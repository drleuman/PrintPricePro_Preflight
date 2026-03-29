'use strict';

const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

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
      const jobId = uuidv4();
      const assetId = jobId;
      const filename = safeFilename(req.file.originalname || 'document.pdf');

      const inputDir = path.join(
        ppos.storageBase,
        'tenants',
        tenantId,
        'jobs',
        jobId,
        'input'
      );

      ensureDir(inputDir);

      const finalPath = path.join(inputDir, filename);

      fs.copyFileSync(req.file.path, finalPath);
      fs.unlinkSync(req.file.path);

      const fileUrl = path.posix.join(
        ppos.storageBase,
        'tenants',
        tenantId,
        'jobs',
        jobId,
        'input',
        filename
      );

      console.log('[BFF][UPLOAD]', {
        requestId,
        tenantId,
        tempPath: req.file.path,
        finalPath,
        fileUrl
      });

      const authContext = req.auth || req.user || {};
      const internalToken = identityService.getAuthHeaders(authContext).Authorization;

      const job = await queue.enqueueJob('PREFLIGHT', {
        requestId,
        jobId,
        assetId,
        tenantId,
        policy,
        fileUrl,
        filename,
        filePath: finalPath, // Pass the physical path for multipart reconstruction
        size: req.file.size,
        userToken: internalToken,
        authContext
      });

      console.log('[BFF][JOB-CREATE]', {
        requestId,
        tenantId,
        jobId: job.id,
        policy,
        fileUrl,
        status: job.status
      });

      return res.status(201).json({
        id: job.id,
        jobId: job.id,
        status: job.status,
        tenantId,
        policy,
        input: {
          assetId,
          fileUrl,
          filename,
          size: req.file.size
        }
      });
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
      headers: authHeaders
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
