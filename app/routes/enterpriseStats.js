/**
 * Enterprise Observability Router
 * Part of Phase 4: Admin Observability (Per-Tenant)
 */
const express = require('express');
const router = express.Router();
const db = require('../services/tenant-db');
const QuotaEngine = require('../services/QuotaEngine');

/**
 * GET /api/v2/enterprise/stats
 * Returns operational metrics for the current active tenant.
 */
router.get('/stats', async (req, res) => {
    const tenantId = req.auth.tenantId;
    
    try {
        const { rows: jobs } = await db.tenantQuery(`
            SELECT 
                current_stage, 
                COUNT(*) as count 
            FROM jobs 
            WHERE tenant_id = ? 
            GROUP BY current_stage
        `, [tenantId]);

        const { rows: alerts } = await db.tenantQuery(`
            SELECT 
                alerts_state_json 
            FROM tenants 
            WHERE id = ?
        `, [tenantId]);

        const quota = await QuotaEngine.checkJobQuota(tenantId, req.auth.daily_job_limit || 1000);

        res.json({
            tenant: {
                id: tenantId,
                name: req.auth.tenantName || 'Tenant',
                plan: req.auth.plan
            },
            operational: {
                jobs_by_stage: jobs,
                active_alerts: alerts[0]?.alerts_state_json || {},
                current_quota: quota
            },
            timestamp: new Date().toISOString()
        });
    } catch (err) {
        console.error('[ENT-STATS] Fetch error:', err.message);
        res.status(500).json({ error: 'INTERNAL_STATS_ERROR', message: 'Could not fetch enterprise metrics.' });
    }
});

module.exports = router;
