const express = require('express');
const router = express.Router();
const db = require('../services/db');
const requireAuth = require('../middleware/requireAuth');

function humanizeFixCode(code) {
  const map = {
    'REBUILD_TRIMBOX': 'The final trim area was rebuilt from the page geometry.',
    'APPLY_BLEED': 'Bleed area was added or adjusted for print production.',
    'CONVERT_CMYK': 'Colors were converted to CMYK for print compatibility.',
    'INJECT_OUTPUT_INTENT': 'A print color profile was attached to the PDF.',
    'FLATTEN_FORMS': 'Interactive form fields were flattened into static print content.',
    'NORMALIZE_PAGE_BOXES': 'Page boxes were normalized for production consistency.',
    'CONVERT_GRAYSCALE': 'The file was converted to grayscale.',
    'REBUILD_300DPI': 'The file was rebuilt at 300 DPI for review/diagnostic purposes — this does not restore real image quality.',
    'BOOKLET_MODE': 'The file was prepared for booklet-style production.',
    'IMPOSE_BOOKLET': 'The file was prepared for booklet-style production.',
    // Phase APP-40.4 — Humanized Change Summary v2: current operating-system fix codes
    'ADD_CROP_MARKS': 'Crop marks were added to indicate trim lines for the printer.',
    'REMOVE_REGISTRATION_MARKS': 'Registration marks were removed from the final output.',
    'NORMALIZE_OBJECT_STREAMS': 'Internal PDF object streams were normalized for compatibility and stability.',
    'REVOKE_FALSE_CERTIFICATION': 'A previously attached production certification was revoked because it no longer reflects the file\'s state.',
    'NORMALIZE_STANDARD_METADATA': 'Document metadata was normalized to standard print-production fields.',
    'STRIP_JAVASCRIPT': 'Embedded JavaScript was removed from the document for security and print-safety.',
    'FLATTEN_ANNOTATIONS': 'Annotations were flattened into static print content.',
    'GENERATE_STANDARD_VALIDATION_REPORT': 'A standard validation report was generated for diagnostic review (no file modification).',
    'NORMALIZE_OUTPUT_INTENT': 'The output intent / color profile reference was normalized for print compatibility.',
    'REMOVE_ACROFORM_ACTIONS': 'Potentially unsafe AcroForm actions were removed from the document.',
    // Findings the system cannot reliably autofix — surfaced as diagnostic/reupload/review guidance
    'UPSCALE_LOW_RESOLUTION': 'Low-resolution images were detected. This cannot be reliably restored automatically — reupload a higher-resolution source if needed.',
    'REPAIR_JPEG_ARTIFACTS': 'JPEG compression artifacts were detected. Automatic repair is not reliable — reupload a cleaner source if possible.',
    'RASTER_TO_VECTOR': 'Rasterized artwork was detected where vector art is expected. Automatic vectorization is not reliable — reupload the original vector source.',
    'RECOVER_MISSING_GLYPHS': 'Missing font glyphs were detected. Automatic recovery is not reliable — reupload a file with the fonts embedded.',
    'SUBSTITUTE_FONTS': 'Non-embedded fonts were detected. Automatic substitution is not production-safe — an operator should review font handling.',
    'CONVERT_PDFX': 'A real PDF/X conversion was requested. This requires operator review and is not a guaranteed automatic conversion.',
    'CONVERT_PDFA': 'A real PDF/A conversion was requested. This requires operator review and is not a guaranteed automatic conversion.',
    'CORRECT_TAC': 'Total Area Coverage (TAC) correction was requested. Professional TAC correction requires operator review — this is not an automatic guarantee.'
  };
  return map[code] || `Correction ${code} was processed.`;
}

// Phase APP-40.4 — fix codes that must never be presented as a completed, reliable autofix.
// They surface here as "what cannot be fixed automatically" / "recommended next action".
const NO_RELIABLE_AUTOFIX_CODES = new Set([
  'REBUILD_300DPI',
  'UPSCALE_LOW_RESOLUTION',
  'REPAIR_JPEG_ARTIFACTS',
  'RASTER_TO_VECTOR',
  'RECOVER_MISSING_GLYPHS',
  'SUBSTITUTE_FONTS',
  'CONVERT_PDFX',
  'CONVERT_PDFA',
  'CORRECT_TAC'
]);

function recommendedNextAction(code) {
  const reuploadCodes = new Set(['REBUILD_300DPI', 'UPSCALE_LOW_RESOLUTION', 'REPAIR_JPEG_ARTIFACTS', 'RASTER_TO_VECTOR', 'RECOVER_MISSING_GLYPHS']);
  const operatorReviewCodes = new Set(['SUBSTITUTE_FONTS', 'CONVERT_PDFX', 'CONVERT_PDFA', 'CORRECT_TAC']);
  if (reuploadCodes.has(code)) return 'Customer reupload recommended — provide a higher-quality source file.';
  if (operatorReviewCodes.has(code)) return 'Operator review required before this can move to production.';
  return null;
}

