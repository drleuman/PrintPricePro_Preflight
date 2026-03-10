const express = require('express');
const router = express.Router();
const queue = require('../services/queue');
const db = require('../services/db');
const auditService = require('../services/auditService');
const requireAdmin = require('../middleware/requireAdmin');

// Enforce admin security
router.use(requireAdmin);

// --- 1.1 Queue Controls ---

router.post('/queue/pause', async (req, res) => {
    try {
        const { queue: queueName, reason } = req.body;
        if (!queueName || !reason) return res.status(400).json({ error: 'queue and reason are required' });

        const type = queueName.toUpperCase() === 'AUTOFIX' ? 'AUTOFIX' : 'PREFLIGHT';
        await queue.pauseQueue(type);

        await auditService.logAction(null, 'ADMIN_QUEUE_PAUSE', {
            ipAddress: req.ip,
            details: { queue: type, reason }
        });
        res.json({ ok: true, queue: type, state: 'paused', paused_at: new Date().toISOString() });
    } catch (err) {
        console.error('[ADMIN-QUEUE-PAUSE-ERROR]', err);
        res.status(500).json({ error: err.message });
    }
});

router.post('/queue/resume', async (req, res) => {
    try {
        const { queue: queueName, reason } = req.body;
        if (!queueName || !reason) return res.status(400).json({ error: 'queue and reason are required' });

        const type = queueName.toUpperCase() === 'AUTOFIX' ? 'AUTOFIX' : 'PREFLIGHT';
        await queue.resumeQueue(type);

        await auditService.logAction(null, 'ADMIN_QUEUE_RESUME', {
            ipAddress: req.ip,
            details: { queue: type, reason }
        });
        res.json({ ok: true, queue: type, state: 'running', resumed_at: new Date().toISOString() });
    } catch (err) {
        console.error('[ADMIN-QUEUE-RESUME-ERROR]', err);
        res.status(500).json({ error: err.message });
    }
});

router.post('/queue/drain', async (req, res) => {
    try {
        const { queue: queueName, includeDelayed, reason } = req.body;
        if (!queueName || !reason) return res.status(400).json({ error: 'queue and reason are required' });

        const type = queueName.toUpperCase() === 'AUTOFIX' ? 'AUTOFIX' : 'PREFLIGHT';
        await queue.drainQueue(type, Boolean(includeDelayed));

        await auditService.logAction(null, 'ADMIN_QUEUE_DRAIN', {
            ipAddress: req.ip,
            details: { queue: type, includeDelayed, reason }
        });
        res.json({ ok: true, queue: type, drained: true });
    } catch (err) {
        console.error('[ADMIN-QUEUE-DRAIN-ERROR]', err);
        res.status(500).json({ error: err.message });
    }
});

router.post('/queue/obliterate', async (req, res) => {
    try {
        const { queue: queueName, force, reason } = req.body;
        if (!queueName || !reason || force !== true) return res.status(400).json({ error: 'queue, reason, and force=true are required' });

        const type = queueName.toUpperCase() === 'AUTOFIX' ? 'AUTOFIX' : 'PREFLIGHT';
        await queue.obliterateQueue(type);

        await auditService.logAction(null, 'ADMIN_QUEUE_OBLITERATE', {
            ipAddress: req.ip,
            details: { queue: type, reason }
        });
        res.json({ ok: true, queue: type, obliterated: true });
    } catch (err) {
        console.error('[ADMIN-QUEUE-OBLITERATE-ERROR]', err);
        res.status(500).json({ error: err.message });
    }
});

router.get('/queue/stats', async (req, res) => {
    try {
        const stats = await queue.getAdminStats();
        res.json({ ok: true, stats });
    } catch (err) {
        console.error('[ADMIN-QUEUE-STATS-ERROR]', err);
        res.status(500).json({ error: err.message });
    }
});

// --- 1.2 Job Controls ---

