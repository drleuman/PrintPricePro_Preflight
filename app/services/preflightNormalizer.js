'use strict';

/**
 * Central helper to preserve source ANALYZE context when presenting AUTOFIX results.
 * Implements non-lossy normalization toward the Canonical APP/BFF AUTOFIX shape.
 */

const sourceJobCache = new Map(); // sourceJobId -> sourceAnalyzeJob payload
const fixJobLinks = new Map();    // fixJobId -> sourceJobId

function cacheSourceJob(sourceJobId, sourceJobData) {
  if (sourceJobId && sourceJobData) {
    sourceJobCache.set(sourceJobId, sourceJobData);
    console.log(`[BFF][NORMALIZER][CACHE] Cached source analyze job context for: ${sourceJobId}`);
  }
}

function linkFixJob(fixJobId, sourceJobId) {
  if (fixJobId && sourceJobId) {
    fixJobLinks.set(fixJobId, sourceJobId);
    console.log(`[BFF][NORMALIZER][LINK] Linked fixJobId: ${fixJobId} -> sourceJobId: ${sourceJobId}`);
  }
}

function getLinkedSourceJobId(fixJobId) {
  if (!fixJobId) return null;
  return fixJobLinks.get(fixJobId) || null;
}

function getCachedSourceJob(fixJobId, rawFixJob) {
  let sourceJobId = fixJobLinks.get(fixJobId);
  if (!sourceJobId && rawFixJob) {
    const fetched = getSourceJobId(rawFixJob, null);
    if (fetched !== "job_unknown") {
      sourceJobId = fetched;
    }
  }
  if (sourceJobId && sourceJobId.startsWith('job_')) {
    return sourceJobCache.get(sourceJobId) || null;
  }
  return null;
}

function getJobId(rawFixJob) {
  const candidates = [
    rawFixJob?.jobId,
    rawFixJob?.id,
    rawFixJob?.fixJobId,
    rawFixJob?.targetJobId,
    rawFixJob?.job_id,
    rawFixJob?.result?.jobId,
    rawFixJob?.result?.id,
    rawFixJob?.result?.fixJobId,
    rawFixJob?.result?.targetJobId,
    rawFixJob?.result?.meta?.jobId
  ];
  const fixId = candidates.find(c => typeof c === 'string' && c.startsWith('fix_'));
  if (fixId) return fixId;
  const jobId = candidates.find(c => typeof c === 'string' && c.startsWith('job_'));
  return jobId || "fix_unknown";
}

function getSourceJobId(rawFixJob, sourceAnalyzeJob) {
  const fixJobId = getJobId(rawFixJob);
  const candidates = [
    rawFixJob?.sourceJobId,
    rawFixJob?.source_job_id,
    rawFixJob?.parentJobId,
    rawFixJob?.parent_job_id,
    rawFixJob?.originalJobId,
    rawFixJob?.original_job_id,
    rawFixJob?.analyzeJobId,
    rawFixJob?.analyze_job_id,
    rawFixJob?.result?.sourceJobId,
    rawFixJob?.result?.source_job_id,
    rawFixJob?.result?.parentJobId,
    rawFixJob?.result?.originalJobId,
    fixJobId ? fixJobLinks.get(fixJobId) : null,
    sourceAnalyzeJob?.jobId,
    sourceAnalyzeJob?.id,
    sourceAnalyzeJob?.result?.jobId
  ];
  const jobId = candidates.find(c => typeof c === 'string' && c.startsWith('job_'));
  return jobId || "job_unknown";
}

function isValidDocumentName(name) {
  if (typeof name !== 'string') return false;
  const n = name.trim();
  if (!n) return false;
  const lower = n.toLowerCase();
  if (lower.includes('unknown')) return false;
  const forbidden = [
    'autofix',
    'analyze',
    'type',
    'status',
    'analysis_status',
    'outcome_category',
    'completed',
    'succeeded',
    'failed',
    'success'
  ];
  if (forbidden.includes(lower)) return false;
  return true;
}

