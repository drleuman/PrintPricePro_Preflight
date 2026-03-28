/**
 * JWT Verification Module
 * Part of Phase 1 - AUTH FOUNDATION
 */
const jwt = require('jsonwebtoken');

const JWT_ALGO = process.env.JWT_ALGORITHM || 'HS256';
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET && !JWT_ALGO.startsWith('RS')) {
    if (process.env.NODE_ENV === 'production') {
        throw new Error('[CRITICAL] JWT_SECRET is missing in production environment.');
    }
    console.warn('[SECURITY] JWT_SECRET missing in verifyJwt.js. JWT validation will fail for HS256.');
}
const JWT_ISSUER = process.env.JWT_ISSUER || 'https://auth.printprice.pro';
const JWT_AUDIENCE = process.env.JWT_AUDIENCE || 'ppos:control';

/**
 * Verifies a JWT token against configured secret/public key and claims.
 */
function verifyJwt(token) {
    const secretOrKey = JWT_ALGO.startsWith('RS') ? JWT_PUBLIC_KEY : JWT_SECRET;
    
    if (!secretOrKey) {
        throw new Error(`[AUTH-CONFIG-ERROR] Missing secret/key for algorithm ${JWT_ALGO}`);
    }

    try {
        return jwt.verify(token, secretOrKey, {
            algorithms: [JWT_ALGO],
            issuer: JWT_ISSUER,
            audience: JWT_AUDIENCE
        });
    } catch (err) {
        // --- DIAGNOSTIC TRACE ONLY ---
        const decoded = jwt.decode(token) || {};
        console.error(`[JWT-AUTH-ERROR] Validation failed: ${err.message}`, {
            claims: {
                iss: decoded.iss,
                aud: decoded.aud,
                azp: decoded.azp,
                client_id: decoded.client_id,
                sub: decoded.sub ? 'present' : 'missing'
            },
            expected: {
                iss: JWT_ISSUER,
                aud: JWT_AUDIENCE
            }
        });
        throw new Error(`JWT_VALIDATION_FAILED: ${err.message}`);
    }
}

module.exports = { verifyJwt };
