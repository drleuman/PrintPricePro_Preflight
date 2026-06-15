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
  const candidates = [
    job.findings,
    job.issues,
    job.analysis?.findings,
    job.analysis?.issues,
    job.forensics?.findings,
    job.report?.findings,
    job.report?.issues,
    job.result?.findings,
    job.result?.issues,
    job.result?.analysis?.findings,
    job.result?.analysis?.issues,
    job.result?.forensics?.findings,
    job.warnings,
    job.analysis_warnings
  ];

  const list = [];
  const seenIds = new Set();
  const seenComposites = new Set();

  for (const arr of candidates) {
    if (Array.isArray(arr)) {
      for (const item of arr) {
        if (item) {
          if (typeof item === 'string') {
            const key = `str:${item}`;
            if (!seenIds.has(key)) {
              seenIds.add(key);
              list.push(item);
            }
          } else {
            const id = item.id || item.uuid;
            if (id) {
              const idStr = String(id);
              if (!seenIds.has(idStr)) {
                seenIds.add(idStr);
                list.push(item);
              }
            } else {
              const code = item.code || item.rule || '';
              const page = item.page ?? item.pageNumber ?? '';
              const severity = item.severity || item.level || '';
              const message = item.message || item.user_message || '';
              const compositeKey = `${code}|${page}|${severity}|${message}`;
              if (!seenComposites.has(compositeKey)) {
                seenComposites.add(compositeKey);
                list.push(item);
              }
            }
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
    return repairs.filter(r => r && typeof r === 'object' && (r.status === 'APPLIED' || r.status === 'SUCCESS' || r.status === 'REQUIRES_HUMAN_REVIEW'));
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
    return repairs.filter(r => r && typeof r === 'object' && (r.status === 'SKIPPED' || r.status === 'UNSUPPORTED' || r.status === 'BLOCKED_BY_POLICY'));
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

  const status = rawFixJob?.status || rawFixJob?.final_status || fixResult?.status || fixResult?.final_status || "UNKNOWN";
  const isFailed = status === "FAILED" || status === "AUTOFIX_FAILED";

  const actualFixed = map.final_fixed_pdf || map.fixed_pdf || map.output_file || map.normalized_pdf || map.certified_pdf;

  if (actualFixed && isFailed) {
      map.diagnostic_output_file = actualFixed;
      delete map.final_fixed_pdf;
      delete map.fixed_pdf;
      delete map.review_pdf;
      delete map.normalized_pdf;
      delete map.certified_pdf;
      delete map.output_file;
  } else if (actualFixed) {
      map.final_fixed_pdf = actualFixed;
      map.fixed_pdf = actualFixed;
  }
  return map;
}

function resolveArtifactName(report, requestedKey) {
  if (!report) return null;
  const artifacts = report.artifacts || report.result?.artifacts || {};
  const artifactList = Array.isArray(report.artifactList) ? report.artifactList : (Array.isArray(report.result?.artifactList) ? report.result.artifactList : []);

  const aliasFallbacks = {
    review_pdf: ["review_pdf", "final_fixed_pdf", "fixed_pdf", "normalized_pdf"],
    certified_pdf: ["certified_pdf", "final_fixed_pdf", "fixed_pdf", "normalized_pdf"],
    final_fixed_pdf: ["final_fixed_pdf", "fixed_pdf"],
    fixed_pdf: ["fixed_pdf", "final_fixed_pdf"],
    normalized_pdf: ["normalized_pdf", "fixed_pdf", "final_fixed_pdf"],
    fix_audit: ["fix_audit"]
  };

  const candidates = aliasFallbacks[requestedKey] || [requestedKey];

  for (const key of candidates) {
    if (artifacts[key]) {
      return {
        requestedKey,
        resolvedKey: key,
        filename: typeof artifacts[key] === "string"
          ? artifacts[key]
          : artifacts[key].filename || artifacts[key].name || artifacts[key].path,
        source: "artifacts"
      };
    }

    const item = artifactList.find(a => a.type === key);
    if (item?.name || item?.filename || item?.path) {
      return {
        requestedKey,
        resolvedKey: key,
        filename: item.name || item.filename || item.path,
        source: "artifactList"
      };
    }
  }

  return null;
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

// APP-60 — BFF Governance Contract Foundation
// These keys are the canonical OS governance domains the BFF must preserve without flattening.
const GOVERNANCE_KEYS = [
  'artifact_trust',
  'standards_certification_governance',
  'structural_metadata_governance',
  'page_marks_governance',
  'security_interactivity_governance',
  'visual_diff_governance',
  'proof_approval_governance',
  'remediation_ux',
  'review_decision_ux',
  'artifact_ux',
  'policy_profile_governance',
  'production_package_governance',
  // APP-62F: Heavy PDF probe semantics governance (Engine -> Worker -> Service -> CP -> BFF)
  'heavy_pdf_probe_governance',
  // APP-64: Ink / Image / Font / Transparency-Overprint / Visual Diff governance (Phases 64-69)
  'ink_governance',
  'selective_image_governance',
  'font_governance',
  'transparency_overprint_physical_governance',
  // APP-67: Policy profiles / machine matching / audit bundle / fix recommendations (Phases 72-75)
  'machine_readiness_governance',
  'audit_bundle_governance',
  'recommendation_governance'
];

// Conservative merge: false flags always win; true flags win for review_required;
// deduplicate domain/warning arrays; preserve evidence from all sides.
function mergeGovernanceObject(candidates) {
  const result = { ...candidates[0] };
  for (let i = 1; i < candidates.length; i++) {
    const c = candidates[i];
    if (!c || typeof c !== 'object') continue;
    for (const f of [
      'production_certified', 'standard_certified', 'certified_pdf_allowed',
      'customer_visible', 'compliance_claim_allowed',
      'pdfx_compliance_claimed', 'pdfa_compliance_claimed',
      // APP-64: a font source unavailable for automatic embedding always wins.
      'font_source_available',
      // APP-64: a visual diff that was required but not performed always wins.
      'visual_diff_performed',
      // APP-66: a production package marked not-ready, or an outstanding
      // payment/production unlock, by any source always wins.
      'package_ready', 'payment_satisfied',
      // APP-67: a policy profile that failed, a machine match that is
      // incompatible, an audit bundle that is unavailable, or a fix
      // recommendation that should not auto-apply, by any source always wins.
      'profile_passed', 'compatible', 'bundle_available', 'auto_apply'
    ]) {
      if (f in c && c[f] === false) result[f] = false;
    }
    if (c.review_required === true) result.review_required = true;
    // APP-62F: heavy_pdf_probe_governance — fatal/degraded flags always win (true wins),
    // and a fatal document failure overrides a degraded-but-usable classification.
    for (const f of ['fatal_document_failure', 'analysis_degraded', 'heavy_pdf_detected']) {
      if (c[f] === true) result[f] = true;
    }
    // APP-67: a recommendation flagged as destructive or operator-only by any
    // source always wins — never silently downgrade to a customer-safe,
    // auto-applicable recommendation.
    for (const f of ['destructive', 'operator_only']) {
      if (c[f] === true) result[f] = true;
    }
    // APP-64: visual/destructive governance signals that always win when true —
    // an unfixable low-res image, a flattened/overprint-modified page, or a
    // detected/expected visual change must never be silently dropped on merge.
    // APP-65: a visual proof requirement (proof_required=true) must never be
    // silently dropped on merge either.
    for (const f of ['low_res_unfixable', 'transparency_flattened', 'overprint_modified', 'visual_change_detected', 'visual_change_expected', 'visual_diff_required', 'proof_required']) {
      if (c[f] === true) result[f] = true;
    }
    // APP-65: proof_status — the most restrictive/blocking status across sources wins.
    // A rejection or pending-customer status must never be silently overridden by a
    // stale "approved" or "not required" value from another source.
    if ('proof_status' in c) {
      const PROOF_STATUS_RANK = {
        PROOF_REJECTED_REUPLOAD_REQUIRED: 4,
        PROOF_PENDING_CUSTOMER: 3,
        PROOF_REQUIRED: 2,
        PROOF_APPROVED: 1,
        PROOF_NOT_REQUIRED: 0
      };
      const curRank = PROOF_STATUS_RANK[result.proof_status] ?? -1;
      const newRank = PROOF_STATUS_RANK[c.proof_status] ?? -1;
      if (newRank > curRank) result.proof_status = c.proof_status;
    }
    for (const arr of ['blocked_by_governance_domains', 'warnings', 'review_required_reasons', 'blockers', 'mismatch_reasons']) {
      if (Array.isArray(c[arr])) {
        result[arr] = [...new Set([...(Array.isArray(result[arr]) ? result[arr] : []), ...c[arr]])];
      }
    }
    for (const objField of ['tools', 'probe_summary']) {
      if (c[objField] && typeof c[objField] === 'object') {
        result[objField] = { ...(result[objField] || {}), ...c[objField] };
      }
    }
    if (c.evidence) {
      result.evidence = (typeof result.evidence === 'object' && result.evidence !== null)
        ? { ...result.evidence, ...c.evidence }
        : { ...c.evidence };
    }
  }
  if (result.fatal_document_failure === true) {
    result.degraded_but_usable = false;
  }
  return result;
}

/**
 * Central governance extractor for APP-60.
 * Searches all known payload locations and merges each governance domain
 * using conservative rules (false flags win, review_required=true wins).
 */
function extractGovernanceContracts(payload) {
  if (!payload || typeof payload !== 'object') return {};
  const locations = [
    payload,
    payload.result,
    payload.report,
    payload.fix_summary,
    payload.delta_report,
    payload.artifact_summary,
    payload.fix_audit,
    payload.artifact_metadata,
    payload.result?.fix_summary,
    payload.result?.delta_report,
    payload.result?.artifact_summary,
    payload.result?.report,
    payload.result?.fix_audit,
    payload.result?.artifact_metadata,
  ].filter(loc => loc && typeof loc === 'object');

  const contracts = {};
  for (const key of GOVERNANCE_KEYS) {
    const candidates = locations.map(loc => loc[key]).filter(v => v && typeof v === 'object');
    if (candidates.length === 0) continue;
    contracts[key] = candidates.length === 1 ? { ...candidates[0] } : mergeGovernanceObject(candidates);
  }

  // APP-63: defense-in-depth — unresolved interactive content (JS, launch actions,
  // embedded files, unflattened forms/annotations) always requires review, even if
  // the OS payload did not explicitly set review_required on this domain.
  const sig = contracts.security_interactivity_governance;
  if (sig && (sig.interactive_content_remaining === true || sig.flattening_skipped === true)) {
    sig.review_required = true;
  }

  // APP-64: defense-in-depth for visual/destructive fix domains (Phases 64-69).
  // Each of these conditions represents a change the customer/operator cannot
  // safely treat as "done" without a human looking at the result, even if the
  // OS payload did not explicitly set review_required on the domain.
  const ink = contracts.ink_governance;
  if (ink && ink.tac_violation_remaining === true) {
    ink.review_required = true;
  }

  // Selective image fixes: a low-resolution image that could not be fixed
  // automatically requires source-file review/reupload.
  const img = contracts.selective_image_governance;
  if (img && img.low_res_unfixable === true) {
    img.review_required = true;
  }

  // Font fixes: if no embeddable font source is available, fonts cannot be
  // embedded automatically and the file requires review.
  const font = contracts.font_governance;
  if (font && font.font_source_available === false) {
    font.review_required = true;
  }

  // Transparency/overprint physical fixes: flattening transparency or modifying
  // overprint settings is a destructive print transform and always needs review.
  const transparency = contracts.transparency_overprint_physical_governance;
  if (transparency && (transparency.transparency_flattened === true || transparency.overprint_modified === true)) {
    transparency.review_required = true;
  }

  // Visual diff: if a visual diff was required but not performed, the file's
  // visual fidelity is unverified and "production-ready" messaging must be blocked.
  const visualDiff = contracts.visual_diff_governance;
  if (visualDiff && visualDiff.visual_diff_required === true && visualDiff.visual_diff_performed !== true) {
    visualDiff.review_required = true;
  }

  // APP-65: Visual proof / customer approval (Phases 69-70). A required proof that
  // has not been approved by the customer must block production-ready messaging,
  // and a rejected proof always requires review/reupload.
  const proofApproval = contracts.proof_approval_governance;
  if (proofApproval && proofApproval.proof_required === true && proofApproval.proof_status !== 'PROOF_APPROVED') {
    proofApproval.review_required = true;
  }
  if (proofApproval && proofApproval.proof_status === 'PROOF_REJECTED_REUPLOAD_REQUIRED') {
    proofApproval.review_required = true;
  }

  // APP-67: Policy profile / standards template (Phase 72). A profile that did
  // not pass leaves the document non-compliant with the printhouse's required
  // standard and must require review before production.
  const policyProfile = contracts.policy_profile_governance;
  if (policyProfile && policyProfile.profile_passed === false) {
    policyProfile.review_required = true;
  }

  // APP-67: Machine assignment / production capability matching (Phase 73). A
  // file that is not compatible with the target machine must require review —
  // "fixed" never implies "ready for this press".
  const machineReadiness = contracts.machine_readiness_governance;
  if (machineReadiness && machineReadiness.compatible === false) {
    machineReadiness.review_required = true;
  }

  // APP-67: Fix recommendation layer (Phase 75). A recommendation flagged as
  // destructive must never be auto-applied and must always be treated as
  // operator-only, regardless of what the OS payload set for auto_apply.
  const recommendation = contracts.recommendation_governance;
  if (recommendation && recommendation.destructive === true) {
    recommendation.operator_only = true;
    recommendation.auto_apply = false;
  }

  // APP-66: Production package / printhouse handoff readiness (Phase 71). The
  // package can never be reported ready while another governance domain still
  // requires review, while artifact_trust withholds production certification,
  // or while a required payment/production unlock is outstanding — even if the
  // OS payload's production_package_governance itself says package_ready=true.
  const productionPackage = contracts.production_package_governance;
  if (productionPackage) {
    const blockingDomains = new Set(
      Array.isArray(productionPackage.blocked_by_governance_domains)
        ? productionPackage.blocked_by_governance_domains
        : []
    );

    for (const key of GOVERNANCE_KEYS) {
      if (key === 'production_package_governance') continue;
      const domain = contracts[key];
      if (domain && domain.review_required === true) {
        blockingDomains.add(key);
      }
    }

    if (contracts.artifact_trust?.production_certified === false) {
      blockingDomains.add('artifact_trust');
    }

    if (productionPackage.payment_required === true && productionPackage.payment_satisfied !== true) {
      blockingDomains.add('payment');
    }

    if (blockingDomains.size > 0) {
      productionPackage.package_ready = false;
      productionPackage.blocked_by_governance_domains = Array.from(blockingDomains);
    }
  }

  return contracts;
}

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

  // APP-62F: Preserve heavy_pdf_probe_governance and other governance contracts from
  // the OS analyze payload (Engine emits this directly during analysis).
  const governanceContracts = extractGovernanceContracts(rawJob);

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
    normalizerVersion: "analyze-get-v2-2026-05-14",
    ...governanceContracts
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

  // APP-60: Extract all governance contracts from the raw PPOS payload (all known locations).
  const governanceContracts = extractGovernanceContracts(rawFixJob);

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
    fix_coverage: rawFixJob?.fix_coverage ?? rawFixJob?.result?.fix_coverage ?? null,
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

    artifact_delta: rawFixJob?.artifact_delta || rawFixJob?.result?.artifact_delta || null,
    certification_blockers: rawFixJob?.certification_blockers || rawFixJob?.result?.certification_blockers || [],

    error: rawFixJob?.error || rawFixJob?.result?.error || null,

    _isDegraded: degradedReasons.length > 0 || Boolean(rawFixJob?._isDegraded),
    degraded_reasons: degradedReasons.length > 0 ? degradedReasons : (rawFixJob?.degraded_reasons || []),
    _forensicDataMissing: !hasForensics(rawFixJob, sourceAnalyzeJob),

    // APP-60: Governance contracts preserved from OS payload — not derived from fix state.
    ...governanceContracts
  };

  return normalizeAutofixFinalState(normalized);
}

function skippedFixRequiresHumanReview(fix) {
  return Boolean(
    fix?.requires_human_review === true ||
    fix?.requiresHumanReview === true ||
    fix?.destructiveFixRisk === "HIGH" ||
    /destructive|explicit review|human review/i.test(String(fix?.reason || ""))
  );
}

function normalizeAutofixFinalState(report) {
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
  const skippedRequiresReview = skippedFixes.some(skippedFixRequiresHumanReview);

  let requiresReview = appliedFixes.some(f =>
    f && (
      f.requires_human_review === true ||
      f.requiresHumanReview === true ||
      f.destructiveFixRisk === 'HIGH' ||
      f.destructive_fix_risk === 'HIGH' ||
      f.industrial_quality === 'LIMITED' ||
      f.industrialQuality === 'LIMITED'
    )
  ) || skippedRequiresReview;

  // Derive highest destructive risk
  let highestRisk = 'LOW';
  appliedFixes.forEach(f => {
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
    appliedFixes.length > 0 &&
    report._isDegraded !== true &&
    (unresolved.length === 0 || skippedRequiresReview);

  // Calculate production certified status
  let productionCertified =
    technicallyFixed &&
    requiresReview === false &&
    highestRisk !== 'HIGH';

  // APP-60: artifact_trust governance overrides — false flags in the OS payload always win
  // over legacy computed values. Never let a derived true override an explicit OS false.
  const governanceTrust = report.artifact_trust;
  if (governanceTrust && typeof governanceTrust === 'object') {
    if (governanceTrust.production_certified === false) productionCertified = false;
  }

  // Determine if an output artifact exists
  const hasArtifactsField = report.artifacts !== undefined || report.artifactList !== undefined;
  const hasOutputArtifact = !hasArtifactsField || !!(
    report.artifacts?.final_fixed_pdf || 
    report.artifacts?.fixed_pdf || 
    report.artifacts?.certified_pdf || 
    report.artifacts?.normalized_pdf ||
    (Array.isArray(report.artifactList) && report.artifactList.some(a => ['final_fixed_pdf', 'fixed_pdf', 'certified_pdf', 'normalized_pdf'].includes(a.type)))
  );

  // Determine final status
  let status = report.status || report.final_status || 'AUTOFIX_COMPLETED';

  const isInProgress = ['PROCESSING', 'QUEUED', 'PENDING', 'IN_PROGRESS', 'RUNNING'].includes(status);
  const isExplicitNonFailedTerminal = ['AUTOFIX_REVIEW_REQUIRED', 'AUTOFIX_PARTIAL', 'AUTOFIX_PARTIAL_REVIEW_REQUIRED', 'AUTOFIX_DEGRADED', 'AUTOFIX_COMPLETED', 'COMPLETED', 'COMPLETED_WITH_REVIEW'].includes(status);
  const isFailedFix = !isExplicitNonFailedTerminal && (failedFixes.length > 0 || (!hasOutputArtifact && !isInProgress));

  if (report._isDegraded === true || (report.degraded_reasons && report.degraded_reasons.length > 0)) {
    status = 'AUTOFIX_DEGRADED';
  } else if (
    appliedFixes.length === 0 &&
    failedFixes.length === 0 &&
    skippedFixes.length > 0 &&
    skippedRequiresReview
  ) {
    status = 'AUTOFIX_REVIEW_REQUIRED';
  } else if (isFailedFix) {
    status = 'AUTOFIX_FAILED';
  } else if (appliedFixes.length > 0 && skippedRequiresReview) {
    status = 'AUTOFIX_PARTIAL_REVIEW_REQUIRED';
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
  let reviewReasons = [];
  appliedFixes.forEach(f => {
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

  if (status === 'AUTOFIX_REVIEW_REQUIRED' || status === 'AUTOFIX_PARTIAL_REVIEW_REQUIRED' || requiresReview) {
    skippedFixes.forEach(f => {
      if (f && skippedFixRequiresHumanReview(f)) {
        const code = f.code || f.strategy || f.repairStrategy || 'UNKNOWN_REPAIR';
        if (!reviewReasons.includes(code)) {
          reviewReasons.push(code);
        }
      }
    });
  }

  // Derive final risk level
  let finalRiskLevel = 'LOW';
  if (status === 'COMPLETED_WITH_REVIEW' || status === 'AUTOFIX_PARTIAL_REVIEW_REQUIRED') {
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

  // PHASE 39.1.8 - Artifact Certification Guard; APP-60: also respect certified_pdf_allowed=false
  if (!productionCertified || (governanceTrust && governanceTrust.certified_pdf_allowed === false)) {
    if (report.artifacts) {
      delete report.artifacts.certified_pdf;
    }
    if (Array.isArray(report.artifactList)) {
      report.artifactList = report.artifactList.filter(a => a.type !== 'certified_pdf');
    }
  }

  const isFailed = status === 'FAILED' || status === 'AUTOFIX_FAILED' || isFailedFix;
  const allowSynthesis = status === 'AUTOFIX_PARTIAL' || status === 'COMPLETED_WITH_REVIEW' || (!productionCertified && requiresReview) || technicallyFixed;

  if (status === 'AUTOFIX_REVIEW_REQUIRED' && appliedFixes.length === 0) {
      // Do not synthesize review_pdf/fixed_pdf/certified_pdf if no fixes were applied
      if (report.artifacts) {
          delete report.artifacts.review_pdf;
          delete report.artifacts.fixed_pdf;
          delete report.artifacts.final_fixed_pdf;
          delete report.artifacts.certified_pdf;
      }
      if (Array.isArray(report.artifactList)) {
          report.artifactList = report.artifactList.filter(a => !['review_pdf', 'fixed_pdf', 'final_fixed_pdf', 'certified_pdf'].includes(a.type));
      }
  } else if (isFailed) {
      if (report.artifacts) {
          const actualFixed = report.artifacts.output_file || report.artifacts.fixed_pdf || report.artifacts.final_fixed_pdf;
          if (actualFixed) {
              report.artifacts.diagnostic_output_file = actualFixed;
          }
          delete report.artifacts.review_pdf;
          delete report.artifacts.fixed_pdf;
          delete report.artifacts.final_fixed_pdf;
          delete report.artifacts.output_file;
      }
      if (Array.isArray(report.artifactList)) {
          const actualFixedItem = report.artifactList.find(a => ['output_file', 'fixed_pdf', 'final_fixed_pdf', 'review_pdf'].includes(a.type));
          report.artifactList = report.artifactList.filter(a => !['output_file', 'fixed_pdf', 'final_fixed_pdf', 'review_pdf'].includes(a.type));
          if (actualFixedItem) {
              report.artifactList.push({ type: 'diagnostic_output_file', name: actualFixedItem.name || actualFixedItem.filename || "diagnostic_output.pdf" });
          }
      }
  } else if (allowSynthesis) {
      if (report.artifacts) {
          if (report.artifacts.fixed_pdf) {
            report.artifacts.review_pdf = report.artifacts.fixed_pdf;
          } else if (report.artifacts.final_fixed_pdf) {
            report.artifacts.review_pdf = report.artifacts.final_fixed_pdf;
          }
      }
      if (Array.isArray(report.artifactList)) {
          const hasReview = report.artifactList.some(a => a.type === 'review_pdf');
          if (!hasReview) {
            const fixedArtifact = report.artifactList.find(a => a.type === 'fixed_pdf' || a.type === 'final_fixed_pdf');
            if (fixedArtifact) {
              report.artifactList.push({ type: 'review_pdf', name: fixedArtifact.name });
            }
          }
      }
  }

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
  report.isFailedFix = isFailedFix;
  
  if (status === 'AUTOFIX_REVIEW_REQUIRED') {
      report.technicallyFixed = false;
      report.productionCertified = false;
      if (appliedFixes.length === 0) {
          report.hasFinalFixedPdf = false;
          report.hasFixedArtifact = false;
          report.hasReviewArtifact = false;
          report.bestArtifactKey = null;
      }
  }

  // Fallback score setting
  if (report.score === undefined || report.score === null || report.score === 100 || report.score === 0) {
    report.score = report.summary.after.risk_score;
  }

  return report;
}

function normalizeAutofixResultState(payload) {
  if (!payload || typeof payload !== 'object') {
    return payload;
  }

  try {
    const hasAppliedFixes = Array.isArray(payload.applied_fixes) || Array.isArray(payload.repairs) || Array.isArray(payload.fixes);
    const hasFixedPdf = payload.final_fixed_pdf || payload.fixed_pdf || payload.artifacts?.final_fixed_pdf || payload.artifacts?.fixed_pdf || (Array.isArray(payload.artifactList) && payload.artifactList.some(a => a.type === 'final_fixed_pdf' || a.type === 'fixed_pdf'));
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
        const nestedHasFixedPdf = nestedObj.final_fixed_pdf || nestedObj.fixed_pdf || nestedObj.artifacts?.final_fixed_pdf || nestedObj.artifacts?.fixed_pdf || (Array.isArray(nestedObj.artifactList) && nestedObj.artifactList.some(a => a.type === 'final_fixed_pdf' || a.type === 'fixed_pdf'));
        const nestedIsAutofix = nestedObj.type === 'AUTOFIX' || (nestedHasAppliedFixes && nestedHasFixedPdf);
        if (nestedIsAutofix) {
          current[lastKey] = normalizeAutofixFinalState(nestedObj);
        }
      }
    }
  } catch (err) {
    console.warn(`[BFF][NORMALIZER][RESULT][WARN] Failed to normalize result state: ${err.message}`);
  }
  return payload;
}

function maybeNormalizeAutofixReportArtifact(report) {
  if (!report || typeof report !== 'object') {
    return report;
  }

  try {
    const hasAppliedFixes = Array.isArray(report.applied_fixes) || Array.isArray(report.repairs) || Array.isArray(report.fixes);
    const hasFixedPdf = report.final_fixed_pdf || report.fixed_pdf || report.artifacts?.final_fixed_pdf || report.artifacts?.fixed_pdf || (Array.isArray(report.artifactList) && report.artifactList.some(a => a.type === 'final_fixed_pdf' || a.type === 'fixed_pdf'));
    const isAutofix = report.type === 'AUTOFIX' || (hasAppliedFixes && hasFixedPdf);

    if (isAutofix) {
      return normalizeAutofixFinalState(report);
    }
  } catch (err) {
    console.warn(`[BFF][NORMALIZER][CENTRAL][WARN] Failed to inspect or normalize report JSON: ${err.message}`);
  }
  return report;
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
  normalizeAutofixFinalState,
  maybeNormalizeAutofixReportArtifact,
  normalizeAutofixResultState,
  extractDocumentMetadata,
  extractSummary,
  extractFindings,
  extractArtifacts: resolveArtifactAliases,
  resolveArtifactAliases,
  resolveArtifactName,
  buildDegradedState,
  deriveCategorySummaries,
  derivePages,
  derivePagesSummaries,
  // APP-60: Governance Contract Foundation
  extractGovernanceContracts,
  mergeGovernanceObject,
  GOVERNANCE_KEYS
};
