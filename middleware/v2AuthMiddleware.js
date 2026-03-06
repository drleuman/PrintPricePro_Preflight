const crypto = require('crypto');
const db = require('../services/db');

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
            SELECT k.tenant_id, t.name as tenant_name, k.id as key_id, t.rate_limit_rpm
            FROM api_keys k
            JOIN tenants t ON k.tenant_id = t.id
            WHERE k.key_hash = ? AND k.revoked = FALSE AND t.status = 'ACTIVE'
            LIMIT 1
        `, [keyHash]);

        if (rows.length === 0) {
            return res.status(401).json({ error: 'Invalid or revoked API Key.' });
        }

        const auth = rows[0];
        const tenantId = auth.tenant_id;
        const rpm = auth.rate_limit_rpm || 60; // Default to 60 RPM if not set

        // --- Rate Limiting Logic ---
        const now = Date.now();
        const windowSize = 60 * 1000; // 1 minute window
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

        // Attach tenant context to the request
        req.tenant = {
            id: tenantId,
            name: auth.tenant_name,
            key_id: auth.key_id,
            rate_limit_rpm: rpm
        };

        // Update last_used_at (async)
        db.query('UPDATE api_keys SET last_used_at = NOW() WHERE id = ?', [auth.key_id]).catch(() => { });

        next();
    } catch (err) {
        console.error('[AUTH-v2] Database error:', err.message);
        res.status(500).json({ error: 'Authentication service temporarily unavailable.' });
    }
};
