'use strict';

const jwt = require('jsonwebtoken');

// Safe configuration fallback
const jwtConfig = {
    secret: process.env.JWT_SECRET || 'ppos-unsecured-dev-secret',
    algorithm: 'HS256',
    issuer: 'https://auth.printprice.pro',
    audience: 'ppos:core',
    expiresIn: '24h'
};

/**
 * Signs a new JWT for the provided user payload.
 * Used by authRoutes for user sessions.
 */
function generateInternalToken(payload, expiresIn = '24h') {
    return jwt.sign(
        payload,
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
 * Generates a system-level token (deprecated but maintained for compatibility)
 */
function getToken() {
  return jwt.sign(
    {
      sub: 'printprice-preflight-app',
      scope: ['preflight:write', 'preflight:analyze', 'jobs:read', 'jobs:write']
    },
    jwtConfig.secret,
    {
      algorithm: jwtConfig.algorithm,
      issuer: jwtConfig.issuer,
      audience: jwtConfig.audience,
      expiresIn: jwtConfig.expiresIn
    }
  );
}

function getAuthHeaders() {
  return {
    Authorization: `Bearer ${getToken()}`
  };
}

module.exports = {
  getToken,
  generateInternalToken,
  getAuthHeaders
};