function extractDocumentMetadata(job) {
  if (!job) return null;
  const doc = job.document || job.result?.document || job.report?.document || job.result?.report?.document;
  if (doc && isValidDocumentName(doc.name)) {
    return {
      name: doc.name,
      size: doc.size || 0,
      page_count: doc.page_count || doc.pageCount || 0,
      pdf_version: doc.pdf_version || doc.pdfVersion || "1.7"
    };
  }

  const meta = job.meta || job.report?.meta || job.result?.meta || job.result?.report?.meta || {};
  const nameCandidate = meta.fileName || meta.filename || job.filename || job.name;
  const size = meta.fileSize || meta.size || job.size;
  const page_count = meta.pageCount || meta.page_count || job.pageCount || job.pages?.length || job.report?.pages?.length || 0;

  if (isValidDocumentName(nameCandidate)) {
    return {
      name: nameCandidate,
      size: size || 0,
      page_count: page_count || 0,
      pdf_version: meta.pdf_version || meta.pdfVersion || "1.7"
    };
  }
  return null;
}

function extractFindings(job) {
  if (!job) return [];
  const target = job.result || job;
  const candidates = [
    target.issues,
    target.findings,
    target.analysis?.findings,
    target.report?.issues,
    target.report?.findings,
    target.warnings,
    target.analysis_warnings,
    target.report?.warnings,
    job.issues,
    job.findings,
    job.analysis?.findings,
    job.warnings
  ];
  const list = [];
  const seen = new Set();
  for (const arr of candidates) {
    if (Array.isArray(arr)) {
      for (const item of arr) {
        if (item) {
          const key = typeof item === 'string' ? item : (item.id || item.code || item.message || JSON.stringify(item));
          if (!seen.has(key)) {
            seen.add(key);
            list.push(item);
          }
        }
      }
    }
  }
  return list;
}

function extractSummary(job) {
  if (!job) return null;
  let s = job.summary || job.report?.summary || job.result?.summary || job.result?.report?.summary;
  if (typeof s === 'object' && s !== null) return s;

  const score = job.score ?? job.report?.score ?? job.result?.score ?? 100;
  const issues = extractFindings(job) || [];
  const critical_count = issues.filter(i => 
    i.severity === 'error' || 
    i.severity === 'CRITICAL' || 
    i.level === 'error'
  ).length;

  return {
    risk_level: critical_count > 0 ? "CRITICAL" : (issues.length > 0 ? "WARNING" : "LOW"),
    risk_score: score,
    scoreBasis: job.scoreBasis || "DOCUMENT_FINDINGS",
    issue_count: issues.length,
    critical_count,
    text: typeof s === 'string' ? s : null
  };
}

function isRepairObjectArray(value) {
  if (!Array.isArray(value)) return false;
  return value.some(item => 
    item && typeof item === 'object' && !Array.isArray(item) &&
    ('code' in item || 'id' in item || 'status' in item || 'strategy' in item || 'reason' in item || 'description' in item)
  );
}

function isStringIntentArray(value) {
  if (!Array.isArray(value)) return false;
  return value.length > 0 && value.every(item => typeof item === 'string');
}

function extractRequestedFixes(rawFixJob) {
  if (!rawFixJob) return [];
  const res = rawFixJob.result || {};
  const data = rawFixJob.data || {};
  const options = rawFixJob.options || {};

  const candidates = [
    rawFixJob.requested_fixes,
    res.requested_fixes,
    data.requested_fixes,
    options.requested_fixes
  ];

  for (const c of candidates) {
    if (Array.isArray(c) && c.length > 0) {
      return c.map(x => typeof x === 'string' ? x : (x?.code || x?.repairStrategy || JSON.stringify(x)));
    }
  }

  if (isStringIntentArray(rawFixJob.fixes)) {
    return rawFixJob.fixes;
  }
  if (isStringIntentArray(res.fixes)) {
    return res.fixes;
  }

  return [];
}

