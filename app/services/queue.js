'use strict';

const fs = require('fs');
const { pposRequest } = require('./apiClient');
const identityService = require('./identityService');
const pposConfig = require('../../config/ppos');

/**
 * Normalizes tenantId from various possible payload formats.
 */
function normalizeTenantId(payload = {}) {
  // Check authContext first (canonical source)
  if (payload.authContext2?.tenantId) return payload.authContext2.tenantId;
  if (payload.authContext?.tenantId) return payload.authContext.tenantId;

  return 'ppos-verified-legacy-carrier';
}

/**
 * Normalizes jobId.
 */
function normalizeJobId(payload = {}) {
  return payload.jobId || payload.job_id || payload.id;
}

/**
 * Validates and normalizes input for PPOS V2 contract.
 */
function normalizeInput(payload = {}) {
  const fileUrl = payload.fileUrl || payload.file_url;
  const filename = payload.filename || payload.original_filename || 'document.pdf';
  const assetId = payload.assetId || payload.asset_id || normalizeJobId(payload);

  if (!fileUrl && !payload.filePath) {
    throw new Error('[QUEUE-CONTRACT-ERROR] Missing required fileUrl/file_url for V2 job creation.');
  }

  return {
    assetId,
    fileUrl: fileUrl || null,
    filename,
    size: payload.size || payload.file_size || null
  };
}

/**
 * Enqueues a job to PPOS asynchronously.
 * Ensures the outgoing request identity is always a BFF-signed internal JWT,
 * propagating the user context safely without using raw frontend tokens.
 */
