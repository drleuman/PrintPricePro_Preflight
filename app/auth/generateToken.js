/**
 * JWT Generation Module (Internal Testing)
 * Part of Phase 1 - AUTH FOUNDATION
 */
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'ppos-dev-only-secret-2026';
const JWT_PRIVATE_KEY = process.env.JWT_PRIVATE_KEY; // For RS256
const JWT_ALGO = process.env.JWT_ALGORITHM || 'HS256';
const JWT_ISSUER = process.env.JWT_ISSUER || 'https://auth.printprice.pro';
const JWT_AUDIENCE = process.env.JWT_AUDIENCE || 'ppos:control';

/**
 * Signs a new JWT for valid enterprise users/services.
 */
function generateToken(payload, expiresIn = '24h') {
    const secretOrKey = JWT_ALGO.startsWith('RS') ? JWT_PRIVATE_KEY : JWT_SECRET;
    
    if (!secretOrKey) {
        throw new Error(`[AUTH-CONFIG-ERROR] Private key required for ${JWT_ALGO}`);
    }

    const options = {
        algorithm: JWT_ALGO,
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE,
        expiresIn: expiresIn
    };

    return jwt.sign(payload, secretOrKey, options);
}

module.exports = { generateToken };
