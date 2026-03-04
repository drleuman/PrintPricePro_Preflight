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

module.exports = {
    connection,
    preflightQueue,
    autofixQueue,
    enqueueJob,
};
