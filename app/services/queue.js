'use strict';

const { pposRequest } = require('./apiClient');
const identityService = require('./identityService');
const pposConfig = require('../../config/ppos');

const isProduction = process.env.NODE_ENV === 'production';

function normalizeTenantId(payload = {}) {
  return payload.tenantId || payload.tenant_id || 'default';
}

function normalizeJobId(payload = {}) {
  return payload.jobId || payload.job_id || payload.id;
}

function normalizeInput(payload = {}) {
  const fileUrl = payload.fileUrl || payload.file_url;
  const filename = payload.filename || payload.original_filename || 'document.pdf';
  const assetId = payload.assetId || payload.asset_id || normalizeJobId(payload);

  if (!fileUrl) {
    throw new Error('[QUEUE-CONTRACT-ERROR] Missing required fileUrl/file_url for V2 job creation.');
  }

  return {
    assetId,
    fileUrl,
    filename,
    size: payload.size || payload.file_size || null
  };
}

async function enqueueJob(type, payload = {}) {
  const tenantId = normalizeTenantId(payload);
  const jobId = normalizeJobId(payload);
  const input = normalizeInput(payload);

  const body = {
    id: jobId,
    jobId,
    tenantId,
    job_type: type || 'PREFLIGHT',
    policy: payload.policy || 'OFFSET_CMYK_STRICT',
    input,
    metadata: {
      source: 'printprice-preflight-app',
      requestId: payload.requestId || null,
      timestamp: new Date().toISOString()
    }
  };

  try {
    const response = await pposRequest(pposConfig.routes.jobs, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...identityService.getAuthHeaders()
      },
      body: JSON.stringify(body)
    });

    const raw = await response.text();
    let data = {};
    try {
      data = raw ? JSON.parse(raw) : {};
    } catch {
      data = { raw };
    }

    if (!response.ok) {
      const message = data?.error || data?.message || raw || `PPOS returned HTTP ${response.status}`;
      throw new Error(`[QUEUE-PPOS-ERROR] ${message}`);
    }

    return {
      id: data.id || data.jobId || jobId,
      status: data.status || 'QUEUED',
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
