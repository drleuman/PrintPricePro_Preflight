'use strict';

const jwt = require('jsonwebtoken');

// Safe configuration fallback
const jwtConfig = {
    secret: process.env.JWT_SECRET || 'ppos-unsecured-dev-secret',
    algorithm: 'HS256',
    issuer: process.env.JWT_ISSUER || 'https://auth.printprice.pro',
    audience: process.env.JWT_AUDIENCE || 'ppos:control',
    expiresIn: '24h'
};

function getScopes() {
    return String(process.env.PPOS_INTERNAL_SCOPES || 'preflight:write,preflight:analyze,jobs:read,jobs:write')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
}

/**
 * Builds a normalized payload for PPOS internal consumption.
 * Ensures 'sub', 'role', 'scopes' and 'email' are present and canonical.
 */
function buildInternalAuthPayload(user = {}) {
    const scopes = getScopes();
    
    // Extract role safely from various possible inputs (user object, roles array, etc)
    const role = user.role || (Array.isArray(user.roles) ? user.roles[0] : user.roles) || 'DEVELOPER';
    
    return {
        sub: user.id || user.userId || user.sub || 'printprice-preflight-app',
        email: user.email || null,
        role: role,
        scopes: scopes,
        scope: scopes.join(' '), // Compatibility with some OAuth2 decoders
        tenantId: user.tenantId || user.tenant_id || 'global'
    };
}

/**
 * Signs a new JWT for the provided user payload.
 * Used for both user sessions and BFF -> PPOS identity propagation.
 */
function generateInternalToken(payload = {}, expiresIn = '15m') {
    const normalizedPayload = buildInternalAuthPayload(payload);

    return jwt.sign(
        normalizedPayload,
        jwtConfig.secret,
        {
            algorithm: jwtConfig.algorithm,
            issuer: jwtConfig.issuer,
            audience: jwtConfig.audience,
            expiresIn: expiresIn || jwtConfig.expiresIn
        }
    );
}

/**
 * Generates a system-level token (legacy placeholder).
 * Replaced by specific identity propagation via getAuthHeaders(userLike).
 */
function getToken() {
  return generateInternalToken({ sub: 'printprice-preflight-app' });
}

/**
 * Returns the Authorization header with a signed token for the given user.
 * If user is empty, generates a system-level token.
 */
function getAuthHeaders(userLike = {}) {
  return {
    Authorization: `Bearer ${generateInternalToken(userLike)}`
  };
}

module.exports = {
  getScopes,
  buildInternalAuthPayload,
  generateInternalToken,
  getAuthHeaders,
  getToken // Maintained for legacy compatibility
};
