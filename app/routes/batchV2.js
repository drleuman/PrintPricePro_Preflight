const express = require('express');
const multer = require('multer');
const router = express.Router();
const assetService = require('../services/assetService');
const queue = require('../services/queue');
const db = require('../services/db');
const auditService = require('../services/dependencyChecker');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const MAX_BATCH_BYTES = Number(process.env.PPP_MAX_BATCH_BYTES || 1024 * 1024 * 1024); // 1GB

const upload = multer({
    dest: 'uploads-v2-temp/',
    limits: { fileSize: MAX_BATCH_BYTES }
});

// All routes in this router require Enterprise Authentication (applied in server.js)

// Granular rate limits for Batch v2 (P1)
const rateLimit = require('express-rate-limit');
const v2UploadLimiter = rateLimit({
    windowMs: 60_000,
    max: 5, // Even stricter for batches (ZIPs)
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'V2 Batch: Too many upload requests. Limit is 5 per minute.' }
});
const v2ReadLimiter = rateLimit({
    windowMs: 60_000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'V2 Batch: Too many status requests. Limit is 100 per minute.' }
});

/**
 * POST /api/v2/batches
 * Upload a ZIP of PDFs for batch processing.
 */
router.post('/', v2UploadLimiter, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No ZIP file provided in "file" field.' });
        }

        const mime = req.file.mimetype || '';
        const ext = path.extname(req.file.originalname).toLowerCase();
        if (ext !== '.zip' && !mime.includes('zip')) {
            fs.unlinkSync(req.file.path);
            return res.status(400).json({ error: 'Only ZIP archives are accepted.' });
        }

        const tenantId = req.auth.tenantId;
        const policy = req.body.policy || 'OFFSET_CMYK_STRICT';
        const batchId = 'batch_' + crypto.randomUUID();

        // Store ZIP as a batch asset
        const zipAsset = await assetService.createAsset({
            filename: req.file.originalname,
            filePath: req.file.path,
            tenantId
        });

        // Create the batch row
        await db.query(
            `INSERT INTO batches (id, tenant_id, status, policy_slug, input_asset_id, metadata_json)
             VALUES (?, ?, 'QUEUED', ?, ?, ?)`,
            [batchId, tenantId, policy, zipAsset.id, JSON.stringify(req.body.metadata || {})]
        );

        // Enqueue the batch-orchestrator job
        await queue.enqueueJob('BATCH_ORCHESTRATE', {
            batch_id: batchId,
            zip_asset_id: zipAsset.id,
            tenant_id: tenantId,
            policy
        });

        await auditService.logAction(tenantId, 'BATCH_SUBMITTED', {
            ipAddress: req.ip,
            details: { batch_id: batchId }
        });

        res.status(202).json({
            batch_id: batchId,
            status: 'QUEUED',
            total_jobs: 0,
            created_at: new Date().toISOString(),
            links: { self: `/api/v2/batches/${batchId}` }
        });
    } catch (err) {
        console.error('[BATCH-API][POST]', err);
        res.status(500).json({ error: 'Failed to create batch.' });
    }
});

/**
 * GET /api/v2/batches
 * List batches for the tenant with optional filters.
 */
router.get('/', v2ReadLimiter, async (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit || 20), 100);
        const status = req.query.status || null;

        const where = ['tenant_id = ?'];
        const params = [req.auth.tenantId];
        if (status) { where.push('status = ?'); params.push(status); }

        const { rows } = await db.query(
            `SELECT id, status, policy_slug, total_jobs, completed_jobs, failed_jobs, 
                    value_generated_total, hours_saved_total, created_at, finished_at
             FROM batches WHERE ${where.join(' AND ')} 
             ORDER BY created_at DESC LIMIT ?`,
            [...params, limit]
        );

        res.json({ count: rows.length, batches: rows });
    } catch (err) {
        console.error('[BATCH-API][LIST]', err);
        res.status(500).json({ error: 'Failed to list batches.' });
    }
});

