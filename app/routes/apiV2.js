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
  return req.auth?.tenantId || req.user?.tenantId || 'default';
}

router.post(
  '/',
  upload.single('file'),
  licenseGuard({ action: 'analyze' }),
  async (req, res) => {
    const requestId = req.id || `req_${Date.now()}`;
    const tenantId = getTenantId(req);

    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No PDF provided.' });
      }

      const policy = req.body?.policy || 'OFFSET_MODERN_COATED';
      const filename = safeFilename(req.file.originalname || 'document.pdf');

      const authContext = req.auth || req.user || {};
      const internalToken = identityService.getAuthHeaders(authContext).Authorization;

      const job = await queue.enqueueJob('PREFLIGHT', {
        requestId,
        tenantId,
        policy,
        filename,
        filePath: req.file.path, // Use the multer temp file path directly
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
        input: {
          assetId: job.id,
          filename,
          size: req.file.size
        }
      };

      if (job.mode === 'sync') {
        responsePayload.inlineResult = job.inlineResult;
      } else {
        responsePayload.id = job.id;
        responsePayload.jobId = job.id;
        responsePayload.status = job.status || 'QUEUED';
      }

      console.log('[BFF][JOB-CREATE-RETURN]', {
        requestId,
        mode: job.mode,
        jobId: job.id,
        isInline: job.mode === 'sync'
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
    const authHeaders = identityService.getAuthHeaders(req.auth || req.user || {});
    
    const response = await pposRequest(upstreamPath, {
      method: 'GET',
      headers: {
        Authorization: req.headers.authorization
      }
    });

    const data = await response.json();

    console.log('[BFF][POLICIES]', {
      upstreamPath,
      hasPreflightRead: true,
      policyCount: data?.policies?.length || 0
    });

    res.json(data);
  } catch (error) {
    console.error('[BFF][POLICIES][ERROR]', error);
    res.status(502).json({ error: 'Failed to fetch policy catalog' });
  }
});

/**
 * GET /api/v2/jobs/:jobId
 * Returns the status of a specific job from PPOS.
 */
router.get('/:jobId', async (req, res) => {
  try {
    const response = await pposRequest(
      ppos.routes.jobStatus(req.params.jobId),
      {
        method: 'GET',
        headers: {
          Authorization: identityService.getAuthHeaders(req.auth || req.user || {}).Authorization
        }
      }
    );

    const raw = await response.text();
    let data = {};
    try {
      data = raw ? JSON.parse(raw) : {};
    } catch {
      data = { raw };
    }

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
