'use strict';
/**
 * Phase 39.1 Hotfix — Preflight BFF Tenant Governance Alignment
 * Smoke Test Script
 *
 * Tests that the BFF governance client is correctly wired to the
 * Phase 39.0 Control Plane canonical tenant-governance routes.
 *
 * Usage (offline — no live services needed):
 *   node scripts/smoke_phase_39_1_bff_tenant_governance_alignment.js
 *
 * Usage (live CP + BFF):
 *   CONTROL_PLANE_URL=http://127.0.0.1:8081 \
 *   BFF_URL=http://localhost:3000 \
 *   TEST_JWT=<your-jwt> \
 *   TEST_TENANT_ID=ph-demo-123 \
 *   node scripts/smoke_phase_39_1_bff_tenant_governance_alignment.js
 *
 * Environment:
 *   CONTROL_PLANE_URL  - Control Plane base URL (default: http://127.0.0.1:8081)
 *   BFF_URL            - BFF base URL (default: http://localhost:3000)
 *   TEST_JWT           - JWT token for an authenticated test user
 *   TEST_TENANT_ID     - Tenant ID to test governance against (optional for offline)
 *   VERBOSE            - Set to 'true' for full response bodies
 *
 * NOTE: If TEST_TENANT_ID is not set, live endpoint tests are SKIPPED (not failed).
 * A missing tenant in the CP is not a hard blocker unless explicitly configured.
 */

const CONTROL_PLANE_URL = process.env.CONTROL_PLANE_URL || 'http://127.0.0.1:8081';
const BFF_URL           = process.env.BFF_URL           || 'http://localhost:3000';
const TEST_JWT          = process.env.TEST_JWT          || '';
const TEST_TENANT_ID    = process.env.TEST_TENANT_ID    || '';
const VERBOSE           = process.env.VERBOSE === 'true';

let passed  = 0;
let failed  = 0;
let skipped = 0;
const errors = [];

// ─── Utility ──────────────────────────────────────────────────────────────

function log(msg)   { console.log(`  ${msg}`); }
function pass(label){ passed++; console.log(`  ✅ PASS: ${label}`); }
function skip(label){ skipped++; console.log(`  ⏭️  SKIP: ${label}`); }
function fail(label, reason) {
    failed++;
    const msg = `  ❌ FAIL: ${label} — ${reason}`;
    console.error(msg);
    errors.push(msg);
}

async function httpRequest(url, opts = {}) {
    const headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...(TEST_JWT ? { 'Authorization': `Bearer ${TEST_JWT}` } : {}),
        ...(opts.headers || {}),
    };
    try {
        const res = await fetch(url, { ...opts, headers, signal: AbortSignal.timeout(8000) });
        let body;
        try { body = await res.json(); } catch { body = null; }
        if (VERBOSE) console.log('    ↪', url, res.status, JSON.stringify(body, null, 2));
        return { status: res.status, body, ok: res.ok };
    } catch (err) {
        return { status: 0, body: null, ok: false, error: err.message };
    }
}

// ─── Suite 1: Source Code Alignment ──────────────────────────────────────

