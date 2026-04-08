'use strict';

const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const queue = require('../services/queue');
const ppos = require('../../config/ppos');
const identityService = require('../services/identityService');
const { pposRequest } = require('../services/apiClient');
const licenseGuard = require('../middleware/licenseGuard');

const router = express.Router();

if (!fs.existsSync(ppos.tempUploadDir)) {
  fs.mkdirSync(ppos.tempUploadDir, { recursive: true });
}

const upload = multer({
  dest: ppos.tempUploadDir,
  limits: { fileSize: 500 * 1024 * 1024 }
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

router.post(
  '/',
  upload.single('file'),
  licenseGuard({ action: 'analyze' }),
  async (req, res) => {
    const requestId = req.id || `req_${Date.now()}`;
    const tenantId = getTenantId(req);
    // FORCE: Generate a unique jobId here to ensure PPOS contract safety
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    try {
      console.log(`[BFF][V2-JOB-START][${requestId}]`, {
        hasFile: !!req.file,
        contentType: req.get('content-type'),
        tenantId
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
        tenantId,
        policy,
        filename,
        filePath: req.file.path,
        size: req.file.size,
        userToken: internalToken,
        authContext
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
      const finalId = jobId || job.jobId || job.id || job.inlineResult?.meta?.jobId || `job_${Date.now()}`;
      
      const responsePayload = {
        ok: true,
        id: finalId,
        jobId: finalId,
        tenantId,
        policy,
        mode: job.mode,
        jobMeta: {
          id: finalId,
          fileName: req.file.originalname,
          fileSize: req.file.size
        }
      };
      
      if (job.inlineResult) {
        responsePayload.inlineResult = job.inlineResult;
        // Ensure the inline result itself contains the jobId in its metadata
        if (responsePayload.inlineResult.meta) {
           responsePayload.inlineResult.meta.jobId = finalId;
        }
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

      const status = error.status || 500;
      return res.status(status).json({
        error: status === 403 ? 'FORBIDDEN' : 'V2_JOB_CREATE_FAILED',
        message: status === 403 ? 'Action restricted by security policy' : (error.message || 'Failed to initialize engine job.'),
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

    const response = await pposRequest(upstreamPath, {
      method: 'GET',
      headers: {
        Authorization: req.headers.authorization,
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

    return res.json({ policies });
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
    console.log(`[BFF][V2-POLL-RAW][${requestId}] FULL PAYLOAD:`, JSON.stringify(data, null, 2));
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

    // --- v2.4.93: Deep Payload Normalization (BFF/FE Contract Sync) ---
    // If the engine returns a 'result' wrapper, hard-flatten it to ensure consistent Step 2/Step 4 behavior
    if (data.status === 'COMPLETED' && data.result) {
        console.log(`[BFF][POLL][DEEP-NORMALIZATION] Flattening result for job ${jobId}`);
        const result = data.result;
        
        // Ensure core finding fields are at the root
        data.report = result.report || data.report;
        data.findings = result.findings || result.report?.findings || data.findings || [];
        data.issues = result.issues || result.report?.issues || data.issues || [];
        
        // v2.4.115-116: Forensic Preservation Hierarchy
        // We promote every meaningful field to the root to ensure zero data-loss before pruning the wrapper
        const forensicFields = [
            'analysis', 'forensics',
            'fixes', 'repairs', 'applied_fixes', 
            'artifacts', 'output', 'reports', 
            'compliance', 'certification', 'trace', 
            'policy', 'metadata', 'audit'
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

        // Set compatibility duplicates
        data.repairs = data.fixes || data.repairs; 

        // --- v2.4.95: Hard-Syncing Boolean Flags after Flattening ---
        data.hasReport = !!data.report;
        data.hasFindings = (data.findings?.length > 0);
        data.hasIssues = (data.issues?.length > 0);
        
        // --- v2.4.111: Forensic Job-Type Identification Bridge ---
        const detectedType = result.type || data.type || result.job_type || 'ANALYZE';
        data.type = detectedType.toUpperCase();
        data.name = result.name || data.name || data.type;

        // Clean up the nested wrapper now that preservation is complete
        delete data.result;
    } else if (data.status === 'COMPLETED' && !data.type) {
        data.type = 'ANALYZE';
    }
    // ------------------------------------------------------------------

    return res.status(response.status).json(data);

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
  try {
    // --- v2.4.111: BFF-Side Artifact Alias Support ---
    // Maps frontend artifact keys to real filenames expected by PPOS
    const artifactMap = {
      'analysis_report': 'report.json',
      'final_fixed_pdf': 'normalized.pdf',
      'audit_report': 'fix_audit.json'
    };
    
    // Resolve targeted artifact ID (favoring alias if present)
    const resolvedArtifactId = artifactMap[req.params.artifactId] || req.params.artifactId;

    const response = await pposRequest(
      ppos.routes.jobArtifact(req.params.jobId, resolvedArtifactId),
      {
        method: 'GET',
        headers: {
          Authorization: identityService.getAuthHeaders(req.auth || req.user || {}).Authorization
        }
      }
    );

    response.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });

    res.status(response.status);

    if (!response.body) {
      return res.end();
    }

    const arrayBuffer = await response.arrayBuffer();
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

/**
 * POST /api/v2/jobs/:jobId/actions/fix
 * Trigger a stateful autofix on an existing job asset.
 */
router.post('/:jobId/actions/fix', async (req, res) => {
  const { jobId } = req.params;
  const requestId = req.get('x-request-id') || `fix_${Date.now()}`;
  const tenantId = getTenantId(req);

  try {
    console.log(`[BFF][FIX-ACTION][${requestId}] Triggering fix for job: ${jobId}`);

    const authContext = req.auth || req.user || {};
    const internalToken = identityService.getAuthHeaders(authContext).Authorization;

    // We enqueue a new AUTOFIX job referencing the previous jobId as the source asset
    const job = await queue.enqueueJob('AUTOFIX', {
      assetId: jobId,
      jobId: `fix_${jobId}_${Date.now()}`,
      force: true,
      requestId,
      tenantId,
      policy: req.body?.policy || 'OFFSET_MODERN_COATED',
      options: req.body?.options || {},
      userToken: internalToken,
      authContext
    });

    const responsePayload = {
      ok: true,
      jobId: job.id,
      status: job.status,
      mode: job.mode,
      inlineResult: job.inlineResult
    };

    return res.status(201).json(responsePayload);
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

module.exports = router;
