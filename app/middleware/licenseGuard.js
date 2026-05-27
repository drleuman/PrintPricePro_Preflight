'use strict';

/**
 * PrintPrice OS — License & Resource Governance Middleware
 * Phase 39.1: Preflight BFF Tenant Governance Alignment
 *
 * Governance is now driven by the Control Plane (Phase 39.0) as the single
 * source of truth for plan limits, entitlements and action evaluation.
 *
 * Responsibilities:
 *   1. Validate user existence and status (via local DB — identity layer).
 *   2. Fetch effective limits/entitlements from Control Plane (via cache).
 *   3. Enforce daily job quotas against CP-supplied limits.
 *   4. Validate file size against CP-supplied per-file limit.
 *   5. Check feature authorization (e.g. AI Magic Fix) via CP entitlements.
 *   6. Increment local usage on success (local DB — forensic counter).
 *
 * IMPORTANT: Hardcoded FREE/PRO/ENTERPRISE byte limits have been removed.
 *   All limits come from the Control Plane. If the CP is unavailable, we
 *   fall back to conservative local defaults to prevent total service loss,
 *   but we log a warning and flag the response.
 *
 * Fallback defaults (ONLY used when Control Plane is unreachable):
 *   FREE:               25 MB per file / 5 jobs per day
 *   PRO:               150 MB per file / 50 jobs per day
 *   ENTERPRISE / OTHER: 1024 MB per file / unlimited jobs
 */

const db = require('../services/db');
const entitlementCache = require('../services/tenantEntitlementCache');

// Conservative fallback limits when the Control Plane is unreachable.
const FALLBACK_LIMITS = {
    FREE:               { max_file_size_mb: 25,   daily_jobs_limit: 5 },
    PRO:                { max_file_size_mb: 150,  daily_jobs_limit: 50 },
    ENTERPRISE:         { max_file_size_mb: 1024, daily_jobs_limit: null }, // null = unlimited
    FOUNDING_PRINTHOUSE:{ max_file_size_mb: 1024, daily_jobs_limit: null },
    CUSTOM:             { max_file_size_mb: 1024, daily_jobs_limit: null },
    SYSTEM:             { max_file_size_mb: 2048, daily_jobs_limit: null },
    DEMO:               { max_file_size_mb: 1024, daily_jobs_limit: null },
    PILOT:              { max_file_size_mb: 1024, daily_jobs_limit: null },
    TRIAL_ENTERPRISE:   { max_file_size_mb: 1024, daily_jobs_limit: null },
    ENTERPRISE_TRIAL:   { max_file_size_mb: 1024, daily_jobs_limit: null },
};

function normalizePlanCode(rawPlan) {
    if (!rawPlan) return 'FREE';
    const plan = String(rawPlan).toUpperCase();
    if (['DEMO', 'PILOT', 'TRIAL_ENTERPRISE', 'ENTERPRISE_TRIAL'].includes(plan)) {
        return 'ENTERPRISE'; // Map aliases to ENTERPRISE
    }
    return plan;
}

function getFallbackLimits(plan) {
    const norm = normalizePlanCode(plan);
    return FALLBACK_LIMITS[norm] || FALLBACK_LIMITS[plan] || FALLBACK_LIMITS['FREE'];
}

/**
 * @param {object} options
 * @param {string}  [options.action='job']     - Logical action name for audit logs
 * @param {boolean} [options.increment=false]  - Increment local usage counter
 * @param {boolean} [options.checkAiFix=false] - Enforce AI Magic Fix entitlement
 */
