/**
 * PrintPrice OS - Unified Redis Client
 * Standalone implementation for Decoupled App (Phase 10)
 */

const Redis = require('ioredis');

let redis;

const getRedis = () => {
    if (redis) return redis;

    if (!process.env.REDIS_URL) {
        console.warn('[REDIS-WARN] REDIS_URL not configured. Some caching/queue features may fail.');
        return null;
    }

    try {
        redis = new Redis(process.env.REDIS_URL, {
            maxRetriesPerRequest: null, // Critical for Temporal/Bull compatibility
            retryStrategy(times) {
                const delay = Math.min(times * 50, 2000);
                return delay;
            }
        });

        redis.on('error', (err) => {
            console.error('[REDIS-ERROR]', err.message);
        });

        redis.on('connect', () => {
            console.log('[REDIS-CONN] Connected to PPOS Redis');
        });

        return redis;
    } catch (err) {
        console.error('[REDIS-BOOT-ERROR]', err.message);
        return null;
    }
};

module.exports = getRedis();
