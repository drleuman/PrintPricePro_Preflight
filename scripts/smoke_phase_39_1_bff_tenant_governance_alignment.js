'use strict';
/**
 * Phase 39.1 — Preflight BFF Tenant Governance Alignment
 * Smoke Test Script
 *
 * Usage:
 *   node scripts/smoke_phase_39_1_bff_tenant_governance_alignment.js
 *
 * Environment:
 *   CONTROL_PLANE_URL   - Control Plane base URL (default: http://localhost:8002)
 *   BFF_URL             - BFF base URL (default: http://localhost:3000)
 *   TEST_JWT            - JWT token for an authenticated test user
 *   TEST_TENANT_ID      - Tenant ID to test governance against
 *   VERBOSE             - Set to 'true' for full response bodies
 */

const CONTROL_PLANE_URL = process.env.CONTROL_PLANE_URL || 'http://localhost:8002';
const BFF_URL           = process.env.BFF_URL           || 'http://localhost:3000';
const TEST_JWT          = process.env.TEST_JWT          || '';
const TEST_TENANT_ID    = process.env.TEST_TENANT_ID    || 'smoke_test_tenant';
const VERBOSE           = process.env.VERBOSE === 'true';

let passed = 0;
let failed = 0;
const errors = [];

// ─── Utility ──────────────────────────────────────────────────────────────

function log(msg) { console.log(`  ${msg}`); }
function pass(label) { passed++; console.log(`  ✅ PASS: ${label}`); }
function fail(label, reason) {
    failed++;
    const msg = `  ❌ FAIL: ${label} — ${reason}`;
    console.error(msg);
    errors.push(msg);
}

async function request(url, opts = {}) {
    const headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...(TEST_JWT ? { 'Authorization': `Bearer ${TEST_JWT}` } : {}),
        ...(opts.headers || {}),
    };
    try {
        const res = await fetch(url, { ...opts, headers });
        let body;
        try { body = await res.json(); } catch { body = null; }
        if (VERBOSE) console.log('    ↪', url, res.status, JSON.stringify(body, null, 2));
        return { status: res.status, body, ok: res.ok };
    } catch (err) {
        return { status: 0, body: null, ok: false, error: err.message };
    }
}

// ─── Test Suites ──────────────────────────────────────────────────────────

async function testControlPlaneGovernanceClient() {
    console.log('\n🔍 [1] Control Plane Governance Client');

    const { controlPlaneGovernanceClient } = (() => {
        try {
            return { controlPlaneGovernanceClient: require('../app/services/controlPlaneGovernanceClient') };
        } catch (e) {
            return { controlPlaneGovernanceClient: null };
        }
    })();

    if (!controlPlaneGovernanceClient) {
        fail('module load', 'controlPlaneGovernanceClient.js not found');
        return;
    }

    pass('controlPlaneGovernanceClient module loads without error');

    const requiredExports = ['getTenantGovernance', 'evaluateAction', 'getTenantLimits', 'getTenantEntitlements'];
    for (const fn of requiredExports) {
        if (typeof controlPlaneGovernanceClient[fn] === 'function') {
            pass(`exports ${fn}()`);
        } else {
            fail(`exports ${fn}()`, 'function not found');
        }
    }

    log(`Control Plane URL: ${controlPlaneGovernanceClient.CONTROL_PLANE_BASE_URL}`);

    // Live CP hit (optional — only if CP is reachable)
    const result = await request(`${CONTROL_PLANE_URL}/api/control-plane/tenants/${TEST_TENANT_ID}/governance`);
    if (result.status === 0) {
        log('⚠️  Control Plane not reachable — skipping live governance fetch test.');
    } else if (result.ok) {
        pass('GET /governance returns 200');
        if (result.body?.plan_code) {
            pass(`governance contains plan_code: ${result.body.plan_code}`);
        } else {
            fail('governance contains plan_code', 'plan_code missing in response');
        }
    } else {
        fail(`GET /governance returns 200`, `got ${result.status}`);
    }
}

