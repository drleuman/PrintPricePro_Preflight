const express = require('express');
const router = express.Router();
const printerSyncService = require('../services/printerSyncService');

/**
 * Middleware to authenticate printer node
 */
async function authenticatePrinter(req, res, next) {
    const printer = await printerSyncService.validatePrinterKey(req.headers.authorization);
    if (!printer) {
        return res.status(401).json({ error: 'Invalid printer API key or node not active' });
    }
    req.printer = printer;
    next();
}

/**
 * POST /api/printer-sync/capacity
 * Sync production capacity
 */
router.post('/capacity', authenticatePrinter, async (req, res) => {
    try {
        const result = await printerSyncService.updateCapacity(req.printer.id, req.body);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /api/printer-sync/machines
 * Sync machine production state
 */
router.post('/machines', authenticatePrinter, async (req, res) => {
    try {
        const { machines } = req.body;
        if (!Array.isArray(machines)) {
            return res.status(400).json({ error: 'Machines must be an array' });
        }
        const result = await printerSyncService.updateMachines(req.printer.id, machines);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /api/printer-sync/schedule
 * Sync upcoming production load (Optional Extension)
 */
router.post('/schedule', authenticatePrinter, async (req, res) => {
    try {
        // For now, track as a sync event
        res.json({ success: true, message: 'Schedule captured (Analytics pending)' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
