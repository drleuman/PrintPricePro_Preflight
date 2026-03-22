/**
 * JWT Verification Module
 * Part of Phase 1 - AUTH FOUNDATION
 */
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'ppos-dev-only-secret-2026';
const JWT_PUBLIC_KEY = process.env.JWT_PUBLIC_KEY; // For RS256
const JWT_ALGO = process.env.JWT_ALGORITHM || 'HS256';
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
        console.error(`[JWT-AUTH-ERROR] Validation failed: ${err.message}`, {
            issuerExpected: JWT_ISSUER,
            audienceExpected: JWT_AUDIENCE,
            algo: JWT_ALGO,
            tokenSnippet: token.substring(0, 10) + '...'
        });
        throw new Error(`JWT_VALIDATION_FAILED: ${err.message}`);
    }
}

module.exports = { verifyJwt };
