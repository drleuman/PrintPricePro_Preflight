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

      const responsePayload = {
        ok: true,
        tenantId,
        policy,
        jobMeta: {
          id: job.id,
          fileName: req.file.originalname,
          fileSize: req.file.size
        }
      };

      if (job.mode === 'sync') {
        responsePayload.inlineResult = job.inlineResult;
      } else {
        // Trust the Engine's returned ID verbatim to avoid mismatch
        const engineId = job.jobId || job.id || job.job_id;
        responsePayload.id = engineId;
        responsePayload.jobId = engineId;
      }

      console.log(`[BFF][V2-JOB-SUCCESS][${requestId}] Response:`, {
        id: responsePayload.id || 'SYNC',
        inline: !!responsePayload.inlineResult
      });

      return res.status(201).json(responsePayload);
    } catch (error) {
      if (req.file?.path) {
        fs.unlink(req.file.path, () => { });
      }

      console.error('[BFF][JOB-CREATE][ERROR]', {
        requestId,
        tenantId,
        error: error.message
      });

      const status = error.status || 500;
      return res.status(status).json({
        error: status === 403 ? 'Forbidden' : 'Failed to create V2 preflight job.',
        message: error.message
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
    console.error('[POLICIES_ERROR]', error?.response?.data || error.message);

    const status = error?.response?.status || 500;
    return res.status(status).json(
      error?.response?.data || { error: 'POLICY_FETCH_FAILED' }
    );
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
      return res.status(404).json({ error: 'Job not found', jobId });
    }

    const raw = await response.text();
    let data = {};
    try {
      data = raw ? JSON.parse(raw) : {};
    } catch {
      data = { raw };
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
        
        // --- v2.4.95: Hard-Syncing Boolean Flags after Flattening ---
        data.hasReport = !!data.report;
        data.hasFindings = data.findings.length > 0;
        data.hasIssues = data.issues.length > 0;
        // -------------------------------------------------------------
        
        // Ensure job type/identity is at the root
        data.type = result.type || data.type || 'ANALYZE';
        data.name = result.name || data.name || data.type;

        // Clean up the nested wrapper to prevent confusion
        delete data.result;
    }
    // ------------------------------------------------------------------

    return res.status(response.status).json(data);

  } catch (error) {
    return res.status(502).json({
      error: 'Bad Gateway',
      message: 'Failed to fetch job status from PPOS',
      details: error.message
    });
  }
});

/**
 * GET /api/v2/jobs/:jobId/artifacts/:artifactId
 * Proxy artifact streaming from PPOS.
 */
router.get('/:jobId/artifacts/:artifactId', async (req, res) => {
  try {
    const response = await pposRequest(
      ppos.routes.jobArtifact(req.params.jobId, req.params.artifactId),
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
    return res.status(502).json({
      error: 'Bad Gateway',
      message: 'Failed to fetch artifact from PPOS',
      details: error.message
    });
  }
});

module.exports = router;
