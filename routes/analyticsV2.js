const express = require('express');
const router = express.Router();
const v2Auth = require('../middleware/v2AuthMiddleware');
const db = require('../services/db');

router.use(v2Auth);

// ---- Helpers ----
function intervalFor(range) {
    switch (range) {
        case '7d': return 'INTERVAL 7 DAY';
        case '90d': return 'INTERVAL 90 DAY';
        case '30d':
        default: return 'INTERVAL 30 DAY';
    }
}

/**
 * GET /api/v2/analytics/summary
 * Executive summary for the authenticated tenant.
 */
router.get('/summary', async (req, res) => {
    try {
        const tenantId = req.tenant.id;
        const interval = intervalFor(req.query.range);

        const [jobs, batches] = await Promise.all([
            db.query(`
                SELECT
                    COUNT(j.id) as total_jobs,
                    (SUM(CASE WHEN j.status = 'SUCCEEDED' THEN 1 ELSE 0 END) / NULLIF(COUNT(j.id),0)) * 100 as success_rate,
                    SUM(m.hours_saved) as hours_saved_total,
                    SUM(m.value_generated) as value_generated_total,
                    AVG(m.risk_score_before) as avg_risk_before,
                    AVG(m.risk_score_after) as avg_risk_after
                FROM jobs j
                LEFT JOIN metrics m ON m.job_id = j.id
                WHERE j.tenant_id = ? AND j.created_at >= NOW() - ${interval}
            `, [tenantId]),
            db.query(`
                SELECT
                    COUNT(*) as total_batches,
                    SUM(hours_saved_total) as batch_hours_saved,
                    SUM(value_generated_total) as batch_value
                FROM batches
                WHERE tenant_id = ? AND created_at >= NOW() - ${interval}
            `, [tenantId])
        ]);

        const j = jobs.rows[0] || {};
        const b = batches.rows[0] || {};
        const riskBefore = Number(j.avg_risk_before || 0);
        const riskAfter = Number(j.avg_risk_after || 0);

        res.json({
            tenant_id: tenantId,
            range: req.query.range || '30d',
            total_jobs: Number(j.total_jobs || 0),
            total_batches: Number(b.total_batches || 0),
            success_rate: Math.round(Number(j.success_rate || 0) * 10) / 10,
            hours_saved_total: Number(j.hours_saved_total || 0) + Number(b.batch_hours_saved || 0),
            value_generated_total: Number(j.value_generated_total || 0) + Number(b.batch_value || 0),
            avg_risk_score_before: Math.round(riskBefore),
            avg_risk_score_after: Math.round(riskAfter),
            avg_risk_reduction: Math.round(riskBefore - riskAfter)
        });
    } catch (err) {
        console.error('[ANALYTICS-SUMMARY]', err);
        res.status(500).json({ error: 'Failed to load summary.' });
    }
});

/**
 * GET /api/v2/analytics/timeseries?range=30d
 * Daily activity timeseries for the tenant.
 */
router.get('/timeseries', async (req, res) => {
    try {
        const tenantId = req.tenant.id;
        const interval = intervalFor(req.query.range);

        const { rows } = await db.query(`
            SELECT
                DATE(j.created_at) as date,
                COUNT(j.id) as jobs,
                SUM(CASE WHEN j.batch_id IS NOT NULL THEN 0 ELSE 0 END) as batches,
                COALESCE(SUM(m.hours_saved), 0) as hours_saved,
                COALESCE(SUM(m.value_generated), 0) as value_generated,
                COALESCE(AVG(m.risk_score_before) - AVG(m.risk_score_after), 0) as avg_risk_reduction
            FROM jobs j
            LEFT JOIN metrics m ON m.job_id = j.id
            WHERE j.tenant_id = ? AND j.created_at >= NOW() - ${interval}
            GROUP BY DATE(j.created_at)
            ORDER BY date ASC
        `, [tenantId]);

        res.json({
            range: req.query.range || '30d',
            data: rows.map(r => ({
                date: r.date,
                jobs: Number(r.jobs),
                hours_saved: Number(r.hours_saved),
                value_generated: Number(r.value_generated),
                avg_risk_reduction: Math.round(Number(r.avg_risk_reduction))
            }))
        });
    } catch (err) {
        console.error('[ANALYTICS-TIMESERIES]', err);
        res.status(500).json({ error: 'Failed to load timeseries.' });
    }
});

