import { PreflightResult, Issue, Severity } from '../types';

/**
 * Robustly extracts findings from various possible backend payload locations.
 * Aligns with V2.4 canonical OS and legacy formats.
 */
export function normalizePreflightResult(payload: any): PreflightResult | null {
    if (!payload) return null;

    // 1. Identify the findings array
    let findings: any[] = [];

    // Try various canonical and legacy locations
    const candidatePaths = [
        payload.issues,
        payload.findings,
        payload.report?.issues,
        payload.report?.findings,
        payload.result?.report?.issues,
        payload.result?.findings,
        payload.summary?.findings,
        payload.anomalies,
        payload.warnings,
        payload.alerts,
        payload.data?.issues,
        payload.data?.findings
    ];

    for (const candidate of candidatePaths) {
        if (Array.isArray(candidate) && candidate.length > 0) {
            findings = candidate;
            break;
        }
        // If it's an empty array, we keep looking but treat it as a valid (but empty) source if no others found
        if (Array.isArray(candidate) && findings.length === 0) {
            findings = candidate;
        }
    }

    // 2. Normalize individual issues
    const normalizedIssues: Issue[] = findings.map((item, idx) => {
        // Handle both object issues and simple strings if any
        if (typeof item === 'string') {
            return {
                id: `finding-${idx}`,
                message: item,
                severity: Severity.WARNING,
                category: 'OTHER'
            };
        }

        return {
            ...item,
            id: item.id || item.uuid || `finding-${idx}`,
            message: item.message || item.title || item.description || 'Unknown deviation',
            severity: mapSeverity(item.severity || item.level || 'warning'),
            category: (item.category || item.type || 'GENERAL').toString().toUpperCase()
        };
    });

    // 3. Construct the PreflightResult
    return {
        score: payload.score ?? payload.report?.score ?? (normalizedIssues.length === 0 ? 100 : Math.max(0, 100 - normalizedIssues.length * 10)),
        summary: payload.summary ?? payload.report?.summary ?? (normalizedIssues.length === 0 ? 'Clean Trace: No issues detected.' : `${normalizedIssues.length} issues identified.`),
        issues: normalizedIssues,
        pages: payload.pages ?? payload.report?.pages ?? [],
        categorySummaries: payload.categorySummaries ?? payload.report?.categorySummaries ?? [],
        meta: {
            fileName: payload.meta?.fileName ?? payload.report?.meta?.fileName ?? 'unknown',
            fileSize: payload.meta?.fileSize ?? payload.report?.meta?.fileSize ?? 0,
            pageCount: payload.meta?.pageCount ?? payload.report?.meta?.pageCount ?? 0
        }
    };
}

/**
 * Maps various backend severity strings to canonical frontend Severity enum.
 */
function mapSeverity(sev: string): Severity | string {
    const s = sev.toLowerCase();
    if (['error', 'critical', 'fatal', 'blocker'].includes(s)) return Severity.ERROR;
    if (['warning', 'alert', 'warn'].includes(s)) return Severity.WARNING;
    if (['info', 'notice', 'advisory', 'low'].includes(s)) return Severity.INFO;
    return sev; // Preserve unknown severities as requested
}
