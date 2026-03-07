const crypto = require('crypto');
const db = require('../services/db');
const notifier = require('../services/notifier');

// Cache for debouncing activity updates
const lastActivityUpdates = new Map(); // tenantId -> timestamp

// In-memory bucket for rate limiting (can be moved to Redis in multi-node setups)
const rateLimits = new Map();

/**
 * Middleware to authenticate Public API v2 requests via Bearer Token.
 * Expected Header: Authorization: Bearer <api_key>
 */
module.exports = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
            error: 'Missing or malformed Authorization header. Expected: Bearer <api_key>'
        });
    }

    const apiKey = authHeader.split(' ')[1];
    if (!apiKey) {
        return res.status(401).json({ error: 'Invalid API Key format.' });
    }

    // Hash the key to compare with the DB storage
    const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');

    try {
        const { rows } = await db.query(`
            SELECT 
                k.tenant_id, 
                t.name as tenant_name, 
                k.id as key_id, 
                t.rate_limit_rpm,
                t.plan,
                t.plan_expires_at,
                t.status as tenant_status,
                t.daily_job_limit,
                t.alerts_state_json
            FROM api_keys k
            JOIN tenants t ON k.tenant_id = t.id
            WHERE k.key_hash = ? AND k.revoked = FALSE
            LIMIT 1
        `, [keyHash]);

        if (rows.length === 0) {
            return res.status(401).json({ error: 'Invalid or revoked API Key.' });
        }

        const auth = rows[0];
        const tenantId = auth.tenant_id;

        // --- 1. Status & Expiry Checks ---
        if (auth.tenant_status === 'SUSPENDED') {
            return res.status(403).json({
                error: 'Account suspended.',
                message: 'Your account has been suspended by an administrator. Please contact billing/support.'
            });
        }

        if (auth.tenant_status === 'QUARANTINED') {
            return res.status(403).json({
                error: 'Account quarantined.',
                message: 'Your account is under operational quarantine due to suspicious activity or technical issues.'
            });
        }

        if (auth.tenant_status !== 'ACTIVE') {
            return res.status(403).json({ error: `Tenant account is ${auth.tenant_status.toLowerCase()}.` });
        }

        if (auth.plan_expires_at && new Date(auth.plan_expires_at) < new Date()) {
            return res.status(402).json({
                error: 'PLAN_EXPIRED',
                message: 'Your subscription has ended. Please renew to continue using the API.',
                details: {
                    plan: auth.plan,
                    expires_at: auth.plan_expires_at,
                    renewal_url: 'https://preflight.printprice.pro/billing' // Example
                }
            });
        }

        // --- 2. Daily Quota Check & Proactive Alerting (Phase 19.5/19.6) ---
        // Only enforce for job creation endpoints (approximate check)
        if (req.method === 'POST' && (req.path.includes('/jobs') || req.path.includes('/batches'))) {
            const { rows: [usage] } = await db.query(
                'SELECT COUNT(*) as count FROM jobs WHERE tenant_id = ? AND created_at >= CURDATE()',
                [tenantId]
            );
            const currentCount = Number(usage.count || 0);
            const limit = auth.daily_job_limit || 1000;
            const percent = (currentCount / limit) * 100;

            // Proactive Alerting (Phase 19.6)
            const alertsState = auth.alerts_state_json || {};
            const today = new Date().toISOString().split('T')[0];

            if (alertsState.last_date !== today) {
                alertsState.last_date = today;
                alertsState.fired = [];
            }

            let alertLevel = null;
            if (percent >= 100 && !alertsState.fired.includes('100')) {
                alertLevel = '100';
            } else if (percent >= 80 && !alertsState.fired.includes('80')) {
                alertLevel = '80';
            }

            if (alertLevel) {
                alertsState.fired.push(alertLevel);
                console.log(`[ALERT][${tenantId}] Reached ${alertLevel}% of daily quota (${currentCount}/${limit})`);

                // Persist alert state & Trigger notification (Phase 20)
                Promise.all([
                    db.query('UPDATE tenants SET alerts_state_json = ? WHERE id = ?', [JSON.stringify(alertsState), tenantId]),
                    notifier.notifyThreshold(tenantId, alertLevel, currentCount, limit)
                ]).catch(err => console.error('[AUTH-v2] Alert handling failed:', err.message));
            }

            if (currentCount >= limit) {
                return res.status(429).json({
                    error: 'Daily quota exceeded.',
                    limit: limit,
                    current_usage: currentCount,
                    message: 'You have reached your daily job limit. Please upgrade your plan or wait until tomorrow (UTC).'
                });
            }
        }

        const rpm = auth.rate_limit_rpm || 60;

        // --- 3. Rate Limiting Logic (Minute-level) ---
        const now = Date.now();
        const windowSize = 60 * 1000;
        let bucket = rateLimits.get(tenantId);

        if (!bucket || (now - bucket.startTime > windowSize)) {
            bucket = { count: 0, startTime: now };
        }

        bucket.count++;
        rateLimits.set(tenantId, bucket);

        if (bucket.count > rpm) {
            return res.status(429).json({
                error: 'Too many requests. Rate limit exceeded.',
                rate_limit: rpm,
                retry_after: Math.ceil((bucket.startTime + windowSize - now) / 1000)
            });
        }

        // --- 4. Attach Context ---
        req.tenant = {
            id: tenantId,
            name: auth.tenant_name,
            key_id: auth.key_id,
            plan: auth.plan,
            rate_limit_rpm: rpm,
            daily_job_limit: auth.daily_job_limit
        };

        // --- 5. Activity Tracking (Optimized / Debounced) ---
        const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        const lastUpdate = lastActivityUpdates.get(tenantId) || 0;
        const DEBOUNCE_TIME = 5 * 60 * 1000; // 5 minutes

        if (now - lastUpdate > DEBOUNCE_TIME) {
            lastActivityUpdates.set(tenantId, now);
            Promise.all([
                db.query('UPDATE api_keys SET last_used_at = NOW(), last_used_ip = ? WHERE id = ?', [ip, auth.key_id]),
                db.query('UPDATE tenants SET last_active_at = NOW() WHERE id = ?', [tenantId])
            ]).catch(err => console.error('[AUTH-v2] Activity tracking failed:', err.message));
        }

        next();
    } catch (err) {
        console.error('[AUTH-v2] Database error:', err.message);
        res.status(500).json({ error: 'Authentication service temporarily unavailable.' });
    }
};