/**
 * GET /api/v2/batches/:id
 * Aggregate status and ROI metrics for a batch.
 */
router.get('/:id', v2ReadLimiter, async (req, res) => {
    try {
        const { rows } = await db.query(
            `SELECT *, 
                (SELECT COUNT(*) FROM jobs WHERE batch_id = ? AND status IN ('QUEUED','RUNNING')) as running_jobs
             FROM batches WHERE id = ? AND tenant_id = ?`,
            [req.params.id, req.params.id, req.auth.tenantId]
        );

        const batch = rows[0];
        if (!batch) return res.status(404).json({ error: 'Batch not found.' });

        res.json({
            batch_id: batch.id,
            status: batch.status,
            policy: batch.policy_slug,
            total_jobs: batch.total_jobs,
            completed_jobs: batch.completed_jobs,
            failed_jobs: batch.failed_jobs,
            canceled_jobs: batch.canceled_jobs,
            running_jobs: Number(batch.running_jobs || 0),
            metrics: {
                risk_score_before_avg: Number(batch.risk_score_before_avg || 0),
                risk_score_after_avg: Number(batch.risk_score_after_avg || 0),
                hours_saved_total: Number(batch.hours_saved_total || 0),
                value_generated_total: Number(batch.value_generated_total || 0)
            },
            created_at: batch.created_at,
            finished_at: batch.finished_at,
            links: {
                jobs: `/api/v2/batches/${batch.id}/jobs`
            }
        });
    } catch (err) {
        console.error('[BATCH-API][GET]', err);
        res.status(500).json({ error: 'Failed to get batch status.' });
    }
});

/**
 * GET /api/v2/batches/:id/jobs
 * List all child jobs of a batch.
 */
router.get('/:id/jobs', v2ReadLimiter, async (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit || 50), 200);
        const { rows: [batchCheck] } = await db.query(
            'SELECT id FROM batches WHERE id = ? AND tenant_id = ?',
            [req.params.id, req.auth.tenantId]
        );
        if (!batchCheck) return res.status(404).json({ error: 'Batch not found.' });

        const { rows } = await db.query(
            `SELECT j.id, j.status, j.progress, j.original_name,
                    m.risk_score_before, m.risk_score_after, m.hours_saved, m.value_generated
             FROM jobs j
             LEFT JOIN metrics m ON j.id = m.job_id
             WHERE j.batch_id = ?
             ORDER BY j.created_at ASC LIMIT ?`,
            [req.params.id, limit]
        );

        res.json({
            batch_id: req.params.id,
            count: rows.length,
            jobs: rows.map(j => ({
                job_id: j.id,
                status: j.status,
                progress: j.progress,
                filename: j.original_name,
                metrics: j.risk_score_before != null ? {
                    risk_score_before: j.risk_score_before,
                    risk_score_after: j.risk_score_after,
                    hours_saved: Number(j.hours_saved || 0),
                    value_generated: Number(j.value_generated || 0)
                } : null,
                links: { self: `/api/v2/jobs/${j.id}` }
            }))
        });
    } catch (err) {
        console.error('[BATCH-API][GET-JOBS]', err);
        res.status(500).json({ error: 'Failed to list batch jobs.' });
    }
});

/**
 * GET /api/v2/batches/:id/download
 * Assembles and streams a ZIP archive containing:
 * - fixed/ : All successfully autofixed PDF files
 * - reports/ : Per-file JSON analysis reports
 * - summary.json : Aggregate batch summary
 * - summary.csv : Tabular CSV for spreadsheet import
 */
