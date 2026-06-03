'use strict';

const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const queue = require('../services/queue');
const ppos = require('../../config/ppos');
const { resolveCanonicalTenantContext } = require('../services/tenantResolver');
const identityService = require('../services/identityService');
const { pposRequest } = require('../services/apiClient');
const licenseGuard = require('../middleware/licenseGuard');
const preflightNormalizer = require('../services/preflightNormalizer');
const statusHelpers = require('../services/statusHelpers');
const { enrollJobInRegistry, updateRegistryWithFixResult } = require('../services/jobRegistryEnrichment');
const requireAuth = require('../middleware/requireAuth');
const db = require('../services/db');
const router = express.Router();
const autofixIdempotencyMap = new Map();

if (!fs.existsSync(ppos.tempUploadDir)) {
  fs.mkdirSync(ppos.tempUploadDir, { recursive: true });
}

// Phase 39.1: Infrastructure ceiling = ENTERPRISE/FOUNDING_PRINTHOUSE max (2048 MB).
// Per-plan enforcement is delegated to licenseGuard (Control Plane-sourced limits).
// This value must never be lower than the highest plan's max_file_size_mb.
const INFRA_MAX_FILE_SIZE_MB = parseInt(
  process.env.INFRA_MAX_FILE_SIZE_MB || '2048',
  10
);

const upload = multer({
  dest: ppos.tempUploadDir,
  limits: { fileSize: INFRA_MAX_FILE_SIZE_MB * 1024 * 1024 }
});

