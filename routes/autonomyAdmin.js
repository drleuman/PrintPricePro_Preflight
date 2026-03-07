const express = require('express');
const router = express.Router();
const db = require('../services/db');
const autonomousOrchestrator = require('../services/autonomousOrchestrator');

/**
 * GET /api/admin/pipelines
 */
router.get('/', async (req, res) => {
    try {
        const { rows } = await db.query(`
            SELECT ajp.*, j.original_name as job_name
            FROM autonomous_job_pipelines ajp
            LEFT JOIN jobs j ON ajp.job_id = j.id
            ORDER BY ajp.created_at DESC
        `);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/admin/pipelines/:id
 */
router.get('/:id', async (req, res) => {
    try {
        const { rows: [pipeline] } = await db.query('SELECT * FROM autonomous_job_pipelines WHERE id = ?', [req.params.id]);
        if (!pipeline) return res.status(404).json({ error: 'Pipeline not found' });

        const { rows: events } = await db.query('SELECT * FROM pipeline_events WHERE pipeline_id = ? ORDER BY created_at ASC', [req.params.id]);

        res.json({
            ...pipeline,
            events
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /api/admin/pipelines/:id/pause
 */
router.post('/:id/pause', async (req, res) => {
    try {
        const { reason } = req.body;
        await autonomousOrchestrator.pausePipeline(req.params.id, reason || 'Manual intervention');
        res.json({ success: true });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

/**
 * POST /api/admin/pipelines/:id/resume
 */
router.post('/:id/resume', async (req, res) => {
    try {
        await autonomousOrchestrator.resumePipeline(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

/**
 * POST /api/admin/pipelines/:id/retry-step
 */
router.post('/:id/retry-step', async (req, res) => {
    try {
        await autonomousOrchestrator.retryPipelineStep(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

/**
 * GET /api/admin/pipelines/metrics
 */
router.get('/metrics', async (req, res) => {
    try {
        const { rows } = await db.query(`
            SELECT 
                COUNT(*) as total_jobs,
                SUM(CASE WHEN pipeline_status = 'COMPLETED' THEN 1 ELSE 0 END) as completed_autonomously,
                SUM(CASE WHEN pipeline_status = 'FAILED' THEN 1 ELSE 0 END) as failed_pipelines,
                SUM(CASE WHEN pipeline_status = 'PAUSED' THEN 1 ELSE 0 END) as requiring_intervention
            FROM autonomous_job_pipelines
        `);
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