function extractRepairs(rawFixJob) {
  if (!rawFixJob) return [];
  const res = rawFixJob.result || {};
  const data = rawFixJob.data || {};

  const candidates = [
    rawFixJob.repairs,
    res.repairs,
    data.repairs,
    rawFixJob.fixes,
    res.fixes,
    data.fixes
  ];

  for (const c of candidates) {
    if (isRepairObjectArray(c)) {
      return c.filter(x => x && typeof x === 'object' && !Array.isArray(x));
    }
  }

  // Fallback 7: raw.applied_fixes + raw.failed_fixes + raw.skipped_fixes if any
  const rawCombined = [
    ...(Array.isArray(rawFixJob.applied_fixes) ? rawFixJob.applied_fixes : []),
    ...(Array.isArray(rawFixJob.failed_fixes) ? rawFixJob.failed_fixes : []),
    ...(Array.isArray(rawFixJob.skipped_fixes) ? rawFixJob.skipped_fixes : [])
  ].filter(x => x && typeof x === 'object' && !Array.isArray(x));

  if (rawCombined.length > 0) {
    return rawCombined;
  }

  // Fallback 8: raw.result.applied_fixes + raw.result.failed_fixes + raw.result.skipped_fixes if any
  const resCombined = [
    ...(Array.isArray(res.applied_fixes) ? res.applied_fixes : []),
    ...(Array.isArray(res.failed_fixes) ? res.failed_fixes : []),
    ...(Array.isArray(res.skipped_fixes) ? res.skipped_fixes : [])
  ].filter(x => x && typeof x === 'object' && !Array.isArray(x));

  if (resCombined.length > 0) {
    return resCombined;
  }

  return [];
}

function extractAppliedFixes(rawFixJob, repairs) {
  if (!rawFixJob) return [];
  const res = rawFixJob.result || {};
  const data = rawFixJob.data || {};

  const candidates = [
    rawFixJob.applied_fixes,
    res.applied_fixes,
    data.applied_fixes
  ];

  for (const c of candidates) {
    if (isRepairObjectArray(c)) {
      return c.filter(x => x && typeof x === 'object' && !Array.isArray(x));
    }
  }

  if (Array.isArray(repairs)) {
    return repairs.filter(r => r && typeof r === 'object' && (r.status === 'APPLIED' || r.status === 'SUCCESS'));
  }

  return [];
}

function extractSkippedFixes(rawFixJob, repairs) {
  if (!rawFixJob) return [];
  const res = rawFixJob.result || {};
  const data = rawFixJob.data || {};

  const candidates = [
    rawFixJob.skipped_fixes,
    res.skipped_fixes,
    data.skipped_fixes
  ];

  for (const c of candidates) {
    if (isRepairObjectArray(c)) {
      return c.filter(x => x && typeof x === 'object' && !Array.isArray(x));
    }
  }

  if (Array.isArray(repairs)) {
    return repairs.filter(r => r && typeof r === 'object' && (r.status === 'SKIPPED' || r.status === 'UNSUPPORTED' || r.status === 'BLOCKED_BY_POLICY' || r.status === 'REQUIRES_HUMAN_REVIEW'));
  }

  return [];
}

function extractFailedFixes(rawFixJob, repairs) {
  if (!rawFixJob) return [];
  const res = rawFixJob.result || {};
  const data = rawFixJob.data || {};

  const candidates = [
    rawFixJob.failed_fixes,
    res.failed_fixes,
    data.failed_fixes
  ];

  for (const c of candidates) {
    if (isRepairObjectArray(c)) {
      return c.filter(x => x && typeof x === 'object' && !Array.isArray(x));
    }
  }

  if (Array.isArray(repairs)) {
    return repairs.filter(r => r && typeof r === 'object' && (r.status === 'FAILED' || r.status === 'ERROR'));
  }

  return [];
}

function extractFixes(target) {
  const repairs = extractRepairs(target);
  if (repairs.length > 0) return repairs;
  return extractRequestedFixes(target);
}

