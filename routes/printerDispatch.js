const express = require('express');
const router = express.Router();
const dispatchService = require('../services/dispatchService');

/**
 * POST /api/printer-dispatch/assignments/:id/accept
 * Printer acknowledges and accepts the job.
 */
router.post('/assignments/:id/accept', async (req, res) => {
    try {
        await dispatchService.handlePrinterResponse(req.params.id, 'ACCEPT');
        res.json({ success: true, message: 'Assignment accepted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /api/printer-dispatch/assignments/:id/reject
 * Printer rejects the job (capacity full, machine issue, etc).
 */
router.post('/assignments/:id/reject', async (req, res) => {
    try {
        await dispatchService.handlePrinterResponse(req.params.id, 'REJECT');
        res.json({ success: true, message: 'Assignment rejected, rerouting triggered' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