async function testTenantEntitlementCache() {
    console.log('\n🔍 [2] Tenant Entitlement Cache');

    const { cache: cacheModule } = (() => {
        try {
            return { cache: require('../app/services/tenantEntitlementCache') };
        } catch (e) {
            return { cache: null };
        }
    })();

    if (!cacheModule) {
        fail('module load', 'tenantEntitlementCache.js not found');
        return;
    }

    pass('tenantEntitlementCache module loads without error');

    const requiredExports = ['getGovernance', 'getLimits', 'isFeatureEnabled', 'getPlanCode', 'getCommercialStatus', 'invalidate', 'flushAll', 'stats'];
    for (const fn of requiredExports) {
        if (typeof cacheModule[fn] === 'function') {
            pass(`exports ${fn}()`);
        } else {
            fail(`exports ${fn}()`, 'not found');
        }
    }

    // Test cache miss → returns null gracefully (CP won't be available here)
    const result = await cacheModule.getGovernance('smoke_test_missing_tenant_xyz', undefined);
    if (result === null) {
        pass('cache miss returns null (no crash on CP unavailability)');
    } else {
        // If a result is returned it means CP was reachable — still valid
        log('ℹ️  Cache returned data (CP was reachable during test)');
    }

    // Invalidation
    cacheModule.invalidate('smoke_test_missing_tenant_xyz');
    pass('invalidate() does not throw');

    const statsObj = cacheModule.stats();
    if (typeof statsObj.size === 'number' && typeof statsObj.ttlMs === 'number') {
        pass(`stats() returns { size: ${statsObj.size}, ttlMs: ${statsObj.ttlMs} }`);
    } else {
        fail('stats() returns expected shape', JSON.stringify(statsObj));
    }
}

async function testLicenseGuardModule() {
    console.log('\n🔍 [3] licenseGuard Middleware');

    let licenseGuard;
    try {
        licenseGuard = require('../app/middleware/licenseGuard');
    } catch (e) {
        fail('module load', e.message);
        return;
    }

    pass('licenseGuard module loads without error');

    if (typeof licenseGuard === 'function') {
        pass('licenseGuard exports a factory function');
    } else {
        fail('licenseGuard exports a factory function', typeof licenseGuard);
        return;
    }

    const middleware = licenseGuard({ action: 'test', increment: false });
    if (typeof middleware === 'function') {
        pass('licenseGuard({ action, increment }) returns a middleware function');
    } else {
        fail('factory returns middleware', typeof middleware);
    }
}

async function testAuthRouteSessionEnrichment() {
    console.log('\n🔍 [4] BFF /api/auth/me Session Enrichment');

    if (!TEST_JWT) {
        log('⚠️  TEST_JWT not set — skipping live /me endpoint test.');
        return;
    }

    const result = await request(`${BFF_URL}/api/auth/me`);

    if (result.status === 0) {
        log('⚠️  BFF not reachable — skipping /me test.');
        return;
    }

    if (result.ok) {
        pass(`GET /api/auth/me returns 200`);

        const body = result.body;
        const cpFields = ['plan', 'ai_magic_fix_enabled', 'daily_jobs_limit', 'max_file_size_mb'];
        for (const field of cpFields) {
            if (field in body) {
                pass(`/me response contains field: ${field}`);
            } else {
                fail(`/me response contains field: ${field}`, 'missing');
            }
        }

        if (body._governance_source) {
            pass(`governance_source present: ${body._governance_source}`);
        } else {
            log('ℹ️  _governance_source not present (CP may be offline — LOCAL_FALLBACK path expected)');
        }
    } else {
        fail('GET /api/auth/me returns 200', `got ${result.status}`);
    }
}

async function testMulterInfraCeiling() {
    console.log('\n🔍 [5] apiV2.js Multer Infrastructure Ceiling');

    let apiV2Source;
    try {
        const fs = require('fs');
        const path = require('path');
        apiV2Source = fs.readFileSync(
            path.join(__dirname, '../app/routes/apiV2.js'),
            'utf8'
        );
    } catch (e) {
        fail('read apiV2.js', e.message);
        return;
    }

    if (apiV2Source.includes('INFRA_MAX_FILE_SIZE_MB')) {
        pass('apiV2.js uses INFRA_MAX_FILE_SIZE_MB variable (not hardcoded)');
    } else {
        fail('apiV2.js uses INFRA_MAX_FILE_SIZE_MB variable', '500 * 1024 * 1024 still hardcoded');
    }

    if (!apiV2Source.includes('500 * 1024 * 1024')) {
        pass('apiV2.js no longer hardcodes 500MB Multer limit');
    } else {
        fail('apiV2.js no longer hardcodes 500MB Multer limit', '500 * 1024 * 1024 still found');
    }

    if (apiV2Source.includes("'2048'") || apiV2Source.includes('"2048"')) {
        pass('apiV2.js default infra ceiling = 2048 MB');
    } else {
        fail('apiV2.js default infra ceiling = 2048 MB', 'not found');
    }
}

