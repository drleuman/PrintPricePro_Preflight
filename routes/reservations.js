const express = require('express');
const router = express.Router();
const reservationService = require('../services/reservationService');

/**
 * POST /api/reservations
 * Manually create a reservation.
 */
router.post('/', async (req, res) => {
    try {
        const { jobId, printerId, machineId, units } = req.body;
        const reservation = await reservationService.createReservation(jobId, printerId, machineId, units);
        res.json(reservation);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

/**
 * POST /api/reservations/:id/cancel
 */
router.post('/:id/cancel', async (req, res) => {
    try {
        await reservationService.releaseReservation(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /api/reservations/:id/confirm
 */
router.post('/:id/confirm', async (req, res) => {
    try {
        await reservationService.confirmReservation(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/reservations/:id
 */
router.get('/:id', async (req, res) => {
    try {
        const { rows } = await db.query('SELECT * FROM capacity_reservations WHERE id = ?', [req.params.id]);
        if (!rows.length) return res.status(404).json({ error: 'Reservation not found' });
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