router.post('/jobs/:id/retry', async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;
        if (!reason) return res.status(400).json({ error: 'reason is required' });

        const result = await db.query('SELECT * FROM jobs WHERE id = ?', [id]);
        const jobRecord = result.rows[0];

        if (!jobRecord) return res.status(404).json({ error: 'Job not found' });
        if (jobRecord.status === 'SUCCEEDED' || jobRecord.status === 'RUNNING') return res.status(400).json({ error: 'Cannot retry a running or successful job' });

        const newJob = await queue.enqueueJob(jobRecord.type, {
            asset_id: jobRecord.asset_id,
            tenant_id: jobRecord.tenant_id,
            policy: jobRecord.requested_profile || 'OFFSET_CMYK_STRICT'
        });

        await db.query(`
            INSERT INTO jobs (id, tenant_id, asset_id, type, status)
            VALUES (?, ?, ?, ?, ?)
        `, [newJob.id, jobRecord.tenant_id, jobRecord.asset_id, jobRecord.type, 'PENDING']);

        await auditService.logAction(jobRecord.tenant_id, 'ADMIN_JOB_RETRY', {
            ipAddress: req.ip,
            jobId: newJob.id,
            details: { old_job_id: id, new_job_id: newJob.id, reason }
        });

        res.json({ ok: true, job_id: id, action: 'retried', new_job_id: newJob.id });
    } catch (err) {
        console.error('[ADMIN-JOB-RETRY-ERROR]', err);
        res.status(500).json({ error: err.message });
    }
});

router.post('/jobs/:id/cancel', async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;
        if (!reason) return res.status(400).json({ error: 'reason is required' });

        const result = await db.query('SELECT status, tenant_id, type FROM jobs WHERE id = ?', [id]);
        if (!result.rows[0]) return res.status(404).json({ error: 'Job not found' });

        const currentStatus = result.rows[0].status;
        const tenantId = result.rows[0].tenant_id;
        const jobType = result.rows[0].type;

        let targetStatus = 'CANCELED';
        let action = 'canceled';

        if (currentStatus === 'RUNNING') {
            targetStatus = 'CANCEL_REQUESTED';
            action = 'cancel_requested';
        } else if (currentStatus === 'CANCELED' || currentStatus === 'CANCEL_REQUESTED' || currentStatus === 'SUCCEEDED' || currentStatus === 'FAILED') {
            return res.status(400).json({ error: `Cannot cancel a job in status ${currentStatus}` });
        }

        // 1. Update DB Status
        await db.query('UPDATE jobs SET status = ?, updated_at = NOW() WHERE id = ?', [targetStatus, id]);

        // 2. Try to remove from BullMQ if it's not running yet
        try {
            const activeQueue = (jobType === 'AUTOFIX') ? queue.autofixQueue : queue.preflightQueue;
            const bJob = await activeQueue.getJob(id);
            if (bJob) {
                const state = await bJob.getState();
                if (state === 'waiting' || state === 'delayed') {
                    await bJob.remove();
                    console.log(`[ADMIN-CANCEL] Job ${id} removed from BullMQ state: ${state}`);
                }
            }
        } catch (queueErr) {
            console.warn(`[ADMIN-CANCEL-QUEUE-WARN] Could not remove job ${id} from BullMQ:`, queueErr.message);
        }

        await auditService.logAction(tenantId, 'ADMIN_JOB_CANCEL', {
            ipAddress: req.ip,
            jobId: id,
            details: { job_id: id, reason, targetStatus }
        });

        res.json({ ok: true, job_id: id, action, status: targetStatus });
    } catch (err) {
        console.error('[ADMIN-JOB-CANCEL-ERROR]', err);
        res.status(500).json({ error: err.message });
    }
});

