import { PreflightResult, Issue, Severity, WorkflowAnalysis, AppMode, ISSUE_CATEGORY } from '../types';

/**
 * deterministic status flags for UI components.
 */

const RANKED_ARTIFACT_KEYS = ['final_fixed_pdf', 'fixed_pdf', 'normalized_pdf', 'certified_pdf'];

export function getBestArtifactKey(artifacts: Record<string, string> | undefined | null): string | null {
    if (!artifacts) return null;
    for (const key of RANKED_ARTIFACT_KEYS) {
        if (artifacts[key]) return key;
    }
    return null;
}

export function isBleedIssue(issue: any): boolean {
    if (!issue) return false;
    const id = (issue.id || '').toString().toLowerCase();
    const code = (issue.code || '').toString().toUpperCase();
    if (['missing-bleed-info', 'insufficient-bleed'].includes(id)) return true;
    if (['BLEED_MISSING', 'BLEED_INSUFFICIENT', 'IND_BLEED'].includes(code)) return true;
    const msg = (issue.message || '').toString().toLowerCase();
    if (msg.includes('bleed') && (msg.includes('missing') || msg.includes('insufficient'))) return true;
    return false;
}

export function isTrimBoxIssue(issue: any): boolean {
    if (!issue) return false;
    const codes = ['TRIMBOX_MISSING', 'TRIM_BOX_ANOMALY', 'IND_GEOM_003', 'IND_TRIM', 'GEOM_TRIMBOX_MISSING'];
    const id = (issue.id || '').toString().toUpperCase();
    const code = (issue.code || '').toString().toUpperCase();
    const type = (issue.type || '').toString().toUpperCase();
    
    if (codes.includes(id) || codes.includes(code) || codes.includes(type)) return true;
    
    const title = (issue.title || '').toString().toLowerCase();
    const message = (issue.message || '').toString().toLowerCase();
    const desc = (issue.description || '').toString().toLowerCase();

    return [title, message, desc].some(t => t.includes('trim box') || t.includes('trimbox'));
}

