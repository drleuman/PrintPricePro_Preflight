'use strict';

/**
 * PrintPrice OS — Control Plane Governance Client
 * Phase 39.1 Hotfix: Align with Phase 39.0 production tenant-governance routes.
 *
 * ROOT CAUSE OF 404:
 *   Phase 39.1 was initially written against a placeholder endpoint path
 *   (the legacy tenant route: /api/control-plane-tenants/:id/governance). The real Control Plane
 *   Phase 39.0 exposes the canonical admin tenant-governance routes at:
 *
 *     GET  /api/admin/tenant-governance/:tenantId/entitlements
 *     POST /api/admin/tenant-governance/:tenantId/evaluate-action
 *     POST /api/admin/tenant-governance/:tenantId/check-file-limit
 *     POST /api/admin/tenant-governance/:tenantId/check-job-limit
 *     POST /api/admin/tenant-governance/:tenantId/grace/freeze-if-expired
 *
 * This client is a thin HTTP adapter. It MUST NOT duplicate the entitlement
 * matrix — it only fetches and surfaces what the Control Plane decides.
 *
 * Canonical CP response shape (getTenantEntitlements):
 *   {
 *     ok: true,
 *     tenantId: "ph-demo-123",
 *     planCode: "FOUNDING_PRINTHOUSE",
 *     commercialStatus: "GRACE",
 *     accessLevel: "FULL",
 *     grace: { ... },
 *     limits: { maxFileSizeMb: 1024, maxJobSizeMb: 2048, ... },
 *     modules: { ... },
 *     actions: { ... },
 *     blockers: [],
 *     warnings: []
 *   }
 */

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

// Production Control Plane runs on :8081 (Phase 39.0)
// Note: 8002 was a placeholder used during Phase 39.1 initial development.
const CONTROL_PLANE_BASE_URL =
    process.env.CONTROL_PLANE_URL ||
    process.env.PPOS_CONTROL_PLANE_URL ||
    'http://127.0.0.1:8081';

const GOVERNANCE_TIMEOUT_MS = parseInt(process.env.CONTROL_PLANE_TIMEOUT_MS || '8000', 10);

// Canonical route base for all tenant governance endpoints
const GOV_BASE = (tenantId) =>
    `${CONTROL_PLANE_BASE_URL}/api/admin/tenant-governance/${encodeURIComponent(tenantId)}`;

// ---------------------------------------------------------------------------
// Headers
// ---------------------------------------------------------------------------

/**
 * Build standard headers for Control Plane requests.
 *
 * Token resolution order:
 *   1. process.env.CONTROL_PLANE_INTERNAL_API_KEY
 *   2. process.env.PPOS_CONTROL_TOKEN
 *   3. caller-provided bearerToken (forwarded JWT)
 *
 * The internal API key is sent as Authorization: Bearer <key>.
 * Secrets are never logged.
 *
 * @param {string} [bearerToken] - Optional caller JWT to forward
 * @returns {Record<string, string>}
 */
function buildHeaders(bearerToken) {
    const headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-BFF-Service': 'PREFLIGHT_BFF',
    };

    // Service-to-service: internal API key takes priority
    const internalKey =
        process.env.CONTROL_PLANE_INTERNAL_API_KEY ||
        process.env.PPOS_CONTROL_TOKEN;

    if (internalKey) {
        headers['Authorization'] = `Bearer ${internalKey}`;
    } else if (bearerToken) {
        headers['Authorization'] = bearerToken.startsWith('Bearer ')
            ? bearerToken
            : `Bearer ${bearerToken}`;
    }

    return headers;
}

// ---------------------------------------------------------------------------
// Fetch wrapper
// ---------------------------------------------------------------------------

/**
 * Generic fetch wrapper with timeout and structured error propagation.
 *
 * Response contract:
 *   - ok: true  → return body
 *   - ok: false → throw structured error with .status and .cpBody
 *   - timeout   → throw with .isTimeout = true
 *
 * "Allowed" semantics for check-* and evaluate-action:
 *   A response is considered ALLOWED when ok === true AND blockers array is
 *   empty (or absent). We do NOT require an explicit "allowed" boolean field.
 *
 * @param {string} url
 * @param {RequestInit} opts
 * @returns {Promise<any>}
 */
