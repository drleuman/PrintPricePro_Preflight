const Redis = require('ioredis');

let redis;
let connectionFailedOnce = false;

const getRedis = () => {
    if (redis) return redis;

    if (!process.env.REDIS_URL) {
        console.warn('[REDIS-WARN] REDIS_URL not configured. Caching/Quota features will fallback to DB.');
        return null;
    }

    try {
        const isDev = process.env.PPOS_ENVIRONMENT === 'development' || process.env.NODE_ENV === 'development';
        
        redis = new Redis(process.env.REDIS_URL, {
            maxRetriesPerRequest: null,
            retryStrategy(times) {
                // Slower retry in dev to avoid log flooding
                const delay = Math.min(times * (isDev ? 1000 : 50), 10000);
                return delay;
            },
            reconnectOnError(err) {
                const targetError = 'READONLY';
                if (err.message.includes(targetError)) return true;
                return false;
            }
        });

        redis.on('error', (err) => {
            if (!connectionFailedOnce) {
                console.error('[REDIS-ERROR] Initial connection failed. Service will operate in fallback mode.', err.message);
                connectionFailedOnce = true;
                
                if (isDev) {
                    console.info('[REDIS-INFO] Development environment detected. Muting further connection errors.');
                }
            } else if (!isDev) {
                // Only log in production after the first failed attempt to avoid spamming dev console
                console.error('[REDIS-RETRY-ERROR]', err.message);
            }
        });

        redis.on('connect', () => {
            console.log('[REDIS-CONN] OK: Connected to PPOS Redis');
            connectionFailedOnce = false; // Reset on success
        });

        return redis;
    } catch (err) {
        console.error('[REDIS-BOOT-ERROR]', err.message);
        return null;
    }
};

module.exports = getRedis();
