/**
 * @project PrintPrice Pro - Preflight V2 API Routes
 * @author Manuel Enrique Morales (https://manuelenriquemorales.com/)
 * @social https://x.com/manuel_emorales | https://www.linkedin.com/in/manuelenriquemorales/
 */
const express = require('express');
const multer = require('multer');
const router = express.Router();
const assetService = require('../services/assetService');
const queue = require('../services/queue');
const db = require('../services/db');

// Multer setup for temporary storage before moving to V2 Assets
const MAX_UPLOAD_BYTES = Number(process.env.PPP_MAX_UPLOAD_BYTES || 250 * 1024 * 1024);
const upload = multer({
    dest: 'uploads-v2-temp/',
    limits: { fileSize: MAX_UPLOAD_BYTES }
});

/**
 * Endpoint: POST /api/preflight/analyze
 * Uploads a PDF, creates an asset, and enqueues a PREFLIGHT job.
 */
router.post('/analyze', upload.single('pdf'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No PDF file uploaded' });
        }

        const tenantId = req.auth.tenantId;

        let sharedInfra;
        try {
            sharedInfra = require('@ppos/shared-infra');
        } catch (e) {
            console.warn('[V2-ANALYZE] @ppos/shared-infra not found in node_modules, falling back to local workspace...');
            sharedInfra = require('../../workspace/PrintPriceOS_Workspace/ppos-shared-infra');
        }
        
        const { policyEnforcementService, resourceGovernanceService } = sharedInfra;
        
        const governanceContext = {
            tenantId,
            queueName: 'PREFLIGHT_PRIMARY',
            serviceName: 'preflight-api-v2',
            jobType: 'PREFLIGHT',
            operation: 'enqueue'
        };

        const decision = await policyEnforcementService.evaluate(governanceContext);

        if (!decision.allowed) {
            return res.status(403).json({ 
                error: 'Operation blocked by Platform Governance', 
                reason: decision.reason,
                code: 'GOVERNANCE_BLOCK'
            });
        }

        // 2nd Gate: Resource Governance (Phase 20.C.1)
        const resourceDecision = await resourceGovernanceService.evaluateRequest(governanceContext);
        
        if (!resourceDecision.allowed) {
            return res.status(429).json({
                error: 'Resource quota exceeded',
                code: 'RESOURCE_LIMIT_REACHED',
                decision: resourceDecision.decision,
                reason: resourceDecision.reason,
                usage: resourceDecision.currentUsage,
                limits: resourceDecision.effectiveLimits
            });
        }

        const asset = await assetService.createAsset({
            filename: req.file.originalname,
            filePath: req.file.path,
            tenantId
        });

        let enqueueReserved = false;
        let job = null;

        try {
            await resourceGovernanceService.reserveEnqueue(tenantId, governanceContext.queueName);
            enqueueReserved = true;

            // Add PREFLIGHT job to queue
            job = await queue.enqueueJob('PREFLIGHT', {
                asset_id: asset.id,
                tenant_id: tenantId,
                policy: req.body.policy || 'OFFSET_CMYK_STRICT',
                governance: {
                    ...governanceContext,
                    enqueuedAt: new Date().toISOString()
                }
            });
        } catch (err) {
            if (enqueueReserved) {
                await resourceGovernanceService.rollbackEnqueue(tenantId, governanceContext.queueName).catch(() => {});
            }
            throw err;
        }

        // Insert job record into Postgres/MySQL
        await db.query(`
            INSERT INTO jobs (id, tenant_id, asset_id, type, status)
            VALUES (?, ?, ?, ?, ?)
        `, [job.id, tenantId, asset.id, 'PREFLIGHT', 'QUEUED']);

        res.status(202).json({
            asset_id: asset.id,
            job_id: job.id,
            status: 'QUEUED'
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
        const { asset_id, policy } = req.body;
        const tenant_id = req.auth.tenantId;
        if (!asset_id) {
            return res.status(400).json({ error: 'Missing asset_id' });
        }

        const asset = await assetService.getAsset(asset_id, tenant_id);
        if (!asset) {
            return res.status(404).json({ error: 'Asset not found' });
        }

        const tId = tenant_id || asset.tenant_id;

        // Phase 19.C.2 Enforcement (Enqueue Logic)
        const { policyEnforcementService, resourceGovernanceService } = require('@ppos/shared-infra');
        const governanceContext = {
            tenantId: tId,
            queueName: 'PREFLIGHT_PRIMARY',
            serviceName: 'preflight-api-v2',
            jobType: 'AUTOFIX',
            operation: 'enqueue'
        };

        const decision = await policyEnforcementService.evaluate(governanceContext);

        if (!decision.allowed) {
            return res.status(403).json({ 
                error: 'Operation blocked by Platform Governance', 
                reason: decision.reason,
                code: 'GOVERNANCE_BLOCK'
            });
        }

        // 2nd Gate: Resource Governance (Phase 20.C.1)
        const resourceDecision = await resourceGovernanceService.evaluateRequest(governanceContext);

        if (!resourceDecision.allowed) {
            return res.status(429).json({
                error: 'Resource quota exceeded',
                code: 'RESOURCE_LIMIT_REACHED',
                decision: resourceDecision.decision,
                reason: resourceDecision.reason,
                usage: resourceDecision.currentUsage,
                limits: resourceDecision.effectiveLimits
            });
        }

        let enqueueReserved = false;
        let job = null;

        try {
            await resourceGovernanceService.reserveEnqueue(tId, governanceContext.queueName);
            enqueueReserved = true;

            const job = await queue.enqueueJob('AUTOFIX', {
                asset_id,
                tenant_id: tId,
                policy: policy || 'OFFSET_CMYK_STRICT',
                governance: {
                    ...governanceContext,
                    enqueuedAt: new Date().toISOString()
                }
            });
        } catch (err) {
            if (enqueueReserved) {
                await resourceGovernanceService.rollbackEnqueue(tId, governanceContext.queueName).catch(() => {});
            }
            throw err;
        }

        await db.query(`
            INSERT INTO jobs (id, tenant_id, asset_id, type, status)
            VALUES (?, ?, ?, ?, ?)
        `, [job.id, tenant_id || asset.tenant_id, asset_id, 'AUTOFIX', 'QUEUED']);

        res.status(202).json({
            job_id: job.id,
            status: 'QUEUED'
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
        const result = await db.query('SELECT * FROM jobs WHERE id = ? AND tenant_id = ?', [req.params.id, req.auth.tenantId]);
        const jobRecord = result.rows[0];

        if (!jobRecord) {
            return res.status(404).json({ error: 'Job not found' });
        }

        // Optional: Cross-check with BullMQ if status is PENDING/PROCESSING
        // For simplicity, we trust the DB record which workers will update.

        // If completed, find the report
        let report = null;
        let delta = null;
        let downloadUrl = null;
        if (jobRecord.status === 'SUCCEEDED') {
            const reportResult = await db.query('SELECT asset_id, data, delta FROM reports WHERE job_id = ?', [jobRecord.id]);
            if (reportResult.rows[0]) {
                report = reportResult.rows[0].data;
                delta = reportResult.rows[0].delta;

                const auditService = require('../services/dependencyChecker');
                const fixedAssetId = reportResult.rows[0].asset_id;
                downloadUrl = auditService.generateSignedUrl(fixedAssetId, 3600); // 1 hour expiry
            }
        }

        res.json({
            job_id: jobRecord.id,
            status: jobRecord.status,
            progress: jobRecord.progress,
            error: jobRecord.error,
            report: report,
            delta: delta,
            download_url: downloadUrl
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
        const auditService = require('../services/dependencyChecker');
        const { expires, sig } = req.query;

        if (expires && sig) {
            if (!auditService.verifySignedUrl(req.params.id, expires, sig)) {
                return res.status(403).json({ error: 'Invalid or expired secure download link' });
            }
        } else        // SECURITY: Mandatory Signed URLs for all downloads
            if (!expires || !sig || !auditService.verifySignedUrl(req.params.id, expires, sig)) {
                console.warn(`[SECURITY][DOWNLOAD] Unsigned or invalid request for asset ${req.params.id} from ${req.ip}`);
                return res.status(403).json({ error: 'Access Denied: Signature Required' });
            }
        const asset = await assetService.getAsset(req.params.id, req.auth.tenantId);
        if (!asset) {
            return res.status(404).json({ error: 'Asset not found' });
        }

        await auditService.logAction(asset.tenant_id, 'DOWNLOAD_SECURE_ASSET', {
            ipAddress: req.ip,
            details: { asset_id: asset.id }
        });

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
// const { listPolicies, loadPolicy } = require('../../workspace/PrintPriceOS_Workspace/ppos-governance-assurance/src/policyEngine');
const listPolicies = () => []; const loadPolicy = () => null;

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
        const tenantId = req.auth.tenantId;
        const { rows } = await db.query(
            'SELECT daily_job_limit FROM tenants WHERE id = ?',
            [tenantId]
        );
        const quota = rows[0];
        const dailyLimit = quota ? quota.daily_job_limit : 1000;
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























