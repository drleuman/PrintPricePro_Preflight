const express = require('express');
const router = express.Router();
const db = require('../services/db');

/**
 * GET /api/admin/routing/economic/overview
 * High-level economic performance metrics.
 */
router.get('/overview', async (req, res) => {
    try {
        const { rows } = await db.query(`
            SELECT 
                AVG(margin_pct) as avg_margin_pct,
                COUNT(*) as total_quotes,
                SUM(CASE WHEN margin_pct < 0 THEN 1 ELSE 0 END) as negative_margin_count,
                SUM(CASE WHEN margin_pct < 20 THEN 1 ELSE 0 END) as low_margin_count
            FROM job_quotes
        `);

        const { rows: auditRows } = await db.query(`
            SELECT AVG(JSON_EXTRACT(final_decision_json, '$.final_routing_score')) as avg_final_score
            FROM economic_routing_audit
        `);

        res.json({
            metrics: rows[0],
            avg_final_score: auditRows[0].avg_final_score || 0
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/admin/routing/economic/history
 * Recent economic routing decisions.
 */
router.get('/history', async (req, res) => {
    try {
        const { rows } = await db.query(`
            SELECT era.*, j.original_name as job_name
            FROM economic_routing_audit era
            JOIN jobs j ON era.job_id = j.id
            ORDER BY era.created_at DESC
            LIMIT 50
        `);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/admin/routing/economic/conflicts
 * Audit trail for economic anomalies.
 */
router.get('/conflicts', async (req, res) => {
    try {
        const { rows } = await db.query(`
            SELECT erc.*, j.original_name as job_name, p.name as printer_name
            FROM economic_routing_conflicts erc
            JOIN jobs j ON erc.job_id = j.id
            LEFT JOIN printer_nodes p ON erc.printer_id = p.id
            ORDER BY erc.created_at DESC
            LIMIT 50
        `);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
