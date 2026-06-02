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
         original_filename      = COALESCE(original_filename, VALUES(original_filename)),
         file_size_bytes        = COALESCE(file_size_bytes, VALUES(file_size_bytes)),
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

/**
 * Persists fix result arrays to the registry row once an AUTOFIX job reaches terminal state.
 * Called fire-and-forget from the polling endpoint — never throws.
 */
async function updateRegistryWithFixResult(jobId, fixPayload) {
  const applied   = Array.isArray(fixPayload.applied_fixes)   ? fixPayload.applied_fixes   : [];
  const skipped   = Array.isArray(fixPayload.skipped_fixes)   ? fixPayload.skipped_fixes   : [];
  const failed    = Array.isArray(fixPayload.failed_fixes)    ? fixPayload.failed_fixes    : [];
  const requested = Array.isArray(fixPayload.requested_fixes) ? fixPayload.requested_fixes : [];

  try {
    await db.execute(
      `UPDATE preflight_job_registry
          SET applied_fixes_json   = ?,
              skipped_fixes_json   = ?,
              failed_fixes_json    = ?,
              requested_fixes_json = ?,
              status               = COALESCE(?, status),
              canonical_payload_json = JSON_MERGE_PATCH(
                COALESCE(canonical_payload_json, JSON_OBJECT()),
                ?
              )
        WHERE job_id = ?`,
      [
        JSON.stringify(applied),
        JSON.stringify(skipped),
        JSON.stringify(failed),
        JSON.stringify(requested),
        fixPayload.status || null,
        JSON.stringify({
          applied_fixes:   applied,
          skipped_fixes:   skipped,
          failed_fixes:    failed,
          requested_fixes: requested,
          status:          fixPayload.status || null
        }),
        jobId
      ]
    );
    console.log(`[REGISTRY-FIX-UPDATE][OK] job_id=${jobId} applied=${applied.length} skipped=${skipped.length} failed=${failed.length}`);
  } catch (err) {
    if (err.code === 'ER_NO_SUCH_TABLE') return;
    console.error(`[REGISTRY-FIX-UPDATE][ERROR] job_id=${jobId}: ${err.message}`);
  }
}

module.exports = { enrollJobInRegistry, updateRegistryWithFixResult };
