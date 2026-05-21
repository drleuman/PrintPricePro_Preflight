'use strict';

const db = require('./db');

/**
 * Enriches preflight_job_registry with origin identity after PPOS creates the row.
 * Retries up to maxRetries times to account for PPOS registration lag on large files.
 * Idempotent: only writes when printhouse_id IS NULL or $.origin is missing.
 */
async function enrichJobRegistry(jobId, origin, { maxRetries = 5, retryDelayMs = 1200 } = {}) {
  const originJson = JSON.stringify(origin);

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await db.execute(
        `UPDATE preflight_job_registry
         SET
           printhouse_id = COALESCE(printhouse_id, ?),
           canonical_payload_json = JSON_SET(
             COALESCE(canonical_payload_json, JSON_OBJECT()),
             '$.origin',
             CAST(? AS JSON)
           )
         WHERE job_id = ?
           AND (
             printhouse_id IS NULL
             OR JSON_EXTRACT(canonical_payload_json, '$.origin') IS NULL
           )`,
        [origin.printhouseId || null, originJson, jobId]
      );

      if (result.affectedRows > 0) {
        console.log(`[REGISTRY-ENRICH][OK] job_id=${jobId} enriched on attempt ${attempt}`);
        return;
      }

      // affectedRows === 0: row may not exist yet (PPOS lag) or origin already set.
      // Keep retrying — on the last attempt we'll log FAIL and give up.
      console.log(`[REGISTRY-ENRICH][WAIT] job_id=${jobId} no rows updated on attempt ${attempt}, retrying...`);
    } catch (err) {
      if (err.code === 'ER_NO_SUCH_TABLE') {
        console.warn(`[REGISTRY-ENRICH][SKIP] preflight_job_registry table not yet available`);
        return;
      }
      console.warn(`[REGISTRY-ENRICH][WARN] attempt ${attempt}/${maxRetries} for job_id=${jobId}: ${err.message}`);
    }

    if (attempt < maxRetries) {
      await new Promise(r => setTimeout(r, retryDelayMs));
    }
  }

  console.error(`[REGISTRY-ENRICH][FAIL] job_id=${jobId} could not be enriched after ${maxRetries} attempts`);
}

module.exports = { enrichJobRegistry };
