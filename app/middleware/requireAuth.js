/**
 * Enterprise Authentication Middleware (Phase 1)
 * Enforces JWT validation and manages legacy API Key fallback.
 */
const { verifyJwt } = require('../auth/verifyJwt');
const crypto = require('crypto');

const ALLOW_LEGACY_AUTH = process.env.ALLOW_LEGACY_AUTH === 'true';
const LEGACY_API_KEY = process.env.PPP_API_KEY;

module.exports = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const requestId = req.headers['x-request-id'] || 'system';

    // --- 1. Extract Token ---
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const tokenToken = authHeader.split(' ')[1];
        
        try {
            const decoded = verifyJwt(tokenToken);
            
            // Success Logging
            console.log(`[AUTH-SUCCESS][${requestId}] JWT validated for tenant ${decoded.tenantId || 'global'}`);

            // Attach to req.auth (Mandatory Structure)
            req.auth = {
                userId: decoded.userId || null,
                tenantId: decoded.tenantId || 'default',
                role: decoded.role || 'GUEST',
                scopes: decoded.scopes || [],
                plan: decoded.plan || 'NONE'
            };

            return next();
        } catch (err) {
            console.error(`[AUTH-FAILURE][${requestId}] Invalid JWT: ${err.message}`);
            return res.status(401).json({
                error: 'INVALID_CREDENTIALS',
                message: 'Invalid or expired JWT token.'
            });
        }
    }

    // --- 2. Fallback to Legacy API Key (If Enabled) ---
    if (ALLOW_LEGACY_AUTH && LEGACY_API_KEY) {
        const headerKey = req.get('x-ppp-api-key') || '';
        
        // Timing-safe comparison helper
        const safeCompare = (a, b) => {
            if (typeof a !== 'string' || typeof b !== 'string') return false;
            try {
                const bufA = Buffer.from(a);
                const bufB = Buffer.from(b);
                if (bufA.length !== bufB.length) return false;
                return crypto.timingSafeEqual(bufA, bufB);
            } catch (e) { return false; }
        };

        if (safeCompare(headerKey, LEGACY_API_KEY)) {
            console.warn(`[AUTH-LEGACY][${requestId}] Authenticated via Legacy API Key (ALLOW_LEGACY_AUTH=true)`);
            
            req.auth = {
                userId: 'legacy-api-system',
                tenantId: 'default',
                role: 'ADMIN_LEGACY',
                scopes: ['*'],
                plan: 'ENTERPRISE'
            };

            return next();
        }
    }

    // --- 3. Immediate Rejection ---
    console.error(`[AUTH-DENIED][${requestId}] No valid JWT provided and Legacy Auth restricted.`);
    res.status(401).json({
        error: 'AUTHENTICATION_REQUIRED',
        message: 'Bearer token in Authorization header is mandatory.'
    });
};