function resolveArtifactAliases(rawFixJob, fixResult) {
  const source = rawFixJob?.artifacts || rawFixJob?.result?.artifacts || fixResult?.artifacts || {};
  const map = {};
  if (Array.isArray(source)) {
    source.forEach(a => {
      if (a?.type && a?.name) map[a.type] = a.name;
    });
  } else if (typeof source === 'object' && source !== null) {
    Object.entries(source).forEach(([k, v]) => {
      if (typeof v === 'object' && v !== null && v?.type && v?.name) {
        map[v.type] = v.name;
      } else if (typeof v === 'string' && isNaN(Number(k))) {
        map[k] = v;
      }
    });
  }

  const actualFixed = map.final_fixed_pdf || map.fixed_pdf || map.output_file || map.normalized_pdf || map.certified_pdf || "fixed.pdf";
  map.final_fixed_pdf = actualFixed;
  map.fixed_pdf = actualFixed;
  return map;
}

function extractArtifactList(rawFixJob) {
  const arts = resolveArtifactAliases(rawFixJob, rawFixJob?.result || rawFixJob);
  return Object.entries(arts).map(([type, name]) => ({ type, name }));
}

function extractForensics(rawFixJob, sourceAnalyzeJob) {
  return rawFixJob?.forensics || sourceAnalyzeJob?.forensics || { events: [] };
}
function extractAnalysisIntegrity(rawFixJob, sourceAnalyzeJob) {
  return rawFixJob?.analysisIntegrity || sourceAnalyzeJob?.analysisIntegrity || {};
}
function extractArtifactIntegrity(rawFixJob, sourceAnalyzeJob) {
  return rawFixJob?.artifactIntegrity || sourceAnalyzeJob?.artifactIntegrity || {};
}
function extractToolchainIntegrity(rawFixJob, sourceAnalyzeJob) {
  return rawFixJob?.toolchainIntegrity || sourceAnalyzeJob?.toolchainIntegrity || {};
}
function extractRuntimeIntegrity(rawFixJob, sourceAnalyzeJob) {
  return rawFixJob?.runtimeIntegrity || sourceAnalyzeJob?.runtimeIntegrity || {};
}
function extractPostfixSummary(rawFixJob) {
  return rawFixJob?.postfixSummary || rawFixJob?.result?.postfixSummary || null;
}
function extractPostfixFindings(rawFixJob) {
  return rawFixJob?.postfixFindings || rawFixJob?.result?.postfixFindings || [];
}
function extractUnresolvedFindings(rawFixJob) {
  return rawFixJob?.unresolved_findings || rawFixJob?.result?.unresolved_findings || [];
}
function hasForensics(rawFixJob, sourceAnalyzeJob) {
  const fBefore = extractFindings(sourceAnalyzeJob);
  const fixes = extractFixes(rawFixJob);
  return fBefore.length > 0 || fixes.length > 0;
}

function buildDegradedState(reasons) {
  return {
    _isDegraded: Array.isArray(reasons) && reasons.length > 0,
    degraded_reasons: reasons || []
  };
}

function deriveCategorySummaries(findings) {
  if (!Array.isArray(findings)) return [];
  const map = new Map();

  findings.forEach(f => {
    if (!f) return;
    const cat = (f.category || "GENERAL").toUpperCase();
    if (!map.has(cat)) {
      map.set(cat, {
        category: cat,
        count: 0,
        error_count: 0,
        warning_count: 0,
        info_count: 0,
        fixable_count: 0
      });
    }
    const entry = map.get(cat);
    entry.count++;
    const sev = (f.severity || f.level || '').toLowerCase();
    if (sev === 'error' || sev === 'critical') {
      entry.error_count++;
    } else if (sev === 'warning') {
      entry.warning_count++;
    } else if (sev === 'info') {
      entry.info_count++;
    }
    if (f.fixable || f.fixRequired || f.safeToAutofix || f.fix_method || f.repairStrategy) {
      entry.fixable_count++;
    }
  });

  return Array.from(map.values());
}