export function analyzeWorkflow(
    result: PreflightResult | null,
    error: any,
    appMode: AppMode
): WorkflowAnalysis {
    const issues = result?.issues || [];
    const issueCount = issues.length;
    const errorCount = issues.filter(i => i.severity === 'error' || i.severity === Severity.ERROR).length;
    const warningCount = issues.filter(i => i.severity === 'warning' || i.severity === Severity.WARNING).length;

    const artifacts = result?.artifacts || {};
    const meta: any = result?.meta || {};

    const isAutofix = result?.type === 'AUTOFIX' || appMode === 'ai' || (result?.meta?.jobId && result.meta.jobId.startsWith('fix_'));
    const isAnalyzeOnly = result?.type === 'ANALYZE' || appMode === 'manual';

    const hasResult = !!result;
    const hasIssues = issueCount > 0;
    const hasErrors = errorCount > 0;

    const forensicDataMissing = (result as any)?._forensicDataMissing;
    const isDegraded = !!(result as any)?._isDegraded;

    const analysisFailed = !hasResult || (!!error && !hasIssues) || forensicDataMissing;

    const isCompliant = hasResult && !analysisFailed && issueCount === 0;

    // 1. Extract raw repair metadata robustly
    const reportRepairs = Array.isArray((result as any)?.report?.repairs) ? (result as any).report.repairs : [];
    const resultRepairs = Array.isArray((result as any)?.repairs) ? (result as any).repairs : [];
    const fixes = Array.isArray(result?.fixes) ? result.fixes : [];
    
    const allRepairs = [...reportRepairs, ...resultRepairs, ...fixes];
    const hasRepairMetadata = allRepairs.length > 0;

    // 2. Resolve artifacts
    const bestArtifactKey = getBestArtifactKey(artifacts);
    const hasFinalArtifact = !!bestArtifactKey;
    const hasCertified = !!artifacts.certified_pdf;
    
    const hasFixedArtifact = !!(
        artifacts.fixed_pdf || 
        artifacts.final_fixed_pdf || 
        artifacts.normalized_pdf
    );

    // 3. Derived autofix states (strict ordering)
    const isRealFix = isAutofix && (hasRepairMetadata || hasFixedArtifact);
    
    // Check multiple flags for NOOP to gracefully handle evolving API schemas
    const explicitNoOp = meta.noopFix === true || meta.no_effective_changes === true || meta.certificationMode === 'CERTIFIED_WITHOUT_MODIFICATION';
    const implicitNoOp = isCompliant && !meta.autofix_effective && !hasFixedArtifact;
    const isNoOpFix = isAutofix && (explicitNoOp || implicitNoOp);

    const hasEffectiveFix = hasFinalArtifact && (isAutofix ? (isRealFix || isNoOpFix) : true);

    const showComparison = isAutofix && isRealFix && hasFinalArtifact && !isNoOpFix;

    const rewritten = meta.rewritten === true || (!explicitNoOp && hasFixedArtifact);
    const certificationMode = meta.certificationMode || (explicitNoOp ? 'CERTIFIED_WITHOUT_MODIFICATION' : null);

    const analysis: WorkflowAnalysis = {
        isAutofix,
        isAnalyzeOnly,
        hasResult,
        issueCount,
        errorCount,
        warningCount,
        hasIssues,
        hasErrors,
        isCompliant,
        isFixed: isAutofix && !analysisFailed,
        isNoOpFix,
        isRealFix,
        isDegraded,
        analysisFailed: !!analysisFailed,
        hasCertified,
        hasFixedArtifact,
        showComparison,
        bestArtifactKey,
        hasEffectiveFix,
        rewritten,
        certificationMode
    };

    if (hasResult) {
        console.log('[WORKFLOW][ANALYSIS]', analysis);
    }
    
    return analysis;
}

/**
 * Parses raw job error payloads into a structured UI-friendly format.
 * v2.4.170: Preserves technical detail while providing human context.
 */
