/**
 * @project PrintPrice Pro - Job Queue Management
 * @author Manuel Enrique Morales (https://manuelenriquemorales.com/)
 * @social https://x.com/manuel_emorales | https://www.linkedin.com/in/manuelenriquemorales/
 */
const { Queue, ConnectionOptions } = require('bullmq');
const Redis = require('ioredis');

// Redis connection configuration
const connection = process.env.REDIS_URL
    ? new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: null })
    : new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        password: process.env.REDIS_PASSWORD || undefined,
        maxRetriesPerRequest: null, // Critical for BullMQ
    });

connection.on('error', (err) => {
    console.error('[REDIS-ERROR]', err.message);
});

// Preflight & AutoFix Queues
const preflightQueue = new Queue('preflight-v2', { connection });
const autofixQueue = new Queue('autofix-v2', { connection });
const webhookQueue = new Queue('webhooks-v2', { connection });
const batchOrchestratorQueue = new Queue('batch-orchestrate-v2', { connection });
const notificationQueue = new Queue('notifications-v2', { connection });

/**
 * Enqueue a new preflight/autofix job.
 * @param {string} type - 'PREFLIGHT' or 'AUTOFIX'
 * @param {object} data - Job data (asset_id, tenant_id, policy, etc.)
 */
async function enqueueJob(type, data) {
    const queue = type === 'AUTOFIX' ? autofixQueue : preflightQueue;
    const job = await queue.add(type.toLowerCase(), data, {
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 5000,
        },
        removeOnComplete: true,
        removeOnFail: false,
    });
    return job;
}

/**
 * Admin: Pause a specific queue.
 */
async function pauseQueue(type) {
    const queue = type === 'AUTOFIX' ? autofixQueue : preflightQueue;
    await queue.pause();
    return true;
}

/**
 * Admin: Resume a specific queue.
 */
async function resumeQueue(type) {
    const queue = type === 'AUTOFIX' ? autofixQueue : preflightQueue;
    await queue.resume();
    return true;
}

/**
 * Admin: Drain the queue.
 */
async function drainQueue(type, includeDelayed = false) {
    // BullMQ drain() only removes waiting and delayed (if delayed is passed as true)
    const queue = type === 'AUTOFIX' ? autofixQueue : preflightQueue;
    await queue.drain(includeDelayed);
    return true;
}

/**
 * Admin: Obliterate the queue completely.
 */
async function obliterateQueue(type) {
    const queue = type === 'AUTOFIX' ? autofixQueue : preflightQueue;
    await queue.obliterate({ force: true });
    return true;
}

/**
 * Admin: Get queue counts (BullMQ truth)
 */
async function getAdminStats() {
    const pCounts = await preflightQueue.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed');
    const aCounts = await autofixQueue.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed');

    return {
        preflight: pCounts,
        autofix: aCounts,
        paused: {
            preflight: await preflightQueue.isPaused(),
            autofix: await autofixQueue.isPaused()
        }
    };
}

module.exports = {
    connection,
    preflightQueue,
    autofixQueue,
    webhookQueue,
    batchOrchestratorQueue,
    notificationQueue,
    enqueueJob,
    pauseQueue,
    resumeQueue,
    drainQueue,
    obliterateQueue,
    getAdminStats
};