function derivePages(findings) {
  if (!Array.isArray(findings)) return [];
  const map = new Map();

  findings.forEach(f => {
    if (!f) return;
    const pageNum = Number(f.page) || 1;
    if (!map.has(pageNum)) {
      map.set(pageNum, {
        page: pageNum,
        issue_count: 0,
        error_count: 0,
        warning_count: 0,
        info_count: 0,
        categoriesSet: new Set()
      });
    }
    const entry = map.get(pageNum);
    entry.issue_count++;
    const sev = (f.severity || f.level || '').toLowerCase();
    if (sev === 'error' || sev === 'critical') {
      entry.error_count++;
    } else if (sev === 'warning') {
      entry.warning_count++;
    } else if (sev === 'info') {
      entry.info_count++;
    }
    if (f.category) {
      entry.categoriesSet.add(f.category.toUpperCase());
    }
  });

  const res = [];
  const sortedPages = Array.from(map.keys()).sort((a, b) => a - b);
  for (const pageNum of sortedPages) {
    const entry = map.get(pageNum);
    res.push({
      page: entry.page,
      issue_count: entry.issue_count,
      error_count: entry.error_count,
      warning_count: entry.warning_count,
      info_count: entry.info_count,
      categories: Array.from(entry.categoriesSet)
    });
  }
  return res;
}

const derivePagesSummaries = derivePages;

function normalizeAnalyzeJob(rawJob) {
  if (!rawJob) return null;

  const allFindings = extractFindings(rawJob);
  const issues = Array.isArray(rawJob.issues) && rawJob.issues.length > 0 ? rawJob.issues : allFindings;
  const findings = Array.isArray(rawJob.findings) && rawJob.findings.length > 0 ? rawJob.findings : allFindings;

  let summary = rawJob.summary || rawJob.result?.summary || rawJob.report?.summary || rawJob.result?.report?.summary;

  if (!summary && allFindings.length > 0) {
    let critical_count = 0;
    let error_count = 0;
    let warning_count = 0;
    let info_count = 0;

    allFindings.forEach(f => {
      const sev = (f.severity || f.level || '').toLowerCase();
      if (sev === 'critical') {
        critical_count++;
      } else if (sev === 'error') {
        error_count++;
      } else if (sev === 'warning') {
        warning_count++;
      } else if (sev === 'info') {
        info_count++;
      }
    });

    const totalCriticalOrError = critical_count + error_count;
    let risk_level = "LOW";
    if (totalCriticalOrError > 0) {
      risk_level = "CRITICAL";
    } else if (warning_count > 0) {
      risk_level = "WARNING";
    }

    let risk_score = 0;
    if (totalCriticalOrError > 0) {
      risk_score = 100;
    } else if (warning_count > 0) {
      risk_score = 50;
    } else if (info_count > 0) {
      risk_score = 10;
    }

    summary = {
      risk_level,
      risk_score,
      scoreBasis: "DOCUMENT_FINDINGS_DERIVED",
      issue_count: allFindings.length,
      critical_count: totalCriticalOrError,
      error_count,
      warning_count,
      info_count,
      derived: true
    };
  }

  let score = rawJob.risk_score ?? rawJob.score ?? 0;
  if (score === 0 && summary?.risk_score !== undefined) {
    score = summary.risk_score;
  }

  const extractedDoc = extractDocumentMetadata(rawJob);
  let documentObj;
  let metaObj;
  const degradedReasons = [];

  const jobIdCandidate = rawJob.jobId || rawJob.id || rawJob.result?.jobId || "job_unknown";

  if (extractedDoc) {
    documentObj = {
      name: extractedDoc.name,
      size: extractedDoc.size,
      page_count: extractedDoc.page_count,
      pdf_version: extractedDoc.pdf_version || "1.7"
    };
    metaObj = {
      ...(rawJob.meta || {}),
      fileName: extractedDoc.name,
      fileSize: extractedDoc.size,
      pageCount: extractedDoc.page_count,
      jobId: jobIdCandidate
    };
  } else {
    documentObj = {
      name: "document.pdf",
      size: 0,
      page_count: 0,
      pdf_version: "1.7"
    };
    metaObj = {
      ...(rawJob.meta || {}),
      fileName: "document.pdf",
      fileSize: 0,
      pageCount: 0,
      jobId: jobIdCandidate
    };
    degradedReasons.push("MISSING_DOCUMENT_METADATA");
  }

  let categorySummaries = rawJob.categorySummaries || rawJob.result?.categorySummaries || rawJob.report?.categorySummaries || rawJob.result?.report?.categorySummaries;
  if (!Array.isArray(categorySummaries) || categorySummaries.length === 0) {
    categorySummaries = deriveCategorySummaries(allFindings);
  }

  let pages = rawJob.pages || rawJob.result?.pages || rawJob.report?.pages || rawJob.result?.report?.pages;
  if (!Array.isArray(pages) || pages.length === 0) {
    pages = derivePages(allFindings);
  }

  const isDegraded = degradedReasons.length > 0 || (rawJob._isDegraded === true);
  const existingReasons = Array.isArray(rawJob.degraded_reasons) ? rawJob.degraded_reasons : [];
  const combinedReasons = Array.from(new Set([...existingReasons, ...degradedReasons]));

  return {
    ...rawJob,
    jobId: jobIdCandidate,
    type: rawJob.type || rawJob.result?.type || "ANALYZE",
    summary: summary || null,
    score,
    document: documentObj,
    meta: metaObj,
    issues,
    findings,
    categorySummaries,
    pages,
    _isDegraded: isDegraded,
    ...(combinedReasons.length > 0 ? { degraded_reasons: combinedReasons } : {}),
    normalizerApplied: true,
    normalizerVersion: "analyze-get-v2-2026-05-14"
  };
}

