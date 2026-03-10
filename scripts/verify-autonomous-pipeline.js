/**
 * Verification script for Phase 30 — Autonomous Pipeline
 */
const autonomousOrchestrator = require('../services/autonomousOrchestrator');
const db = require('../services/db');

async function verifyAutonomousPipeline() {
    console.log('--- STARTING AUTONOMOUS PIPELINE VERIFICATION ---');

    const jobId = 'job-auto-verify-1';

    try {
        console.log('1. Mocking Initial Job...');
        await db.query(`
            INSERT INTO jobs (id, original_name, tenant_id, status)
            VALUES (?, 'Verification Job', 't1', 'RECEIVED')
            ON DUPLICATE KEY UPDATE id = id
        `, [jobId]);

        console.log('\n2. Starting Pipeline...');
        const pipelineId = await autonomousOrchestrator.startPipeline(jobId);
        console.log(`- Pipeline created: ${pipelineId}`);

        // Wait for a few cycles of the state machine
        console.log('\n3. Simulating Pipeline Execution (Auto-advance)...');
        await new Promise(resolve => setTimeout(resolve, 3000));

        const { rows: [pipeline] } = await db.query('SELECT * FROM autonomous_job_pipelines WHERE id = ?', [pipelineId]);
        console.log(`- Current State: ${pipeline.pipeline_state}`);
        console.log(`- Current Status: ${pipeline.pipeline_status}`);

        console.log('\n4. Testing Pause/Resume...');
        await autonomousOrchestrator.pausePipeline(pipelineId, 'ADMIN_REVIEW');
        const { rows: [pPaused] } = await db.query('SELECT pipeline_status FROM autonomous_job_pipelines WHERE id = ?', [pipelineId]);
        console.log(`- Status after pause: ${pPaused.pipeline_status}`);

        await autonomousOrchestrator.resumePipeline(pipelineId);
        const { rows: [pResumed] } = await db.query('SELECT pipeline_status FROM autonomous_job_pipelines WHERE id = ?', [pipelineId]);
        console.log(`- Status after resume: ${pResumed.pipeline_status}`);

        console.log('\n5. Verifying Integrity of Events...');
        const { rows: events } = await db.query('SELECT event_type, step_name FROM pipeline_events WHERE pipeline_id = ? ORDER BY created_at ASC', [pipelineId]);
        console.log(`- Pipeline history (${events.length} events recorded)`);
        events.forEach(e => console.log(`  [${e.event_type}] ${e.step_name}`));

        console.log('\n--- AUTONOMOUS PIPELINE VERIFICATION COMPLETE ---');
        process.exit(0);
    } catch (err) {
        console.error('Verification failed:', err.message);
        process.exit(1);
    }
}

verifyAutonomousPipeline();
