// routes/connectAdmin.js
const express = require('express');
const router = express.Router();
const requireAdmin = require('../middleware/requireAdmin');
const networkOpsService = require('../services/networkOpsService');

router.use(requireAdmin);

/**
 * GET /api/admin/network/overview
 */
router.get('/overview', async (req, res) => {
    try {
        const stats = await networkOpsService.getNetworkOverview();
        res.json(stats);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/admin/network/printers
 * List all printer nodes with filters and pagination.
 */
router.get('/printers', async (req, res) => {
    try {
        const filters = {
            country: req.query.country,
            status: req.query.status,
            connect_status: req.query.connect_status,
            routing_eligible: req.query.routing_eligible
        };
        const options = {
            limit: req.query.limit || 20,
            offset: req.query.offset || 0
        };
        const list = await networkOpsService.listPrinters(filters, options);
        res.json(list);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/admin/network/printers/:id
 * Full detail for drawer view.
 */
router.get('/printers/:id', async (req, res) => {
    try {
        const detail = await networkOpsService.getPrinterDetail(req.params.id);
        res.json(detail);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/admin/network/capacity
 */
router.get('/capacity', async (req, res) => {
    try {
        const capacity = await networkOpsService.getCapacityByRegion();
        res.json(capacity);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/admin/network/health
 */
router.get('/health', async (req, res) => {
    try {
        const health = await networkOpsService.getHealthWarnings();
        res.json(health);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/admin/network/sync-status
 */
router.get('/sync-status', async (req, res) => {
    try {
        const status = await networkOpsService.getSyncStatusDetails();
        res.json(status);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Production Management Actions (Keep existing logic but point to new endpoints if needed)
router.post('/printers/:id/approve', async (req, res) => {
    try {
        const db = require('../services/db');
        await db.query(`UPDATE printer_nodes SET status = 'ACTIVE' WHERE id = ?`, [req.params.id]);
        res.json({ success: true, status: 'ACTIVE' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/printers/:id/suspend', async (req, res) => {
    try {
        const db = require('../services/db');
        await db.query(`UPDATE printer_nodes SET status = 'SUSPENDED' WHERE id = ?`, [req.params.id]);
        res.json({ success: true, status: 'SUSPENDED' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