/**
 * GET /api/v2/analytics/policies?range=30d
 * Policy performance breakdown.
 */
router.get('/policies', async (req, res) => {
    try {
        const tenantId = req.tenant.id;
        const interval = intervalFor(req.query.range);

        const { rows } = await db.query(`
            SELECT
                m.policy_slug,
                COUNT(m.id) as jobs,
                SUM(m.hours_saved) as hours_saved,
                SUM(m.value_generated) as value_generated,
                AVG(m.risk_score_before - m.risk_score_after) as avg_risk_reduction,
                (SUM(CASE WHEN m.success = 1 THEN 1 ELSE 0 END) / NULLIF(COUNT(m.id),0)) * 100 as success_rate
            FROM metrics m
            WHERE m.tenant_id = ? AND m.created_at >= NOW() - ${interval}
            GROUP BY m.policy_slug
            ORDER BY value_generated DESC
        `, [tenantId]);

        res.json({
            range: req.query.range || '30d',
            policies: rows.map(r => ({
                policy_slug: r.policy_slug,
                jobs: Number(r.jobs),
                hours_saved: Number(r.hours_saved || 0),
                value_generated: Number(r.value_generated || 0),
                avg_risk_reduction: Math.round(Number(r.avg_risk_reduction || 0)),
                success_rate: Math.round(Number(r.success_rate || 0) * 10) / 10
            }))
        });
    } catch (err) {
        console.error('[ANALYTICS-POLICIES]', err);
        res.status(500).json({ error: 'Failed to load policy analytics.' });
    }
});

/**
 * GET /api/v2/analytics/errors?range=30d
 * Top error codes for the tenant.
 */
router.get('/errors', async (req, res) => {
    try {
        const tenantId = req.tenant.id;
        const interval = intervalFor(req.query.range);

        const { rows } = await db.query(`
            SELECT
                JSON_UNQUOTE(JSON_EXTRACT(j.error, '$.message')) as error_message,
                COUNT(*) as count,
                MAX(j.updated_at) as last_seen
            FROM jobs j
            WHERE j.tenant_id = ?
              AND j.status = 'FAILED'
              AND j.error IS NOT NULL
              AND j.created_at >= NOW() - ${interval}
            GROUP BY JSON_EXTRACT(j.error, '$.message')
            ORDER BY count DESC
            LIMIT 20
        `, [tenantId]);

        res.json({
            range: req.query.range || '30d',
            errors: rows.map(r => ({
                error_message: r.error_message || 'Unknown error',
                count: Number(r.count),
                last_seen: r.last_seen
            }))
        });
    } catch (err) {
        console.error('[ANALYTICS-ERRORS]', err);
        res.status(500).json({ error: 'Failed to load error analytics.' });
    }
});

/**
 * GET /api/v2/analytics/batches?range=30d
 * Batch history with ROI summary.
 */
router.get('/batches', async (req, res) => {
    try {
        const tenantId = req.tenant.id;
        const interval = intervalFor(req.query.range);
        const limit = Math.min(parseInt(req.query.limit || 20), 100);

        const { rows } = await db.query(`
            SELECT
                id, status, policy_slug,
                total_jobs, completed_jobs, failed_jobs,
                hours_saved_total, value_generated_total,
                risk_score_before_avg, risk_score_after_avg,
                created_at, finished_at
            FROM batches
            WHERE tenant_id = ? AND created_at >= NOW() - ${interval}
            ORDER BY created_at DESC
            LIMIT ?
        `, [tenantId, limit]);

        res.json({
            range: req.query.range || '30d',
            batches: rows.map(r => ({
                batch_id: r.id,
                status: r.status,
                policy: r.policy_slug,
                total_jobs: Number(r.total_jobs || 0),
                completed_jobs: Number(r.completed_jobs || 0),
                failed_jobs: Number(r.failed_jobs || 0),
                hours_saved_total: Number(r.hours_saved_total || 0),
                value_generated_total: Number(r.value_generated_total || 0),
                risk_reduction: Math.round(Number(r.risk_score_before_avg || 0) - Number(r.risk_score_after_avg || 0)),
                created_at: r.created_at,
                finished_at: r.finished_at,
                links: { download: `/api/v2/batches/${r.id}/download` }
            }))
        });
    } catch (err) {
        console.error('[ANALYTICS-BATCHES]', err);
        res.status(500).json({ error: 'Failed to load batch analytics.' });
    }
});

module.exports = router;
