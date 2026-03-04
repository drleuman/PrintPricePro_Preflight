/**
 * PrintPrice Pro Preflight - DB Worker Process
 * Executes background tasks from the PostgreSQL job queue.
 */
require('dotenv').config();
const os = require('os');
const { query, pool } = require('./db');
const JobProcessor = require('./jobProcessor');
const JobManager = require('./jobManager');

const WORKER_ID = `${os.hostname()}-${process.pid}`;
const POLL_INTERVAL = 1000;
const MAX_CONCURRENT_HEAVY = parseInt(process.env.MAX_WORKERS || '1');

console.log(`[${new Date().toISOString()}] Starting PrintPrice Worker ${WORKER_ID}`);

async function claimTask() {
    // 1. Find and lock the next task
    const selectSql = `
        SELECT jt.id
        FROM job_tasks jt
        JOIN jobs j ON j.id = jt.job_id
        WHERE
            jt.status IN ('PENDING', 'RETRY_WAIT')
            AND (jt.run_after IS NULL OR jt.run_after <= NOW())
            AND j.status NOT IN ('FAILED','CANCELED','CERTIFIED')
        ORDER BY
            j.priority DESC,
            jt.created_at ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
    `;
    const res = await query(selectSql, []);
    if (!res.rows || res.rows.length === 0) return null;

    const taskId = res.rows[0].id;

    // 2. Update the locked task
    const updateSql = `
        UPDATE job_tasks
        SET
          status = 'RUNNING',
          locked_by = $1,
          locked_at = NOW(),
          started_at = NOW(),
          attempts = attempts + 1
        WHERE id = $2
    `;
    await query(updateSql, [WORKER_ID, taskId]);

    // 3. Fetch the full row to return to the processor
    const fetchSql = `SELECT * FROM job_tasks WHERE id = $1`;
    const fetchRes = await query(fetchSql, [taskId]);
    return fetchRes.rows[0];
}

async function runLoop() {
    while (true) {
        try {
            const task = await claimTask();
            if (task) {
                console.log(`[${new Date().toISOString()}] Worker ${WORKER_ID} claimed task ${task.id} (${task.task_type}) for job ${task.job_id}`);

                // For now, we execute sequentially within this process to respect MAX_CONCURRENT_HEAVY=1
                // If we want multiple concurrent per process, we can use a local semaphore.
                await JobProcessor.executeTask(task);
            } else {
                await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
            }
        } catch (err) {
            console.error(`[${new Date().toISOString()}] Worker loop error:`, err);
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }
}

// Graceful Shutown
const shutdown = async () => {
    console.log('Worker shutting down gracefully...');
    await pool.end();
    process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

runLoop();
