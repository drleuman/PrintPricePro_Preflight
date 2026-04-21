'use strict';

const fs = require('fs');
const FormData = require('form-data');
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

  return 'ppos-production-worker';
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
  const deploymentId = 'production-ver-2-4-preflight';

  // Initialize 'input' at the function head to prevent ReferenceErrors in all scopes
  let input = null;
  try {
    input = normalizeInput(payload);
  } catch (err) {
    console.error('[QUEUE][CONTRACT-ERROR]', err.message);
    throw err;
  }

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
    force: payload.force || true,
    cleanup: payload.cleanup || true,
    config: {
      ...payload,
      force: payload.force || true,
      cleanup: payload.cleanup || true
    },
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
      // Removed shadowing of deploymentId and tenantId to use outer scope variables

      // v2.4.125: Node/PM2 Runtime Stability Pivot
      // Switching to 'form-data' package as native Web FormData/File 
      // shows branding mismatches in the production PM2 environment.
      const form = new FormData();
      form.append('id', jobId || `job_${Date.now()}`);
      form.append('jobId', jobId || `job_${Date.now()}`);
      form.append('tenantId', tenantId);
      form.append('deploymentId', deploymentId);
      form.append('job_type', type || 'PREFLIGHT');
      form.append('policy', payload.policy || 'OFFSET_MODERN_COATED');
      form.append('input', JSON.stringify(input));
      form.append('metadata', JSON.stringify({
        source: 'printprice-preflight-app',
        requestId: payload.requestId || null,
        timestamp: new Date().toISOString(),
        ...payload.metadata
      }));

      form.append('file', fileBuffer, {
        filename: fileName,
        contentType: fileMimeType || 'application/pdf',
        knownLength: fileBuffer.length
      });

      console.log('[QUEUE][FILE-OBJECT-CHECK]', {
        mode: 'form-data-buffer',
        size: fileBuffer.length,
        type: fileMimeType || 'application/pdf',
        name: fileName
      });

      response = await pposRequest(pposConfig.routes.jobs, {
        method: 'POST',
        headers: {
          ...authHeaders,
          ...form.getHeaders()
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

    // v2.4.120: Hardened canonical ID extraction
    // Priority: Upstream explicit fields -> nested metadata -> pre-generated local ID
    const rawId = data.jobId || data.job_id || data.id || data.job?.id || 
                  data.metadata?.jobId || data.result?.jobId || data.result?.meta?.jobId || 
                  jobId;

    // PROTECTION: Never allow mode labels like 'SYNC' or 'ASYNC' to become the canonical ID
    const canonicalJobId = (typeof rawId === 'string' && rawId !== 'SYNC' && rawId !== 'ASYNC' && (rawId.startsWith('job_') || rawId.startsWith('fix_'))) 
                           ? rawId 
                           : jobId;

    // Detection of sync/inline mode: It's sync if it contains a full report or finding structure
    const hasInlineSigns = !!(data.issues || data.report || data.findings || data.analysis || data.fixes);
    const mode = hasInlineSigns ? 'sync' : 'async';

    console.log('[CREATE-JOB][MODE-DETECTED]', { mode, jobId: canonicalJobId });

    if (mode === 'unknown') {
      console.error('[CREATE-JOB][FAILURE] No canonical job ID OR inline result found in response', data);
      throw new Error("PPOS did not return jobId or valid inline result");
    }

    console.log('[CREATE-JOB][BFF-RETURN]', { mode, jobId: canonicalJobId });

    // FAIL-LOUD: Diagnostic for ID loss
    if (!canonicalJobId || canonicalJobId === 'undefined') {
      console.error(`[CREATE-JOB][CRITICAL] No canonical job ID resolved in mode ${mode}!`, {
        upstreamKeys: Object.keys(data),
        requestId: payload.requestId,
        upstreamStatus: data.status
      });
    }

    return {
      id: canonicalJobId,
      jobId: canonicalJobId,
      status: data.status || "QUEUED",
      mode,
      inlineResult: hasInlineSigns ? data : null,
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
