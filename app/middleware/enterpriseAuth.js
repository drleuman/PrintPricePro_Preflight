/**
 * Unified Enterprise Authentication Middleware
 * Part of Phase 1: Authentication & Identity Hardening
 *
 * Supports:
 * - Bearer Token (JWT / API Key)
 * - Strict Tenant Isolation (req.tenant)
 * - RBAC (Scopes)
 * - Quotas & Plan Visibility
 */
const crypto = require('crypto');
const db = require('../services/db');
const AuthService = require('../security/AuthService');
const TenantContext = require('../services/TenantContext');

// In-memory cache for rate limiting (Phase 19.C: To be moved to Redis in multi-node)
const rateLimits = new Map();
const lastActivityUpdates = new Map();

module.exports = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
            error: 'AUTHENTICATION_REQUIRED',
            message: 'Missing or malformed Authorization header. Expected: Bearer <token>'
        });
    }

    const token = authHeader.split(' ')[1];
    let authContext = null;

    try {
        // --- 1. Token Identification & Routing ---
        if (token.includes('.')) {
            // Likely a JWT
            try {
                authContext = await AuthService.verify(token);
                authContext.type = 'JWT';
            } catch (err) {
                return res.status(401).json({ error: 'INVALID_TOKEN', message: err.message });
            }
        } else {
            // Fallback: API Key (Hashed)
            const keyHash = crypto.createHash('sha256').update(token).digest('hex');
            const { rows } = await db.query(`
                SELECT 
                    k.tenant_id, 
                    t.name as tenant_name, 
                    k.id as key_id, 
                    t.rate_limit_rpm,
                    t.plan,
                    t.status as tenant_status,
                    t.daily_job_limit,
                    k.scopes_json
                FROM api_keys k
                JOIN tenants t ON k.tenant_id = t.id
                WHERE k.key_hash = ? AND k.revoked = FALSE
                LIMIT 1
            `, [keyHash]);

            if (rows.length === 0) {
                return res.status(401).json({ error: 'INVALID_API_KEY', message: 'Invalid or revoked API Key' });
            }

            const row = rows[0];
            authContext = {
                tenant_id: row.tenant_id,
                tenant_name: row.tenant_name,
                key_id: row.key_id,
                plan: row.plan,
                status: row.tenant_status,
                rate_limit: row.rate_limit_rpm || 60,
                daily_limit: row.daily_job_limit || 1000,
                scopes: row.scopes_json || [],
                type: 'API_KEY'
            };
        }

        // --- 2. Tenant Status & Plan Constraints ---
        if (authContext.status === 'SUSPENDED') {
            return res.status(403).json({ error: 'ACCOUNT_SUSPENDED', message: 'Account has been suspended by an administrator.' });
        }

        if (authContext.status === 'QUARANTINED') {
            return res.status(403).json({ error: 'ACCOUNT_QUARANTINED', message: 'Account is under operational quarantine.' });
        }

        if (authContext.status !== 'ACTIVE') {
            return res.status(403).json({ error: 'INACTIVE_ACCOUNT', message: `Tenant account is ${authContext.status.toLowerCase()}.` });
        }

        // --- 3. Rate Limiting Logic ---
        const now = Date.now();
        const tenantId = authContext.tenant_id;
        let bucket = rateLimits.get(tenantId);
        
        if (!bucket || (now - bucket.startTime > 60000)) {
            bucket = { count: 0, startTime: now };
        }

        bucket.count++;
        rateLimits.set(tenantId, bucket);

        if (bucket.count > authContext.rate_limit) {
            return res.status(429).json({
                error: 'RATE_LIMIT_EXCEEDED',
                limit: authContext.rate_limit,
                message: 'Too many requests. Please wait before retrying.'
            });
        }

        // --- 4. Strict Context Attachment ---
        const tenantTag = {
            id: authContext.tenant_id,
            name: authContext.tenant_name,
            plan: authContext.plan,
            auth_type: authContext.type,
            scopes: authContext.scopes || [],
            daily_job_limit: authContext.daily_limit,
            rate_limit: authContext.rate_limit
        };

        req.tenant = tenantTag;

        // --- 5. Activity Tracking (Debounced) ---
        const debounceTime = 5 * 60 * 1000;
        const lastUpdate = lastActivityUpdates.get(tenantId) || 0;
        if (now - lastUpdate > debounceTime) {
            lastActivityUpdates.set(tenantId, now);
            const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
            
            // Non-blocking update
            if (authContext.type === 'API_KEY') {
                db.query('UPDATE api_keys SET last_used_at = NOW(), last_used_ip = ? WHERE id = ?', [ip, authContext.key_id])
                  .catch(err => console.error('[ENT-AUTH] Activity update fail:', err.message));
            }
            db.query('UPDATE tenants SET last_active_at = NOW() WHERE id = ?', [tenantId])
              .catch(err => console.error('[ENT-AUTH] Tenant update fail:', err.message));
        }

        // --- 6. Wrap subsequent execution in tenant context (AsyncLocalStorage) ---
        TenantContext.run(tenantTag, () => {
            next();
        });
    } catch (err) {
        console.error('[ENT-AUTH] Authentication error:', err.message);
        res.status(500).json({ error: 'INTERNAL_AUTH_ERROR', message: 'Authentication service temporarily unavailable.' });
    }
};