async function cpFetch(url, opts = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), GOVERNANCE_TIMEOUT_MS);

    try {
        const response = await fetch(url, { ...opts, signal: controller.signal });
        clearTimeout(timer);

        let body;
        try {
            body = await response.json();
        } catch {
            body = null;
        }

        if (!response.ok) {
            const err = new Error(
                `[CP-GOV] HTTP ${response.status} from ${url}: ${body?.message || response.statusText}`
            );
            err.status = response.status;
            err.cpBody = body;
            throw err;
        }

        return body;
    } catch (err) {
        clearTimeout(timer);
        if (err.name === 'AbortError') {
            const timeoutErr = new Error(
                `[CP-GOV] Request timed out after ${GOVERNANCE_TIMEOUT_MS}ms: ${url}`
            );
            timeoutErr.status = 504;
            timeoutErr.isTimeout = true;
            throw timeoutErr;
        }
        throw err;
    }
}

// ---------------------------------------------------------------------------
// Public API — Phase 39.0 canonical routes
// ---------------------------------------------------------------------------

/**
 * Fetch full tenant entitlements + governance context.
 * Canonical endpoint: GET /api/admin/tenant-governance/:tenantId/entitlements
 *
 * This is the primary method. All others derive from it or call their own
 * dedicated endpoint.
 *
 * @param {string} tenantId
 * @param {string} [bearerToken]
 * @returns {Promise<object>} Raw CP governance object
 */
async function getTenantEntitlements(tenantId, bearerToken) {
    const url = `${GOV_BASE(tenantId)}/entitlements`;
    console.log(`[CP-GOV] Fetching entitlements for tenant: ${tenantId}`);

    return cpFetch(url, {
        method: 'GET',
        headers: buildHeaders(bearerToken),
    });
}

/**
 * Backward-compatible alias for getTenantEntitlements.
 * Previously called the legacy tenant route (/api/control-plane-tenants/:id/governance) — now routes
 * to the canonical Phase 39.0 endpoint.
 *
 * @param {string} tenantId
 * @param {string} [bearerToken]
 * @returns {Promise<object>}
 */
async function getTenantGovernance(tenantId, bearerToken) {
    return getTenantEntitlements(tenantId, bearerToken);
}

/**
 * Get effective file/job limits for a tenant.
 * Calls getTenantEntitlements and normalizes the limits block.
 *
 * Returned shape:
 *   { maxFileSizeMb, maxJobSizeMb, maxJobsPerMonth, retentionDays, source }
 *
 * @param {string} tenantId
 * @param {string} [bearerToken]
 * @returns {Promise<object|null>}
 */
async function getTenantLimits(tenantId, bearerToken) {
    const data = await getTenantEntitlements(tenantId, bearerToken);
    if (!data) return null;

    const raw = data.limits || {};
    return {
        // Normalize camelCase (CP Phase 39.0) ↔ snake_case (legacy BFF consumers)
        maxFileSizeMb:   raw.maxFileSizeMb   ?? raw.max_file_size_mb   ?? null,
        maxJobSizeMb:    raw.maxJobSizeMb    ?? raw.max_job_size_mb    ?? null,
        maxJobsPerMonth: raw.maxJobsPerMonth ?? raw.daily_jobs_limit   ?? null,
        retentionDays:   raw.retentionDays   ?? raw.retention_days     ?? null,
        // Keep both naming conventions for downstream consumers
        max_file_size_mb:  raw.maxFileSizeMb  ?? raw.max_file_size_mb  ?? null,
        max_job_size_mb:   raw.maxJobSizeMb   ?? raw.max_job_size_mb   ?? null,
        daily_jobs_limit:  raw.maxJobsPerMonth ?? raw.daily_jobs_limit ?? null,
        source: data.planCode || data.plan_code || 'CONTROL_PLANE',
    };
}

/**
 * Evaluate a named action for a tenant against Control Plane policies.
 * Canonical endpoint: POST /api/admin/tenant-governance/:tenantId/evaluate-action
 *
 * Allowed = ok is true AND blockers array is empty/absent.
 *
 * @param {string} tenantId
 * @param {string} actionCode  - e.g. 'SUBMIT_JOB', 'USE_AI_FIX'
 * @param {object} [context]   - Extra metadata for the evaluation
 * @param {string} [bearerToken]
 * @returns {Promise<{ ok: boolean, allowed: boolean, blockers: any[], warnings: any[] }>}
 */
