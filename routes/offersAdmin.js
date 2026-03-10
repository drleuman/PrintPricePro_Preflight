const express = require('express');
const router = express.Router();
const db = require('../services/db');

/**
 * GET /api/admin/offers
 */
router.get('/', async (req, res) => {
    try {
        const { rows } = await db.query(`
            SELECT po.*, j.original_name as job_name, p.name as printer_name
            FROM production_offers po
            JOIN jobs j ON po.job_id = j.id
            JOIN printer_nodes p ON po.printer_id = p.id
            ORDER BY po.created_at DESC
            LIMIT 50
        `);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/admin/offers/metrics
 */
router.get('/metrics', async (req, res) => {
    try {
        const { rows } = await db.query(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN offer_status = 'ACCEPTED' THEN 1 ELSE 0 END) as accepted,
                SUM(CASE WHEN offer_status = 'REJECTED' THEN 1 ELSE 0 END) as rejected,
                SUM(CASE WHEN offer_status = 'EXPIRED' THEN 1 ELSE 0 END) as expired,
                AVG(CASE WHEN offer_status = 'ACCEPTED' THEN TIMESTAMPDIFF(SECOND, created_at, updated_at) END) as avg_response_time_sec
            FROM production_offers
        `);
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