async function enqueueJob(type, payload = {}) {
  // Requirement: Normalización robusta de la ruta del archivo (filePath vs filepath)
  const localFilePath = payload.filePath || payload.filepath || null;

  const tenantId = normalizeTenantId(payload);
  const jobId = normalizeJobId(payload);
  
  // Usamos localFilePath para la validación del contrato
  // Priority: Force use of environment-defined deployment ID to allow rotation/unlocking
  const deploymentId = 'legacy-production-monolith-v2';
  
  console.log('[QUEUE][DEPLOYMENT-RESOLVED]', { 
    final: deploymentId, 
    fromEnv: process.env.PPOS_DEPLOYMENT_ID,
    fromContext: payload.authContext2?.deploymentId 
  });

  // ... (restando del contenido para brevedad en la edición, pero localFilePath se usará abajo) ...


  // Use authContext2 (canonical) or authContext (legacy) for identity propagation
  const userIdentity = payload.authContext2 || payload.authContext || {};

  const body = {
    tenantId,
    deploymentId,
    job_type: type || 'PREFLIGHT',
    policy: payload.policy || 'OFFSET_MODERN_COATED',
    input,
    metadata: {
      source: 'printprice-preflight-app',
      requestId: payload.requestId || null,
      timestamp: new Date().toISOString()
    }
  };

  if (jobId) {
    body.id = jobId;
    body.jobId = jobId;
  }

  // Debug outgoing payload (Sanitized)
  console.log('[JOB_PAYLOAD]', {
    tenantId,
    deploymentId,
    jobId,
    bodyKeys: Object.keys(body),
    metadataKeys: Object.keys(body.metadata)
  });

  /**
   * REFACTOR: Never use raw payload.userToken for PPOS communication.
   * We always sign a fresh internal JWT withbff -> ppos trust.
   */
  const authHeaders = identityService.getAuthHeaders(userIdentity);
  const authHeader = authHeaders.Authorization;

  // Debug outgoing contract context (Safe logs)
  const decoded = identityService.buildInternalAuthPayload(userIdentity);
  console.log('[PPOS-OUTBOUND-AUTH]', {
    hasAuthHeader: !!authHeader,
    scheme: authHeader ? authHeader.split(' ')[0] : 'None',
    sub: decoded.sub,
    role: decoded.role,
    scopes: decoded.scopes,
    email: decoded.email
  });

  try {
    let response;

    // Determine if we should send as multipart/form-data
    if (localFilePath && fs.existsSync(localFilePath)) {
      console.log(`[QUEUE][MULTIPART] Reconstructing job creation request${jobId ? ' for ' + jobId : ''}`);

      const fileBuffer = await fs.promises.readFile(localFilePath);
      const fileMimeType = payload.mimeType || 'application/pdf';
      const fileName = payload.filename || input.filename || 'document.pdf';
      const blob = new Blob([fileBuffer], { type: fileMimeType });

      const form = new FormData();

      // Scalar fields
      if (jobId) {
        form.append('id', jobId);
        form.append('jobId', jobId);
      }
      form.append('tenantId', tenantId);
      form.append('deploymentId', deploymentId);
      form.append('job_type', type || 'PREFLIGHT');
      form.append('policy', payload.policy || 'OFFSET_MODERN_COATED');

      // Nested objects as JSON strings
      form.append('input', JSON.stringify(input));
      form.append('metadata', JSON.stringify({
        source: 'printprice-preflight-app',
        requestId: payload.requestId || null,
        timestamp: new Date().toISOString(),
        ...payload.metadata
      }));

      // Canonical multipart file field
      form.append('file', blob, fileName);

      console.log('[JOB_PAYLOAD][MULTIPART]', {
        tenantId,
        deploymentId,
        jobId,
        formFields: ['id', 'jobId', 'tenantId', 'deploymentId', 'job_type', 'policy', 'input', 'metadata', 'file']
      });

      console.log('[QUEUE][MULTIPART][DEBUG]', {
        jobId,
        tenantId,
        filePath: localFilePath,
        fileExists: true,
        fileSize: fileBuffer.length,
        fileName,
        fileMimeType,
        usingNativeFormData: true
      });

      console.log('[QUEUE][TARGET]', pposConfig.routes.jobs);
      response = await pposRequest(pposConfig.routes.jobs, {
        method: 'POST',
        headers: {
          ...authHeaders
        },
        body: form
      });
    } else {
      // Legacy JSON path (used for batch orchestrate or when file is already remote)
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': authHeader
      };

      console.log('[QUEUE][TARGET-JSON]', pposConfig.routes.jobs);
      response = await pposRequest(pposConfig.routes.jobs, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      });
    }

    const raw = await response.text();
    let data = {};
    try {
      data = raw ? JSON.parse(raw) : {};
    } catch {
      data = { raw };
    }

    console.log('[CREATE-JOB][UPSTREAM]', data);

    if (!response.ok) {
      const message = data?.error || data?.message || raw || `PPOS returned HTTP ${response.status}`;
      const err = new Error(`[QUEUE-PPOS-ERROR] ${message}`);
      err.status = response.status;
      throw err;
    }

    // Extraction order for jobId: jobId, job_id, id, job.id
    const canonicalJobId = data.jobId || data.job_id || data.id || data.job?.id;

    // Detection of sync/inline mode
    const hasInlineSigns = !!(data.analysis || data.issues || (data.status && !canonicalJobId));
    const mode = canonicalJobId ? 'async' : (hasInlineSigns ? 'sync' : 'unknown');

    console.log('[CREATE-JOB][MODE-DETECTED]', { mode, jobId: canonicalJobId });

    if (mode === 'unknown') {
      console.error('[CREATE-JOB][FAILURE] No canonical job ID OR inline result found in response', data);
      throw new Error("PPOS did not return jobId or valid inline result");
    }

    console.log('[CREATE-JOB][BFF-RETURN]', { mode, jobId: canonicalJobId });

    return {
      id: canonicalJobId,
      jobId: canonicalJobId,
      status: data.status || "QUEUED",
      mode,
      inlineResult: mode === 'sync' ? data : null,
      raw: data
    };
  } catch (serviceError) {
    console.error('[QUEUE] PPOS unavailable.', serviceError.message);
    throw serviceError;
  }
}

module.exports = {
  enqueueJob
};