export function getReadableFixFailure(error: any): { title: string; summary: string; detail: string; code: string } {
    if (!error) {
        return {
            title: 'Automatic fix failed',
            summary: 'The system encountered an unexpected error during correction.',
            detail: 'No error information provided.',
            code: 'UNKNOWN_ERROR'
        };
    }

    const rawError = typeof error === 'string' ? error : (error.message || error.error || error.details || JSON.stringify(error));
    const code = error.code || (rawError.includes('[AUTOFIX-ENGINE-ERROR]') ? 'AUTOFIX_ENGINE_FAILURE' : 'FIX_ABORTED');

    let title = 'Automatic fix failed';
    let summary = 'The PDF processor could not generate a corrected file.';
    let detail = rawError;

    // Detect common PPOS engine failures
    if (rawError.includes('Ghostscript could not produce')) {
        summary = 'Ghostscript could not produce a corrected PDF from this file.';
    } else if (rawError.includes('circular reference')) {
        summary = 'The document contains a circular reference in its internal structure.';
    } else if (rawError.includes('LuaTeX')) {
        summary = 'The file contains complex LaTeX structures that are incompatible with standard processing.';
    } else if (rawError.includes('gs -dNOPAUSE')) {
        summary = 'The core rendering engine failed to process the document layers.';
    } else if (rawError.includes('AUTOFIX-INPUT-ERROR')) {
        summary = 'The engine could not find the input file to begin correction.';
    }

    return { title, summary, detail, code };
}


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
export function normalizePreflightResult(rawPayload: any): PreflightResult | null {
    if (!rawPayload) return null;

    const normalizedPayload = normalizeAutofixResultState(rawPayload);

    console.log('[STEP2][RAW-PAYLOAD]', normalizedPayload);

    // --- v2.4.94: Deep Flattening of Async Payloads ---
    // If the data is nested in 'result' (canonical async format), bring it to the root
    let payload = normalizedPayload;
    if (normalizedPayload.result && typeof normalizedPayload.result === 'object') {
        console.log('[STEP2][FLATTENING] Merging nested result into payload root');
        payload = { ...normalizedPayload, ...normalizedPayload.result };
    }
    // -------------------------------------------------

    // 1. Identify the findings array
    let findings: any[] = [];
    let sourceFound = false;

    // Try various canonical and legacy locations including warnings to ensure no diagnostic loss
    const candidateConfigs = [
        { path: payload.findings, isWarning: false },
        { path: payload.issues, isWarning: false },
        { path: payload.analysis?.findings, isWarning: false },
        { path: payload.analysis?.issues, isWarning: false },
        { path: payload.forensics?.findings, isWarning: false },
        { path: payload.report?.findings, isWarning: false },
        { path: payload.report?.issues, isWarning: false },
        { path: payload.result?.findings, isWarning: false },
        { path: payload.result?.issues, isWarning: false },
        { path: payload.result?.analysis?.findings, isWarning: false },
        { path: payload.result?.analysis?.issues, isWarning: false },
        { path: payload.result?.forensics?.findings, isWarning: false },
        { path: payload.warnings, isWarning: true },
        { path: payload.analysis_warnings, isWarning: true },
        { path: payload.data?.issues, isWarning: false },
        { path: payload.data?.findings, isWarning: false },
        { path: payload.report?.warnings, isWarning: true },
        { path: payload.result?.warnings, isWarning: true },
        { path: payload.result?.analysis_warnings, isWarning: true },
        { path: payload.result?.analysis?.warnings, isWarning: true },
        { path: payload.result?.report?.warnings, isWarning: true }
    ];

    candidateConfigs.forEach((c, idx) => {
        if (c.path) console.log(`[STEP2][CANDIDATE][${idx}]`, typeof c.path, Array.isArray(c.path), 'isWarning:', c.isWarning);
    });

    const seenIds = new Set<string>();
    const seenComposites = new Set<string>();

    for (const { path: candidate, isWarning } of candidateConfigs) {
        if (Array.isArray(candidate)) {
            sourceFound = true;
            for (const item of candidate) {
                if (item !== undefined && item !== null) {
                    if (typeof item === 'string') {
                        const key = `str:${item}`;
                        if (!seenIds.has(key)) {
                            seenIds.add(key);
                            findings.push(item);
                        }
                    } else {
                        const id = item.id || item.uuid;
                        if (id) {
                            const idStr = String(id);
                            if (!seenIds.has(idStr)) {
                                seenIds.add(idStr);
                                const findingItem = {
                                    ...item,
                                    severity: item.severity || item.level || (isWarning ? 'warning' : undefined),
                                    type: item.type || (isWarning ? 'WARNING' : undefined)
                                };
                                findings.push(findingItem);
                            }
                        } else {
                            const code = item.code || item.rule || '';
                            const page = item.page ?? item.pageNumber ?? '';
                            const severity = item.severity || item.level || (isWarning ? 'warning' : '');
                            const message = item.message || item.user_message || '';
                            const compositeKey = `${code}|${page}|${severity}|${message}`;
                            if (!seenComposites.has(compositeKey)) {
                                seenComposites.add(compositeKey);
                                const findingItem = {
                                    ...item,
                                    severity: item.severity || item.level || (isWarning ? 'warning' : undefined),
                                    type: item.type || (isWarning ? 'WARNING' : undefined)
                                };
                                findings.push(findingItem);
                            }
                        }
                    }
                }
            }
        }
    }

    // --- v2.4.97: Aggressive Source Detection ---
    // Specifically check if technical indicators exist beyond just top-level object presence
    const hasTechnicalIndicators = !!(
        payload.score !== undefined || 
        payload.summary || 
        payload.report?.meta || 
        payload.report?.status === 'COMPLETED'
    );
    
    if (!sourceFound && hasTechnicalIndicators) {
        console.log('[STEP2][AGGRESSIVE-DETECTION] Source marked as found via technical indicators');
        sourceFound = true;
    }
    // --------------------------------------------

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
        const isTrimBox = isTrimBoxIssue(item);
        const isBleed = isBleedIssue(item);

        const normalized: Issue = {
            ...item,
            id: item.id || item.uuid || item.code || item.rule || `finding-${idx}`,
            title: item.title || item.summary || hRule || item.rule || item.code || (item.id && !item.id.includes('finding-') ? item.id : null) || (item.message !== 'Technical preflight finding' ? item.message : null) || 'Technical preflight finding',
            message: (item.message === 'Technical preflight finding' ? (hDesc || item.message) : (item.message || item.user_message || hDesc || 'System deviation detected.')),
            description: item.description || item.details || item.explanation || hDesc || item.summary || '',
            recommendation: item.recommendation || item.suggested_fix || item.fixText || item.hint || '',
            severity: mapSeverity(item.severity || item.level || 'warning'),
            category: isTrimBox ? 'GEOMETRY' : isBleed ? ISSUE_CATEGORY.BLEED_MARGINS : (item.category || item.type || 'General').toString().toUpperCase(),
            page: item.page ?? item.pageNumber ?? item.metadata?.page ?? null,
            fixable: isTrimBox ? true : isBleed ? true : !!(item.fixable || item.fixAvailable || item.fix?.available || item.isFixable),
            fixRequired: item.fixRequired ?? undefined,
            safeToAutofix: item.safeToAutofix ?? undefined,
            confidence: item.confidence ?? undefined,
            destructiveFixRisk: item.destructiveFixRisk ?? undefined,
            repairStrategy: isTrimBox ? "REBUILD_TRIMBOX" : isBleed ? "APPLY_BLEED" : item.repairStrategy,
            fix_method: isTrimBox ? "REBUILD_TRIMBOX" : isBleed ? "APPLY_BLEED" : item.fix_method,
            raw: item // Keep for debugging
        };

        if (idx === 0) {
            console.log('[ISSUE][RAW]', item);
            console.log('[ISSUE][NORMALIZED]', normalized);
        }

        return normalized;
    });

    const pageCount = payload.meta?.pageCount ?? payload.report?.meta?.pageCount ?? payload.pages?.length ?? payload.report?.pages?.length ?? null;

    let derivedSummaryFallback: any = null;
    if (normalizedIssues.length > 0) {
        const errs = normalizedIssues.filter(i => i.severity === Severity.ERROR).length;
        const warns = normalizedIssues.filter(i => i.severity === Severity.WARNING).length;
        derivedSummaryFallback = {
            risk_level: errs > 0 ? 'CRITICAL' : (warns > 0 ? 'WARNING' : 'LOW'),
            risk_score: errs > 0 ? 100 : (warns > 0 ? 50 : 10),
            issue_count: normalizedIssues.length,
            derived: true
        };
    }

    const resolvedSummary = payload.summary !== undefined && payload.summary !== null
        ? payload.summary
        : (payload.summary_text ?? payload.summary?.before?.text ?? payload.report?.summary ?? derivedSummaryFallback ?? (sourceFound ? null : 'Analysis data unavailable'));

    // 3. Construct the PreflightResult
    const result: PreflightResult = {
        type: (payload.type || payload.result?.type || payload.job_type || '').toUpperCase() as any,
        sourceJobId: payload.sourceJobId || payload.meta?.sourceJobId || undefined,
        artifacts: payload.artifacts ?? payload.result?.artifacts ?? {},
        score: payload.score ?? payload.report?.score ?? (resolvedSummary?.risk_score ?? (sourceFound ? 0 : null)),
        summary: resolvedSummary,
        issues: normalizedIssues,
        fixes: payload.fixes ?? payload.repairs ?? payload.result?.fixes ?? payload.result?.repairs ?? [],
        repairs: payload.repairs ?? payload.fixes ?? payload.result?.repairs ?? payload.result?.fixes ?? [],
        requested_fixes: payload.requested_fixes ?? payload.result?.requested_fixes ?? undefined,
        applied_fixes: payload.applied_fixes ?? payload.result?.applied_fixes ?? undefined,
        skipped_fixes: payload.skipped_fixes ?? payload.result?.skipped_fixes ?? undefined,
        failed_fixes: payload.failed_fixes ?? payload.result?.failed_fixes ?? undefined,
        pages: payload.pages ?? payload.report?.pages ?? [],
        categorySummaries: payload.categorySummaries ?? payload.report?.categorySummaries ?? [],
        meta: {
            fileName: payload.meta?.fileName ?? payload.document?.name ?? payload.report?.meta?.fileName ?? payload.filename ?? 'unknown',
            fileSize: payload.meta?.fileSize ?? payload.document?.size ?? payload.report?.meta?.fileSize ?? payload.size ?? 0,
            pageCount: payload.meta?.pageCount ?? payload.document?.page_count ?? pageCount ?? 0,
            jobId: pickCanonicalJobId(payload.jobId, payload.job_id, payload.meta?.jobId, payload.id) || 'unknown',
            sourceJobId: payload.sourceJobId || payload.meta?.sourceJobId || undefined,
            noopFix: payload.meta?.noopFix ?? payload.noopFix ?? undefined,
            rewritten: payload.meta?.rewritten ?? payload.rewritten ?? undefined,
            certificationMode: payload.meta?.certificationMode ?? payload.certificationMode ?? undefined,
            autofix_effective: payload.meta?.autofix_effective ?? payload.autofix_effective ?? undefined,
            no_effective_changes: payload.meta?.no_effective_changes ?? payload.no_effective_changes ?? undefined
        }
    };

    // Preserve rich fields on result directly if present for Step3/Step4
    if (resolvedSummary && typeof resolvedSummary === 'object') {
        (result as any).summaryObject = resolvedSummary;
    }
    if (payload.document) {
        (result as any).document = payload.document;
    }
    if (payload.findings_before) {
        (result as any).findings_before = payload.findings_before;
    }
    if (payload.findings_after) {
        (result as any).findings_after = payload.findings_after;
    }
    if (payload.unresolved_findings) {
        (result as any).unresolved_findings = payload.unresolved_findings;
    }
    if (payload.artifactList) {
        (result as any).artifactList = payload.artifactList;
    }
    if (payload.degraded_reasons) {
        (result as any).degraded_reasons = payload.degraded_reasons;
    }

    (result as any).status = payload.status || payload.final_status;
    (result as any).final_status = payload.final_status || payload.status;
    (result as any).technicallyFixed = payload.technicallyFixed ?? (payload.summary?.after?.technically_fixed ?? payload.summaryObject?.after?.technically_fixed ?? undefined);
    (result as any).productionCertified = payload.productionCertified ?? (payload.summary?.after?.production_certified ?? payload.summaryObject?.after?.production_certified ?? undefined);
    (result as any).requiresHumanReview = payload.requiresHumanReview ?? (payload.summary?.after?.requires_human_review ?? payload.summaryObject?.after?.requires_human_review ?? undefined);
    (result as any).reviewReasons = payload.reviewReasons ?? (payload.summary?.after?.review_reasons ?? payload.summaryObject?.after?.review_reasons ?? undefined);
    (result as any).destructiveRiskSummary = payload.destructiveRiskSummary ?? (payload.summary?.after?.destructive_risk ?? payload.summaryObject?.after?.destructive_risk ?? undefined);
    (result as any).finalRiskLevel = payload.finalRiskLevel ?? (payload.summary?.after?.risk_level ?? payload.summaryObject?.after?.risk_level ?? undefined);
    (result as any).finalScoreBasis = payload.finalScoreBasis;

    // --- v2.4.140: Fail-Loud Forensic Detection ---
    const hasTechnicalData = sourceFound || (normalizedIssues.length > 0) || (result.score !== null);
    const isDegraded = !!(payload.degraded || payload.partial || payload._degraded);
    
    (result as any)._forensicDataMissing = !hasTechnicalData;
    (result as any)._isDegraded = isDegraded;

    if (!hasTechnicalData) {
        console.error('[STEP2][CRITICAL] Forensic data expected but not found in payload.', {
            id: result.meta.jobId,
            status: payload.status
        });
    }

    if (!hasTechnicalData && payload.status === 'FAILED') {
        console.warn('[STEP2][NORMALIZED][FAILED-JOB] Constructing partial result for failed job.');
    }

    console.log('[STEP2][NORMALIZED]', result);
    return result;
}

