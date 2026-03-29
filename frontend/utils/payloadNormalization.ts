import { PreflightResult, Issue, Severity } from '../types';

/**
 * Robustly extracts findings from various possible backend payload locations.
 * Aligns with V2.4 canonical OS and legacy formats.
 */
export function normalizePreflightResult(payload: any): PreflightResult | null {
    if (!payload) return null;

    console.log('[STEP2][RAW-PAYLOAD]', payload);

    // 1. Identify the findings array
    let findings: any[] = [];
    let sourceFound = false;

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
        if (Array.isArray(candidate)) {
            findings = candidate;
            sourceFound = true;
            if (candidate.length > 0) break;
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
            id: item.id || item.uuid || item.code || item.rule || `finding-${idx}`,
            title: item.title || item.message || item.rule || item.code || 'Technical Finding',
            message: item.message || item.description || item.details || 'Preflight deviation detected.',
            description: item.description || item.details || item.explanation || '',
            recommendation: item.recommendation || item.suggested_fix || item.fixText || '',
            severity: mapSeverity(item.severity || item.level || 'warning'),
            category: (item.category || item.type || 'General').toString().toUpperCase(),
            page: item.page ?? item.pageNumber ?? item.metadata?.page ?? null,
            fixable: !!(item.fixable || item.fixAvailable || item.fix?.available || item.isFixable),
            raw: item // Keep for debugging
        };
    });

    const pageCount = payload.meta?.pageCount ?? payload.report?.meta?.pageCount ?? payload.pages?.length ?? payload.report?.pages?.length ?? null;

    // 3. Construct the PreflightResult
    const result: PreflightResult = {
        score: payload.score ?? payload.report?.score ?? (sourceFound && normalizedIssues.length === 0 ? 100 : (normalizedIssues.length > 0 ? Math.max(0, 100 - normalizedIssues.length * 10) : 0)),
        summary: payload.summary ?? payload.report?.summary ?? (sourceFound ? (normalizedIssues.length === 0 ? 'Clean Trace: No issues detected.' : `${normalizedIssues.length} issues identified.`) : 'Analysis data unavailable'),
        issues: normalizedIssues,
        pages: payload.pages ?? payload.report?.pages ?? [],
        categorySummaries: payload.categorySummaries ?? payload.report?.categorySummaries ?? [],
        meta: {
            fileName: payload.meta?.fileName ?? payload.report?.meta?.fileName ?? payload.filename ?? 'unknown',
            fileSize: payload.meta?.fileSize ?? payload.report?.meta?.fileSize ?? payload.size ?? 0,
            pageCount: pageCount ?? 0,
            jobId: payload.jobId ?? payload.job_id ?? payload.id
        }
    };

    // Add a flag for UI to detect missing forensic data
    (result as any)._forensicDataMissing = !sourceFound;

    console.log('[STEP2][NORMALIZED]', result);
    return result;
}

/**
 * Maps various backend severity strings to canonical frontend Severity enum.
 */
function mapSeverity(sev: string): Severity {
    const s = String(sev || 'info').toLowerCase();
    if (['error', 'critical', 'fatal', 'blocker'].includes(s)) return Severity.ERROR;
    if (['warning', 'alert', 'warn'].includes(s)) return Severity.WARNING;
    return Severity.INFO;
}