async function evaluateAction(tenantId, actionCode, context = {}, bearerToken) {
    const url = `${GOV_BASE(tenantId)}/evaluate-action`;
    console.log(`[CP-GOV] Evaluating action "${actionCode}" for tenant: ${tenantId}`);

    const data = await cpFetch(url, {
        method: 'POST',
        headers: buildHeaders(bearerToken),
        body: JSON.stringify({ actionCode, context }),
    });

    // Normalize "allowed" for backward compat with consumers expecting { allowed: bool }
    const blockers = Array.isArray(data?.blockers) ? data.blockers : [];
    return {
        ...data,
        allowed: data?.ok === true && blockers.length === 0,
    };
}

/**
 * Check if a specific file size is within the tenant's limits.
 * Canonical endpoint: POST /api/admin/tenant-governance/:tenantId/check-file-limit
 *
 * @param {string} tenantId
 * @param {number} fileSizeBytes
 * @param {object} [context]
 * @param {string} [bearerToken]
 * @returns {Promise<{ ok: boolean, allowed: boolean, blockers: any[], limits: object }>}
 */
async function checkFileLimit(tenantId, fileSizeBytes, context = {}, bearerToken) {
    const url = `${GOV_BASE(tenantId)}/check-file-limit`;
    console.log(`[CP-GOV] Checking file limit for tenant ${tenantId}: ${fileSizeBytes} bytes`);

    const data = await cpFetch(url, {
        method: 'POST',
        headers: buildHeaders(bearerToken),
        body: JSON.stringify({ fileSizeBytes, context }),
    });

    const blockers = Array.isArray(data?.blockers) ? data.blockers : [];
    return {
        ...data,
        allowed: data?.ok === true && blockers.length === 0,
    };
}

/**
 * Check if a job's total size is within the tenant's limits.
 * Canonical endpoint: POST /api/admin/tenant-governance/:tenantId/check-job-limit
 *
 * @param {string} tenantId
 * @param {number} totalJobSizeBytes
 * @param {object} [context]
 * @param {string} [bearerToken]
 * @returns {Promise<{ ok: boolean, allowed: boolean, blockers: any[], limits: object }>}
 */
async function checkJobLimit(tenantId, totalJobSizeBytes, context = {}, bearerToken) {
    const url = `${GOV_BASE(tenantId)}/check-job-limit`;
    console.log(`[CP-GOV] Checking job limit for tenant ${tenantId}: ${totalJobSizeBytes} bytes`);

    const data = await cpFetch(url, {
        method: 'POST',
        headers: buildHeaders(bearerToken),
        body: JSON.stringify({ totalJobSizeBytes, context }),
    });

    const blockers = Array.isArray(data?.blockers) ? data.blockers : [];
    return {
        ...data,
        allowed: data?.ok === true && blockers.length === 0,
    };
}

/**
 * Trigger grace-period freeze check for a tenant.
 * Canonical endpoint: POST /api/admin/tenant-governance/:tenantId/grace/freeze-if-expired
 *
 * @param {string} tenantId
 * @param {string} [bearerToken]
 * @returns {Promise<object>}
 */
async function freezeIfExpired(tenantId, bearerToken) {
    const url = `${GOV_BASE(tenantId)}/grace/freeze-if-expired`;
    console.log(`[CP-GOV] Grace freeze-if-expired for tenant: ${tenantId}`);

    return cpFetch(url, {
        method: 'POST',
        headers: buildHeaders(bearerToken),
        body: JSON.stringify({}),
    });
}

// ---------------------------------------------------------------------------
// Module export
// ---------------------------------------------------------------------------

module.exports = {
    // Primary entitlements fetch
    getTenantEntitlements,

    // Backward-compatible aliases (used by tenantEntitlementCache / licenseGuard)
    getTenantGovernance,
    getTenantLimits,

    // Action / limit evaluation
    evaluateAction,
    checkFileLimit,
    checkJobLimit,
    freezeIfExpired,

    // Expose for test overrides / mocking
    _buildHeaders: buildHeaders,
    _cpFetch: cpFetch,
    CONTROL_PLANE_BASE_URL,
};