/**
 * Core normalizing function requested by the specification.
 * Preserves source ANALYZE context inside an AUTOFIX result payload.
 */
function normalizeAutofixJob(rawFixJob, sourceAnalyzeJob) {
  const fixJobId = getJobId(rawFixJob);
  const rawSourceJobId = getSourceJobId(rawFixJob, sourceAnalyzeJob);
  const sourceJobId = rawSourceJobId === "job_unknown" ? null : rawSourceJobId;

  const sourceDocument = extractDocumentMetadata(sourceAnalyzeJob);
  const fixDocument = extractDocumentMetadata(rawFixJob);
  const sourceSummary = extractSummary(sourceAnalyzeJob);
  const sourceFindings = extractFindings(sourceAnalyzeJob);

  const fixResult = rawFixJob?.result || rawFixJob || {};
  const requested_fixes = extractRequestedFixes(rawFixJob);
  let repairs = extractRepairs(rawFixJob);

  const rawRepairs = rawFixJob?.repairs || rawFixJob?.result?.repairs;
  if (Array.isArray(rawRepairs) && rawRepairs.length > 0 && repairs.length === 0) {
    console.warn('[BFF][AUTOFIX][REPAIR-PRESERVATION-WARN] Raw repairs present but normalized repairs empty. Preserving raw repairs.');
    repairs = rawRepairs.filter(r => r && typeof r === 'object');
  }

  const applied_fixes = extractAppliedFixes(rawFixJob, repairs);
  const skipped_fixes = extractSkippedFixes(rawFixJob, repairs);
  const failed_fixes = extractFailedFixes(rawFixJob, repairs);
  const artifacts = resolveArtifactAliases(rawFixJob, fixResult);

  const finalFileName = sourceDocument?.name || fixDocument?.name || "document.pdf";
  const finalFileSize = sourceDocument?.size || fixDocument?.size || rawFixJob?.meta?.fileSize || 0;
  const finalPageCount = sourceDocument?.page_count || fixDocument?.page_count || rawFixJob?.meta?.pageCount || 0;

  const degradedReasons = [];

  if (!sourceAnalyzeJob) {
    degradedReasons.push("MISSING_SOURCE_ANALYSIS");
  }
  if (!sourceDocument && finalFileName === "document.pdf") {
    if (!degradedReasons.includes("MISSING_DOCUMENT_METADATA")) {
      degradedReasons.push("MISSING_DOCUMENT_METADATA");
    }
  }
  if (!sourceSummary) {
    degradedReasons.push("MISSING_SOURCE_SUMMARY");
  }

  const postfixFindings = extractPostfixFindings(rawFixJob);
  const unresolvedFindings = extractUnresolvedFindings(rawFixJob) || [];
  const resolvedIssues = postfixFindings?.length ? postfixFindings : (sourceFindings || []);

  const summaryFindings =
    postfixFindings?.length ? postfixFindings :
    unresolvedFindings?.length ? unresolvedFindings :
    sourceFindings?.length ? sourceFindings :
    resolvedIssues?.length ? resolvedIssues :
    [];

  const derivedPages = rawFixJob?.pages?.length ? rawFixJob.pages :
    ((sourceAnalyzeJob?.pages || sourceAnalyzeJob?.report?.pages)?.length ? (sourceAnalyzeJob.pages || sourceAnalyzeJob.report.pages) :
    derivePages(summaryFindings));

  const derivedCategorySummaries = rawFixJob?.categorySummaries?.length ? rawFixJob.categorySummaries :
    ((sourceAnalyzeJob?.categorySummaries || sourceAnalyzeJob?.report?.categorySummaries)?.length ? (sourceAnalyzeJob.categorySummaries || sourceAnalyzeJob.report.categorySummaries) :
    deriveCategorySummaries(summaryFindings));

  // Preserve summary string for legacy frontend utils
  const summaryString = typeof (sourceSummary?.text || rawFixJob?.summary) === 'string'
    ? (sourceSummary?.text || rawFixJob?.summary)
    : "Fixes applied with source findings preserved";

  return {
    id: fixJobId,
    jobId: fixJobId,
    sourceJobId,
    type: "AUTOFIX",
    status: rawFixJob?.status || fixResult.status || "COMPLETED",
    ok: Boolean(rawFixJob?.ok ?? fixResult.ok ?? artifacts.fixed_pdf ?? true),
    progress: rawFixJob?.progress ?? 100,

    document: sourceDocument || fixDocument || {
      name: finalFileName,
      size: finalFileSize,
      page_count: finalPageCount,
      pdf_version: "1.7"
    },

    summary: {
      before: sourceSummary || null,
      after: extractPostfixSummary(rawFixJob) || null
    },

    // Backward-compatible flat fields for frontend consumption
    summaryFlat: sourceSummary || null,
    summary_text: summaryString,
    score: extractPostfixSummary(rawFixJob)?.risk_score ?? sourceSummary?.risk_score ?? rawFixJob?.score ?? 0,
    pages: derivedPages,
    categorySummaries: derivedCategorySummaries,

    findings_before: sourceFindings || [],
    findings_after: postfixFindings || [],
    issues: resolvedIssues,
    issues_source: postfixFindings?.length ? "findings_after" : "findings_before",

    requested_fixes,
    fixes: repairs,
    repairs,
    applied_fixes,
    skipped_fixes,
    failed_fixes,
    unresolved_findings: unresolvedFindings,

    artifacts,
    artifactList: extractArtifactList(rawFixJob),

    forensics: extractForensics(rawFixJob, sourceAnalyzeJob),
    analysisIntegrity: extractAnalysisIntegrity(rawFixJob, sourceAnalyzeJob),
    artifactIntegrity: extractArtifactIntegrity(rawFixJob, sourceAnalyzeJob),
    toolchainIntegrity: extractToolchainIntegrity(rawFixJob, sourceAnalyzeJob),
    runtimeIntegrity: extractRuntimeIntegrity(rawFixJob, sourceAnalyzeJob),

    meta: {
      ...(rawFixJob?.meta || {}),
      fileName: finalFileName,
      fileSize: finalFileSize,
      pageCount: finalPageCount,
      jobId: fixJobId,
      sourceJobId
    },

    _isDegraded: degradedReasons.length > 0,
    degraded_reasons: degradedReasons,
    _forensicDataMissing: !hasForensics(rawFixJob, sourceAnalyzeJob)
  };
}

module.exports = {
  cacheSourceJob,
  linkFixJob,
  getLinkedSourceJobId,
  getCachedSourceJob,
  getJobId,
  getSourceJobId,
  normalizeAnalyzeJob,
  normalizeAutofixJob,
  extractDocumentMetadata,
  extractSummary,
  extractFindings,
  extractArtifacts: resolveArtifactAliases,
  resolveArtifactAliases,
  buildDegradedState,
  deriveCategorySummaries,
  derivePages,
  derivePagesSummaries
};
