const express = require('express');
const router = express.Router();
const db = require('../services/db');
const requireAuth = require('../middleware/requireAuth');

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

  const normalizedRole = String(identityRole || '').toLowerCase();
  const normalizedAppRole = String(identityAppRole || '').toUpperCase();

  const isAdmin =
    normalizedRole === 'tenant_admin' ||
    normalizedRole === 'admin' ||
    normalizedRole === 'super_admin' ||
    normalizedRole === 'superadmin';

  const isDeveloper = normalizedAppRole === 'DEVELOPER';

  const operationalRole = isAdmin ? 'tenant_admin' : 'member';

  const adminAccess = isAdmin
    ? {
        enabled: true,
        reason: 'ROLE_TENANT_ADMIN',
        label: 'Admin / Developer Access'
      }
    : isDeveloper
      ? {
          enabled: true,
          reason: 'APP_ROLE_DEVELOPER',
          label: 'Admin / Developer Access'
        }
      : {
          enabled: false,
          reason: null,
          label: null
        };

  res.json({
    ok: true,
    identity: {
      userId: auth.userId,
      email: auth.email,
      role: identityRole,
      appRole: identityAppRole,
      operationalRole,
      isAdmin,
      isDeveloper,
      printhouseId: auth.printhouseId,
      organizationName: null // Expand later if needed
    },
    adminAccess,
    license: {
      plan: auth.plan,
      commercialStatus: auth.plan === 'FREE' ? 'FREE' : 'ACTIVE',
      accessLevel: auth.plan,
      daily_jobs_limit: auth.plan === 'ENTERPRISE' ? 10000 : (auth.plan === 'PRO' ? 1000 : 50),
      monthly_jobs_limit: auth.plan === 'ENTERPRISE' ? 300000 : (auth.plan === 'PRO' ? 30000 : 1500),
      max_file_size_mb: auth.plan === 'ENTERPRISE' ? 2048 : 500,
      max_job_size_mb: auth.plan === 'ENTERPRISE' ? 2048 : 500,
      source: 'auth_token',
      ai_magic_fix_enabled: auth.plan !== 'FREE'
    },
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
      } catch (e) {
        // Ignore JSON parse errors
      }

      let artifacts = payload.artifacts || {};
      let result = payload.result || {};
      let resArtifacts = result.artifacts || {};

      const hasAnalysisReport = !!(artifacts.analysis_report || artifacts.report || resArtifacts.analysis_report);

      const item = {
        groupKey: row.job_id,
        jobId: row.job_id,
        type: 'ANALYZE',
        filename: row.original_filename || payload.fileName || payload.jobMeta?.fileName || 'document.pdf',
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        fileSizeBytes: row.file_size_bytes || 0,
        fileSizeMb: (row.file_size_bytes || 0) / (1024 * 1024),
        policyProfile: row.policy || payload.policy,
        issuesCount: Array.isArray(payload.issues) ? payload.issues.length : (Array.isArray(result.issues) ? result.issues.length : 0),
        findingsCount: Array.isArray(payload.findings) ? payload.findings.length : (Array.isArray(result.findings) ? result.findings.length : 0),
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
      
      let appliedFixesCount = Array.isArray(payload.applied_fixes) ? payload.applied_fixes.length : (Array.isArray(result.applied_fixes) ? result.applied_fixes.length : 0);
      let skippedFixesCount = Array.isArray(payload.skipped_fixes) ? payload.skipped_fixes.length : (Array.isArray(result.skipped_fixes) ? result.skipped_fixes.length : 0);
      let failedFixesCount = Array.isArray(payload.failed_fixes) ? payload.failed_fixes.length : (Array.isArray(result.failed_fixes) ? result.failed_fixes.length : 0);
      
      let requiresHumanReview = payload.requiresHumanReview || result.requiresHumanReview || row.status === 'REVIEW_REQUIRED';
      let productionCertified = payload.productionCertified || result.productionCertified || row.status === 'CERTIFIED';

      const fixItem = {
        groupKey: row.job_id,
        jobId: row.job_id,
        sourceJobId: sourceJobId,
        type: 'AUTOFIX',
        filename: row.original_filename || payload.fileName || payload.jobMeta?.fileName || 'document.pdf',
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        fileSizeBytes: row.file_size_bytes || 0,
        fileSizeMb: (row.file_size_bytes || 0) / (1024 * 1024),
        appliedFixesCount,
        skippedFixesCount,
        failedFixesCount,
        requiresHumanReview,
        productionCertified,
        artifacts: {
          analysisReport: false,
          reviewPdf: !!(artifacts.review_pdf || resArtifacts.review_pdf),
          fixedPdf: !!(artifacts.fixed_pdf || resArtifacts.fixed_pdf || artifacts.final_fixed_pdf || resArtifacts.final_fixed_pdf),
          certifiedPdf: !!(artifacts.certified_pdf || resArtifacts.certified_pdf)
        }
      };

      if (sourceJobId && analyzeMap.has(sourceJobId)) {
        // Link up
        const parentAnalyze = analyzeMap.get(sourceJobId);
        parentAnalyze.relatedFixJobs.push(fixItem);
      } else {
        // Add as standalone fix if parent is missing from limit set
        fixItem.sourceAnalyzeJob = null; // Can't resolve in this query cleanly
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
