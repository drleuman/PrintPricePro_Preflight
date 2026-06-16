const express = require('express');
const router = express.Router();
const db = require('../services/db');
const requireAuth = require('../middleware/requireAuth');
const { humanizeFixCode, recommendedNextAction, buildClientChangeSummary, NO_RELIABLE_AUTOFIX_CODES } = require('../services/clientChangeSummaryHelper');


if (typeof requireAuth !== 'function') {
  throw new Error('[ACCOUNT-ROUTES] requireAuth middleware is not a function. Check import path/export shape.');
}

console.log('[API-V2][ACCOUNT-ROUTES][REGISTERED]');
console.log('GET /api/v2/me');
console.log('GET /api/v2/me/file-history');
console.log('POST /api/v2/me/api-key/rotation-request');

/**
 * GET /api/v2/me
 * Returns aggregated user telemetry, license, security state, and basic usage.
 */
router.get('/', requireAuth, async (req, res) => {
  const auth = req.auth;
  const tenantId = auth.tenantId;
  const userId = auth.userId;

  let jobsToday = 0;
  let analyzeJobsToday = 0;
  let autofixJobsToday = 0;

  try {
    const today = new Date().toISOString().split('T')[0];
    const rows = await db.query(
      `SELECT type, COUNT(*) as count 
       FROM preflight_job_registry 
       WHERE tenant_id = ? AND created_at >= ?
       GROUP BY type`,
      [tenantId, today + ' 00:00:00']
    );
    
    if (rows && Array.isArray(rows)) {
      const dataRows = rows.rows || rows;
      for (const row of dataRows) {
        const count = Number(row.count) || 0;
        jobsToday += count;
        if (row.type === 'ANALYZE') analyzeJobsToday += count;
        if (row.type === 'AUTOFIX') autofixJobsToday += count;
      }
    }
  } catch (err) {
    console.warn('[BFF][ME] Failed to query usage stats:', err.message);
  }

  const identityRole = req.auth?.role || req.user?.role || auth?.role || null;
  const identityAppRole = req.auth?.appRole || req.user?.appRole || auth?.appRole || null;
  const email = auth?.email || req.user?.email || null;

  const normalizedRole = String(identityRole || '').toLowerCase();
  const normalizedAppRole = String(identityAppRole || '').toUpperCase();
  const normalizedEmail = String(email || '').toLowerCase();

  const isAdmin =
    normalizedRole === 'tenant_admin' ||
    normalizedRole === 'admin' ||
    normalizedRole === 'super_admin' ||
    normalizedRole === 'superadmin';

  const isDeveloper = normalizedAppRole === 'DEVELOPER';

  const isInternalAdmin =
    normalizedEmail === 'admin@printprice.pro' ||
    isAdmin ||
    isDeveloper;

  const operationalRole = isInternalAdmin ? 'tenant_admin' : 'member';

  const adminAccess = isInternalAdmin
    ? {
        enabled: true,
        reason: 'INTERNAL_ADMIN_SYSTEM_SCOPE',
        label: 'System Admin Access'
      }
    : {
        enabled: false,
        reason: null,
        label: null
      };

  let licenseObj = {
    plan: auth.plan,
    commercialStatus: auth.plan === 'FREE' ? 'FREE' : 'ACTIVE',
    accessLevel: auth.plan,
    daily_jobs_limit: auth.plan === 'ENTERPRISE' ? 10000 : (auth.plan === 'PRO' ? 1000 : 50),
    monthly_jobs_limit: auth.plan === 'ENTERPRISE' ? 300000 : (auth.plan === 'PRO' ? 30000 : 1500),
    max_file_size_mb: auth.plan === 'ENTERPRISE' ? 2048 : 500,
    max_job_size_mb: auth.plan === 'ENTERPRISE' ? 2048 : 500,
    source: 'auth_token',
    ai_magic_fix_enabled: auth.plan !== 'FREE'
  };

  if (isInternalAdmin) {
    licenseObj = {
      plan: 'SYSTEM',
      commercialStatus: 'INTERNAL',
      accessLevel: 'SYSTEM',
      daily_jobs_limit: null,
      monthly_jobs_limit: null,
      max_file_size_mb: 2048,
      max_job_size_mb: 2048,
      source: 'internal_admin_override',
      ai_magic_fix_enabled: true,
      large_file_pipeline_enabled: true
    };
  }

  res.json({
    ok: true,
    identity: {
      userId: auth.userId,
      email: email,
      role: identityRole,
      appRole: identityAppRole,
      operationalRole,
      isAdmin,
      isDeveloper,
      printhouseId: auth.printhouseId,
      organizationName: null // Expand later if needed
    },
    adminAccess,
    license: licenseObj,
    apiAccess: {
      enabled: false,
      environment: "live",
      maskedKey: null,
      scopes: auth.scopes || [],
      lastUsedAt: null,
      rotationAvailable: true,
      rotationStatus: "NOT_PROVISIONED"
    },
    security: {
      jwtValidated: true,
      loginMethod: 'STANDARD_OAUTH2'
    },
    usage: {
      jobsToday,
      analyzeJobsToday,
      autofixJobsToday
    }
  });
});

