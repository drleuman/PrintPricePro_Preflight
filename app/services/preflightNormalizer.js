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

function getCachedSourceJob(fixJobId, rawFixJob) {
  let sourceJobId = fixJobLinks.get(fixJobId);
  if (!sourceJobId && rawFixJob) {
    const candidates = [
      rawFixJob.sourceJobId,
      rawFixJob.parentJobId,
      rawFixJob.originalJobId,
      rawFixJob.analyzeJobId,
      rawFixJob.source_job_id,
      rawFixJob.result?.sourceJobId,
      rawFixJob.result?.parentJobId
    ];
    sourceJobId = candidates.find(c => typeof c === 'string' && c.startsWith('job_'));
  }
  if (sourceJobId) {
    return sourceJobCache.get(sourceJobId) || null;
  }
  return null;
}

function getJobId(rawFixJob) {
  const candidates = [
    rawFixJob?.jobId,
    rawFixJob?.job_id,
    rawFixJob?.id,
    rawFixJob?.result?.jobId,
    rawFixJob?.result?.meta?.jobId
  ];
  const fixId = candidates.find(c => typeof c === 'string' && c.startsWith('fix_'));
  if (fixId) return fixId;
  const jobId = candidates.find(c => typeof c === 'string' && c.startsWith('job_'));
  return jobId || "fix_unknown";
}

function getSourceJobId(rawFixJob, sourceAnalyzeJob) {
  const candidates = [
    rawFixJob?.sourceJobId,
    rawFixJob?.parentJobId,
    rawFixJob?.originalJobId,
    rawFixJob?.analyzeJobId,
    rawFixJob?.source_job_id,
    sourceAnalyzeJob?.jobId,
    sourceAnalyzeJob?.id,
    sourceAnalyzeJob?.result?.jobId
  ];
  const jobId = candidates.find(c => typeof c === 'string' && c.startsWith('job_'));
  return jobId || "job_unknown";
}

function extractDocumentMetadata(job) {
  if (!job) return null;
  const doc = job.document || job.result?.document || job.report?.document;
  if (doc && doc.name && !doc.name.includes('unknown')) {
    return {
      name: doc.name,
      size: doc.size || 0,
      page_count: doc.page_count || doc.pageCount || 0,
      pdf_version: doc.pdf_version || doc.pdfVersion || "1.7"
    };
  }

  const meta = job.meta || job.report?.meta || job.result?.meta || job.result?.report?.meta || {};
  const name = meta.fileName || meta.filename || job.filename || job.name;
  const size = meta.fileSize || meta.size || job.size;
  const page_count = meta.pageCount || meta.page_count || job.pageCount || job.pages?.length || job.report?.pages?.length || 0;

  if (name && !name.toLowerCase().includes('unknown')) {
    return {
      name,
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
    target.report?.issues,
    target.report?.findings,
    target.warnings,
    target.analysis_warnings,
    target.report?.warnings,
    job.issues,
    job.findings,
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

function extractFixes(target) {
  if (!target) return [];
  const res = target.result || target;
  const list =
    target.fixes ||
    target.repairs ||
    target.applied_fixes ||
    res.fixes ||
    res.repairs ||
    res.applied_fixes ||
    target.autofix?.fixes ||
    target.autofix?.repairs ||
    res.autofix?.fixes ||
    res.autofix?.repairs ||
    [];
  return Array.isArray(list) ? list : [];
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

function normalizeAnalyzeJob(rawJob) {
  if (!rawJob) return null;
  return rawJob;
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
  const sourceSummary = extractSummary(sourceAnalyzeJob);
  const sourceFindings = extractFindings(sourceAnalyzeJob);

  const fixResult = rawFixJob?.result || rawFixJob || {};
  const fixes = extractFixes(rawFixJob);
  const artifacts = resolveArtifactAliases(rawFixJob, fixResult);

  const degradedReasons = [];

  if (!sourceAnalyzeJob) degradedReasons.push("MISSING_SOURCE_ANALYSIS");
  if (!sourceDocument) degradedReasons.push("MISSING_DOCUMENT_METADATA");
  if (!sourceSummary) degradedReasons.push("MISSING_SOURCE_SUMMARY");

  const finalFileName = (sourceDocument?.name && !sourceDocument.name.includes('unknown'))
    ? sourceDocument.name
    : (rawFixJob?.meta?.fileName && !rawFixJob.meta.fileName.includes('unknown') ? rawFixJob.meta.fileName : "document.pdf");

  const finalFileSize = sourceDocument?.size || rawFixJob?.meta?.fileSize || 0;
  const finalPageCount = sourceDocument?.page_count || rawFixJob?.meta?.pageCount || 0;

  const postfixFindings = extractPostfixFindings(rawFixJob);
  const resolvedIssues = postfixFindings?.length ? postfixFindings : (sourceFindings || []);

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

    document: sourceDocument || extractDocumentMetadata(rawFixJob) || {
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
    pages: rawFixJob?.pages?.length ? rawFixJob.pages : (sourceAnalyzeJob?.pages || sourceAnalyzeJob?.report?.pages || []),
    categorySummaries: rawFixJob?.categorySummaries?.length ? rawFixJob.categorySummaries : (sourceAnalyzeJob?.categorySummaries || sourceAnalyzeJob?.report?.categorySummaries || []),

    findings_before: sourceFindings || [],
    findings_after: postfixFindings || [],
    issues: resolvedIssues,
    issues_source: postfixFindings?.length ? "findings_after" : "findings_before",

    fixes,
    repairs: fixes,
    unresolved_findings: extractUnresolvedFindings(rawFixJob) || [],

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
  getCachedSourceJob,
  normalizeAnalyzeJob,
  normalizeAutofixJob,
  extractDocumentMetadata,
  extractSummary,
  extractFindings,
  extractArtifacts: resolveArtifactAliases,
  resolveArtifactAliases,
  buildDegradedState
};