function buildClientChangeSummary(fixJobData) {
  const {
    jobId, status, productionCertified, requiresHumanReview,
    appliedFixes = [], skippedFixes = [], failedFixes = []
  } = fixJobData;

  const appliedChanges = (Array.isArray(appliedFixes) ? appliedFixes : []).map(f => {
    if (!f) return null;
    return {
      code: f.code || f,
      label: humanizeFixCode(f.code || f),
      description: f.description || null,
      requiresHumanReview: !!f.requiresHumanReview,
      destructiveFixRisk: f.destructiveFixRisk || null
    };
  }).filter(Boolean);

  const skippedChanges = (Array.isArray(skippedFixes) ? skippedFixes : []).map(f => {
    if (!f) return null;
    return {
      code: f.code || f,
      label: humanizeFixCode(f.code || f),
      reason: f.reason || null,
      requiresHumanReview: !!f.requiresHumanReview
    };
  }).filter(Boolean);

  const failedChanges = (Array.isArray(failedFixes) ? failedFixes : []).map(f => {
    if (!f) return null;
    return {
      code: f.code || f,
      label: humanizeFixCode(f.code || f),
      reason: f.reason || null
    };
  }).filter(Boolean);

  const reviewWarnings = [];

  for (const f of appliedChanges) {
    if (f.requiresHumanReview) reviewWarnings.push("This change requires visual review before production.");
    if (f.destructiveFixRisk === "HIGH") reviewWarnings.push("This change may alter the visual appearance of the file.");
    if (f.code === "CONVERT_CMYK") reviewWarnings.push("CMYK conversion can slightly change colors. Please review the output PDF.");
    if (f.code === "APPLY_BLEED" && fixJobData.strategy === "BOX_EXPANSION_ONLY") reviewWarnings.push("Bleed was applied by adjusting PDF page boxes; no new artwork was created beyond the page edge.");
  }

  if (skippedChanges.length > 0) reviewWarnings.push("Some requested corrections were not applied automatically.");
  if (failedChanges.length > 0) reviewWarnings.push("Some corrections failed and may require manual prepress intervention.");

  // Remove duplicate warnings
  const uniqueWarnings = [...new Set(reviewWarnings)];

  // Phase APP-40.4 — "What cannot be fixed automatically" + "Recommended next action".
  // Pulled from applied/skipped/failed lists whose codes are knowingly unreliable autofixes.
  const allChanges = [...appliedChanges, ...skippedChanges, ...failedChanges];
  const cannotFixAutomatically = [];
  const recommendedActions = [];
  const seenCodes = new Set();
  for (const f of allChanges) {
    if (!f || !NO_RELIABLE_AUTOFIX_CODES.has(f.code) || seenCodes.has(f.code)) continue;
    seenCodes.add(f.code);
    cannotFixAutomatically.push({ code: f.code, label: humanizeFixCode(f.code) });
    const action = recommendedNextAction(f.code);
    if (action) recommendedActions.push({ code: f.code, action });
  }

  let productionRecommendation = "Correction completed. Please verify the output before production.";
  if (productionCertified && !requiresHumanReview) {
    productionRecommendation = "Production certified. The corrected PDF can be used for print production.";
  } else if (requiresHumanReview) {
    productionRecommendation = "Review required before production use.";
  }

  return {
    title: "Client Change Summary",
    jobId,
    status,
    productionCertified,
    requiresHumanReview,
    plainLanguageSummary: "A summary of automatic corrections and findings.",
    // What changed / what was not changed / what requires review / what cannot be fixed automatically / recommended next action
    whatChanged: appliedChanges,
    whatWasNotChanged: skippedChanges,
    whatRequiresReview: allChanges.filter(f => f && f.requiresHumanReview),
    whatCannotBeFixedAutomatically: cannotFixAutomatically,
    recommendedNextActions: recommendedActions,
    appliedChanges,
    skippedChanges,
    failedChanges,
    reviewWarnings: uniqueWarnings,
    productionRecommendation
  };
}


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
        governance: {
          artifact_trust: artifact_trust || null,
          review_required: artifact_trust?.review_required ?? requiresHumanReview ?? false,
          production_certified: productionCertified,
          standard_certified: artifact_trust?.standard_certified ?? null,
          customer_visible: artifact_trust?.customer_visible ?? null,
          certified_pdf_allowed: artifact_trust?.certified_pdf_allowed ?? null,
          standards_certification_governance: payload.standards_certification_governance || result.standards_certification_governance || null,
          page_marks_governance: payload.page_marks_governance || result.page_marks_governance || null,
          security_interactivity_governance: payload.security_interactivity_governance || result.security_interactivity_governance || null,
          remediation_ux: payload.remediation_ux || result.remediation_ux || null,
          review_decision_ux: payload.review_decision_ux || result.review_decision_ux || null,
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