function safeFilename(name) {
  return String(name || 'document.pdf').replace(/[^a-zA-Z0-9._-]/g, '_');
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function getTenantId(req) {
  return req.auth?.tenantId || req.user?.tenantId || 'global';
}

function canonicalId(data, fallbackId) {
  const candidates = [
    data?.jobId, 
    data?.job_id, 
    data?.id,
    data?.job?.id,
    data?.result?.jobId,
    data?.result?.meta?.jobId,
    data?.inlineResult?.meta?.jobId,
    data?.jobMeta?.id,
    fallbackId
  ];
  
  // v2.4.166: Robust Canonical filtering (Prioritize 'fix_' over 'job_')
  const fixId = candidates.find(v => typeof v === 'string' && v.startsWith('fix_'));
  if (fixId) return fixId;

  const resolved = candidates.find(v => typeof v === 'string' && v.startsWith('job_'));
  return resolved || fallbackId;
}

function isAutofixLikePayload(payload, requestedJobId) {
  const id = String(payload?.jobId || payload?.id || requestedJobId || '');
  return (
    payload?.type === 'AUTOFIX' ||
    payload?.result?.type === 'AUTOFIX' ||
    id.startsWith('fix_') ||
    String(requestedJobId || '').startsWith('fix_') ||
    Array.isArray(payload?.repairs) ||
    Array.isArray(payload?.fixes) ||
    Array.isArray(payload?.result?.repairs) ||
    Array.isArray(payload?.result?.fixes) ||
    Boolean(payload?.artifacts?.final_fixed_pdf) ||
    Boolean(payload?.artifacts?.fixed_pdf) ||
    Boolean(payload?.result?.artifacts?.final_fixed_pdf) ||
    Boolean(payload?.result?.artifacts?.fixed_pdf)
  );
}

function isAnalyzeLikePayload(payload, requestedJobId) {
  const id = String(payload?.jobId || payload?.id || requestedJobId || '');
  const type = payload?.type || payload?.result?.type || '';
  const hasFindingsOrIssues = Array.isArray(payload?.findings) || Array.isArray(payload?.issues) || Array.isArray(payload?.result?.findings) || Array.isArray(payload?.result?.issues);
  const hasAnalysisReport = Boolean(payload?.artifacts?.analysis_report || payload?.result?.artifacts?.analysis_report);
  const hasSummaryOrDoc = Boolean(payload?.result?.summary || payload?.result?.document || payload?.summary || payload?.document);
  
  return (
    type === 'ANALYZE' ||
    id.startsWith('job_') ||
    hasFindingsOrIssues ||
    hasAnalysisReport ||
    hasSummaryOrDoc
  );
}

router.post(
  '/',
  upload.single('file'),
  licenseGuard({ action: 'analyze' }),
  async (req, res) => {
    const requestId = req.id || `req_${Date.now()}`;
    const tenantContext = await resolveCanonicalTenantContext(req);
    const tenantId = tenantContext.canonicalTenantId;
    
    // FORCE: Generate a unique jobId here to ensure PPOS contract safety
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const origin = {
      source: 'PREFLIGHT_APP',
      userId: tenantContext.userId,
      email: tenantContext.email,
      appRole: tenantContext.appRole,
      tenantId: tenantContext.canonicalTenantId,
      printhouseId: tenantContext.printhouseId
    };

    try {
      console.log(`[BFF][V2-JOB-START][${requestId}]`, {
        userId: tenantContext.userId,
        email: tenantContext.email,
        jwtTenantId: tenantContext.jwtTenantId,
        canonicalTenantId: tenantContext.canonicalTenantId,
        governanceTenantId: tenantContext.governanceTenantId,
        executionTenantId: tenantContext.executionTenantId,
        upstreamTenantId: tenantContext.canonicalTenantId,
        governancePlanCode: tenantContext.planCode,
        maxFileSizeMb: req.license?.max_file_size_mb || tenantContext.limits?.max_file_size_mb,
        hasFile: !!req.file,
        contentType: req.get('content-type')
      });

      if (!req.file) {
        console.warn(`[BFF][V2-JOB-ERROR][${requestId}] Request missing PDF file.`);
        return res.status(400).json({ 
          error: 'BAD_REQUEST', 
          message: 'No PDF provided. Ensure you use multipart/form-data with a "file" field.' 
        });
      }

      const policy = req.body?.policy || 'OFFSET_MODERN_COATED';
      const filename = safeFilename(req.file.originalname || 'document.pdf');

      console.log(`[BFF][V2-JOB-RECEIVED][${requestId}]`, {
        filename,
        policy,
        size: req.file.size
      });

      const authContext = req.auth || req.user || {};
      const internalToken = identityService.getAuthHeaders(authContext).Authorization;

      const job = await queue.enqueueJob('PREFLIGHT', {
        jobId, // Pass the pre-generated ID
        force: true,   // Clear previous job state
        cleanup: true, // Remove ghost tasks
        requestId,
        tenantId: tenantContext.canonicalTenantId,
        canonicalTenantId: tenantContext.canonicalTenantId,
        jwtTenantId: tenantContext.jwtTenantId,
        executionTenantId: tenantContext.executionTenantId,
        policy,
        filename,
        filePath: req.file.path,
        size: req.file.size,
        userToken: internalToken,
        authContext,
        origin
      });

      console.log('[BFF][JOB-CREATE-SUCCESS]', {
        requestId,
        tenantId,
        jobId: job.id,
        policy,
        status: job.status
      });

      // Cleanup the temp file from multer
      fs.unlink(req.file.path, (err) => {
        if (err) console.warn(`[BFF][CLEANUP][WARN] Failed to delete temp file ${req.file.path}:`, err.message);
      });

      // v2.4.120: Forensic ID Propagation Logic
      // We prioritize the local jobId (from Line 47) as the canonical contract ID
      const finalId = canonicalId(job, jobId);

      console.log('[PREFLIGHT-JOB-SCOPE]', {
        requestId,
        jobId: finalId,
        email: origin.email,
        userId: origin.userId,
        appRole: origin.appRole,
        tenantId: origin.tenantId,
        printhouseId: origin.printhouseId,
        upstreamTenantId: tenantId,
        originalFilename: req.file?.originalname || null
      });

      // Fire-and-forget: create/enrich preflight_job_registry row with origin identity
      setImmediate(() => {
        enrollJobInRegistry(finalId, origin, {
          policy:   policy,
          fileSize: req.file?.size    || 0,
          filename: req.file?.originalname || null
        });
      });

      const responsePayload = {
        ok: true,
        id: finalId,
        jobId: finalId,
        tenantId,
        policy,
        mode: job.mode || 'async',
        jobMeta: {
          id: finalId,
          fileName: req.file.originalname,
          fileSize: req.file.size
        }
      };
      
      if (job.inlineResult) {
        responsePayload.inlineResult = job.inlineResult;
        responsePayload.mode = 'sync';
        // Ensure the inline result itself contains the jobId in its metadata
        responsePayload.inlineResult.meta = {
          ...(responsePayload.inlineResult.meta || {}),
          jobId: finalId
        };
      }

      console.log(`[BFF][V2-JOB-SUCCESS][${requestId}]`, {
        id: responsePayload.id,
        mode: responsePayload.inlineResult ? 'SYNC' : 'ASYNC',
        hasInline: !!responsePayload.inlineResult
      });

      // FAIL-LOUD: Diagnostic for artifact loss prévention
      if (!responsePayload.id || responsePayload.id === 'undefined') {
        console.error(`[BFF][V2-JOB-CRITICAL-ERROR][${requestId}] Job created but ID IS MISSING!`, {
            jobIdVar: jobId,
            jobResultId: job.id,
            jobResultJobId: job.jobId
        });
      }

      responsePayload.__route_marker = 'apiV2-jobid-patch-2026-04-08';
      return res.status(201).json(responsePayload);
    } catch (error) {
      const traceId = requestId;
      if (req.file?.path) {
        fs.unlink(req.file.path, () => { });
      }

      console.error(`[BFF][V2-JOB-CREATE][ERROR][${traceId}]`, {
        tenantId,
        error: error.message
      });

      const upstreamStatus = error.status;
      const isUpstreamTimeout = upstreamStatus === 408 || upstreamStatus === 504 || error.code === 'ECONNABORTED';
      const status = (upstreamStatus === 403 || upstreamStatus === 400)
        ? upstreamStatus
        : upstreamStatus >= 400 && upstreamStatus < 600
          ? 503
          : 500;
      return res.status(status).json({
        error: status === 403 ? 'FORBIDDEN' : isUpstreamTimeout ? 'ENGINE_TIMEOUT' : 'V2_JOB_CREATE_FAILED',
        message: isUpstreamTimeout
          ? 'The preflight engine did not respond in time. Please try again.'
          : status === 403 ? 'Action restricted by security policy' : (error.message || 'Failed to initialize engine job.'),
        traceId,
        v2: true
      });
    }
  }
);

/**
 * GET /api/v2/jobs/policies
 * Returns available preflight policies for the frontend.
 */
router.get('/policies', async (req, res) => {
  try {
    const upstreamPath = ppos.routes.policies;

    const authHeaders = identityService.getAuthHeaders(req.auth || req.user || {});
    const response = await pposRequest(upstreamPath, {
      method: 'GET',
      headers: {
        Authorization: authHeaders.Authorization,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const err = new Error('Upstream policy fetch failed');
      err.response = { status: response.status, data: errorData };
      throw err;
    }

    const data = await response.json();
    const policies = Array.isArray(data?.policies) ? data.policies : [];

    console.log('[POLICIES_PROXY]', {
      upstreamCount: policies.length
    });

    return res.json({
      ok: data.ok ?? true,
      source: data.source || 'UNKNOWN',
      fallbackMode: data.fallbackMode ?? false,
      policyVersion: data.policyVersion || null,
      loadedAt: data.loadedAt || null,
      policies,
      ...(data.error ? { error: data.error } : {}),
      ...(data.reason ? { reason: data.reason } : {})
    });
  } catch (error) {
    const traceId = req.id || `req_pol_${Date.now()}`;
    console.error(`[POLICIES_ERROR][${traceId}]`, error?.response?.data || error.message);

    const status = error?.response?.status || 500;
    const errorData = error?.response?.data || {};
    
    return res.status(status).json({
       error: errorData.error || 'POLICY_FETCH_FAILED',
       message: errorData.message || 'The policy engine is unreachable.',
       traceId,
       v2: true
    });
  }
});

/**
 * GET /api/v2/jobs/:jobId
 */
router.get('/:jobId', async (req, res) => {
  const { jobId } = req.params;
  const requestId = req.get('x-request-id') || 'internal-' + Date.now();
  
  try {
    console.log(`[BFF][POLL][${requestId}] Status check for Job: ${jobId}`);
    
    const authHeader = identityService.getAuthHeaders(req.auth || req.user || {}).Authorization;
    
    // Pass 1: Try literal ID as provided
    let response = await pposRequest(
      ppos.routes.jobStatus(jobId),
      {
        headers: {
          'Authorization': authHeader,
          'X-Request-ID': requestId
        }
      }
    );

    // Pass 2: Fallback if 404 and ID looks like a numeric worker ID
    if (response.status === 404 && !String(jobId).startsWith('job_')) {
          console.log(`[BFF][POLL][FALLBACK] ID ${jobId} not found. Trying prefixed 'job_${jobId}'...`);
          response = await pposRequest(
            ppos.routes.jobStatus(`job_${jobId}`),
            {
              headers: {
                'Authorization': authHeader,
                'X-Request-ID': requestId + '-retry'
              }
            }
          );
    }

    // Pass 3: Fallback if 404 and ID has a prefix (try legacy numeric)
    if (response.status === 404 && String(jobId).startsWith('job_')) {
          const numericId = String(jobId).replace('job_', '');
          console.log(`[BFF][POLL][FALLBACK] ID ${jobId} not found. Trying numeric '${numericId}'...`);
          response = await pposRequest(
            ppos.routes.jobStatus(numericId),
            {
              headers: {
                'Authorization': authHeader,
                'X-Request-ID': requestId + '-retry2'
              }
            }
          );
    }

    if (response.status === 404) {
      return res.status(404).json({ 
        error: 'JOB_NOT_FOUND', 
        message: 'The requested job ID was not found in the PPOS registry.',
        traceId: requestId,
        v2: true
      });
    }

    const raw = await response.text();
    let data = {};
    try {
      data = raw ? JSON.parse(raw) : {};
    } catch {
      data = { raw };
    }

    // --- PHASE 1 DIAGNOSTIC ---
    if (process.env.DEBUG_PREFLIGHT_PAYLOAD === 'true') {
      console.log(`[BFF][V2-POLL-RAW][${requestId}] FULL PAYLOAD:`, JSON.stringify(data, null, 2));
    }
    // ---------------------------

    if (!response.ok) {
        return res.status(response.status).json({
            error: data.code || data.error || 'PPOS_UPSTREAM_ERROR',
            message: data.message || 'The PPOS engine returned a terminal failure.',
            details: data.raw || null,
            traceId: requestId,
            v2: true
        });
    }

    // Capture original arrays and counts before flattening/deletion logic modifies them
    data._rawRootRepairsArray = Array.isArray(data.repairs) ? data.repairs : null;
    data._rawResultRepairsArray = data.result && Array.isArray(data.result.repairs) ? data.result.repairs : null;
    data._rawRootRepairsCount = Array.isArray(data.repairs) ? data.repairs.length : 0;
    data._rawResultRepairsCount = data.result && Array.isArray(data.result.repairs) ? data.result.repairs.length : 0;

    // --- v2.4.93: Deep Payload Normalization (BFF/FE Contract Sync) ---
    // If the engine returns a 'result' wrapper, hard-flatten it to ensure consistent Step 2/Step 4 behavior
    const terminalStatus = String(data.status || '').toUpperCase();
    if (statusHelpers.isTerminalDiagnosticStatus(terminalStatus) && data.result) {
        console.log(`[BFF][POLL][DEEP-NORMALIZATION] Flattening result for job ${jobId}`);
        const result = data.result;
        
        // Ensure core finding fields are at the root
        data.report = result.report || data.report;
        data.issues = result.issues || result.report?.issues || result.analysis?.issues || data.issues || [];
        data.findings = result.findings || result.report?.findings || result.analysis?.findings || data.findings || data.issues || [];
        data.warnings = result.warnings || result.analysis_warnings || result.analysis?.warnings || result.report?.warnings || data.warnings || data.analysis_warnings || [];
        data.analysis_warnings = data.warnings;
        
        // v2.4.115-116: Forensic Preservation Hierarchy
        // We promote every meaningful field to the root to ensure zero data-loss before pruning the wrapper
        const forensicFields = [
            'analysis', 'forensics',
            'fixes', 'repairs', 'applied_fixes', 
            'artifacts', 'output', 'reports', 
            'compliance', 'certification', 'trace', 
            'policy', 'metadata', 'audit',
            'findings', 'issues', 'warnings', 'analysis_warnings',
            'analyzerCoverage', 'analyzer_coverage',
            'analysisIntegrity', 'artifactIntegrity',
            'toolchainIntegrity', 'runtimeIntegrity',
            'summary', 'outcome_category', 'analysis_status',
            'missingTools', 'missingArtifacts',
            'certifiable', 'partial', 'degraded_reasons'
        ];
        
        forensicFields.forEach(field => {
            if (result[field] !== undefined) {
                // Combine instead of overwrite if root already has data (e.g. artifacts)
                if (field === 'artifacts' || field === 'metadata') {
                   data[field] = { ...data[field], ...result[field] };
                } else {
                   data[field] = result[field];
                }
            }
        });

        // Set compatibility duplicates, ensuring we NEVER overwrite object repair records with string intents
        const isObjArray = Array.isArray(data.repairs) && data.repairs.some(x => x && typeof x === 'object');
        if (!isObjArray) {
            data.repairs = data.fixes || data.repairs;
        }
        const isFixesObjArray = Array.isArray(data.fixes) && data.fixes.some(x => x && typeof x === 'object');
        if (!isFixesObjArray && isObjArray) {
            data.fixes = data.repairs;
        } 

        // --- v2.4.95: Hard-Syncing Boolean Flags after Flattening ---
        data.hasReport = !!data.report;
        data.hasFindings = Array.isArray(data.findings) && data.findings.length > 0;
        data.hasIssues = Array.isArray(data.issues) && data.issues.length > 0;
        data.hasWarnings = Array.isArray(data.warnings) && data.warnings.length > 0;
        
        // --- v2.4.111: Forensic Job-Type Identification Bridge ---
        const detectedType = result.type || data.type || result.job_type || 'ANALYZE';
        console.log(`[BFF][POLL][TYPE-RAW][${requestId}]`, { 
            detected: detectedType, 
            source: result.type ? 'result.type' : (data.type ? 'data.type' : 'job_type') 
        });
        data.type = detectedType.toUpperCase();
        data.name = result.name || data.name || data.type;

        // Clean up the nested wrapper now that preservation is complete
        delete data.result;
    } else if (statusHelpers.isTerminalDiagnosticStatus(terminalStatus)) {
        // Fallback sync if data.result was not present but status is terminal
        data.warnings = data.warnings || data.analysis_warnings || data.report?.warnings || data.analysis?.warnings || [];
        data.analysis_warnings = data.warnings;
        data.hasReport = !!data.report;
        data.hasFindings = Array.isArray(data.findings) && data.findings.length > 0;
        data.hasIssues = Array.isArray(data.issues) && data.issues.length > 0;
        data.hasWarnings = Array.isArray(data.warnings) && data.warnings.length > 0;
    }

    // Normalize artifacts to canonical key-value map {type: filename} for frontend compatibility.
    // PPOS returns a top-level array; spreading it produces numeric keys unusable by getBestArtifactKey.
    if (data.artifacts) {
        const artMap = {};
        if (Array.isArray(data.artifacts)) {
            data.artifacts.forEach(a => {
                if (a?.type && a?.name) artMap[a.type] = a.name;
            });
        } else if (typeof data.artifacts === 'object') {
            Object.entries(data.artifacts).forEach(([k, v]) => {
                if (typeof v === 'object' && v?.type && v?.name) {
                    artMap[v.type] = v.name;
                } else if (typeof v === 'string' && isNaN(Number(k))) {
                    artMap[k] = v;
                }
            });
        }
        data.artifacts = artMap;
    }

    // v2.4.135: Strict Canonical ID Enforcement Bridge
    // If the OS returns a numeric ID, we fallback strictly to the request param jobId (which is canonical).
    // This removes the risk of numeric database primary keys (like '32') leaking as public identifiers.
    data.jobId = canonicalId(data, jobId);
    data.id = data.jobId; // Unify root identifiers to prevent frontend ambiguity

    console.log(`[BFF][CANONICAL-ID][POLL] Status check for Job: ${jobId} -> Resolved: ${data.jobId}`);

    if (statusHelpers.isTerminalDiagnosticStatus(terminalStatus) && !data.type) {
        data.type = 'ANALYZE';
    }
    // ------------------------------------------------------------------

    console.log(`[BFF][POLL][DIAGNOSTIC-SUMMARY][${requestId}]`, {
      jobId: data.jobId,
      status: data.status,
      type: data.type,
      issues: Array.isArray(data.issues) ? data.issues.length : null,
      findings: Array.isArray(data.findings) ? data.findings.length : null,
      warnings: Array.isArray(data.warnings) ? data.warnings.length : null,
      analysisWarnings: Array.isArray(data.analysis_warnings) ? data.analysis_warnings.length : null,
      hasIssues: data.hasIssues,
      hasFindings: data.hasFindings,
      hasWarnings: data.hasWarnings
    });

    if (data.type === 'ANALYZE' && statusHelpers.isTerminalDiagnosticStatus(terminalStatus)) {
        preflightNormalizer.cacheSourceJob(data.jobId, data);
    }

    console.info(`[BFF][POLL][NORMALIZE-CHECK][${requestId}]`, {
      requestedJobId: jobId,
      resolvedJobId: data?.jobId || data?.id || null,
      type: data?.type || data?.result?.type || null,
      startsWithFix: String(jobId || '').startsWith('fix_') || String(data?.jobId || data?.id || '').startsWith('fix_'),
      hasRepairs: Array.isArray(data?.repairs) || Array.isArray(data?.result?.repairs),
      repairsCount: Array.isArray(data?.repairs)
        ? data.repairs.length
        : (Array.isArray(data?.result?.repairs) ? data.result.repairs.length : 0),
      hasFixes: Array.isArray(data?.fixes) || Array.isArray(data?.result?.fixes),
      fixesCount: Array.isArray(data?.fixes)
        ? data.fixes.length
        : (Array.isArray(data?.result?.fixes) ? data.result.fixes.length : 0),
      hasFinalFixedPdf: Boolean(data?.artifacts?.final_fixed_pdf || data?.result?.artifacts?.final_fixed_pdf)
    });

    let finalResponsePayload = data;

    const isAutofixLike = isAutofixLikePayload(data, jobId);

    if (isAutofixLike) {
      const canonicalFixId = preflightNormalizer.getJobId(data);
      const resolvedFixId = (canonicalFixId !== "fix_unknown" && canonicalFixId.startsWith("fix_"))
          ? canonicalFixId
          : (data.jobId || data.id || jobId);

      let fetchedSourceId = preflightNormalizer.getSourceJobId(data, null);
      let resolvedSourceJobId = (fetchedSourceId !== "job_unknown")
          ? fetchedSourceId
          : preflightNormalizer.getLinkedSourceJobId(resolvedFixId);

      let cachedSource = preflightNormalizer.getCachedSourceJob(resolvedFixId, data);

      if (!cachedSource && resolvedSourceJobId && resolvedSourceJobId.startsWith('job_')) {
        try {
          console.log(`[BFF][POLL][SOURCE-FETCH] Source job ${resolvedSourceJobId} not in cache. Fetching from upstream...`);
          const authHeaders = identityService.getAuthHeaders(req.auth || req.user || {});
          const srcRes = await pposRequest(ppos.routes.jobStatus(resolvedSourceJobId), {
            headers: { Authorization: authHeaders.Authorization }
          });
          if (srcRes.ok) {
            const srcData = await srcRes.json();
            preflightNormalizer.cacheSourceJob(resolvedSourceJobId, srcData);
            cachedSource = srcData;
          }
        } catch (err) {
          console.warn(`[BFF][POLL][SOURCE-FETCH][WARN] Upstream fetch for source job ${resolvedSourceJobId} failed: ${err.message}`);
        }
      }

      const finalSourceJobId = cachedSource?.jobId || cachedSource?.id || resolvedSourceJobId || null;

      console.info("[BFF][FIX-LINK][RESOLVE]", {
        fixJobId: resolvedFixId,
        sourceJobId: finalSourceJobId,
        hasLinkedSource: Boolean(finalSourceJobId),
        hasSourceContext: Boolean(cachedSource),
        sourceFindingsCount: cachedSource ? preflightNormalizer.extractFindings(cachedSource).length : null
      });

      finalResponsePayload = preflightNormalizer.normalizeAutofixJob({
        ...data,
        jobId: resolvedFixId,
        id: resolvedFixId,
        ...(finalSourceJobId ? { sourceJobId: finalSourceJobId } : {})
      }, cachedSource);

      const rawRootRepairsCount = data._rawRootRepairsCount || 0;
      const rawResultRepairsCount = data._rawResultRepairsCount || 0;
      const requestedFixesCount = Array.isArray(finalResponsePayload.requested_fixes) ? finalResponsePayload.requested_fixes.length : 0;
      let normalizedRepairsCount = Array.isArray(finalResponsePayload.repairs) ? finalResponsePayload.repairs.length : 0;
      let normalizedAppliedCount = Array.isArray(finalResponsePayload.applied_fixes) ? finalResponsePayload.applied_fixes.length : 0;
      let normalizedSkippedCount = Array.isArray(finalResponsePayload.skipped_fixes) ? finalResponsePayload.skipped_fixes.length : 0;
      let normalizedFailedCount = Array.isArray(finalResponsePayload.failed_fixes) ? finalResponsePayload.failed_fixes.length : 0;

      console.log("[BFF][POLL][AUTOFIX-REPAIR-PRESERVE]", {
        jobId: finalResponsePayload.jobId,
        requestedFixesCount,
        rawRootRepairsCount,
        rawResultRepairsCount,
        normalizedRepairsCount,
        normalizedAppliedCount,
        normalizedSkippedCount,
        normalizedFailedCount
      });

      if ((rawRootRepairsCount > 0 || rawResultRepairsCount > 0) && normalizedRepairsCount === 0) {
        console.warn("[BFF][AUTOFIX][REPAIR-PRESERVATION-WARN] Raw root/result repairs count > 0 but normalized repairs count === 0");
        const rawRepairsToPreserve = data._rawRootRepairsArray || data._rawResultRepairsArray || [];
        finalResponsePayload.repairs = rawRepairsToPreserve;
        finalResponsePayload.fixes = rawRepairsToPreserve;
        finalResponsePayload.applied_fixes = rawRepairsToPreserve.filter(r => r && typeof r === 'object' && (r.status === "APPLIED" || r.status === "SUCCESS" || r.status === "REQUIRES_HUMAN_REVIEW"));
        finalResponsePayload.failed_fixes = rawRepairsToPreserve.filter(r => r && typeof r === 'object' && (r.status === "FAILED" || r.status === "ERROR"));
        finalResponsePayload.skipped_fixes = rawRepairsToPreserve.filter(r => r && typeof r === 'object' && (r.status === "SKIPPED" || r.status === "UNSUPPORTED" || r.status === "BLOCKED_BY_POLICY"));

        // Update counts for subsequent enriched log
        normalizedRepairsCount = finalResponsePayload.repairs.length;
        normalizedAppliedCount = finalResponsePayload.applied_fixes.length;
        normalizedSkippedCount = finalResponsePayload.skipped_fixes.length;
        normalizedFailedCount = finalResponsePayload.failed_fixes.length;
      }

      finalResponsePayload._bffNormalizerApplied = true;
      finalResponsePayload._bffNormalizerVersion = "autofix-get-v2-2026-05-14";

      console.info(`[BFF][POLL][AUTOFIX-ENRICHED][${requestId}]`, {
        requestedJobId: jobId,
        resolvedJobId: finalResponsePayload.jobId,
        sourceJobId: finalResponsePayload.sourceJobId || null,
        type: finalResponsePayload.type,
        fixesCount: Array.isArray(finalResponsePayload.fixes) ? finalResponsePayload.fixes.length : 0,
        repairsCount: Array.isArray(finalResponsePayload.repairs) ? finalResponsePayload.repairs.length : 0,
        artifactListCount: Array.isArray(finalResponsePayload.artifactList) ? finalResponsePayload.artifactList.length : 0,
        degraded: finalResponsePayload._isDegraded,
        degradedReasons: finalResponsePayload.degraded_reasons || []
      });
    } else if (isAnalyzeLikePayload(data, jobId)) {
      finalResponsePayload = preflightNormalizer.normalizeAnalyzeJob(data);
      console.info(`[BFF][POLL][ANALYZE-ENRICHED][${requestId}]`, {
        requestedJobId: jobId,
        resolvedJobId: finalResponsePayload?.jobId,
        hasSummary: Boolean(finalResponsePayload?.summary),
        isDerivedSummary: finalResponsePayload?.summary?.derived || false,
        findingsCount: Array.isArray(finalResponsePayload?.findings) ? finalResponsePayload.findings.length : 0,
        degraded: finalResponsePayload?._isDegraded
      });
    }

    finalResponsePayload = preflightNormalizer.normalizeAutofixResultState(finalResponsePayload);

    let normalizedReport = null;
    if (finalResponsePayload?.type === 'AUTOFIX') {
      normalizedReport = finalResponsePayload;
    } else {
      const nestedToCheck = [
        finalResponsePayload?.result,
        finalResponsePayload?.data?.result,
        finalResponsePayload?.report,
        finalResponsePayload?.data?.report,
        finalResponsePayload?.job?.result,
        finalResponsePayload?.job?.report,
        finalResponsePayload?.fixResult,
        finalResponsePayload?.autofixResult
      ];
      normalizedReport = nestedToCheck.find(r => r?.type === 'AUTOFIX');
    }

    if (normalizedReport) {
      res.setHeader('X-PPOS-Autofix-Result-Normalized', 'true');
      res.setHeader('X-PPOS-Autofix-Status', normalizedReport.status || 'COMPLETED_WITH_REVIEW');
      console.log(`[AUTOFIX_RESULT_NORMALIZED_FOR_FRONTEND]\nroute=apiV2_status\njobId=${jobId}\nstatus=${normalizedReport.status}`);
    }

    // Fire-and-forget: persist fix result counts to registry once terminal
    if (
      finalResponsePayload?.type === 'AUTOFIX' &&
      statusHelpers.isTerminalStatus(String(finalResponsePayload.status || ''))
    ) {
      setImmediate(() => {
        updateRegistryWithFixResult(
          finalResponsePayload.jobId || finalResponsePayload.job_id || jobId,
          finalResponsePayload
        ).catch(() => {});
      });
    }

    return res.status(response.status).json(finalResponsePayload);

  } catch (error) {
    console.error(`[BFF][POLL][ERROR][${requestId}]`, error.message);
    return res.status(502).json({
      error: 'PPOS_GATEWAY_ERROR',
      message: 'The PPOS engine status node returned an unexpected response.',
      details: error.message,
      traceId: requestId,
      v2: true
    });
  }
});

/**
 * GET /api/v2/jobs/:jobId/artifacts/:artifactId
 * Proxy artifact streaming from PPOS.
 */
router.get('/:jobId/artifacts/:artifactId', async (req, res) => {
  const { jobId, artifactId } = req.params;
  const requestId = req.id || `art_${Date.now()}`;

  try {
    // --- v2.4.111: BFF-Side Artifact Alias Support ---
    const artifactMap = {
      'analysis_report': 'report.json',
      'audit_report': 'fix_audit.json'
    };
    
    let resolvedArtifactId = artifactMap[artifactId] || artifactId;

    const needsAliasResolution = ['review_pdf', 'certified_pdf', 'final_fixed_pdf', 'fixed_pdf', 'normalized_pdf', 'fix_audit'].includes(artifactId);

    // v2.4.160: Artifact Aliasing Logic (Requirement 4)
    if (needsAliasResolution) {
       console.log(`[BFF][ARTIFACT][ALIAS-RESOLVE] Resolving alias for ${jobId}/${artifactId}`);
       const authHeaders = identityService.getAuthHeaders(req.auth || req.user || {});
       
       try {
         const jobRes = await pposRequest(ppos.routes.jobStatus(jobId), {
           headers: { Authorization: authHeaders.Authorization }
         });
         
         if (jobRes.ok) {
           const jobData = await jobRes.json();
           const report = jobData.result || jobData;
           
           const resolution = preflightNormalizer.resolveArtifactName(report, artifactId);
           if (resolution) {
               resolvedArtifactId = resolution.filename;
               console.log(`[BFF][ARTIFACT][ALIAS-RESOLVE] Aliased ${artifactId} -> ${resolvedArtifactId}`);
           } else {
               console.log(`[BFF][ARTIFACT][ALIAS-RESOLVE] No alias resolution found for ${artifactId}`);
           }
         }
       } catch (err) {
         console.warn(`[BFF][ARTIFACT][ALIAS-RESOLVE][WARN] Failed to fetch job status for aliasing: ${err.message}`);
       }
    }

    const response = await pposRequest(
      ppos.routes.jobArtifact(jobId, resolvedArtifactId),
      {
        method: 'GET',
        headers: {
          Authorization: identityService.getAuthHeaders(req.auth || req.user || {}).Authorization
        }
      }
    );

    if (!response.ok) {
      const contentType = response.headers.get('content-type') || '';
      let body = {};
      try {
        if (contentType.includes('application/json')) {
          body = await response.json();
        } else {
          const text = await response.text();
          body = { message: text };
        }
      } catch (e) {
        body = { message: 'Failed to parse error response body.' };
      }

      console.warn(`[BFF][ARTIFACT][ERROR] Upstream artifact request failed with status ${response.status}`, body);

      return res.status(response.status).json({
        error: body.error || 'ARTIFACT_STREAM_FAILED',
        message: body.message || 'Failed to retrieve requested artifact.',
        jobId,
        artifactId,
        requestedAlias: body.requestedAlias || resolvedArtifactId || null,
        availableArtifacts: body.availableArtifacts || null,
        upstream: body,
        traceId: requestId,
        v2: true
      });
    }

    response.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });

    res.status(response.status);

    if (!response.body) {
      return res.end();
    }

    const arrayBuffer = await response.arrayBuffer();

    // --- v2.4.172: Normalize JSON Report Artifacts at Boundary ---
    const isReportJson = artifactId === 'analysis_report' || artifactId === 'report.json' || resolvedArtifactId === 'report.json' || artifactId === 'audit_report' || resolvedArtifactId === 'fix_audit.json';
    if (isReportJson) {
      try {
        const text = Buffer.from(arrayBuffer).toString('utf8');
        let json = JSON.parse(text);
        
        const wasAutofix = json && (json.type === 'AUTOFIX' || Array.isArray(json.applied_fixes) || Array.isArray(json.repairs) || Array.isArray(json.fixes));
        
        json = preflightNormalizer.maybeNormalizeAutofixReportArtifact(json);
        
        if (json && json.type === 'AUTOFIX') {
          res.setHeader('X-PPOS-Autofix-Normalized', 'true');
          res.setHeader('X-PPOS-Autofix-Status', json.status || 'COMPLETED_WITH_REVIEW');
          
          console.log(`[AUTOFIX_REPORT_NORMALIZED_AT_DOWNLOAD]\nroute=apiV2_artifact\njobId=${jobId}\nartifactId=${artifactId}\nstatus=${json.status}`);
        }
        
        const finalBuf = Buffer.from(JSON.stringify(json, null, 2));
        res.setHeader('Content-Length', finalBuf.length);
        return res.end(finalBuf);
      } catch (e) {
        console.warn(`[AUTOFIX_REPORT_NORMALIZATION_SKIPPED]\nreason=${e.message}\nroute=apiV2_artifact`);
      }
    }

    return res.end(Buffer.from(arrayBuffer));

  } catch (error) {
    const traceId = `req_art_${Date.now()}`;
    console.error(`[BFF][ARTIFACT][ERROR][${traceId}]`, error.message);
    return res.status(502).json({
      error: 'ARTIFACT_STREAM_FAILED',
      message: 'Failed to retrieve requested artifact from PPOS storage.',
      details: error.message,
      traceId,
      v2: true
    });
  }
});

function normalizeRequestedFixes(body = {}) {
  const candidates = [
    body.requestedFixes,
    body.requested_fixes,
    body.fixes,
    body.options?.requestedFixes,
    body.options?.requested_fixes,
    body.options?.fixes
  ];

  const out = [];

  for (const candidate of candidates) {
    if (!candidate) continue;
    const arr = Array.isArray(candidate) ? candidate : [candidate];

    for (const item of arr) {
      if (!item) continue;

      if (typeof item === "string") {
        out.push(item);
        continue;
      }

      if (typeof item === "object") {
        const code =
          item.code ||
          item.id ||
          item.repairStrategy ||
          item.strategy ||
          item.fix_method ||
          item.recommended_fix;

        if (code) out.push(code);
      }
    }
  }

  return [...new Set(out.map(x => String(x).trim()).filter(Boolean))];
}

/**
 * POST /api/v2/jobs/:jobId/actions/fix
 * Trigger a stateful autofix on an existing job asset.
 */
router.post('/:jobId/actions/fix', async (req, res) => {
  const { jobId } = req.params;
  const requestId = req.get('x-request-id') || `fix_${Date.now()}`;
  const tenantId = getTenantId(req);

  const sendNormalizedFixResponse = (statusCode, data) => {
    const finalData = preflightNormalizer.normalizeAutofixResultState(data);
    let normalizedReport = null;
    if (finalData?.type === 'AUTOFIX') {
      normalizedReport = finalData;
    } else {
      const nestedToCheck = [
        finalData?.result,
        finalData?.data?.result,
        finalData?.report,
        finalData?.data?.report,
        finalData?.job?.result,
        finalData?.job?.report,
        finalData?.fixResult,
        finalData?.autofixResult
      ];
      normalizedReport = nestedToCheck.find(r => r?.type === 'AUTOFIX');
    }

    if (normalizedReport) {
      res.setHeader('X-PPOS-Autofix-Result-Normalized', 'true');
      res.setHeader('X-PPOS-Autofix-Status', normalizedReport.status || 'COMPLETED_WITH_REVIEW');
      console.log(`[AUTOFIX_RESULT_NORMALIZED_FOR_FRONTEND]\nroute=apiV2_fix\njobId=${jobId}\nstatus=${normalizedReport.status}`);
    }
    return res.status(statusCode).json(finalData);
  };

  try {
    if (!jobId) {
        return res.status(400).json({
            error: 'MISSING_JOB_ID',
            message: 'Target Job ID is required for a stateful fix.'
        });
    }

    const estimatedBodySizeBytes = req.headers["content-length"] ? parseInt(req.headers["content-length"], 10) : 0;
    console.log(`[APP-BFF][MAGIC-FIX-REQUEST]`, {
      route: req.originalUrl,
      method: req.method,
      jobId,
      contentLength: req.headers["content-length"],
      contentType: req.headers["content-type"],
      bodyKeys: Object.keys(req.body || {}),
      hasFile: Boolean(req.file),
      estimatedBodySizeBytes
    });

    if (estimatedBodySizeBytes > 1048576) {
      console.log(`[APP-BFF][MAGIC-FIX-PAYLOAD-TOO-LARGE-RISK]`);
    }

    if (req.file || req.body?.file || req.body?.blob || req.body?.base64 || req.body?.pdf || req.body?.document || req.body?.binary || typeof req.body?.file === 'string') {
        return res.status(400).json({
            error: "INLINE_FILE_NOT_ALLOWED_FOR_MAGIC_FIX",
            message: "Magic Fix must reference an existing source job. Do not resend the PDF."
        });
    }

    console.log(`[APP][AUTOFIX][REQUEST][${requestId}]`, { jobId, policy: req.body?.policy || 'default' });

    const authHeaders = identityService.getAuthHeaders(req.auth || req.user || {});

    // Requirement 1: Preserve source job context
    if (req.body?.sourceJobContext) {
      preflightNormalizer.cacheSourceJob(jobId, req.body.sourceJobContext);
    }
    try {
      const sourceStatusRes = await pposRequest(ppos.routes.jobStatus(jobId), {
        headers: { Authorization: authHeaders.Authorization }
      });
      if (sourceStatusRes.ok) {
        const sourceData = await sourceStatusRes.json();
        preflightNormalizer.cacheSourceJob(jobId, sourceData);
      }
    } catch (err) {
      console.warn(`[BFF][AUTOFIX] Pre-fetch source job context failed: ${err.message}`);
    }

    const body = req.body || {};

    const requestedFixes = normalizeRequestedFixes(body);

    const forceBleed = Boolean(
      body.forceBleed ??
      body.force_bleed ??
      body.options?.forceBleed ??
      body.options?.force_bleed ??
      false
    );

    const incomingMagicFixProfile =
      req.body?.magicFixProfile ||
      req.body?.magic_fix_profile ||
      req.body?.options?.magicFixProfile ||
      req.body?.options?.magic_fix_profile ||
      null;

    const hasCmyk = requestedFixes.includes("CONVERT_CMYK");
    const hardeningAction = req.body?.hardeningAction || req.body?.options?.hardeningAction || null;

    let magicFixProfile =
      incomingMagicFixProfile ||
      (hasCmyk ? "MAGIC_FIX_FORCE_CMYK" : "MAGIC_FIX_SAFE");

    if (hasCmyk && hardeningAction === "OPTIMIZE_CMYK") {
      magicFixProfile = "MAGIC_FIX_FORCE_CMYK";
    }

    const targetProfile =
      body.targetProfile ||
      body.target_profile ||
      body.options?.targetProfile ||
      body.options?.target_profile ||
      'FOGRA51';

    const policy = body.policy || 'OFFSET_MODERN_COATED';
    const policyId = body.policyId || body.policy || 'OFFSET_MODERN_COATED';

    const canonicalFixesStr = requestedFixes.sort().join(',');

    const idempotencyKeyObj = {
      tenantId,
      jobId,
      fixes: canonicalFixesStr,
      magicFixProfile,
      hardeningAction,
      targetProfile,
      forceBleed,
      policyId
    };
    const idempotencyKey = JSON.stringify(idempotencyKeyObj);

    console.log(`[BFF][AUTOFIX][IDEMPOTENCY-KEY]`, { idempotencyKey });

    if (autofixIdempotencyMap.has(idempotencyKey)) {
      console.log(`[BFF][AUTOFIX][IDEMPOTENT-HIT]`, { idempotencyKey });
      const record = autofixIdempotencyMap.get(idempotencyKey);
      if (record.pendingPromise) {
        try {
          const enrichedData = await record.pendingPromise;
          return sendNormalizedFixResponse(200, enrichedData);
        } catch (err) {
          // If previous execution failed, fall through to re-attempt
        }
      } else if (record.result) {
        return sendNormalizedFixResponse(200, record.result);
      }
    }

    const executeFixAction = async () => {
      const options = body.options || {};
      let { type, strategy, repairStrategy } = options;

      const hasTrimBox = requestedFixes.some(f => f === 'REBUILD_TRIMBOX' || f?.repairStrategy === 'REBUILD_TRIMBOX');
      if (hasTrimBox) {
          const hasStructuralFix = requestedFixes.some(f =>
              ['RGB→CMYK', 'BLEED', 'FLATTEN_PDF', 'REBUILD', 'CONVERT_GRAYSCALE', 'CONVERT_CMYK'].includes(typeof f === 'string' ? f : f?.repairStrategy)
          );

          if (!hasStructuralFix && !strategy) {
              type = 'geometry';
              strategy = 'REBUILD_TRIMBOX';
              repairStrategy = 'REBUILD_TRIMBOX';
          }
      }

      const hasBleedOpt = forceBleed || requestedFixes.some(f =>
          f === 'APPLY_BLEED' || f === 'BLEED' || f?.repairStrategy === 'APPLY_BLEED' || f?.repairStrategy === 'BLEED'
      );
      if (hasBleedOpt && !type && !repairStrategy) {
          type = 'bleed';
          repairStrategy = 'APPLY_BLEED';
      }

      const hasCmyk = options.forceCmykAfterFix === true || requestedFixes.some(f =>
          f === 'CONVERT_CMYK' || f === 'RGB→CMYK' || f?.repairStrategy === 'CONVERT_CMYK' || f?.repairStrategy === 'RGB→CMYK'
      );

      const servicePayload = {
        ...body,
        policy,
        policyId,
        fixes: requestedFixes,
        requested_fixes: requestedFixes,
        requestedFixes,
        forceBleed,
        force_bleed: forceBleed,
        targetProfile,
        target_profile: targetProfile,
        magicFixProfile,
        magic_fix_profile: magicFixProfile,
        options: {
          ...options,
          type,
          strategy,
          repairStrategy,
          ...(hasCmyk ? { target: 'cmyk' } : {}),
          fixes: requestedFixes,
          requested_fixes: requestedFixes,
          requestedFixes,
          forceBleed,
          force_bleed: forceBleed,
          targetProfile,
          target_profile: targetProfile,
          magicFixProfile,
          magic_fix_profile: magicFixProfile
        }
      };

      console.log(`[BFF][FIX-ACTION][FORWARD-PAYLOAD]`, {
        sourceJobId: jobId,
        requestedFixesCount: requestedFixes.length,
        requestedFixes,
        forceBleed,
        targetProfile
      });

      console.log(`[BFF][MAGIC-FIX-FORWARD]`, {
        jobId,
        requestedFixes,
        requestedFixesCount: requestedFixes.length,
        magicFixProfile,
        targetProfile,
        hardeningAction,
        bodyKeys: Object.keys(req.body || {})
      });

      const response = await pposRequest(
        `/api/preflight/jobs/${jobId}/actions/fix`,
        {
          method: 'POST',
          headers: {
            Authorization: authHeaders.Authorization,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(servicePayload)
        }
      );

      let bodyPreview = '';
      try {
        const clonedRes = response.clone();
        bodyPreview = await clonedRes.text();
        bodyPreview = bodyPreview.substring(0, 200);
      } catch (e) {
        bodyPreview = 'Could not preview body';
      }

      console.log(`[APP-BFF][MAGIC-FIX-UPSTREAM-RESPONSE]`, {
        upstreamUrl: `/api/preflight/jobs/${jobId}/actions/fix`,
        status: response.status,
        statusText: response.statusText,
        contentType: response.headers.get('content-type'),
        bodyPreview
      });

      if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error(`[APP][AUTOFIX][ERROR][${requestId}]`, errorData);
          const err = new Error(errorData.message || 'The PPOS engine rejected the fix action.');
          err.status = response.status;
          err.upstreamError = errorData;
          throw err;
      }

      const data = await response.json();
      
      const canonicalFixId = preflightNormalizer.getJobId(data);
      const resolvedFixId = (canonicalFixId !== "fix_unknown" && canonicalFixId.startsWith("fix_"))
          ? canonicalFixId
          : (data.jobId || data.id || data.fixJobId || data.targetJobId || data.result?.jobId || jobId);

      console.log(`[APP][AUTOFIX][RESPONSE][${requestId}]`, { sourceJobId: jobId, targetJobId: resolvedFixId });
      console.log(`[BFF][CANONICAL-ID][FIX] Response for Job: ${jobId} -> Resolved: ${resolvedFixId}`);

      preflightNormalizer.linkFixJob(resolvedFixId, jobId);

      const cachedSource = preflightNormalizer.getCachedSourceJob(resolvedFixId, data);

      console.info("[BFF][FIX-LINK][CREATE]", {
        sourceJobId: jobId,
        fixJobId: resolvedFixId,
        hasSourceContext: Boolean(cachedSource),
        sourceFindingsCount: Array.isArray(cachedSource?.findings) ? cachedSource.findings.length : null
      });

      const enrichedData = preflightNormalizer.normalizeAutofixJob({
        ...data,
        jobId: resolvedFixId,
        id: resolvedFixId,
        sourceJobId: jobId
      }, cachedSource);

      enrichedData.jobId = resolvedFixId;
      enrichedData.sourceJobId = jobId;

      return enrichedData;
    };

    const pendingPromise = executeFixAction();
    console.log(`[BFF][AUTOFIX][IDEMPOTENT-STORE]`, { idempotencyKey });
    autofixIdempotencyMap.set(idempotencyKey, { pendingPromise });

    try {
      const enrichedData = await pendingPromise;
      autofixIdempotencyMap.set(idempotencyKey, { result: enrichedData });
      
      setTimeout(() => {
        if (autofixIdempotencyMap.get(idempotencyKey)?.result === enrichedData) {
          autofixIdempotencyMap.delete(idempotencyKey);
        }
      }, 65000);

      return sendNormalizedFixResponse(200, enrichedData);
    } catch (err) {
      console.log(`[BFF][AUTOFIX][IDEMPOTENT-CLEAR-ON-ERROR]`, { idempotencyKey });
      autofixIdempotencyMap.delete(idempotencyKey);
      
      const status = err.status || 500;
      return res.status(status).json({
          error: 'FIX_ACTION_FAILED',
          message: err.message || 'The PPOS engine rejected the fix action.',
          traceId: requestId,
          v2: true,
          ...(err.upstreamError ? { upstreamError: err.upstreamError } : {})
      });
    }
  } catch (error) {
    const traceId = requestId;
    console.error(`[BFF][FIX-ACTION][ERROR][${traceId}]`, error.message);
    return res.status(500).json({
      error: 'FIX_ACTION_FAILED',
      message: 'Failed to trigger the autofix lifecycle for this job.',
      traceId,
      v2: true
    });
  }
});

router.autofixIdempotencyMap = autofixIdempotencyMap;
module.exports = router;
