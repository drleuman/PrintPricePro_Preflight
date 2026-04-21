/**
 * JWT Verification Module
 * Part of Phase 1 - AUTH FOUNDATION
 */
const jwt = require('jsonwebtoken');

const { generateInternalToken } = require('../services/identityService');
// We extract the secret via a placeholder generation or we could export jwtConfig.
// For Phase 1, we will re-implement the priority logic precisely for robustness.
const JWT_SECRET = process.env.JWT_SECRET || process.env.PPOS_JWT_SECRET || 'ppos-unsecured-dev-secret';
const JWT_ALGO = process.env.JWT_ALGORITHM || 'HS256';

const JWT_ISSUER = process.env.JWT_ISSUER || 'https://auth.printprice.pro';
const JWT_AUDIENCE = process.env.JWT_AUDIENCE || 'ppos:control';

/**
 * Verifies a JWT token against configured secret/public key and claims.
 */
function verifyJwt(token) {
    const JWT_PUBLIC_KEY = process.env.JWT_PUBLIC_KEY || null;
    const secretOrKey = (JWT_ALGO && JWT_ALGO.startsWith('RS')) ? JWT_PUBLIC_KEY : JWT_SECRET;
    
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
