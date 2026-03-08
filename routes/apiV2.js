const express = require('express');
const multer = require('multer');
const router = express.Router();
const v2Auth = require('../middleware/v2AuthMiddleware');
const assetService = require('../services/assetService');
const queue = require('../services/queue');
const db = require('../services/db');
const auditService = require('../services/auditService');
const routingService = require('../services/routingService');

const MAX_UPLOAD_BYTES = Number(process.env.PPP_MAX_UPLOAD_BYTES || 500 * 1024 * 1024);
const upload = multer({
    dest: 'uploads-v2-temp/',
    limits: { fileSize: MAX_UPLOAD_BYTES }
});

// All routes in this router require v2 API Authentication
router.use(v2Auth);

// Granular rate limits for Public v2 (P1)
const rateLimit = require('express-rate-limit');
const v2UploadLimiter = rateLimit({
    windowMs: 60_000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'V2 Engine: Too many upload requests. Limit is 10 per minute.' }
});
const v2ReadLimiter = rateLimit({
    windowMs: 60_000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'V2 Engine: Too many status requests. Limit is 100 per minute.' }
});

/**
 * POST /api/v2/jobs
 * Standardized entry for external systems.
 */
router.post('/', v2UploadLimiter, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No PDF file provided in "file" field.' });
        }

        const tenantId = req.tenant.id;
        const policy = req.body.policy || 'OFFSET_CMYK_STRICT';

        // 1. Create Asset
        const asset = await assetService.createAsset({
            filename: req.file.originalname,
            filePath: req.file.path,
            tenantId
        });

        // 2. Enqueue AUTOFIX (v2 Public API defaults to full Autofix pipeline for maximum ROI)
        const job = await queue.enqueueJob('AUTOFIX', {
            asset_id: asset.id,
            tenant_id: tenantId,
            policy: policy
        });

        // 3. Persist Job
        await db.query(`
            INSERT INTO jobs (id, tenant_id, asset_id, type, status)
            VALUES (?, ?, ?, ?, ?)
        `, [job.id, tenantId, asset.id, 'AUTOFIX', 'QUEUED']);

        // 4. Audit
        await auditService.logAction(tenantId, 'API_JOB_SUBMITTED', {
            ipAddress: req.ip,
            details: { job_id: job.id, asset_id: asset.id, policy }
        });

        res.status(202).json({
            job_id: job.id,
            status: 'QUEUED',
            created_at: new Date().toISOString(),
            links: {
                self: `/api/v2/jobs/${job.id}`,
                asset: `/api/assets/${asset.id}`
            }
        });
    } catch (err) {
        console.error('[API-V2-JOBS-POST]', err);
        res.status(500).json({ error: 'Internal server error while creating job.' });
    }
});

/**
 * GET /api/v2/jobs/:id
 * Detailed job status, including ROI metrics if completed.
 */
router.get('/:id', v2ReadLimiter, async (req, res) => {
    try {
        const { rows } = await db.query(`
            SELECT j.*, m.risk_score_before, m.risk_score_after, m.hours_saved, m.value_generated, r.asset_id as fixed_asset_id
            FROM jobs j
            LEFT JOIN metrics m ON j.id = m.job_id
            LEFT JOIN reports r ON j.id = r.job_id
            WHERE j.id = ? AND j.tenant_id = ?
        `, [req.params.id, req.tenant.id]);

        const job = rows[0];
        if (!job) return res.status(404).json({ error: 'Job not found for this tenant.' });

        const response = {
            job_id: job.id,
            status: job.status,
            progress: job.progress,
            type: job.type,
            created_at: job.created_at,
            updated_at: job.updated_at,
            error: job.error ? JSON.parse(job.error) : null,
            metrics: job.status === 'SUCCEEDED' ? {
                risk_score_before: job.risk_score_before,
                risk_score_after: job.risk_score_after,
                hours_saved: Number(job.hours_saved || 0),
                value_generated: Number(job.value_generated || 0)
            } : null,
            links: {}
        };

        if (job.status === 'SUCCEEDED' && job.fixed_asset_id) {
            response.links.download_url = auditService.generateSignedUrl(job.fixed_asset_id, 3600);
            response.links.report_url = `/api/reports/${job.id}`; // Optional: direct report link
        }

        res.json(response);
    } catch (err) {
        console.error('[API-V2-JOBS-GET]', err);
        res.status(500).json({ error: 'Internal server error while fetching job.' });
    }
});

/**
 * GET /api/v2/jobs
 * List recent jobs for the tenant.
 */
router.get('/', v2ReadLimiter, async (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit || 20), 100);
        const { rows } = await db.query(`
            SELECT id, status, type, created_at
            FROM jobs
            WHERE tenant_id = ?
            ORDER BY created_at DESC
            LIMIT ?
        `, [req.tenant.id, limit]);

        res.json({
            count: rows.length,
            jobs: rows.map(r => ({
                job_id: r.id,
                status: r.status,
                type: r.type,
                created_at: r.created_at,
                links: { self: `/api/v2/jobs/${r.id}` }
            }))
        });
    } catch (err) {
        console.error('[API-V2-JOBS-LIST]', err);
        res.status(500).json({ error: 'Internal server error while listing jobs.' });
    }
});

/**
 * POST /api/v2/jobs/:id/routing
 * Get routing recommendations for a specific job.
 */
router.post('/:id/routing', v2ReadLimiter, async (req, res) => {
    try {
        const jobId = req.params.id;
        const tenantId = req.tenant.id;
        const { paper_id, policy_id } = req.body;

        // Verify job ownership
        const { rows } = await db.query('SELECT id FROM jobs WHERE id = ? AND tenant_id = ?', [jobId, tenantId]);
        if (rows.length === 0) return res.status(404).json({ error: 'Job not found.' });

        const recommendation = await routingService.recommendRoute(jobId, {
            paperId: paper_id,
            policyId: policy_id
        });

        // Audit
        await auditService.logAction(tenantId, 'ROUTING_RECOMMENDATION_REQUESTED', {
            ipAddress: req.ip,
            details: { job_id: jobId, paper_id, policy_id }
        });

        res.json(recommendation);
    } catch (err) {
        console.error('[API-V2-ROUTING-POST]', err);
        res.status(500).json({ error: err.message || 'Internal server error while fetching routing' });
    }
});

module.exports = router;
