/**
 * Scale simulator for Phase 30 — Autonomous Jobs
 */
const autonomousOrchestrator = require('../services/autonomousOrchestrator');
const db = require('../services/db');

async function simulateAutonomousJobs(count = 5) {
    console.log(`--- SIMULATING ${count} AUTONOMOUS JOBS ---`);

    for (let i = 0; i < count; i++) {
        const jobId = `sim-job-${i}-${Date.now()}`;
        try {
            await db.query(`
                INSERT INTO jobs (id, original_name, tenant_id, status)
                VALUES (?, ?, 't1', 'RECEIVED')
            `, [jobId, `Simulation Job ${i}`]);

            const pipelineId = await autonomousOrchestrator.startPipeline(jobId);
            console.log(`[SIM] Started pipeline ${pipelineId} for job ${jobId}`);
        } catch (err) {
            console.error(`[SIM] Failed to start job ${i}:`, err.message);
        }
    }

    console.log('\n--- SIMULATION INJECTION COMPLETE ---');
    console.log('Pipelines are running in background. Use Admin Dashboard to monitor.');
    process.exit(0);
}

const count = parseInt(process.argv[2]) || 5;
simulateAutonomousJobs(count);
