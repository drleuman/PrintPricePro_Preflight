const express = require('express');
const router = express.Router();
const db = require('../services/db');
const productionOfferService = require('../services/productionOfferService');
const negotiationService = require('../services/negotiationService');

/**
 * GET /api/printer-offers
 * List active offers for the authenticated printer.
 */
router.get('/', async (req, res) => {
    try {
        const printerId = req.printer.id; // Provided by auth middleware
        const { rows } = await db.query(`
            SELECT po.*, j.original_name as job_name
            FROM production_offers po
            JOIN jobs j ON po.job_id = j.id
            WHERE po.printer_id = ? AND po.offer_status IN ('SENT', 'VIEWED', 'PENDING')
            ORDER BY po.created_at DESC
        `, [printerId]);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /api/printer-offers/:id/accept
 */
router.post('/:id/accept', async (req, res) => {
    try {
        await productionOfferService.acceptOffer(req.params.id);
        res.json({ success: true, message: 'Offer accepted' });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

/**
 * POST /api/printer-offers/:id/reject
 */
router.post('/:id/reject', async (req, res) => {
    try {
        const { reason } = req.body;
        await productionOfferService.rejectOffer(req.params.id, reason);
        res.json({ success: true, message: 'Offer rejected' });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

/**
 * POST /api/printer-offers/:id/counter
 */
router.post('/:id/counter', async (req, res) => {
    try {
        const { proposed_price, proposed_lead_time_days, proposed_notes } = req.body;
        const counterofferId = await negotiationService.createCounteroffer(req.params.id, 'PRINTER', {
            proposed_price,
            proposed_lead_time_days,
            proposed_notes
        });
        res.json({ success: true, counteroffer_id: counterofferId });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

/**
 * POST /api/printer-offers/:id/counter/:counterofferId/accept
 */
router.post('/:id/counter/:counterofferId/accept', async (req, res) => {
    try {
        await negotiationService.acceptCounteroffer(req.params.counterofferId);
        res.json({ success: true, message: 'Counteroffer accepted' });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

/**
 * POST /api/printer-offers/:id/counter/:counterofferId/reject
 */
router.post('/:id/counter/:counterofferId/reject', async (req, res) => {
    try {
        await negotiationService.rejectCounteroffer(req.params.counterofferId);
        res.json({ success: true, message: 'Counteroffer rejected' });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

module.exports = router;
