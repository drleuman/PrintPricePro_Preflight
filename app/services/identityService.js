'use strict';

const jwt = require('jsonwebtoken');
const ppos = require('../../config/ppos');

function getToken() {
  if (!ppos.jwt.secret) {
    throw new Error('JWT secret is not configured.');
  }

  return jwt.sign(
    {
      sub: 'printprice-preflight-app',
      scope: ['preflight:write', 'preflight:analyze', 'jobs:read', 'jobs:write']
    },
    ppos.jwt.secret,
    {
      algorithm: ppos.jwt.algorithm,
      issuer: ppos.jwt.issuer,
      audience: ppos.jwt.audience,
      expiresIn: ppos.jwt.expiresIn
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
  getAuthHeaders
};
