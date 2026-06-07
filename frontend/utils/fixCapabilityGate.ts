/**
 * Phase APP-40.2 — Fix Request Whitelist.
 *
 * The frontend must stop assuming which fixes the engine supports. Before any
 * `requestedFixes` payload is sent to `POST /api/v2/jobs/:jobId/actions/fix`,
 * it must be classified against the live capability contract
 * (`GET /api/v2/preflight/capabilities`, see `usePreflightCapabilities`).
 */

export interface PreflightCapability {
    code: string;
    label?: string;
    category?: string;
    implemented?: boolean;
    autofixable?: boolean;
    requires_human_review?: boolean;
    production_safe?: boolean;
    diagnostic_only?: boolean;
    customer_reupload_recommended?: boolean;
    operator_review_required?: boolean;
    trust_level?: string;
}

export interface RequestedFixRow {
    id?: string;
    repairStrategy: string | null;
    [key: string]: any;
}

export interface FixCapabilityGateResult {
    allowedFixes: RequestedFixRow[];
    reviewOnlyFixes: RequestedFixRow[];
    diagnosticOnlyFixes: RequestedFixRow[];
    unsupportedFixes: RequestedFixRow[];
}

function findCapability(code: string | null | undefined, capabilities: PreflightCapability[]): PreflightCapability | undefined {
    if (!code) return undefined;
    const upper = code.toUpperCase();
    return capabilities.find((c) => (c.code || '').toUpperCase() === upper);
}

/**
 * Classifies each requested fix against the capability contract.
 *
 * Rules (per PHASE APP-40.2):
 * - Unknown code, `implemented=false`, or `autofixable=false` → unsupported (never sent to engine).
 * - `diagnostic_only=true` → diagnostic-only (shown to user, never sent to engine).
 * - `requires_human_review=true` → review-only (sent, but surfaced as FIXED_REVIEW_REQUIRED).
 * - Otherwise → allowed.
 */
export function filterRequestedFixesByCapability(
    requestedFixes: RequestedFixRow[] | null | undefined,
    capabilities: PreflightCapability[] | null | undefined,
): FixCapabilityGateResult {
    const result: FixCapabilityGateResult = {
        allowedFixes: [],
        reviewOnlyFixes: [],
        diagnosticOnlyFixes: [],
        unsupportedFixes: [],
    };

    const fixes = Array.isArray(requestedFixes) ? requestedFixes : [];
    const caps = Array.isArray(capabilities) ? capabilities : [];

    // Without a capability contract we cannot vouch for anything — treat everything
    // as unsupported rather than silently letting unverified fixes through.
    if (caps.length === 0) {
        result.unsupportedFixes = fixes;
        return result;
    }

    for (const fix of fixes) {
        const capability = findCapability(fix?.repairStrategy, caps);

        if (!capability || capability.implemented === false || capability.autofixable === false) {
            result.unsupportedFixes.push(fix);
            continue;
        }

        if (capability.diagnostic_only === true) {
            result.diagnosticOnlyFixes.push(fix);
            continue;
        }

        if (capability.requires_human_review === true) {
            result.reviewOnlyFixes.push(fix);
            continue;
        }

        result.allowedFixes.push(fix);
    }

    return result;
}

/** Fixes that may be safely submitted to the engine (allowed + review-only, never diagnostic/unsupported). */
export function getSubmittableFixes(gate: FixCapabilityGateResult): RequestedFixRow[] {
    return [...gate.allowedFixes, ...gate.reviewOnlyFixes];
}

export function logCapabilityGateDecision(gate: FixCapabilityGateResult): void {
    console.log('[APP][FIX-CAPABILITY-GATE]', {
        allowed: gate.allowedFixes.map((f) => f.repairStrategy),
        reviewOnly: gate.reviewOnlyFixes.map((f) => f.repairStrategy),
        diagnosticOnly: gate.diagnosticOnlyFixes.map((f) => f.repairStrategy),
        unsupported: gate.unsupportedFixes.map((f) => f.repairStrategy),
    });
}
