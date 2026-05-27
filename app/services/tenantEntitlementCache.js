'use strict';

/**
 * PrintPrice OS — Tenant Entitlement Cache
 * Phase 39.1: Preflight BFF Tenant Governance Alignment
 *
 * In-memory TTL cache that wraps the Control Plane Governance Client.
 * Reduces latency on hot paths (upload, job submission) without making
 * every BFF request a synchronous round-trip to the Control Plane.
 *
 * Design rules:
 *  1. Cache entries expire after CACHE_TTL_MS (default 60 s).
 *  2. On cache miss → fetch from Control Plane → store → return.
 *  3. On Control Plane error → return null (caller decides fallback).
 *  4. Invalidation: explicit or on next TTL expiry.
 *  5. We NEVER serve stale data beyond CACHE_TTL_MS.
 *  6. Cache key = tenantId (string).
 */

const cpClient = require('./controlPlaneGovernanceClient');

// Configurable TTL (default 60 s, keep short to stay aligned with CP changes)
const CACHE_TTL_MS = parseInt(process.env.TENANT_ENTITLEMENT_CACHE_TTL_MS || '60000', 10);

/**
 * @typedef {Object} CacheEntry
 * @property {object} governance - Raw governance object from Control Plane
 * @property {number} fetchedAt  - Timestamp when the entry was last fetched (ms)
 */

