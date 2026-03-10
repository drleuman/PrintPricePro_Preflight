const express = require('express');
const router = express.Router();
const db = require('../services/db');
const commercialCommitmentService = require('../services/commercialCommitmentService');
const settlementReadinessService = require('../services/settlementReadinessService');

/**
 * GET /api/admin/commitments
 */
router.get('/', async (req, res) => {
    try {
        const { rows } = await db.query(`
            SELECT cc.*, p.name as printer_name
            FROM commercial_commitments cc
            JOIN printer_nodes p ON cc.printer_id = p.id
            ORDER BY cc.created_at DESC
        `);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/admin/commitments/:id
 */
router.get('/:id', async (req, res) => {
    try {
        const commitment = await commercialCommitmentService.getCommitment(req.params.id);
        const { rows: events } = await db.query('SELECT * FROM commercial_commitment_events WHERE commercial_commitment_id = ? ORDER BY created_at ASC', [req.params.id]);
        const { rows: placeholders } = await db.query('SELECT * FROM settlement_placeholders WHERE commercial_commitment_id = ?', [req.params.id]);

        res.json({
            ...commitment,
            events,
            settlement_placeholder: placeholders[0] || null
        });
    } catch (err) {
        res.status(404).json({ error: err.message });
    }
});

/**
 * POST /api/admin/commitments/:id/lock
 */
router.post('/:id/lock', async (req, res) => {
    try {
        await commercialCommitmentService.lockCommitment(req.params.id);
        await settlementReadinessService.recomputeSettlementState(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

/**
 * POST /api/admin/commitments/:id/void
 */
router.post('/:id/void', async (req, res) => {
    try {
        await commercialCommitmentService.voidCommitment(req.params.id);
        await settlementReadinessService.recomputeSettlementState(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

/**
 * POST /api/admin/commitments/:id/attach-ledger-reference
 */
router.post('/:id/attach-ledger-reference', async (req, res) => {
    try {
        const { ledger_reference } = req.body;
        await commercialCommitmentService.attachLedgerReference(req.params.id, ledger_reference);
        res.json({ success: true });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

/**
 * GET /api/admin/settlement/readiness
 */
router.get('/settlement/readiness', async (req, res) => {
    try {
        const { rows } = await db.query(`
            SELECT settlement_readiness_status, COUNT(*) as count
            FROM commercial_commitments
            GROUP BY settlement_readiness_status
        `);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
