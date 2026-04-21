'use strict';

const jwt = require('jsonwebtoken');

// Safe configuration fallback
const jwtConfig = {
    // BFF sessions prioritize JWT_SECRET. Fallback to PPOS_JWT_SECRET for legacy engine trust.
    secret: process.env.JWT_SECRET || process.env.PPOS_JWT_SECRET || 'ppos-unsecured-dev-secret',
    algorithm: 'HS256',
    issuer: process.env.JWT_ISSUER || 'https://auth.printprice.pro',
    audience: process.env.JWT_AUDIENCE || 'ppos:control',
    expiresIn: '24h'
};

function getScopes() {
    const rawScopes = String(process.env.PPOS_INTERNAL_SCOPES || 'preflight:read,preflight:write,preflight:analyze,jobs:read,jobs:write');
    
    // Parse scopes
    const scopes = rawScopes
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);

    // Hardened Phase 10 logic: Policy retrieval is a core capability. 
    // Always ensure preflight:read is present to prevent UI "Empty Policy" errors.
    if (!scopes.includes('preflight:read')) {
        console.warn('[IDENTITY][PPOS_SCOPES] Forcing preflight:read into scopes to prevent UI degradation.');
        scopes.push('preflight:read');
    }

    // Phase 10 production guard: Always allow basic job discovery
    if (!scopes.includes('jobs:read')) {
        scopes.push('jobs:read');
    }

    console.log('[IDENTITY][PPOS_SCOPES]', {
        scopes,
        hasPreflightPrecedence: true
    });

    return scopes;
}

/**
 * Maps product-level roles to PPOS operational roles.
 * @param {string} productRole - The original product role (e.g., 'DEVELOPER', 'AUTHOR')
 * @returns {string} - The mapped PPOS operational role
 */
function mapProductRoleToPposRole(productRole = '') {
    const role = String(productRole).toUpperCase();
    if (role === 'DEVELOPER') return 'tenant_admin';
    if (['AUTHOR', 'PUBLISHER', 'PRINT_HOUSE'].includes(role)) return 'member';
    return 'member'; // Fallback
}

/**
 * Builds a normalized payload for PPOS internal consumption.
 * Ensures 'sub', 'role', 'scopes' and 'email' are present and canonical.
 */
function buildInternalAuthPayload(user = {}) {
    const scopes = getScopes();
    
    // Extract product role safely from various possible inputs
    const originalRole = user.appRole || user.role || (Array.isArray(user.roles) ? user.roles[0] : user.roles) || 'DEVELOPER';
    
    // Map to PPOS operational role
    const operationalRole = mapProductRoleToPposRole(originalRole);
    
    return {
        sub: user.id || user.userId || user.sub || 'printprice-preflight-app',
        email: user.email || null,
        role: operationalRole,      // Operational role (tenant_admin, member, etc)
        appRole: originalRole,       // Product role (DEVELOPER, AUTHOR, etc)
        scopes: scopes,
        scope: scopes.join(' '),     // Compatibility with some OAuth2 decoders
        tenantId: 'ppos-production-worker'
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