router.post('/jobs/bulk-cancel', async (req, res) => {
    try {
        const { tenant_id, statuses = ['PENDING', 'QUEUED'], limit = 500, reason } = req.body;
        if (!tenant_id || !reason) return res.status(400).json({ error: 'tenant_id and reason are required' });

        const statusStr = statuses.map(s => `'${s}'`).join(',');

        // Find them first
        const searchResult = await db.query(`SELECT id, status, type FROM jobs WHERE tenant_id = ? AND status IN (${statusStr}) LIMIT ?`, [tenant_id, limit]);

        let canceled = 0;
        let requested = 0;

        for (const row of searchResult.rows) {
            const target = row.status === 'RUNNING' ? 'CANCEL_REQUESTED' : 'CANCELED';
            await db.query('UPDATE jobs SET status = ?, updated_at = NOW() WHERE id = ?', [target, row.id]);

            if (target === 'CANCELED') {
                canceled++;
                // Try BullMQ removal for non-running jobs
                try {
                    const activeQueue = (row.type === 'AUTOFIX') ? queue.autofixQueue : queue.preflightQueue;
                    const bJob = await activeQueue.getJob(row.id);
                    if (bJob) await bJob.remove();
                } catch (e) {
                    console.warn(`[ADMIN-BULK-CANCEL-QUEUE-WARN] Could not remove job ${row.id} from BullMQ:`, e.message);
                }
            } else {
                requested++;
            }
        }

        await auditService.logAction(tenant_id, 'ADMIN_BULK_CANCEL', {
            ipAddress: req.ip,
            details: { reason, limit, canceled, requested }
        });
        res.json({ ok: true, matched: searchResult.rows.length, canceled, requested });
    } catch (err) {
        console.error('[ADMIN-BULK-CANCEL-ERROR]', err);
        res.status(500).json({ error: err.message });
    }
});

// --- 1.3 Tenant Quarantine Controls ---

router.post('/tenants/:tenantId/quarantine/enable', async (req, res) => {
    try {
        const { tenantId } = req.params;
        const { reason, ttl_minutes = 120 } = req.body;
        if (!reason) return res.status(400).json({ error: 'reason is required' });

        // Calculate until
        const until = new Date(Date.now() + ttl_minutes * 60000);
        const untilMySQL = until.toISOString().slice(0, 19).replace('T', ' '); // format for MySQL DATETIME

        await db.query(`
            INSERT INTO tenant_controls (tenant_id, quarantined_until, reason, updated_at) 
            VALUES (?, ?, ?, NOW())
            ON DUPLICATE KEY UPDATE quarantined_until = ?, reason = ?, updated_at = NOW()
        `, [tenantId, untilMySQL, reason, untilMySQL, reason]);

        await auditService.logAction(tenantId, 'ADMIN_TENANT_QUARANTINE_ENABLE', {
            ipAddress: req.ip,
            details: { reason, ttl_minutes, until: until.toISOString() }
        });
        res.json({ ok: true, tenant_id: tenantId, quarantined: true, until: until.toISOString() });
    } catch (err) {
        console.error('[ADMIN-QUARANTINE-ENABLE-ERROR]', err);
        res.status(500).json({ error: err.message });
    }
});

router.post('/tenants/:tenantId/quarantine/disable', async (req, res) => {
    try {
        const { tenantId } = req.params;
        const { reason } = req.body;
        if (!reason) return res.status(400).json({ error: 'reason is required' });

        await db.query('UPDATE tenant_controls SET quarantined_until = NULL, updated_at = NOW() WHERE tenant_id = ?', [tenantId]);

        await auditService.logAction(tenantId, 'ADMIN_TENANT_QUARANTINE_DISABLE', {
            ipAddress: req.ip,
            details: { reason }
        });
        res.json({ ok: true, tenant_id: tenantId, quarantined: false });
    } catch (err) {
        console.error('[ADMIN-QUARANTINE-DISABLE-ERROR]', err);
        res.status(500).json({ error: err.message });
    }
});

router.get('/tenants/quarantine', async (req, res) => {
    try {
        // Find all currently quarantined tenants where quarantined_until > NOW()
        const result = await db.query('SELECT tenant_id, quarantined_until, reason, updated_at FROM tenant_controls WHERE quarantined_until IS NOT NULL AND quarantined_until > NOW() ORDER BY updated_at DESC');

        res.json({ ok: true, items: result.rows });
    } catch (err) {
        console.error('[ADMIN-QUARANTINE-LIST-ERROR]', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