async function testFrontendTypes() {
    console.log('\n🔍 [6] Frontend Types — useAuth.tsx & Step1UploadV2_4.tsx');

    const fs = require('fs');
    const path = require('path');

    // Check useAuth.tsx
    let useAuthSource = '';
    try {
        useAuthSource = fs.readFileSync(
            path.join(__dirname, '../frontend/hooks/useAuth.tsx'), 'utf8'
        );
    } catch (e) {
        fail('read useAuth.tsx', e.message);
    }

    if (useAuthSource.includes('FOUNDING_PRINTHOUSE')) {
        pass('useAuth.tsx User.plan includes FOUNDING_PRINTHOUSE');
    } else {
        fail('useAuth.tsx User.plan includes FOUNDING_PRINTHOUSE', 'not found');
    }

    if (useAuthSource.includes('commercial_status')) {
        pass('useAuth.tsx User includes commercial_status');
    } else {
        fail('useAuth.tsx User includes commercial_status', 'not found');
    }

    if (useAuthSource.includes('max_file_size_mb')) {
        pass('useAuth.tsx User includes max_file_size_mb');
    } else {
        fail('useAuth.tsx User includes max_file_size_mb', 'not found');
    }

    // Check Step1UploadV2_4.tsx
    let step1Source = '';
    try {
        step1Source = fs.readFileSync(
            path.join(__dirname, '../frontend/components/steps/Step1UploadV2_4.tsx'), 'utf8'
        );
    } catch (e) {
        fail('read Step1UploadV2_4.tsx', e.message);
    }

    if (!step1Source.includes("user?.plan === 'PRO'")) {
        pass('Step1UploadV2_4.tsx no longer uses hardcoded plan-based limit switch');
    } else {
        fail('Step1UploadV2_4.tsx no longer uses hardcoded plan-based limit switch', "still has user?.plan === 'PRO'");
    }

    if (step1Source.includes('user?.max_file_size_mb')) {
        pass('Step1UploadV2_4.tsx reads maxMb from user.max_file_size_mb (CP-sourced)');
    } else {
        fail('Step1UploadV2_4.tsx reads maxMb from user.max_file_size_mb (CP-sourced)', 'not found');
    }

    if (step1Source.includes('user?.ai_magic_fix_enabled === true')) {
        pass('Step1UploadV2_4.tsx reads isAiFixAllowed from user.ai_magic_fix_enabled (CP-sourced)');
    } else {
        fail('Step1UploadV2_4.tsx reads isAiFixAllowed from CP-sourced field', 'not found');
    }
}

// ─── Runner ───────────────────────────────────────────────────────────────

async function main() {
    console.log('\n========================================');
    console.log(' Phase 39.1 — BFF Tenant Governance Smoke Test');
    console.log(`  Control Plane: ${CONTROL_PLANE_URL}`);
    console.log(`  BFF URL:       ${BFF_URL}`);
    console.log(`  Tenant ID:     ${TEST_TENANT_ID}`);
    console.log(`  JWT Present:   ${!!TEST_JWT}`);
    console.log('========================================');

    await testControlPlaneGovernanceClient();
    await testTenantEntitlementCache();
    await testLicenseGuardModule();
    await testAuthRouteSessionEnrichment();
    await testMulterInfraCeiling();
    await testFrontendTypes();

    console.log('\n========================================');
    console.log(` Results: ${passed} passed / ${failed} failed`);
    if (errors.length > 0) {
        console.log('\n Failures:');
        errors.forEach(e => console.log(e));
    }
    console.log('========================================\n');

    process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
    console.error('[SMOKE] Unhandled error:', err);
    process.exit(1);
});
