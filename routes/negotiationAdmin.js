const express = require('express');
const router = express.Router();
const db = require('../services/db');
const negotiationService = require('../services/negotiationService');
const marketplaceReadinessService = require('../services/marketplaceReadinessService');

/**
 * GET /api/admin/marketplace/negotiations
 */
router.get('/negotiations', async (req, res) => {
    try {
        const { rows } = await db.query(`
            SELECT po.id as offer_id, po.negotiation_status, po.counteroffer_count,
                   po.committed_price, po.committed_lead_time_days, po.commercial_ready,
                   p.name as printer_name, po.updated_at
            FROM production_offers po
            JOIN printer_nodes p ON po.printer_id = p.id
            WHERE po.negotiation_status != 'NONE'
            ORDER BY po.updated_at DESC
        `);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/admin/marketplace/negotiations/:offerId
 */
router.get('/negotiations/:offerId', async (req, res) => {
    try {
        const { rows: chain } = await db.query(`
            SELECT * FROM offer_counteroffers 
            WHERE offer_id = ?
            ORDER BY created_at ASC
        `, [req.params.offerId]);
        res.json(chain);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /api/admin/marketplace/offers/:id/counter
 */
router.post('/offers/:id/counter', async (req, res) => {
    try {
        const counterofferId = await negotiationService.createCounteroffer(req.params.id, 'PLATFORM', req.body);
        res.json({ success: true, counteroffer_id: counterofferId });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

/**
 * POST /api/admin/marketplace/sessions/:id/mark-commercial-ready
 */
router.post('/sessions/:id/mark-commercial-ready', async (req, res) => {
    try {
        const { offer_id } = req.body;
        const commitment = await marketplaceReadinessService.markCommercialReady(req.params.id, offer_id);
        res.json({ success: true, commitment });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

module.exports = router;
