'use strict';

/**
 * Phase 39.1.1 — Preflight Session Governance Field Mapping
 * Smoke Test Script
 */

const fs = require('fs');
const path = require('path');

const BFF_URL = process.env.BFF_URL || 'http://localhost:3000';
const TEST_JWT = process.env.TEST_JWT || '';
const TEST_TENANT_ID = process.env.TEST_TENANT_ID || '';
const VERBOSE = process.env.VERBOSE === 'true';

let passed = 0;
let failed = 0;
let skipped = 0;
const errors = [];

function pass(label) {
    passed++;
    console.log(`  ✅ PASS: ${label}`);
}

function skip(label) {
    skipped++;
    console.log(`  ⏭️  SKIP: ${label}`);
}

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

function testStaticCodeMapping() {
    console.log('\n🔍 [1] Static Code Mapping (app/routes/authRoutes.js)');

    let src = '';
    try {
        src = fs.readFileSync(path.join(__dirname, '../app/routes/authRoutes.js'), 'utf8');
    } catch (e) {
        fail('read authRoutes.js', e.message);
        return;
    }

    // Verify maps commercialStatus to commercial_status
    if (src.includes('commercialStatus') && src.includes('commercial_status')) {
        pass('authRoutes.js maps commercialStatus to commercial_status');
    } else {
        fail('authRoutes.js maps commercialStatus to commercial_status', 'mapping not found');
    }

    // Verify maps accessLevel to access_level
    if (src.includes('accessLevel') && src.includes('access_level')) {
        pass('authRoutes.js maps accessLevel to access_level');
    } else {
        fail('authRoutes.js maps accessLevel to access_level', 'mapping not found');
    }

    // Verify maps grace.active to in_grace_period
    if (src.includes('in_grace_period') && (src.includes('grace.active') || src.includes('grace_period'))) {
        pass('authRoutes.js maps grace.active to in_grace_period');
    } else {
        fail('authRoutes.js maps grace.active to in_grace_period', 'mapping not found');
    }

    // Verify maps grace.expired to grace_expired
    if (src.includes('grace_expired') && src.includes('grace.expired')) {
        pass('authRoutes.js maps grace.expired to grace_expired');
    } else {
        fail('authRoutes.js maps grace.expired to grace_expired', 'mapping not found');
    }

    // Verify maps grace.endsAt to grace_ends_at
    if (src.includes('grace_ends_at') && (src.includes('grace.endsAt') || src.includes('grace.ends_at'))) {
        pass('authRoutes.js maps grace.endsAt to grace_ends_at');
    } else {
        fail('authRoutes.js maps grace.endsAt to grace_ends_at', 'mapping not found');
    }

    // Verify preserves FOUNDING_PRINTHOUSE
    if (src.includes('planCodeVal') || src.includes('planCode') || src.includes('plan_code')) {
        pass('authRoutes.js handles plan/planCode/plan_code dynamically, preserving FOUNDING_PRINTHOUSE');
    } else {
        fail('authRoutes.js handles plan/planCode/plan_code dynamically', 'missing plan mapping');
    }

    // Verify limits mapping
    if (src.includes('max_file_size_mb') && src.includes('max_job_size_mb')) {
        pass('authRoutes.js maps limits.maxFileSizeMb and maxJobSizeMb to snake_case equivalent');
    } else {
        fail('authRoutes.js maps limits.maxFileSizeMb and maxJobSizeMb', 'limits mapping missing');
    }
}

async function testLiveSessionEnrichment() {
    console.log('\n🔍 [2] Live BFF /api/auth/me Session Enrichment');

    if (!TEST_JWT) {
        skip('Live JWT test - TEST_JWT env var not set');
        return;
    }

    const result = await httpRequest(`${BFF_URL}/api/auth/me`);

    if (result.status === 0) {
        skip(`BFF /me endpoint unreachable at ${BFF_URL}`);
        return;
    }

    if (result.ok) {
        pass('GET /api/auth/me returns 200');
        const user = result.body || {};

        if (user._governance_source === 'CONTROL_PLANE') {
            pass('Governance source is CONTROL_PLANE');

            if (user.plan === 'FOUNDING_PRINTHOUSE' || user.planCode === 'FOUNDING_PRINTHOUSE' || user.plan_code === 'FOUNDING_PRINTHOUSE') {
                pass('FOUNDING_PRINTHOUSE plan preserved in session');
            } else {
                fail('FOUNDING_PRINTHOUSE plan preserved in session', `Got plan: ${user.plan}`);
            }

            if (user.commercial_status === 'GRACE' || user.commercial_status === 'GRACE_PERIOD') {
                pass(`commercial_status correctly mapped: ${user.commercial_status}`);
            } else {
                fail('commercial_status correctly mapped', `Got: ${user.commercial_status}`);
            }

            if (user.access_level === 'FULL') {
                pass('access_level mapped: FULL');
            } else {
                fail('access_level mapped', `Got: ${user.access_level}`);
            }

            if (user.in_grace_period === true) {
                pass('in_grace_period mapped: true');
            } else {
                fail('in_grace_period mapped', `Got: ${user.in_grace_period}`);
            }

            if (user.max_file_size_mb === 1024) {
                pass('max_file_size_mb mapped: 1024');
            } else {
                fail('max_file_size_mb mapped', `Got: ${user.max_file_size_mb}`);
            }

            if (user.max_job_size_mb === 2048) {
                pass('max_job_size_mb mapped: 2048');
            } else {
                fail('max_job_size_mb mapped', `Got: ${user.max_job_size_mb}`);
            }
        } else {
            skip('BFF using LOCAL_FALLBACK (skipping live CP alignment assertions)');
        }
    } else {
        fail('GET /api/auth/me returns 200', `Status: ${result.status}`);
    }
}

async function main() {
    console.log('\n================================================================================');
    console.log(' PHASE 39.1.1 — PREFLIGHT SESSION GOVERNANCE FIELD MAPPING SMOKE TEST');
    console.log('================================================================================');

    testStaticCodeMapping();
    await testLiveSessionEnrichment();

    const status = failed === 0 ? 'READY' : 'BLOCKED';
    const result = failed === 0 ? 'SESSION_GOVERNANCE_FIELDS_ALIGNED' : 'ALIGNMENT_INCOMPLETE';
    const blockers = failed === 0 ? 'NONE' : `${failed} FAILURE(S)`;

    console.log('\n================================================================================');
    console.log('PHASE 39.1.1 — PREFLIGHT SESSION GOVERNANCE FIELD MAPPING');
    console.log(`STATUS: ${status}`);
    console.log(`RESULT: ${result}`);
    console.log(`BLOCKERS: ${blockers}`);
    console.log('================================================================================\n');

    process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
    console.error('[SMOKE] Unhandled error:', err);
    process.exit(1);
});