/**
 * GET /api/v2/me/file-history
 * Returns the latest files processed by the tenant/user.
 */
router.get('/file-history', requireAuth, async (req, res) => {
  const requestedLimit = Number.parseInt(req.query.limit, 10);
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(Math.max(requestedLimit, 1), 100)
    : 20;

  const fetchLimit = Math.min(limit * 2, 200);
  const tenantId = req.auth.tenantId;
  const userId = req.auth.userId;

  try {
    // Phase 39.1.18: Tenant scope. We reconstruct relationships dynamically.
    const queryStr = `
      SELECT * 
      FROM preflight_job_registry 
      WHERE tenant_id = ? 
      ORDER BY created_at DESC 
      LIMIT ${fetchLimit}
    `;
    const rowsRaw = await db.query(queryStr, [tenantId]); // Fetch extra for grouping
    const dbRows = rowsRaw.rows || rowsRaw || [];

    const items = [];
    const analyzeMap = new Map();

        // 1. Process ANALYZE jobs first
    for (const row of dbRows) {
      if (row.type !== 'ANALYZE') continue;
      
      let payload = {};
      try {
        if (typeof row.canonical_payload_json === 'string') {
          payload = JSON.parse(row.canonical_payload_json);
        } else if (typeof row.canonical_payload_json === 'object' && row.canonical_payload_json !== null) {
          payload = row.canonical_payload_json;
        }
      } catch (e) {}

      let artifacts = payload.artifacts || {};
      let result = payload.result || {};
      let resArtifacts = result.artifacts || {};

      const hasAnalysisReport = !!(artifacts.analysis_report || artifacts.report || resArtifacts.analysis_report);

      const extractFilename = (r, p) => r.original_filename || r.filename || p.original_filename || p.originalFilename || p.filename || p.fileName || p.input?.filename || p.metadata?.filename || p.document?.filename || p.jobMeta?.filename || p.jobMeta?.fileName || null;
      const resolvedFilename = extractFilename(row, payload) || 'document.pdf';

      const extractFileSize = (r, p) => r.file_size_bytes || r.fileSizeBytes || p.fileSizeBytes || p.file_size_bytes || p.fileSize || p.meta?.fileSize || p.meta?.size || p.metadata?.fileSizeBytes || 0;
      const resolvedFileSizeBytes = extractFileSize(row, payload);

      const resolvedIssuesCount = row.issue_count ?? payload.issuesCount ?? payload.issueCount ?? payload.issues?.length ?? payload.findings?.length ?? 0;
      const resolvedFindingsCount = payload.findingsCount ?? payload.findings?.length ?? payload.issuesCount ?? payload.issues?.length ?? row.issue_count ?? 0;

      const item = {
        groupKey: row.job_id,
        jobId: row.job_id,
        // Phase APP-40.6 — explicit OS-style job linkage for the History view
        jobType: 'ANALYZE',
        sourceJob: null,
        fixJob: null,
        type: 'ANALYZE',
        filename: resolvedFilename,
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        fileSizeBytes: resolvedFileSizeBytes,
        fileSizeMb: resolvedFileSizeBytes / (1024 * 1024),
        policyProfile: row.policy || payload.policy,
        issuesCount: resolvedIssuesCount,
        findingsCount: resolvedFindingsCount,
        artifacts: {
          analysisReport: hasAnalysisReport,
          reviewPdf: !!(artifacts.review_pdf || resArtifacts.review_pdf),
          fixedPdf: false,
          certifiedPdf: false
        },
        relatedFixJobs: []
      };
      analyzeMap.set(row.job_id, item);
      items.push(item);
    }

    // 2. Process AUTOFIX jobs and link them to ANALYZE jobs
    for (const row of dbRows) {
      if (row.type !== 'AUTOFIX') continue;
      
      let payload = {};
      try {
        if (typeof row.canonical_payload_json === 'string') {
          payload = JSON.parse(row.canonical_payload_json);
        } else if (typeof row.canonical_payload_json === 'object' && row.canonical_payload_json !== null) {
          payload = row.canonical_payload_json;
        }
      } catch (e) { }

      const sourceJobId = row.source_job_id || payload.sourceJobId || payload.source_job_id || payload.result?.sourceJobId;
      
      let artifacts = payload.artifacts || {};
      let result = payload.result || {};
      let resArtifacts = result.artifacts || {};
      
      const extractFilename = (r, p) => r.original_filename || r.filename || p.original_filename || p.originalFilename || p.filename || p.fileName || p.input?.filename || p.metadata?.filename || p.document?.filename || p.jobMeta?.filename || p.jobMeta?.fileName || null;
      let resolvedFilename = extractFilename(row, payload);

      const extractFileSize = (r, p) => r.file_size_bytes || r.fileSizeBytes || p.fileSizeBytes || p.file_size_bytes || p.fileSize || p.meta?.fileSize || p.meta?.size || p.metadata?.fileSizeBytes || 0;
      let resolvedFileSizeBytes = extractFileSize(row, payload);

            const safeParseLen = (str) => {
        if (!str) return null;
        try {
          const parsed = JSON.parse(str);
          return Array.isArray(parsed) ? parsed.length : null;
        } catch(e) {
          return null;
        }
      };

      let requestedFixesCount = safeParseLen(row.requested_fixes_json) ?? payload.requestedFixesCount ?? payload.requestedFixes?.length ?? 0;
      let appliedFixesCount = safeParseLen(row.applied_fixes_json) ?? payload.appliedFixesCount ?? payload.appliedFixes?.length ?? payload.applied_fixes?.length ?? 0;
      let skippedFixesCount = safeParseLen(row.skipped_fixes_json) ?? payload.skippedFixesCount ?? payload.skippedFixes?.length ?? payload.skipped_fixes?.length ?? 0;
      let failedFixesCount = safeParseLen(row.failed_fixes_json) ?? payload.failedFixesCount ?? payload.failedFixes?.length ?? payload.failed_fixes?.length ?? 0;
      
      let requiresHumanReview = payload.requiresHumanReview || result.requiresHumanReview || row.status === 'REVIEW_REQUIRED';
      let productionCertified = payload.productionCertified || result.productionCertified || row.status === 'CERTIFIED';

      // APP-60: artifact_trust governance — false flags win over legacy computed values.
      // Never derive production-readiness from job status alone when OS provides artifact_trust.
      const artifact_trust = payload.artifact_trust || result.artifact_trust || null;
      if (artifact_trust && typeof artifact_trust === 'object') {
        if (artifact_trust.production_certified === false) productionCertified = false;
        if (artifact_trust.review_required === true) requiresHumanReview = true;
      }

      // Phase APP-40.3 — a fixed_pdf must never be presented as certified. Only the
      // engine's explicit productionCertified=true (with no pending human review) earns the badge.
      const isProductionSafe = !!productionCertified && !requiresHumanReview;
      const trustLevel = failedFixesCount > 0
        ? 'NEEDS_ATTENTION'
        : isProductionSafe
          ? 'CERTIFIED_SAFE'
          : requiresHumanReview
            ? 'REVIEW_REQUIRED'
            : appliedFixesCount > 0
              ? 'FIXED_UNCERTIFIED'
              : 'DIAGNOSTIC_ONLY';

      let reviewReasons = payload.reviewReasons || payload.review_reasons || result.reviewReasons || result.review_reasons || [];
      let fixSummary = payload.fixSummary || payload.fix_summary || result.fixSummary || result.fix_summary || [];

      // Link up early to inherit filename and size if needed
      let parentAnalyze = null;
      if (sourceJobId && analyzeMap.has(sourceJobId)) {
        parentAnalyze = analyzeMap.get(sourceJobId);
      }

      if (!resolvedFilename || resolvedFilename === 'document.pdf') {
        if (parentAnalyze?.filename) {
          resolvedFilename = parentAnalyze.filename;
        }
      }
      resolvedFilename = resolvedFilename || 'document.pdf';

      if (!resolvedFileSizeBytes && parentAnalyze?.fileSizeBytes) {
        resolvedFileSizeBytes = parentAnalyze.fileSizeBytes;
      }

      
      const safeParseArr = (str, fallback) => {
        const validFallback = Array.isArray(fallback) ? fallback : [];
        if (!str) return validFallback;
        try { 
          const p = JSON.parse(str); 
          return Array.isArray(p) ? p : validFallback; 
        } catch(e) { 
          return validFallback; 
        }
      };
      
      const appliedFixesArr = safeParseArr(row.applied_fixes_json, payload.appliedFixes || payload.applied_fixes || []);
      const skippedFixesArr = safeParseArr(row.skipped_fixes_json, payload.skippedFixes || payload.skipped_fixes || []);
      const failedFixesArr = safeParseArr(row.failed_fixes_json, payload.failedFixes || payload.failed_fixes || []);
      const fixCoverage = payload?.fix_coverage ?? payload?.result?.fix_coverage ?? null;

      const clientChangeSummary = buildClientChangeSummary({
        jobId: row.job_id,
        status: row.status,
        productionCertified,
        requiresHumanReview,
        appliedFixes: appliedFixesArr,
        skippedFixes: skippedFixesArr,
        failedFixes: failedFixesArr,
        strategy: payload.strategy || null
      });
  
      const fixItem = {
        groupKey: row.job_id,
        jobId: row.job_id,
        sourceJobId: sourceJobId,
        // Phase APP-40.6 — explicit OS-style job linkage for the History view
        jobType: 'AUTOFIX',
        sourceJob: sourceJobId,
        fixJob: row.job_id,
        type: 'AUTOFIX',
        filename: resolvedFilename,
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        fileSizeBytes: resolvedFileSizeBytes,
        fileSizeMb: resolvedFileSizeBytes / (1024 * 1024),
        requestedFixesCount,
        appliedFixesCount,
        skippedFixesCount,
        failedFixesCount,
        requiresHumanReview,
        productionCertified,
        productionSafe: isProductionSafe,
        trustLevel,
        artifactDelta: payload.artifact_delta ?? payload.artifactDelta ?? result.artifact_delta ?? null,
        reviewReasons,
        fixSummary,
        clientChangeSummary,
        fix_coverage: fixCoverage,
        // APP-60: Governance context preserved from OS payload for history consumers.
        // Do not compute production recommendation from legacy status alone.
        // APP-62: remediation_state, review_decision_state, and customer_safe_next_action
        // are derived from the governance contracts so history consumers can display
        // safe next-action prompts without exposing internal tokens or raw IDs.
        governance: {
          artifact_trust: artifact_trust || null,
          review_required: artifact_trust?.review_required ?? requiresHumanReview ?? false,
          production_certified: productionCertified,
          standard_certified: artifact_trust?.standard_certified ?? null,
          customer_visible: artifact_trust?.customer_visible ?? null,
          certified_pdf_allowed: artifact_trust?.certified_pdf_allowed ?? null,
          // APP-61: artifact_ux — preserved for history card UX label rendering.
          artifact_ux: payload.artifact_ux || result.artifact_ux || null,
          standards_certification_governance: payload.standards_certification_governance || result.standards_certification_governance || null,
          page_marks_governance: payload.page_marks_governance || result.page_marks_governance || null,
          security_interactivity_governance: payload.security_interactivity_governance || result.security_interactivity_governance || null,
          remediation_ux: payload.remediation_ux || result.remediation_ux || null,
          review_decision_ux: payload.review_decision_ux || result.review_decision_ux || null,
          // APP-66: production_package_governance — printhouse handoff / production
          // package readiness (Phase 71). package_ready and blocked_by_governance_domains
          // are surfaced directly so history cards can show handoff status without
          // re-deriving it from job status.
          production_package_governance: payload.production_package_governance || result.production_package_governance || null,
          package_ready: (() => {
            const pkg = payload.production_package_governance || result.production_package_governance || null;
            return pkg?.package_ready ?? null;
          })(),
          // APP-67: policy profile / machine matching / audit bundle / fix recommendations
          // (Phases 72-75). Preserved as-is so history cards can show standards-profile
          // and machine-compatibility status without re-deriving it from job status.
          policy_profile_governance: payload.policy_profile_governance || result.policy_profile_governance || null,
          machine_readiness_governance: payload.machine_readiness_governance || result.machine_readiness_governance || null,
          audit_bundle_governance: payload.audit_bundle_governance || result.audit_bundle_governance || null,
          recommendation_governance: payload.recommendation_governance || result.recommendation_governance || null,
          // APP-62: derived safe fields for history card display.
          remediation_state: (() => {
            const ux = payload.remediation_ux || result.remediation_ux || null;
            return ux?.remediation_state ?? null;
          })(),
          review_decision_state: (() => {
            const ux = payload.review_decision_ux || result.review_decision_ux || null;
            return ux?.decision ?? null;
          })(),
          customer_safe_next_action: (() => {
            const rem = payload.remediation_ux || result.remediation_ux || null;
            const rev = payload.review_decision_ux || result.review_decision_ux || null;
            // Prefer remediation next_action if remediation is active
            if (rem?.next_action) return rem.next_action;
            // Fall back to review decision customer_message
            if (rev?.customer_message) return rev.customer_message;
            // Legacy fallback: derive from trust and fix state
            if (artifact_trust?.review_required || requiresHumanReview) {
              return 'A human review is required before this file can move to production.';
            }
            if (!productionCertified && appliedFixesCount > 0) {
              return 'Review the corrected file before sending to production.';
            }
            return null;
          })(),
        },
        artifacts: {
          analysisReport: false,
          fixAudit: !!(artifacts.fix_audit || resArtifacts.fix_audit),
          reviewPdf: !!(artifacts.review_pdf || resArtifacts.review_pdf),
          fixedPdf: !!(artifacts.fixed_pdf || resArtifacts.fixed_pdf || artifacts.final_fixed_pdf || resArtifacts.final_fixed_pdf),
          // Phase APP-40.3: only expose the certified download when the engine actually
          // vouches for production-safety — never just because the artifact key exists.
          certifiedPdf: !!((artifacts.certified_pdf || resArtifacts.certified_pdf) && isProductionSafe)
        }
      };

      if (parentAnalyze) {
        parentAnalyze.relatedFixJobs.push(fixItem);
      } else {
        fixItem.sourceAnalyzeJob = null;
        items.push(fixItem);
      }
    }

    // Sort by created_at desc and apply limit
    const sortedItems = items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, limit);

    res.json({
      ok: true,
      scope: 'tenant',
      limit,
      items: sortedItems
    });

  } catch (err) {
    console.error('[BFF][ME][FILE-HISTORY][ERROR]', {
      message: err.message,
      code: err.code,
      errno: err.errno,
      sqlState: err.sqlState,
      sqlMessage: err.sqlMessage,
      tenantId,
      limit,
      fetchLimit
    });
    res.status(500).json({ error: 'HISTORY_FETCH_FAILED', message: 'Failed to retrieve file history' });
  }
});

/**
 * POST /api/v2/me/api-key/rotation-request
 * Simulates API key rotation for the account panel.
 */
router.post('/api-key/rotation-request', requireAuth, async (req, res) => {
  res.json({
    ok: true,
    message: 'API key rotation requested successfully. The new key will be emailed to you shortly.'
  });
});

module.exports = router;
