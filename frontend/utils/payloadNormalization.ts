import { PreflightResult, Issue, Severity } from '../types';

function humanizeRule(code: string | undefined | null): string | null {
    if (!code) return null;
    const c = String(code).toUpperCase();
    const mapping: Record<string, string> = {
        'IND_GEOM': 'Geometry Violation',
        'IND_TYPE': 'Typography Incompatibility',
        'IND_COLOR': 'Color Space Deviation',
        'IND_BOX': 'Dimension Mismatch',
        'IND_IMAGE': 'Image Quality Alert',
        'IND_BLEED': 'Bleed Margin Warning',
        'IND_TRIM': 'Trim Box Anomaly',
        'IND_PDF': 'PDF Version Deviation',
        'IND_FONT': 'Font Embedding Issue',
        'IND_BLACK': 'Rich Black Overload',
        'IND_SPOT': 'Spot Color Alert'
    };

    // Partial match for codes like IND_GEOM_002
    for (const [key, val] of Object.entries(mapping)) {
        if (c.startsWith(key)) return val;
    }

    return null;
}

function humanizeDescription(code: string | undefined | null): string | null {
    if (!code) return null;
    const c = String(code).toUpperCase();
    const mapping: Record<string, string> = {
        'IND_GEOM': 'The document contains geometry variations that may affect centering and alignment during the printing process.',
        'IND_TYPE': 'One or more fonts or text elements appear legacy or incompatible with the target print profile, which could cause rendering errors.',
        'IND_COLOR': 'A color space deviation was detected. Some elements may use RGB or non-standard profiles that will shift when converted.',
        'IND_BOX': 'The page boundary boxes (Trim, Bleed, Media) are inconsistent or missing, which is critical for automated imposition.',
        'IND_IMAGE': 'Some graphical assets have a resolution lower than the 300 DPI industry standard, risking pixelation.',
        'IND_BLEED': 'No bleed margins were detected. Background elements end exactly at the trim line, creating a risk of white edges after cutting.',
        'IND_TRIM': 'The trim box is not correctly defined or is too close to critical content, which may result in content loss.',
        'IND_PDF': 'The PDF version or structure does not strictly follow the PDF/X output intent standard.',
        'IND_FONT': 'There are non-embedded fonts in the file. The printer may substitute them with generic typefaces.',
        'IND_BLACK': 'Some black elements use a total ink coverage above 320%, which may cause smearing or drying issues.',
        'IND_SPOT': 'Document uses spot colors (Pantones) that are not part of the standard CMYK target process.'
    };

    for (const [key, val] of Object.entries(mapping)) {
        if (c.startsWith(key)) return val;
    }
    return null;
}

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

        const hRule = humanizeRule(item.rule || item.code || item.id);
        const hDesc = humanizeDescription(item.rule || item.code || item.id);

        const normalized = {
            ...item,
            id: item.id || item.uuid || item.code || item.rule || `finding-${idx}`,
            title: item.title || item.summary || hRule || item.rule || item.code || (item.id && !item.id.includes('finding-') ? item.id : null) || (item.message !== 'Technical preflight finding' ? item.message : null) || 'Technical preflight finding',
            message: (item.message === 'Technical preflight finding' ? (hDesc || item.message) : (item.message || item.user_message || hDesc || 'System deviation detected.')),
            description: item.description || item.details || item.explanation || hDesc || item.summary || '',
            recommendation: item.recommendation || item.suggested_fix || item.fixText || item.hint || '',
            severity: mapSeverity(item.severity || item.level || 'warning'),
            category: (item.category || item.type || 'General').toString().toUpperCase(),
            page: item.page ?? item.pageNumber ?? item.metadata?.page ?? null,
            fixable: !!(item.fixable || item.fixAvailable || item.fix?.available || item.isFixable),
            raw: item // Keep for debugging
        };

        if (idx === 0) {
            console.log('[ISSUE][RAW]', item);
            console.log('[ISSUE][NORMALIZED]', normalized);
        }

        return normalized;
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
