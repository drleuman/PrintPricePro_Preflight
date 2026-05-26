'use strict';

/**
 * PrintPrice OS — Control Plane Governance Client
 * Phase 39.1: Preflight BFF Tenant Governance Alignment
 *
 * Thin HTTP adapter that queries the Control Plane Tenant Governance API.
 * The Control Plane (Phase 39.0) is the SINGLE source of truth for:
 *   - plan_code, commercial_status, access_level
 *   - grace period tracking
 *   - module entitlements
 *   - action evaluation (evaluate_action)
 *   - file/job limits
 *   - Founding Printhouse onboarding
 *
 * This client MUST NOT duplicate or hardcode the entitlement matrix.
 * It only fetches and surfaces what the Control Plane decides.
 */

const CONTROL_PLANE_BASE_URL =
    process.env.CONTROL_PLANE_URL ||
    process.env.PPOS_CONTROL_PLANE_URL ||
    'http://127.0.0.1:8002';

const GOVERNANCE_TIMEOUT_MS = parseInt(process.env.CONTROL_PLANE_TIMEOUT_MS || '5000', 10);

/**
 * Build standard headers for Control Plane requests.
 * The BFF calls the Control Plane as a service-to-service call using an
 * internal API key or the caller's JWT, depending on the action.
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

    const internalKey = process.env.CONTROL_PLANE_INTERNAL_API_KEY;
    if (internalKey) {
        headers['X-Internal-Api-Key'] = internalKey;
    }

    if (bearerToken) {
        headers['Authorization'] = bearerToken.startsWith('Bearer ')
            ? bearerToken
            : `Bearer ${bearerToken}`;
    }

    return headers;
}

/**
 * Generic fetch wrapper with timeout and structured error handling.
 * Returns the parsed JSON body or throws a structured error.
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
            const timeoutErr = new Error(`[CP-GOV] Request timed out after ${GOVERNANCE_TIMEOUT_MS}ms: ${url}`);
            timeoutErr.status = 504;
            timeoutErr.isTimeout = true;
            throw timeoutErr;
        }
        throw err;
    }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetch full tenant governance context for a given tenant.
 * Maps to GET /api/control-plane/tenants/:tenantId/governance
 *
 * Returns the raw Control Plane governance object, which includes:
 *   { plan_code, commercial_status, access_level, entitlements, limits, grace_period, ... }
 *
 * @param {string} tenantId
 * @param {string} [bearerToken]
 * @returns {Promise<object>}
 */
async function getTenantGovernance(tenantId, bearerToken) {
    const url = `${CONTROL_PLANE_BASE_URL}/api/control-plane/tenants/${encodeURIComponent(tenantId)}/governance`;
    console.log(`[CP-GOV] Fetching governance for tenant: ${tenantId}`);

    const data = await cpFetch(url, {
        method: 'GET',
        headers: buildHeaders(bearerToken),
    });

    return data;
}

/**
 * Evaluate a specific action for a tenant against Control Plane policies.
 * Maps to POST /api/control-plane/tenants/:tenantId/evaluate-action
 *
 * The Control Plane returns: { allowed: bool, reason?: string, code?: string }
 *
 * @param {string} tenantId
 * @param {string} action  - e.g. 'SUBMIT_JOB', 'USE_AI_FIX', 'DOWNLOAD_ARTIFACT'
 * @param {object} [context] - Extra context (file size, job type, etc.)
 * @param {string} [bearerToken]
 * @returns {Promise<{ allowed: boolean, reason?: string, code?: string }>}
 */
async function evaluateAction(tenantId, action, context = {}, bearerToken) {
    const url = `${CONTROL_PLANE_BASE_URL}/api/control-plane/tenants/${encodeURIComponent(tenantId)}/evaluate-action`;
    console.log(`[CP-GOV] Evaluating action "${action}" for tenant: ${tenantId}`);

    const data = await cpFetch(url, {
        method: 'POST',
        headers: buildHeaders(bearerToken),
        body: JSON.stringify({ action, context }),
    });

    return data;
}

/**
 * Fetch effective file/job limits for a tenant.
 * Maps to GET /api/control-plane/tenants/:tenantId/limits
 *
 * Returns: { max_file_size_mb, max_job_size_mb, daily_jobs_limit, ... }
 *
 * @param {string} tenantId
 * @param {string} [bearerToken]
 * @returns {Promise<object>}
 */
async function getTenantLimits(tenantId, bearerToken) {
    const url = `${CONTROL_PLANE_BASE_URL}/api/control-plane/tenants/${encodeURIComponent(tenantId)}/limits`;
    console.log(`[CP-GOV] Fetching limits for tenant: ${tenantId}`);

    const data = await cpFetch(url, {
        method: 'GET',
        headers: buildHeaders(bearerToken),
    });

    return data;
}

/**
 * Fetch module entitlements for a tenant.
 * Maps to GET /api/control-plane/tenants/:tenantId/entitlements
 *
 * Returns: { modules: string[], features: { ai_magic_fix: bool, ... } }
 *
 * @param {string} tenantId
 * @param {string} [bearerToken]
 * @returns {Promise<object>}
 */
async function getTenantEntitlements(tenantId, bearerToken) {
    const url = `${CONTROL_PLANE_BASE_URL}/api/control-plane/tenants/${encodeURIComponent(tenantId)}/entitlements`;
    console.log(`[CP-GOV] Fetching entitlements for tenant: ${tenantId}`);

    const data = await cpFetch(url, {
        method: 'GET',
        headers: buildHeaders(bearerToken),
    });

    return data;
}

// ---------------------------------------------------------------------------
// Module export
// ---------------------------------------------------------------------------

module.exports = {
    getTenantGovernance,
    evaluateAction,
    getTenantLimits,
    getTenantEntitlements,

    // Expose for test overrides / mocking
    _buildHeaders: buildHeaders,
    _cpFetch: cpFetch,
    CONTROL_PLANE_BASE_URL,
};