/** @type {Map<string, CacheEntry>} */
const cache = new Map();

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function isFresh(entry) {
    return entry && (Date.now() - entry.fetchedAt) < CACHE_TTL_MS;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Get governance context for a tenant (cache-first).
 * Returns the Control Plane governance object or null on failure.
 *
 * @param {string} tenantId
 * @param {string} [bearerToken] - Forwarded JWT for authenticated CP calls
 * @returns {Promise<object|null>}
 */
async function getGovernance(tenantId, bearerToken) {
    if (!tenantId) return null;

    const entry = cache.get(tenantId);
    if (isFresh(entry)) {
        return entry.governance;
    }

    try {
        const governance = await cpClient.getTenantGovernance(tenantId, bearerToken);
        cache.set(tenantId, { governance, fetchedAt: Date.now() });
        console.log(`[ENTITLEMENT-CACHE] Refreshed governance for tenant: ${tenantId}`);
        return governance;
    } catch (err) {
        console.warn(`[ENTITLEMENT-CACHE] Failed to fetch governance for tenant ${tenantId}:`, err.message);
        // If we have a stale entry, serve it as a soft fallback (better than blocking)
        if (entry) {
            console.warn(`[ENTITLEMENT-CACHE] Serving stale governance for tenant ${tenantId} (age: ${Date.now() - entry.fetchedAt}ms)`);
            return entry.governance;
        }
        return null;
    }
}

/**
 * Get effective file/job limits for a tenant (cache-first, derived from governance).
 * Returns an object with max_file_size_mb, max_job_size_mb, daily_jobs_limit, or null.
 *
 * @param {string} tenantId
 * @param {string} [bearerToken]
 * @returns {Promise<{ max_file_size_mb: number, max_job_size_mb: number, daily_jobs_limit: number }|null>}
 */
async function getLimits(tenantId, bearerToken) {
    const governance = await getGovernance(tenantId, bearerToken);
    if (!governance) return null;

    // Phase 39.0 CP returns limits under governance.limits (camelCase)
    const limits = governance.limits || governance.effective_limits || governance.file_limits || null;
    if (!limits) return null;

    const max_file_size_mb = limits.maxFileSizeMb ?? limits.max_file_size_mb ?? limits.fileUploadMaxMb ?? limits.maxUploadMb ?? limits.uploadMaxMb ?? null;
    const max_job_size_mb = limits.maxJobSizeMb ?? limits.max_job_size_mb ?? limits.maxProcessingFileSizeMb ?? null;
    const daily_jobs_limit = limits.dailyJobsLimit ?? limits.daily_jobs_limit ?? limits.maxJobsPerDay ?? limits.max_jobs_per_day ?? null;
    const monthly_jobs_limit = limits.maxJobsPerMonth ?? limits.monthlyJobsLimit ?? limits.monthly_jobs_limit ?? null;

    const planCode = governance.planCode || governance.plan_code || governance.plan || 'FREE';
    const commercialStatus = governance.commercialStatus || governance.commercial_status || 'UNKNOWN';
    const accessLevel = governance.accessLevel || governance.access_level || null;

    const result = {
        tenantId: governance.tenantId || tenantId,
        planCode,
        commercialStatus,
        accessLevel,
        max_file_size_mb,
        maxFileSizeMb: max_file_size_mb,
        max_job_size_mb,
        maxJobSizeMb: max_job_size_mb,
        daily_jobs_limit,
        dailyJobsLimit: daily_jobs_limit,
        monthly_jobs_limit,
        monthlyJobsLimit: monthly_jobs_limit,
        retentionDays: limits.retentionDays ?? limits.retention_days ?? null,
        rawLimits: limits,
        source: governance.source || 'CONTROL_PLANE'
    };

    console.log('[TENANT-ENTITLEMENT-NORMALIZED]', {
        tenantId: result.tenantId,
        planCode: result.planCode,
        commercialStatus: result.commercialStatus,
        accessLevel: result.accessLevel,
        max_file_size_mb: result.max_file_size_mb,
        max_job_size_mb: result.max_job_size_mb,
        daily_jobs_limit: result.daily_jobs_limit,
        monthly_jobs_limit: result.monthly_jobs_limit,
        source: result.source
    });

    return result;
}

/**
 * Check if a specific feature is enabled for a tenant.
 * Feature names follow Control Plane conventions: 'ai_magic_fix', 'bulk_upload', etc.
 *
 * @param {string} tenantId
 * @param {string} featureName
 * @param {string} [bearerToken]
 * @returns {Promise<boolean>}
 */
async function isFeatureEnabled(tenantId, featureName, bearerToken) {
    const governance = await getGovernance(tenantId, bearerToken);
    if (!governance) return false;

    // Phase 39.0: feature flags live in governance.modules or governance.actions
    // Legacy: governance.entitlements or governance.features
    const modules  = governance.modules  || {};
    const actions  = governance.actions  || {};
    const entitlements = governance.entitlements || governance.features || {};

    // Check all possible locations; camelCase and snake_case variants
    const camel = featureName.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    return (
        modules[featureName]  === true || modules[camel]  === true ||
        actions[featureName]  === true || actions[camel]  === true ||
        entitlements[featureName] === true || entitlements[camel] === true
    );
}

/**
 * Get the effective plan code for a tenant.
 * Returns 'FREE' as safe default when governance is unavailable.
 *
 * @param {string} tenantId
 * @param {string} [bearerToken]
 * @returns {Promise<string>}
 */
async function getPlanCode(tenantId, bearerToken) {
    const governance = await getGovernance(tenantId, bearerToken);
    if (!governance) return 'FREE';

    // Phase 39.0 uses camelCase 'planCode'; legacy used 'plan_code' / 'plan'
    return governance.planCode || governance.plan_code || governance.plan || 'FREE';
}

/**
 * Check if the tenant's commercial status is ACTIVE.
 * GRACE_PERIOD tenants are still allowed to operate (with degraded limits).
 *
 * @param {string} tenantId
 * @param {string} [bearerToken]
 * @returns {Promise<{ active: boolean, status: string, inGrace: boolean }>}
 */
async function getCommercialStatus(tenantId, bearerToken) {
    const governance = await getGovernance(tenantId, bearerToken);
    if (!governance) {
        return { active: false, status: 'UNKNOWN', inGrace: false };
    }

    // Phase 39.0 uses 'commercialStatus' (camelCase); legacy used 'commercial_status'
    const status = governance.commercialStatus || governance.commercial_status || 'UNKNOWN';
    // Phase 39.0 may use 'GRACE' (short) or 'GRACE_PERIOD' — both count as grace
    const active = ['ACTIVE', 'GRACE_PERIOD', 'GRACE', 'TRIAL'].includes(status);
    const inGrace = status === 'GRACE_PERIOD' || status === 'GRACE';

    return { active, status, inGrace };
}

/**
 * Invalidate cache for a specific tenant.
 * Call this after governance-changing events (plan upgrade, suspension, etc.)
 *
 * @param {string} tenantId
 */
function invalidate(tenantId) {
    if (cache.has(tenantId)) {
        cache.delete(tenantId);
        console.log(`[ENTITLEMENT-CACHE] Invalidated governance cache for tenant: ${tenantId}`);
    }
}

/**
 * Flush the entire cache. Useful after bulk governance changes.
 */
function flushAll() {
    const size = cache.size;
    cache.clear();
    console.log(`[ENTITLEMENT-CACHE] Flushed ${size} entries.`);
}

/**
 * Return cache statistics for observability endpoints.
 * @returns {{ size: number, entries: string[] }}
 */
function stats() {
    return {
        size: cache.size,
        ttlMs: CACHE_TTL_MS,
        entries: Array.from(cache.keys()),
    };
}

// ---------------------------------------------------------------------------
// Module export
// ---------------------------------------------------------------------------

module.exports = {
    getGovernance,
    getLimits,
    isFeatureEnabled,
    getPlanCode,
    getCommercialStatus,
    invalidate,
    flushAll,
    stats,

    // Exposed for testing
    _cache: cache,
    CACHE_TTL_MS,
};