module.exports = (options = {}) => {
    return async (req, res, next) => {
        const { action = 'job', increment = false, checkAiFix = false } = options;
        const userId   = req.auth?.userId;
        const tenantId = req.auth?.tenantId || userId;
        const requestId = req.headers['x-request-id'] || req.id || 'system';

        if (!userId) {
            return res.status(401).json({
                error: 'AUTH_REQUIRED',
                message: 'Identity context required for governance.',
                traceId: requestId,
                v2: true
            });
        }

        try {
            // ── 1. Identity check (local DB — fast, always required) ──────────
            const users = await db.execute(`
                SELECT u.status, u.role, l.plan, l.ai_magic_fix_enabled,
                       l.daily_jobs_limit AS local_daily_jobs_limit,
                       l.jobs_used_today,
                       l.id AS license_id
                FROM users u
                LEFT JOIN licenses l ON u.id = l.user_id
                WHERE u.id = ?
            `, [userId]);

            if (users.length === 0) {
                return res.status(404).json({
                    error: 'USER_NOT_FOUND',
                    message: 'Node identity not recognized.',
                    traceId: requestId,
                    v2: true
                });
            }

            const user = users[0];

            if (user.status !== 'ACTIVE') {
                return res.status(403).json({
                    error: 'NODE_SUSPENDED',
                    message: 'Access to Preflight node is currently restricted.',
                    traceId: requestId,
                    v2: true
                });
            }

            // ── 2. Governance limits from Control Plane (cache-first) ─────────
            let cpLimits = null;
            let cpUnavailable = false;
            const bearerToken = req.headers['authorization'];

            try {
                cpLimits = await entitlementCache.getLimits(tenantId, bearerToken);
            } catch (cpErr) {
                cpUnavailable = true;
                console.warn(`[GOVERNANCE][${requestId}] Control Plane unavailable, using fallback limits:`, cpErr.message);
            }

            // Merge CP limits with local fallback
            const planCode = (await entitlementCache.getPlanCode(tenantId, bearerToken).catch(() => null))
                || user.plan
                || 'FREE';

            const fallback = getFallbackLimits(planCode.toUpperCase());

            const maxFileSizeMb  = cpLimits?.max_file_size_mb  ?? fallback.max_file_size_mb;
            const dailyJobsLimit = cpLimits?.daily_jobs_limit  ?? user.local_daily_jobs_limit ?? fallback.daily_jobs_limit;
            const maxJobSizeMb   = cpLimits?.max_job_size_mb   ?? null;
            const monthlyJobsLimit = cpLimits?.monthly_jobs_limit ?? null;

            console.log(`[GOVERNANCE-LIMIT-RESOLVED]`, {
                tenantId,
                userId,
                planCode: planCode,
                cpAvailable: !cpUnavailable,
                cpLimits,
                resolvedMaxFileSizeMb: maxFileSizeMb,
                resolvedMaxJobSizeMb: maxJobSizeMb,
                resolvedDailyJobsLimit: dailyJobsLimit,
                resolvedMonthlyJobsLimit: monthlyJobsLimit,
                source: !cpUnavailable ? 'CONTROL_PLANE' : (user.plan ? 'LOCAL_FALLBACK' : 'PLAN_ALIAS_FALLBACK')
            });

            // ── 3. Daily quota check ──────────────────────────────────────────
            // null dailyJobsLimit = unlimited (ENTERPRISE / FOUNDING_PRINTHOUSE / SYSTEM)
            if (dailyJobsLimit !== null && user.jobs_used_today >= dailyJobsLimit) {
                console.warn(`[GOVERNANCE-BLOCKED][${requestId}] User ${userId} exceeded daily quota (${user.jobs_used_today}/${dailyJobsLimit}) plan=${planCode}`);
                return res.status(429).json({
                    error: 'LICENSE_LIMIT_EXCEEDED',
                    code: 'DAILY_QUOTA_REACHED',
                    message: `Daily limit of ${dailyJobsLimit} jobs reached for plan ${planCode}.`,
                    plan: planCode,
                    cpSource: !cpUnavailable,
                    traceId: requestId,
                    v2: true
                });
            }

            // ── 4. File size check ────────────────────────────────────────────
            if (req.file && maxFileSizeMb !== null) {
                const fileSizeMb = req.file.size / (1024 * 1024);
                if (fileSizeMb > maxFileSizeMb) {
                    return res.status(413).json({
                        error: 'LICENSE_LIMIT_EXCEEDED',
                        code: 'FILE_TOO_LARGE',
                        message: `Plan ${planCode} supports up to ${maxFileSizeMb}MB per file. Received: ${fileSizeMb.toFixed(2)}MB.`,
                        plan: planCode,
                        limitMb: maxFileSizeMb,
                        fileSizeMb: parseFloat(fileSizeMb.toFixed(2)),
                        cpSource: !cpUnavailable,
                        traceId: requestId,
                        v2: true
                    });
                }
            }

            // ── 5. AI Magic Fix entitlement check ────────────────────────────
            if (checkAiFix && req.body?.repair === 'true') {
                // Ask CP first; fall back to local license flag
                let aiFixAllowed = user.ai_magic_fix_enabled;
                try {
                    aiFixAllowed = await entitlementCache.isFeatureEnabled(tenantId, 'ai_magic_fix', bearerToken);
                } catch {
                    // CP unavailable — use local value
                }

                if (!aiFixAllowed) {
                    return res.status(403).json({
                        error: 'FEATURE_NOT_ALLOWED',
                        code: 'AI_FIX_RESTRICTED',
                        message: `AI Magic Fix is not available on plan ${planCode}.`,
                        plan: planCode,
                        traceId: requestId,
                        v2: true
                    });
                }
            }

            // ── 6. Increment local usage counter (forensic) ──────────────────
            if (increment && user.license_id) {
                await db.execute(
                    'UPDATE licenses SET jobs_used_today = jobs_used_today + 1 WHERE id = ?',
                    [user.license_id]
                );
                await db.execute(
                    'INSERT INTO usage_logs (user_id, action, metadata) VALUES (?, ?, ?)',
                    [userId, `PREFLIGHT_${action.toUpperCase()}`, JSON.stringify({
                        plan: planCode,
                        status: 'SUCCESS',
                        cpSource: !cpUnavailable,
                    })]
                );
            }

            // ── 7. Attach enriched governance context for downstream consumers ─
            req.license = {
                ...user,
                plan: planCode,
                max_file_size_mb: maxFileSizeMb,
                daily_jobs_limit: dailyJobsLimit,
                cp_source: !cpUnavailable,
            };

            if (cpUnavailable) {
                console.warn(`[GOVERNANCE][${requestId}] CP unavailable — request allowed with fallback limits (plan=${planCode})`);
            }

            next();

        } catch (err) {
            console.error(`[GOVERNANCE-ERROR][${requestId}]`, err);
            res.status(500).json({
                error: 'GOVERNANCE_FAILURE',
                message: 'Resource check failed in license node.',
                traceId: requestId,
                v2: true
            });
        }
    };
};
