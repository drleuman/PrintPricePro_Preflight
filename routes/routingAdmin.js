// routes/routingAdmin.js
const express = require('express');
const router = express.Router();
const requireAdmin = require('../middleware/requireAdmin');
const db = require('../services/db');
const qualityService = require('../services/printerQualityService');
const recommendationService = require('../services/routingRecommendationService');

router.use(requireAdmin);

/**
 * GET /api/admin/routing/overview
 */
router.get('/overview', async (req, res) => {
    try {
        const { rows: insights } = await db.query(`
            SELECT 
                AVG(confidence_score) as avg_confidence,
                COUNT(CASE WHEN fallback_used = 1 THEN 1 END) / COUNT(*) as fallback_rate
            FROM routing_audit_log
            WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
        `);

        const { rows: conflicts } = await db.query(`
            SELECT COUNT(*) as count 
            FROM routing_conflicts 
            WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
        `);

        res.json({
            avg_confidence: insights[0]?.avg_confidence || 0,
            fallback_rate: insights[0]?.fallback_rate || 0,
            recent_conflicts: conflicts[0]?.count || 0,
            timestamp: new Date()
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/admin/routing/history
 */
router.get('/history', async (req, res) => {
    try {
        const { rows } = await db.query(`
            SELECT rh.*, p.name as printer_name
            FROM routing_history rh
            JOIN printer_nodes p ON rh.printer_id = p.id
            ORDER BY rh.created_at DESC
            LIMIT 100
        `);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/admin/printers/:id/performance
 */
router.get('/performance/:id', async (req, res) => {
    try {
        const { rows: [perf] } = await db.query('SELECT * FROM printer_performance WHERE printer_id = ?', [req.params.id]);
        res.json(perf || { message: 'No performance data yet' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /api/admin/routing/outcome
 * Record mock outcome for testing.
 */
router.post('/outcome', async (req, res) => {
    try {
        const { jobId, printerId, status, completionTime, rating } = req.body;
        await qualityService.recordOutcome(jobId, printerId, { status, completionTime, rating });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/admin/routing/audit
 */
router.get('/audit', async (req, res) => {
    try {
        const { rows } = await db.query('SELECT * FROM routing_audit_log ORDER BY created_at DESC LIMIT 50');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/admin/routing/conflicts
 */
router.get('/conflicts', async (req, res) => {
    try {
        const { rows } = await db.query('SELECT * FROM routing_conflicts ORDER BY created_at DESC LIMIT 50');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/admin/reservations
 */
router.get('/reservations', async (req, res) => {
    try {
        const { rows } = await db.query(`
            SELECT cr.*, p.name as printer_name 
            FROM capacity_reservations cr
            JOIN printer_nodes p ON cr.printer_id = p.id
            WHERE cr.reservation_status = 'ACTIVE'
            ORDER BY cr.created_at DESC
        `);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/admin/reservations/metrics
 */
router.get('/reservations/metrics', async (req, res) => {
    try {
        const { rows } = await db.query(`
            SELECT 
                COUNT(CASE WHEN reservation_status = 'ACTIVE' THEN 1 END) as active,
                COUNT(CASE WHEN reservation_status = 'EXPIRED' THEN 1 END) as expired,
                COUNT(CASE WHEN reservation_status = 'CONFIRMED' THEN 1 END) as confirmed,
                COUNT(CASE WHEN reservation_status = 'CONFIRMED' THEN 1 END) / COUNT(*) as success_rate
            FROM capacity_reservations
            WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
        `);
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/admin/dispatch/assignments
 */
router.get('/dispatch/assignments', async (req, res) => {
    try {
        const { rows } = await db.query(`
            SELECT ja.*, p.name as printer_name 
            FROM job_assignments ja
            JOIN printer_nodes p ON ja.printer_id = p.id
            ORDER BY ja.created_at DESC
            LIMIT 50
        `);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/admin/dispatch/events
 */
router.get('/dispatch/events', async (req, res) => {
    try {
        const { rows } = await db.query('SELECT * FROM dispatch_events ORDER BY created_at DESC LIMIT 100');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
