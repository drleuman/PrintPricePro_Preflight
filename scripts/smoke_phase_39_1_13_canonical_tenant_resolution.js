'use strict';

const { resolveCanonicalTenantContext } = require('../app/services/tenantResolver');
const entitlementCache = require('../app/services/tenantEntitlementCache');

// Mock CP Response
entitlementCache.getGovernance = async (tenantId) => {
    if (tenantId === 'ph-demo-123') {
        return {
            tenantId: 'ph-demo-123',
            planCode: 'FOUNDING_PRINTHOUSE',
            commercialStatus: 'GRACE',
            accessLevel: 'FULL'
        };
    }
    return null;
};

entitlementCache.getLimits = async (tenantId) => {
    if (tenantId === 'ph-demo-123') {
        return {
            max_file_size_mb: 1024,
            max_job_size_mb: 2048,
            daily_jobs_limit: null,
            monthly_jobs_limit: 100000
        };
    }
    return null;
};

async function run() {
    console.log("=== Smoke Test: Canonical Tenant Resolution ===");

    const req = {
        auth: {
            userId: "87e69868-7f50-48d9-8564-ce1a0014f954",
            email: "demo-printhouse@printprice.pro",
            appRole: "PRINT_HOUSE",
            tenantId: "ppos-production-worker",
            printhouseId: "ph-demo-123" // The PRINT_HOUSE user has this set usually
        }
    };

    const ctx = await resolveCanonicalTenantContext(req);

    const assertions = [
        { name: 'canonicalTenantId', expected: 'ph-demo-123', actual: ctx.canonicalTenantId },
        { name: 'governanceTenantId', expected: 'ph-demo-123', actual: ctx.governanceTenantId },
        { name: 'jwtTenantId', expected: 'ppos-production-worker', actual: ctx.jwtTenantId },
        { name: 'executionTenantId', expected: 'ppos-production-worker', actual: ctx.executionTenantId },
        { name: 'planCode', expected: 'FOUNDING_PRINTHOUSE', actual: ctx.planCode },
        { name: 'max_file_size_mb', expected: 1024, actual: ctx.limits.max_file_size_mb },
        { name: 'max_job_size_mb', expected: 2048, actual: ctx.limits.max_job_size_mb },
        { name: 'daily_jobs_limit', expected: null, actual: ctx.limits.daily_jobs_limit }
    ];

    let passed = true;
    assertions.forEach(a => {
        if (a.actual !== a.expected) {
            console.error(`❌ FAILED: ${a.name} | Expected: ${a.expected} | Actual: ${a.actual}`);
            passed = false;
        } else {
            console.log(`✅ PASSED: ${a.name} = ${a.actual}`);
        }
    });

    if (passed) {
        console.log("All smoke test assertions passed successfully!");
        process.exit(0);
    } else {
        console.error("Smoke test failed!");
        process.exit(1);
    }
}

run().catch(err => {
    console.error("Test execution failed:", err);
    process.exit(1);
});
