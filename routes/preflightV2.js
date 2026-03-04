const express = require('express');
const multer = require('multer');
const router = express.Router();
const assetService = require('../services/assetService');
const queue = require('../services/queue');
const db = require('../services/db');

// Multer setup for temporary storage before moving to V2 Assets
const upload = multer({ dest: 'uploads-v2-temp/' });

/**
 * Endpoint: POST /api/preflight/analyze
 * Uploads a PDF, creates an asset, and enqueues a PREFLIGHT job.
 */
router.post('/analyze', upload.single('pdf'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No PDF file uploaded' });
        }

        const tenantId = req.body.tenant_id || 'default';
        const asset = await assetService.createAsset({
            filename: req.file.originalname,
            filePath: req.file.path,
            tenantId
        });

        // Add PREFLIGHT job to queue
        const job = await queue.enqueueJob('PREFLIGHT', {
            asset_id: asset.id,
            tenant_id: tenantId,
            policy: req.body.policy || 'OFFSET_CMYK_STRICT'
        });

        // Insert job record into Postgres
        await db.query(`
            INSERT INTO jobs (id, tenant_id, asset_id, type, status)
            VALUES ($1, $2, $3, $4, $5)
        `, [job.id, tenantId, asset.id, 'PREFLIGHT', 'PENDING']);

        res.status(202).json({
            asset_id: asset.id,
            job_id: job.id,
            status: 'queued'
        });
    } catch (err) {
        console.error('[V2-ANALYZE-ERROR]', err);
        res.status(500).json({ error: 'Failed to start analysis', details: err.message });
    }
});

/**
 * Endpoint: POST /api/preflight/autofix
 * Enqueues an AUTOFIX job for an existing asset.
 */
router.post('/autofix', async (req, res) => {
    try {
        const { asset_id, tenant_id, policy } = req.body;
        if (!asset_id) {
            return res.status(400).json({ error: 'Missing asset_id' });
        }

        const asset = await assetService.getAsset(asset_id);
        if (!asset) {
            return res.status(404).json({ error: 'Asset not found' });
        }

        const job = await queue.enqueueJob('AUTOFIX', {
            asset_id,
            tenant_id: tenant_id || asset.tenant_id,
            policy: policy || 'OFFSET_CMYK_STRICT'
        });

        await db.query(`
            INSERT INTO jobs (id, tenant_id, asset_id, type, status)
            VALUES ($1, $2, $3, $4, $5)
        `, [job.id, tenant_id || asset.tenant_id, asset_id, 'AUTOFIX', 'PENDING']);

        res.status(202).json({
            job_id: job.id,
            status: 'queued'
        });
    } catch (err) {
        console.error('[V2-AUTOFIX-ERROR]', err);
        res.status(500).json({ error: 'Failed to start autofix', details: err.message });
    }
});

/**
 * Endpoint: GET /api/jobs/:id
 * Polls the status of a specific job.
 */
router.get('/jobs/:id', async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM jobs WHERE id = $1', [req.params.id]);
        const jobRecord = result.rows[0];

        if (!jobRecord) {
            return res.status(404).json({ error: 'Job not found' });
        }

        // Optional: Cross-check with BullMQ if status is PENDING/PROCESSING
        // For simplicity, we trust the DB record which workers will update.

        // If completed, find the report
        let report = null;
        let delta = null;
        if (jobRecord.status === 'COMPLETED') {
            const reportResult = await db.query('SELECT data, delta FROM reports WHERE job_id = $1', [jobRecord.id]);
            if (reportResult.rows[0]) {
                report = reportResult.rows[0].data;
                delta = reportResult.rows[0].delta;
            }
        }

        res.json({
            job_id: jobRecord.id,
            status: jobRecord.status,
            progress: jobRecord.progress,
            error: jobRecord.error,
            report: report,
            delta: delta
        });
    } catch (err) {
        console.error('[V2-JOB-STATUS-ERROR]', err);
        res.status(500).json({ error: 'Failed to fetch job status' });
    }
});

/**
 * Endpoint: GET /api/assets/:id
 * Downloads the binary PDF for an asset.
 */
router.get('/assets/:id', async (req, res) => {
    try {
        const asset = await assetService.getAsset(req.params.id);
        if (!asset) {
            return res.status(404).json({ error: 'Asset not found' });
        }

        res.download(asset.storage_path, asset.filename);
    } catch (err) {
        console.error('[V2-ASSET-DOWNLOAD-ERROR]', err);
        res.status(500).json({ error: 'Failed to download asset' });
    }
});

/**
 * Endpoint: GET /api/v2/preflight/policies
 * Returns all available print policies.
 */
const { listPolicies, loadPolicy } = require('../services/policyEngine');

router.get('/policies', (req, res) => {
    const policies = listPolicies();
    res.json({ ok: true, policies });
});

router.get('/policies/:slug', (req, res) => {
    const policy = loadPolicy(req.params.slug);
    if (!policy) return res.status(404).json({ ok: false, error: 'Policy not found' });
    res.json({ ok: true, policy });
});

/**
 * Endpoint: GET /api/v2/metrics/summary
 * Returns aggregated North Star Metrics (success rate, avg processing time, total processing time).
 */
router.get('/metrics/summary', async (req, res) => {
    try {
        const result = await db.query(`
            SELECT 
                COUNT(*) as total_jobs,
                SUM(CASE WHEN success THEN 1 ELSE 0 END) as successful_jobs,
                AVG(processing_ms) as avg_processing_ms,
                SUM(processing_ms) as total_processing_ms,
                SUM(file_size_bytes) as total_bytes_processed,
                SUM(page_count) as total_pages_processed,
                SUM(delta_score) as total_issues_fixed,
                policy_slug
            FROM metrics
            GROUP BY policy_slug
        `);

        const summary = {
            total_jobs: 0,
            successful_jobs: 0,
            avg_processing_ms: 0,
            total_processing_ms: 0,
            total_bytes_processed: 0,
            total_pages_processed: 0,
            total_issues_fixed: 0,
            by_policy: {}
        };

        result.rows.forEach(row => {
            const count = parseInt(row.total_jobs);
            summary.total_jobs += count;
            summary.successful_jobs += parseInt(row.successful_jobs);
            summary.total_processing_ms += parseInt(row.total_processing_ms || 0);
            summary.total_bytes_processed += parseInt(row.total_bytes_processed || 0);
            summary.total_pages_processed += parseInt(row.total_pages_processed || 0);
            summary.total_issues_fixed += parseInt(row.total_issues_fixed || 0);

            summary.by_policy[row.policy_slug] = {
                total_jobs: count,
                successful_jobs: parseInt(row.successful_jobs),
                avg_processing_ms: Math.round(Number(row.avg_processing_ms)),
                total_pages_processed: parseInt(row.total_pages_processed || 0)
            };
        });

        if (summary.total_jobs > 0) {
            summary.avg_processing_ms = Math.round(summary.total_processing_ms / summary.total_jobs);
            summary.success_rate_pct = Math.round((summary.successful_jobs / summary.total_jobs) * 100 * 10) / 10;
        }

        // Estimated compute cost: assume $0.05 per hour of compute
        const hoursOfCompute = summary.total_processing_ms / (1000 * 60 * 60);
        summary.estimated_compute_cost_usd = Math.round(hoursOfCompute * 0.05 * 10000) / 10000;

        res.json({ ok: true, metrics: summary });
    } catch (err) {
        console.error('[METRICS-ERROR]', err);
        res.status(500).json({ ok: false, error: 'Failed to fetch metrics' });
    }
});

module.exports = router;