/**
 * Strict canonical ID resolver.
 * Only accepts values that are strings and start with the contract prefix 'job_'.
 * This prevents numeric database IDs (e.g., '32') from leaking into public identifiers.
 */
export function pickCanonicalJobId(...candidates: any[]): string | null {
    const fixId = candidates.find(c => typeof c === 'string' && c.startsWith('fix_'));
    if (fixId) return fixId;

    const jobId = candidates.find(c => typeof c === 'string' && c.startsWith('job_'));
    if (jobId) return jobId;

    for (const c of candidates) {
        if (c && (typeof c === 'number' || (!c.toString().startsWith('job_') && !c.toString().startsWith('fix_')))) {
            console.warn('[JOB-ID][REJECTED] Ignoring non-canonical identifier candidate:', c);
        }
    }
    return null;
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

export function getCanonicalFileName(payload: any, originalFile: File | { name: string } | null): string {
    const meta = payload?.meta || {};
    const jobFileName = meta.fileName || payload?.filename || meta.filename;
    const isInternalUuid = jobFileName && /^[0-9a-f-]{36}/.test(jobFileName);
    const isGenericName = jobFileName && jobFileName.toLowerCase().includes('unknown');

    if (!jobFileName || isInternalUuid || isGenericName) {
        return originalFile?.name || jobFileName || 'certified_document.pdf';
    }
    return jobFileName;
}

export function normalizeAutofixFinalState(report: any): any {
  if (!report) return report;

  // Ensure report has summary object
  if (!report.summary) {
    report.summary = { before: null, after: null };
  }

  // Support summaryObject mapping
  const summaryObject = report.summaryObject || {};
  if (!report.summary.before && summaryObject.before) {
    report.summary.before = summaryObject.before;
  }
  if (!report.summary.after && summaryObject.after) {
    report.summary.after = summaryObject.after;
  }

  // Extract fixes arrays
  const unresolved = report.unresolved_findings || report.findings_after || [];
  const failedFixes = report.failed_fixes || [];
  const skippedFixes = report.skipped_fixes || [];
  const appliedFixes = report.applied_fixes || report.fixes || report.repairs || [];

  // Determine review requirements
  const requiresReview = appliedFixes.some((f: any) =>
    f && (
      f.requires_human_review === true ||
      f.requiresHumanReview === true ||
      f.destructiveFixRisk === 'HIGH' ||
      f.destructive_fix_risk === 'HIGH' ||
      f.industrial_quality === 'LIMITED' ||
      f.industrialQuality === 'LIMITED'
    )
  );

  // Derive highest destructive risk
  let highestRisk = 'LOW';
  appliedFixes.forEach((f: any) => {
    if (!f) return;
    const risk = (f.destructiveFixRisk || f.destructive_fix_risk || '').toUpperCase();
    if (risk === 'HIGH') {
      highestRisk = 'HIGH';
    } else if (risk === 'MEDIUM' && highestRisk !== 'HIGH') {
      highestRisk = 'MEDIUM';
    }
  });

  // Calculate technical fixed status
  const technicallyFixed =
    failedFixes.length === 0 &&
    unresolved.length === 0 &&
    appliedFixes.length > 0 &&
    report._isDegraded !== true;

  // Calculate production certified status
  const productionCertified =
    technicallyFixed &&
    requiresReview === false &&
    highestRisk !== 'HIGH';

  // Determine if an output artifact exists
  const hasArtifactsField = report.artifacts !== undefined || report.artifactList !== undefined;
  const hasOutputArtifact = !hasArtifactsField || !!(
    report.artifacts?.final_fixed_pdf || 
    report.artifacts?.fixed_pdf || 
    report.artifacts?.certified_pdf || 
    report.artifacts?.normalized_pdf ||
    (Array.isArray(report.artifactList) && report.artifactList.some((a: any) => ['final_fixed_pdf', 'fixed_pdf', 'certified_pdf', 'normalized_pdf'].includes(a.type)))
  );

  // Determine final status
  let status = report.status || report.final_status || 'AUTOFIX_COMPLETED';

  if (report._isDegraded === true || (report.degraded_reasons && report.degraded_reasons.length > 0)) {
    status = 'AUTOFIX_DEGRADED';
  } else if (failedFixes.length > 0 || !hasOutputArtifact) {
    status = 'AUTOFIX_FAILED';
  } else if (unresolved.length > 0 || skippedFixes.length > 0) {
    status = 'AUTOFIX_PARTIAL';
  } else if (technicallyFixed) {
    if (requiresReview || highestRisk === 'HIGH') {
      status = 'COMPLETED_WITH_REVIEW';
    } else {
      status = 'AUTOFIX_COMPLETED';
    }
  }

  // Extract review reasons
  const reviewReasons: string[] = [];
  appliedFixes.forEach((f: any) => {
    if (!f) return;
    if (
      f.requires_human_review === true ||
      f.requiresHumanReview === true ||
      f.destructiveFixRisk === 'HIGH' ||
      f.destructive_fix_risk === 'HIGH' ||
      f.industrial_quality === 'LIMITED' ||
      f.industrialQuality === 'LIMITED'
    ) {
      const code = f.code || f.strategy || f.repairStrategy || 'UNKNOWN_REPAIR';
      if (!reviewReasons.includes(code)) {
        reviewReasons.push(code);
      }
    }
  });

  // Derive final risk level
  let finalRiskLevel = 'LOW';
  if (status === 'COMPLETED_WITH_REVIEW') {
    finalRiskLevel = 'REVIEW_REQUIRED';
  } else if (status === 'AUTOFIX_FAILED') {
    finalRiskLevel = 'CRITICAL';
  } else if (status === 'AUTOFIX_PARTIAL') {
    finalRiskLevel = 'WARNING';
  }

  // Derive risk score
  const scoreBasis = 'AUTOFIX_FINAL_STATE';
  const riskScore = status === 'AUTOFIX_COMPLETED' ? 100 : (status === 'COMPLETED_WITH_REVIEW' ? 20 : 0);

  // Generate or enrich summary.after
  if (!report.summary.after) {
    report.summary.after = {
      risk_level: finalRiskLevel,
      risk_score: riskScore,
      scoreBasis,
      issue_count: unresolved.length,
      unresolved_count: unresolved.length,
      failed_fix_count: failedFixes.length,
      skipped_fix_count: skippedFixes.length,
      applied_fix_count: appliedFixes.length,
      technically_fixed: technicallyFixed,
      production_certified: productionCertified,
      requires_human_review: requiresReview,
      review_required_count: reviewReasons.length,
      review_reasons: reviewReasons,
      destructive_risk: highestRisk,
      status
    };
  } else {
    const after = report.summary.after;
    after.risk_level = after.risk_level ?? finalRiskLevel;
    after.risk_score = after.risk_score ?? riskScore;
    after.scoreBasis = after.scoreBasis ?? scoreBasis;
    after.issue_count = after.issue_count ?? unresolved.length;
    after.unresolved_count = after.unresolved_count ?? unresolved.length;
    after.failed_fix_count = after.failed_fix_count ?? failedFixes.length;
    after.skipped_fix_count = after.skipped_fix_count ?? skippedFixes.length;
    after.applied_fix_count = after.applied_fix_count ?? appliedFixes.length;
    after.technically_fixed = after.technically_fixed ?? technicallyFixed;
    after.production_certified = after.production_certified ?? productionCertified;
    after.requires_human_review = after.requires_human_review ?? requiresReview;
    after.review_required_count = after.review_required_count ?? reviewReasons.length;
    after.review_reasons = after.review_reasons ?? reviewReasons;
    after.destructive_risk = after.destructive_risk ?? highestRisk;
    after.status = after.status ?? status;
  }

  // Sync both summary and summaryObject consistently
  report.summaryObject = {
    before: report.summary.before,
    after: report.summary.after
  };

  // Top-level fields
  report.status = status;
  report.final_status = status;
  report.technicallyFixed = technicallyFixed;
  report.productionCertified = productionCertified;
  report.requiresHumanReview = requiresReview;
  report.reviewReasons = reviewReasons;
  report.destructiveRiskSummary = highestRisk;
  report.finalRiskLevel = finalRiskLevel;
  report.finalScoreBasis = scoreBasis;

  // Fallback score setting
  if (report.score === undefined || report.score === null || report.score === 100 || report.score === 0) {
    report.score = report.summary.after.risk_score;
  }

  return report;
}

export function normalizeAutofixResultState(payload: any): any {
  if (!payload || typeof payload !== 'object') {
    return payload;
  }

  try {
    const hasAppliedFixes = Array.isArray(payload.applied_fixes) || Array.isArray(payload.repairs) || Array.isArray(payload.fixes);
    const hasFixedPdf = payload.final_fixed_pdf || payload.fixed_pdf || payload.artifacts?.final_fixed_pdf || payload.artifacts?.fixed_pdf || (Array.isArray(payload.artifactList) && payload.artifactList.some((a: any) => a.type === 'final_fixed_pdf' || a.type === 'fixed_pdf'));
    const isAutofix = payload.type === 'AUTOFIX' || (hasAppliedFixes && hasFixedPdf);

    if (isAutofix) {
      return normalizeAutofixFinalState(payload);
    }

    const nestedPaths = [
      ['result'],
      ['data', 'result'],
      ['report'],
      ['data', 'report'],
      ['job', 'result'],
      ['job', 'report'],
      ['fixResult'],
      ['autofixResult']
    ];

    for (const path of nestedPaths) {
      let current = payload;
      for (let i = 0; i < path.length - 1; i++) {
        current = current ? current[path[i]] : undefined;
      }
      const lastKey = path[path.length - 1];
      if (current && typeof current === 'object' && current[lastKey] && typeof current[lastKey] === 'object') {
        const nestedObj = current[lastKey];
        const nestedHasAppliedFixes = Array.isArray(nestedObj.applied_fixes) || Array.isArray(nestedObj.repairs) || Array.isArray(nestedObj.fixes);
        const nestedHasFixedPdf = nestedObj.final_fixed_pdf || nestedObj.fixed_pdf || nestedObj.artifacts?.final_fixed_pdf || nestedObj.artifacts?.fixed_pdf || (Array.isArray(nestedObj.artifactList) && nestedObj.artifactList.some((a: any) => a.type === 'final_fixed_pdf' || a.type === 'fixed_pdf'));
        const nestedIsAutofix = nestedObj.type === 'AUTOFIX' || (nestedHasAppliedFixes && nestedHasFixedPdf);
        if (nestedIsAutofix) {
          current[lastKey] = normalizeAutofixFinalState(nestedObj);
        }
      }
    }
  } catch (err: any) {
    console.warn(`[FE][NORMALIZER][RESULT][WARN] Failed to normalize result state: ${err.message}`);
  }
  return payload;
}