async function testSourceCodeAlignment() {
    console.log('\n🔍 [1] Source Code — Endpoint Alignment');

    const fs   = require('fs');
    const path = require('path');

    let src = '';
    try {
        src = fs.readFileSync(
            path.join(__dirname, '../app/services/controlPlaneGovernanceClient.js'), 'utf8'
        );
    } catch (e) {
        fail('read controlPlaneGovernanceClient.js', e.message);
        return;
    }

    // Old placeholder paths must be gone
    if (!src.includes('/api/control-plane/tenants')) {
        pass('governance client no longer contains /api/control-plane/tenants');
    } else {
        fail('governance client no longer contains /api/control-plane/tenants', 'old path still present');
    }

    // New canonical paths must be present
    if (src.includes('/api/admin/tenant-governance')) {
        pass('governance client contains /api/admin/tenant-governance');
    } else {
        fail('governance client contains /api/admin/tenant-governance', 'canonical path not found');
    }

    // Default fallback port must be 8081, not 8002
    if (src.includes('8081') && !src.includes("'http://127.0.0.1:8002'")) {
        pass('default Control Plane URL fallback is :8081 (not :8002)');
    } else {
        fail('default Control Plane URL fallback is :8081', 'still references 8002 or missing 8081');
    }

    // getTenantEntitlements maps to /entitlements
    const hasEntitlementsRoute = src.includes('/entitlements') && src.includes('getTenantEntitlements');
    if (hasEntitlementsRoute) {
        pass('getTenantEntitlements maps to /entitlements');
    } else {
        fail('getTenantEntitlements maps to /entitlements', 'route or function not found');
    }

    // checkFileLimit maps to /check-file-limit
    if (src.includes('/check-file-limit') && src.includes('checkFileLimit')) {
        pass('checkFileLimit maps to /check-file-limit');
    } else {
        fail('checkFileLimit maps to /check-file-limit', 'route or function not found');
    }

    // checkJobLimit maps to /check-job-limit
    if (src.includes('/check-job-limit') && src.includes('checkJobLimit')) {
        pass('checkJobLimit maps to /check-job-limit');
    } else {
        fail('checkJobLimit maps to /check-job-limit', 'route or function not found');
    }

    // evaluate-action must send actionCode (not the old 'action')
    if (src.includes('actionCode')) {
        pass('evaluateAction sends actionCode in request body (Phase 39.0 contract)');
    } else {
        fail('evaluateAction sends actionCode', 'actionCode not found in body serialization');
    }

    // Authorization header uses internal key
    if (src.includes('CONTROL_PLANE_INTERNAL_API_KEY') && src.includes('PPOS_CONTROL_TOKEN')) {
        pass('buildHeaders resolves internal API key from CONTROL_PLANE_INTERNAL_API_KEY / PPOS_CONTROL_TOKEN');
    } else {
        fail('buildHeaders resolves internal API key', 'key env vars not referenced');
    }
}

// ─── Suite 2: Module Contract ─────────────────────────────────────────────

async function testModuleContract() {
    console.log('\n🔍 [2] Module Contract');

    let cpClient;
    try {
        cpClient = require('../app/services/controlPlaneGovernanceClient');
    } catch (e) {
        fail('controlPlaneGovernanceClient module load', e.message);
        return;
    }
    pass('controlPlaneGovernanceClient module loads without error');

    const required = [
        'getTenantEntitlements',
        'getTenantGovernance',
        'getTenantLimits',
        'evaluateAction',
        'checkFileLimit',
        'checkJobLimit',
        'freezeIfExpired',
    ];
    for (const fn of required) {
        if (typeof cpClient[fn] === 'function') {
            pass(`exports ${fn}()`);
        } else {
            fail(`exports ${fn}()`, 'not exported or not a function');
        }
    }

    log(`Resolved CONTROL_PLANE_BASE_URL: ${cpClient.CONTROL_PLANE_BASE_URL}`);
    if (cpClient.CONTROL_PLANE_BASE_URL.includes('8081') || process.env.CONTROL_PLANE_URL) {
        pass(`CONTROL_PLANE_BASE_URL points to correct host`);
    } else {
        fail('CONTROL_PLANE_BASE_URL', `got ${cpClient.CONTROL_PLANE_BASE_URL}`);
    }
}

// ─── Suite 3: Entitlement Cache Contract ─────────────────────────────────

async function testEntitlementCache() {
    console.log('\n🔍 [3] Entitlement Cache Contract');

    let cacheModule;
    try {
        cacheModule = require('../app/services/tenantEntitlementCache');
    } catch (e) {
        fail('tenantEntitlementCache module load', e.message);
        return;
    }
    pass('tenantEntitlementCache module loads without error');

    const required = ['getGovernance', 'getLimits', 'isFeatureEnabled', 'getPlanCode',
                      'getCommercialStatus', 'invalidate', 'flushAll', 'stats'];
    for (const fn of required) {
        if (typeof cacheModule[fn] === 'function') {
            pass(`exports ${fn}()`);
        } else {
            fail(`exports ${fn}()`, 'not found');
        }
    }

    // Cache miss must return null gracefully
    const result = await cacheModule.getGovernance('__smoke_test_nonexistent__', undefined);
    if (result === null) {
        pass('cache miss → null (no crash when CP is unreachable)');
    } else {
        log('ℹ️  Cache returned data (CP was reachable during test — valid)');
    }

    cacheModule.invalidate('__smoke_test_nonexistent__');
    pass('invalidate() does not throw');

    const statsObj = cacheModule.stats();
    if (typeof statsObj.size === 'number' && typeof statsObj.ttlMs === 'number') {
        pass(`stats() returns expected shape { size: ${statsObj.size}, ttlMs: ${statsObj.ttlMs} }`);
    } else {
        fail('stats() returns expected shape', JSON.stringify(statsObj));
    }
}

