'use strict';

const path = require('path');

function stripTrailingSlash(value) {
  return String(value || '').replace(/\/+$/, '');
}

const preflightServiceUrl = stripTrailingSlash(
  process.env.PPOS_PREFLIGHT_SERVICE_URL ||
  process.env.PREFLIGHT_SERVICE_URL ||
  'http://127.0.0.1:8001'
);

const storageBase = stripTrailingSlash(
  process.env.PPOS_STORAGE_BASE ||
  process.env.STORAGE_BASE ||
  '/storage'
);

const jwtSecret =
  process.env.JWT_SECRET ||
  process.env.PPOS_JWT_SECRET ||
  '';

const jwtIssuer =
  process.env.JWT_ISSUER ||
  process.env.OIDC_ISSUER ||
  'https://auth.printprice.pro';

const jwtAudience =
  process.env.JWT_AUDIENCE ||
  process.env.OIDC_AUDIENCE ||
  'ppos:control';

module.exports = {
  preflightServiceUrl,
  storageBase,
  tempUploadDir: process.env.V2_TEMP_UPLOAD_DIR || path.join(process.cwd(), 'uploads-v2-temp'),
  jwt: {
    secret: jwtSecret,
    issuer: jwtIssuer,
    audience: jwtAudience,
    algorithm: 'HS256',
    expiresIn: process.env.JWT_EXPIRES_IN || '5m'
  },
  routes: {
    jobs: `${preflightServiceUrl}/api/preflight/jobs`,
    policies: `${preflightServiceUrl}/api/preflight/jobs/policies`,
    jobStatus: (jobId) => `${preflightServiceUrl}/api/preflight/jobs/${encodeURIComponent(jobId)}`,
    jobArtifact: (jobId, artifactId) =>
      `${preflightServiceUrl}/api/preflight/jobs/${encodeURIComponent(jobId)}/artifacts/${encodeURIComponent(artifactId)}`
  }
};
