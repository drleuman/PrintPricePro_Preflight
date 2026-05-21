'use strict';

const db = require('./db');

/**
 * Creates or enriches a preflight_job_registry row with Preflight App origin identity.
 *
 * Uses INSERT ... ON DUPLICATE KEY UPDATE so it works regardless of timing:
 * - If ControlPlane hasn't synced yet: creates the initial row immediately
 * - If ControlPlane already synced: enriches the existing row (sets printhouse_id
 *   if NULL, promotes origin to $.origin in canonical_payload_json)
 *
 * Only uses base schema columns from migration 006 — safe without requiring
 * ControlPlane's dynamic schema migrations to have run first.
 *
 * Never throws — enrollment must not block job creation.
 */
async function enrollJobInRegistry(jobId, origin, jobMeta = {}) {
  const canonicalPayload = {
    job_id: jobId,
    tenant_id: origin.tenantId || 'global',
    origin,
    status: 'QUEUED',
    policy: jobMeta.policy || null,
    source: 'PREFLIGHT_APP'
  };
  const canonicalJson = JSON.stringify(canonicalPayload);
  const originJson    = JSON.stringify(origin);

  try {
    await db.execute(
      `INSERT INTO preflight_job_registry
         (job_id, tenant_id, printhouse_id, status, policy, type, progress,
          file_size_bytes, original_filename, canonical_payload_json)
       VALUES (?, ?, ?, 'QUEUED', ?, 'ANALYZE', 0, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         printhouse_id          = COALESCE(printhouse_id, VALUES(printhouse_id)),
         canonical_payload_json = JSON_SET(
           COALESCE(canonical_payload_json, JSON_OBJECT()),
           '$.origin', CAST(? AS JSON)
         )`,
      [
        jobId,
        origin.tenantId     || 'global',
        origin.printhouseId || null,
        jobMeta.policy      || null,
        jobMeta.fileSize    || 0,
        jobMeta.filename    || null,
        canonicalJson,
        originJson  // extra param for JSON_SET in ON DUPLICATE KEY UPDATE
      ]
    );

    console.log(`[REGISTRY-ENROLL][OK] job_id=${jobId} enrolled with printhouseId=${origin.printhouseId || 'null'}`);
  } catch (err) {
    if (err.code === 'ER_NO_SUCH_TABLE') {
      console.warn(`[REGISTRY-ENROLL][SKIP] preflight_job_registry not available (ControlPlane not yet migrated)`);
      return;
    }
    console.error(`[REGISTRY-ENROLL][ERROR] job_id=${jobId}: ${err.message}`);
  }
}

module.exports = { enrollJobInRegistry };
