'use strict';

const entitlementCache = require('./tenantEntitlementCache');

/**
 * Resolves a canonical tenant context from a request object.
 *
 * @param {object} req - Express request object
 * @returns {Promise<object>} Resolved canonical context
 */
async function resolveCanonicalTenantContext(req) {
    const auth = req.auth || req.user || {};
    const userId = auth.userId || auth.id || null;
    const email = auth.email || null;
    const appRole = auth.appRole || auth.role || null;
    const jwtTenantId = auth.tenantId || auth.tenant_id || userId;
    const printhouseId = auth.printhouseId || auth.printhouse_id || null;
    
    // 1. Determine candidate tenant ID for CP
    // Always use jwtTenantId for governance lookup. printhouseId is intentionally excluded
    // because it may point to a different (incorrectly scoped) CP tenant, producing wrong
    // limits. /api/auth/me uses the same approach (mockReq never carries printhouse_id).
    let candidateTenantId = jwtTenantId;

    console.log('[TENANT-RESOLVER-CANDIDATE]', {
        userId,
        appRole,
        jwtTenantId,
        printhouseId,
        candidateTenantId,
        usingPrinthouseOverride: appRole === 'PRINT_HOUSE' && !!printhouseId,
    });

    // 2. Fetch Governance
    let governance = null;
    let limitsObj = null;
    let source = 'LOCAL_FALLBACK';
    
    const bearerToken = req.headers ? req.headers['authorization'] : null;
    
    if (userId) {
        try {
            governance = await entitlementCache.getGovernance(candidateTenantId, bearerToken);
            if (governance) {
                limitsObj = await entitlementCache.getLimits(candidateTenantId, bearerToken);
                source = 'CONTROL_PLANE';
            }
        } catch (e) {
            console.warn('[TENANT-RESOLVER] Governance fetch failed:', e.message);
        }
    }
    
    let canonicalTenantId = jwtTenantId;
    let planCode = auth.plan || 'FREE';
    let commercialStatus = 'UNKNOWN';
    let accessLevel = null;
    let limits = {};
    
    if (governance) {
        canonicalTenantId = governance.tenantId || candidateTenantId;
        planCode = governance.planCode || governance.plan_code || governance.plan || planCode;
        commercialStatus = governance.commercialStatus || governance.commercial_status || commercialStatus;
        accessLevel = governance.accessLevel || governance.access_level || null;
    }
    
    if (limitsObj) {
        limits = {
            max_file_size_mb: limitsObj.max_file_size_mb,
            max_job_size_mb: limitsObj.max_job_size_mb,
            daily_jobs_limit: limitsObj.daily_jobs_limit,
            monthly_jobs_limit: limitsObj.monthly_jobs_limit
        };
    } else {
        limits = {
            max_file_size_mb: auth.max_file_size_mb || null,
            daily_jobs_limit: auth.daily_jobs_limit || auth.local_daily_jobs_limit || null
        };
    }

    const context = {
        userId,
        email,
        appRole,
        jwtTenantId,
        canonicalTenantId,
        governanceTenantId: governance ? (governance.tenantId || candidateTenantId) : null,
        executionTenantId: jwtTenantId,
        printhouseId,
        planCode,
        commercialStatus,
        accessLevel,
        limits,
        source,
        rawGovernance: governance || null
    };

    return context;
}

module.exports = {
    resolveCanonicalTenantContext
};