router.get('/:id/download', v2ReadLimiter, async (req, res) => {
    try {
        // Verify tenant ownership
        const { rows: [batch] } = await db.query(
            `SELECT * FROM batches WHERE id = ? AND tenant_id = ?`,
            [req.params.id, req.auth.tenantId]
        );
        if (!batch) return res.status(404).json({ error: 'Batch not found.' });

        if (!['SUCCEEDED', 'PARTIAL'].includes(batch.status)) {
            return res.status(409).json({
                error: 'Batch is not yet ready for download.',
                status: batch.status
            });
        }

        // Fetch all completed child jobs with reports and assets
        const { rows: jobs } = await db.query(`
            SELECT j.id as job_id, j.original_name,
                   j.status,
                   r.data as report_data,
                   r.asset_id as fixed_asset_id,
                   m.risk_score_before, m.risk_score_after,
                   m.hours_saved, m.value_generated
            FROM jobs j
            LEFT JOIN reports r ON r.job_id = j.id
            LEFT JOIN metrics m ON m.job_id = j.id
            WHERE j.batch_id = ?
            ORDER BY j.created_at ASC
        `, [req.params.id]);

        const AdmZip = require('adm-zip');
        const outZip = new AdmZip();

        // ---- CSV header ----
        const csvRows = [
            'filename,status,risk_before,risk_after,hours_saved,value_usd,fixed_file'
        ];

        for (const job of jobs) {
            const filename = job.original_name || `${job.job_id}.pdf`;

            // 1. Add per-file JSON report
            if (job.report_data) {
                try {
                    const reportBuf = Buffer.from(
                        typeof job.report_data === 'string'
                            ? job.report_data
                            : JSON.stringify(job.report_data, null, 2)
                    );
                    const reportName = filename.replace(/\.pdf$/i, '') + '_report.json';
                    outZip.addFile(`reports/${reportName}`, reportBuf);
                } catch (_) { /* skip malformed reports */ }
            }

            // 2. Add fixed PDF
            let hasFixedFile = false;
            if (job.status === 'SUCCEEDED' && job.fixed_asset_id) {
                try {
                    const fixedAsset = await assetService.getAsset(job.fixed_asset_id);
                    if (fixedAsset && fs.existsSync(fixedAsset.storage_path)) {
                        const pdfBuf = fs.readFileSync(fixedAsset.storage_path);
                        const fixedName = filename.replace(/\.pdf$/i, '') + '_fixed.pdf';
                        outZip.addFile(`fixed/${fixedName}`, pdfBuf);
                        hasFixedFile = true;
                    }
                } catch (_) { /* continue even if asset missing */ }
            }

            // 3. CSV row
            csvRows.push([
                `"${filename.replace(/"/g, '""')}"`,
                job.status,
                job.risk_score_before ?? '',
                job.risk_score_after ?? '',
                Number(job.hours_saved || 0).toFixed(2),
                Number(job.value_generated || 0).toFixed(2),
                hasFixedFile ? 'yes' : 'no'
            ].join(','));
        }

        // 4. Add summary.json
        const summary = {
            batch_id: batch.id,
            status: batch.status,
            policy: batch.policy_slug,
            total_jobs: Number(batch.total_jobs),
            completed_jobs: Number(batch.completed_jobs),
            failed_jobs: Number(batch.failed_jobs),
            metrics: {
                risk_score_before_avg: Number(batch.risk_score_before_avg || 0),
                risk_score_after_avg: Number(batch.risk_score_after_avg || 0),
                hours_saved_total: Number(batch.hours_saved_total || 0),
                value_generated_total: Number(batch.value_generated_total || 0)
            },
            generated_at: new Date().toISOString()
        };
        outZip.addFile('summary.json', Buffer.from(JSON.stringify(summary, null, 2)));

        // 5. Add CSV
        outZip.addFile('summary.csv', Buffer.from(csvRows.join('\n')));

        // 6. Stream ZIP
        const zipBuffer = outZip.toBuffer();
        const outputName = `batch_${req.params.id}_output.zip`;

        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="${outputName}"`);
        res.setHeader('Content-Length', zipBuffer.length);
        res.send(zipBuffer);

    } catch (err) {
        console.error('[BATCH-API][DOWNLOAD]', err);
        res.status(500).json({ error: 'Failed to assemble batch output.' });
    }
});

module.exports = router;






