// ─── Suite 4: Live Control Plane (optional) ───────────────────────────────

async function testLiveControlPlane() {
    console.log('\n🔍 [4] Live Control Plane Endpoints');

    if (!TEST_TENANT_ID) {
        skip('Live CP tests — TEST_TENANT_ID not set (set env var to enable)');
        return;
    }

    const entitlementsUrl = `${CONTROL_PLANE_URL}/api/admin/tenant-governance/${TEST_TENANT_ID}/entitlements`;

    // ── 4a: GET /entitlements ────────────────────────────────────────────
    const result = await httpRequest(entitlementsUrl);

    if (result.status === 0) {
        skip(`GET /entitlements — CP not reachable at ${CONTROL_PLANE_URL}`);
    } else if (result.ok) {
        pass(`GET /api/admin/tenant-governance/${TEST_TENANT_ID}/entitlements → 200`);

        if (result.body?.planCode || result.body?.plan_code || result.body?.plan) {
            pass(`response contains plan identifier: ${result.body.planCode || result.body.plan_code || result.body.plan}`);
        } else {
            fail('response contains plan identifier', 'planCode / plan_code / plan missing');
        }

        if (result.body?.limits) {
            pass('response contains limits object');
        } else {
            log('ℹ️  limits object absent in response (may be expected for this tenant)');
        }
    } else if (result.status === 404) {
        // Tenant not found is an integration issue, not a routing bug
        fail(`GET /entitlements → 404 (tenant "${TEST_TENANT_ID}" not found in CP)`,
             'verify TEST_TENANT_ID exists in the Control Plane');
    } else {
        fail(`GET /entitlements returns 200`, `got ${result.status}: ${JSON.stringify(result.body)}`);
    }

    // ── 4b: 780 MB file limit check (FOUNDING_PRINTHOUSE / ENTERPRISE must allow) ──
    const checkUrl = `${CONTROL_PLANE_URL}/api/admin/tenant-governance/${TEST_TENANT_ID}/check-file-limit`;
    const INLAY_FILE_BYTES = 780 * 1024 * 1024; // 780 MB

    const checkResult = await httpRequest(checkUrl, {
        method: 'POST',
        body: JSON.stringify({ fileSizeBytes: INLAY_FILE_BYTES, context: { reason: 'smoke_test_780mb' } }),
    });

    if (checkResult.status === 0) {
        skip('check-file-limit (780 MB) — CP not reachable');
    } else if (checkResult.ok) {
        const blockers = Array.isArray(checkResult.body?.blockers) ? checkResult.body.blockers : [];
        const allowed  = checkResult.body?.ok === true && blockers.length === 0;
        if (allowed) {
            pass(`780 MB inlay file check: ALLOWED (ok=true, blockers=0)`);
        } else {
            fail('780 MB inlay file check: ALLOWED', `blockers: ${JSON.stringify(blockers)}`);
        }
    } else {
        fail('check-file-limit (780 MB) returns 200', `got ${checkResult.status}`);
    }
}

// ─── Suite 5: Live BFF Session Enrichment (optional) ─────────────────────

async function testLiveBffSession() {
    console.log('\n🔍 [5] Live BFF /api/auth/me Session Enrichment');

    if (!TEST_JWT) {
        skip('BFF /me test — TEST_JWT not set');
        return;
    }

    const result = await httpRequest(`${BFF_URL}/api/auth/me`);

    if (result.status === 0) {
        skip('BFF /me — BFF not reachable');
        return;
    }

    if (result.ok) {
        pass('GET /api/auth/me → 200');
        for (const field of ['plan', 'ai_magic_fix_enabled', 'daily_jobs_limit', 'max_file_size_mb']) {
            if (field in result.body) {
                pass(`/me response contains: ${field}`);
            } else {
                fail(`/me response contains: ${field}`, 'missing');
            }
        }
        if (result.body._governance_source) {
            pass(`_governance_source: ${result.body._governance_source}`);
        } else {
            log('ℹ️  _governance_source not present (CP may be offline — LOCAL_FALLBACK expected)');
        }
    } else {
        fail('GET /api/auth/me → 200', `got ${result.status}`);
    }
}

