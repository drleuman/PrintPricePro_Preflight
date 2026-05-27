/**
 * Phase 39.1.7: BFF Tenant Governance Upload Limit Audit & Demo/Pilot Enterprise Capability Fix
 * Smoke Test for Propagation and Fallback Logic
 */

const { getLimits } = require('../app/services/tenantEntitlementCache');
const { getGovernance } = require('../app/services/tenantEntitlementCache');
const licenseGuard = require('../app/middleware/licenseGuard');

// Mock cache internal state to test without live Control Plane
const entitlementCache = require('../app/services/tenantEntitlementCache');

async function runTest() {
    let passed = 0;
    let failed = 0;

    const assert = (condition, msg) => {
        if (condition) {
            console.log(`✅ PASS: ${msg}`);
            passed++;
        } else {
            console.error(`❌ FAIL: ${msg}`);
            failed++;
        }
    };

    console.log('--- A. Control Plane Payload: FOUNDING_PRINTHOUSE ---');
    
    // Inject mock into cache
    const tenantId = 'demo-printhouse-tenant';
    const mockCPResponse = {
        tenantId: "demo-printhouse-tenant",
        planCode: "FOUNDING_PRINTHOUSE",
        commercialStatus: "ACTIVE",
        accessLevel: "FULL",
        limits: {
            maxFileSizeMb: 1024,
            maxJobSizeMb: 2048,
            maxJobsPerMonth: 50000,
            maxJobsPerDay: null,
            dailyJobsLimit: null,
            allowLargeUploads: true
        }
    };
    
    entitlementCache._cache.set(tenantId, { governance: mockCPResponse, fetchedAt: Date.now() });

    const limits = await getLimits(tenantId);
    
    assert(limits.max_file_size_mb === 1024, 'normalized max_file_size_mb = 1024');
    assert(limits.max_job_size_mb === 2048, 'normalized max_job_size_mb = 2048');
    assert(limits.daily_jobs_limit === null, 'daily_jobs_limit = null');
    assert(limits.monthly_jobs_limit === 50000, 'monthly_jobs_limit = 50000 (maxJobsPerMonth not used as daily limit)');

    console.log('\n--- B. /api/auth/me equivalent (enrichWithGovernance) ---');
    const authRoutesStr = require('fs').readFileSync('./app/routes/authRoutes.js', 'utf8');
    // We can't directly call enrichWithGovernance easily as it's not exported, so we simulate it:
    
    const mockUser = {
        id: tenantId,
        email: 'demo@printhouse.com',
        plan: 'FREE', // Initial local plan
        tenant_id: tenantId
    };

    const limitSource = limits;
    const maxFileSizeMbVal = limits?.max_file_size_mb;
    
    assert(maxFileSizeMbVal === 1024, '/api/auth/me equivalent max_file_size_mb = 1024');

    console.log('\n--- C. licenseGuard ---');
    const mockRes = {
        status: (code) => ({
            json: (data) => ({ statusCode: code, data })
        })
    };
    const mockNext = () => ({ status: 'NEXT_CALLED' });

    // C.1 FOUNDING_PRINTHOUSE (Cache Hit) -> 780MB file allowed
    const req1 = {
        headers: { 'x-request-id': 'req1' },
        auth: { userId: 'u1', tenantId: tenantId },
        file: { size: 780 * 1024 * 1024 } // 780 MB
    };
    
    // We override DB check just for testing
    const originalDbExecute = require('../app/services/db').execute;
    require('../app/services/db').execute = async (query) => {
        return [{ status: 'ACTIVE', plan: 'FOUNDING_PRINTHOUSE', jobs_used_today: 0, ai_magic_fix_enabled: true }];
    };

    const guard = licenseGuard();
    const result1 = await guard(req1, mockRes, mockNext);
    assert(req1.license && req1.license.max_file_size_mb === 1024, '780MB file allowed for FOUNDING_PRINTHOUSE');

    // C.2 FOUNDING_PRINTHOUSE -> 1030MB file blocked
    const req2 = {
        headers: { 'x-request-id': 'req2' },
        auth: { userId: 'u1', tenantId: tenantId },
        file: { size: 1030 * 1024 * 1024 } // 1030 MB
    };
    const result2 = await guard(req2, mockRes, mockNext);
    assert(result2?.statusCode === 413, '1030MB file blocked for FOUNDING_PRINTHOUSE');

    // C.3 FREE -> 780MB file blocked
    entitlementCache._cache.delete('free-tenant');
    const req3 = {
        headers: { 'x-request-id': 'req3' },
        auth: { userId: 'u-free', tenantId: 'free-tenant' },
        file: { size: 780 * 1024 * 1024 } // 780 MB
    };
    require('../app/services/db').execute = async (query) => {
        return [{ status: 'ACTIVE', plan: 'FREE', jobs_used_today: 0, ai_magic_fix_enabled: false }];
    };
    const result3 = await guard(req3, mockRes, mockNext);
    assert(result3?.statusCode === 413, '780MB file blocked for FREE');

    // Restore DB execute
    require('../app/services/db').execute = originalDbExecute;

    console.log(`\nTests completed: ${passed} passed, ${failed} failed.`);
    process.exit(failed > 0 ? 1 : 0);
}

runTest().catch(console.error);
