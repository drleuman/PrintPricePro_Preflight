const express = require('express');
const router = express.Router();
const db = require('../services/db');
const marketplaceService = require('../services/marketplaceService');

/**
 * GET /api/admin/marketplace/sessions
 */
router.get('/sessions', async (req, res) => {
    try {
        const { rows } = await db.query(`
            SELECT ms.*, j.original_name as job_name,
                   (SELECT COUNT(*) FROM production_offers WHERE marketplace_session_id = ms.id) as offer_count
            FROM job_marketplace_sessions ms
            JOIN jobs j ON ms.job_id = j.id
            ORDER BY ms.created_at DESC
            LIMIT 50
        `);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/admin/marketplace/sessions/:id
 */
router.get('/sessions/:id', async (req, res) => {
    try {
        const { rows: [session] } = await db.query(`
            SELECT ms.*, j.original_name as job_name
            FROM job_marketplace_sessions ms
            JOIN jobs j ON ms.job_id = j.id
            WHERE ms.id = ?
        `, [req.params.id]);

        if (!session) return res.status(404).json({ error: 'Session not found' });

        const { rows: offers } = await db.query(`
            SELECT po.*, p.name as printer_name
            FROM production_offers po
            JOIN printer_nodes p ON po.printer_id = p.id
            WHERE po.marketplace_session_id = ?
            ORDER BY po.offer_rank ASC
        `, [req.params.id]);

        const { rows: events } = await db.query(`
            SELECT * FROM marketplace_events 
            WHERE marketplace_session_id = ?
            ORDER BY created_at DESC
        `, [req.params.id]);

        res.json({ ...session, offers, events });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /api/admin/marketplace/sessions/:id/select
 */
router.post('/sessions/:id/select', async (req, res) => {
    try {
        const { offer_id, selection_mode } = req.body;
        await marketplaceService.selectOffer(req.params.id, offer_id, selection_mode || 'ADMIN_OVERRIDE');
        res.json({ success: true, message: 'Offer selected and session updated' });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

module.exports = router;