// ─── Suite 6: Multer Ceiling & Docs ──────────────────────────────────────

async function testDocsAndCeiling() {
    console.log('\n🔍 [6] Multer Ceiling & Documentation');

    const fs   = require('fs');
    const path = require('path');

    // apiV2.js Multer ceiling
    let apiV2Src = '';
    try { apiV2Src = fs.readFileSync(path.join(__dirname, '../app/routes/apiV2.js'), 'utf8'); } catch {}
    if (apiV2Src.includes('INFRA_MAX_FILE_SIZE_MB') && !apiV2Src.includes('500 * 1024 * 1024')) {
        pass('apiV2.js: Multer ceiling uses INFRA_MAX_FILE_SIZE_MB (not hardcoded 500MB)');
    } else {
        fail('apiV2.js: Multer ceiling', 'INFRA_MAX_FILE_SIZE_MB missing or 500MB still hardcoded');
    }

    // Phase notes exist
    const notesPath = path.join(__dirname, '../PHASE_39_1_BFF_TENANT_GOVERNANCE_NOTES.md');
    if (fs.existsSync(notesPath)) {
        const notes = fs.readFileSync(notesPath, 'utf8');
        if (notes.includes('8081')) {
            pass('PHASE_39_1 notes reference port 8081');
        } else {
            fail('PHASE_39_1 notes reference port 8081', 'not found');
        }
        if (notes.includes('/api/admin/tenant-governance')) {
            pass('PHASE_39_1 notes document canonical endpoint');
        } else {
            fail('PHASE_39_1 notes document canonical endpoint', '/api/admin/tenant-governance not found');
        }
    } else {
        skip('PHASE_39_1_BFF_TENANT_GOVERNANCE_NOTES.md not found');
    }

    // .env.example
    const envPath = path.join(__dirname, '../.env.example');
    if (fs.existsSync(envPath)) {
        const envEx = fs.readFileSync(envPath, 'utf8');
        if (envEx.includes('CONTROL_PLANE_URL')) {
            pass('.env.example documents CONTROL_PLANE_URL');
        } else {
            fail('.env.example documents CONTROL_PLANE_URL', 'missing');
        }
    } else {
        skip('.env.example not found');
    }
}

// ─── Runner ───────────────────────────────────────────────────────────────

async function main() {
    console.log('\n================================================================================');
    console.log(' PHASE 39.1 — PREFLIGHT BFF TENANT GOVERNANCE ALIGNMENT');
    console.log(`  Control Plane : ${CONTROL_PLANE_URL}`);
    console.log(`  BFF URL       : ${BFF_URL}`);
    console.log(`  Tenant ID     : ${TEST_TENANT_ID || '(not set — live tests skipped)'}`);
    console.log(`  JWT Present   : ${!!TEST_JWT}`);
    console.log('================================================================================');

    await testSourceCodeAlignment();
    await testModuleContract();
    await testEntitlementCache();
    await testLiveControlPlane();
    await testLiveBffSession();
    await testDocsAndCeiling();

    const status = failed === 0 ? 'READY' : 'BLOCKED';
    const result = failed === 0 ? 'BFF_ALIGNED_WITH_CONTROL_PLANE_TENANT_GOVERNANCE' : 'ALIGNMENT_INCOMPLETE';
    const blockers = failed === 0 ? 'NONE' : `${failed} FAILURE(S) — see above`;

    console.log('\n================================================================================');
    console.log(` PHASE 39.1 — PREFLIGHT BFF TENANT GOVERNANCE ALIGNMENT`);
    console.log(` STATUS:   ${status}`);
    console.log(` RESULT:   ${result}`);
    console.log(` PASSED:   ${passed}`);
    console.log(` SKIPPED:  ${skipped}`);
    console.log(` BLOCKERS: ${blockers}`);
    if (errors.length > 0) {
        console.log('\n Failures:');
        errors.forEach(e => console.log(e));
    }
    console.log('================================================================================\n');

    process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
    console.error('[SMOKE] Unhandled error:', err);
    process.exit(1);
});
