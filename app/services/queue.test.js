/**
 * queue.js tests
 *
 * NOTE: enqueueJob makes real HTTP calls via pposRequest (a CJS require that
 * cannot be intercepted by vi.mock in this setup). Tests here cover:
 *   1. Contract validation (normalizeInput) — tested through the thrown error
 *      path, which fires BEFORE pposRequest is called.
 *   2. Canonical-ID resolution logic (exercised by injecting mock responses
 *      through the module's exports object before require caching locks in).
 *
 * Integration tests for the full enqueueJob → PPOS HTTP round-trip live in
 * the integration suite.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

// ---------------------------------------------------------------------------
// Patch apiClient in the module cache BEFORE queue.js is first required,
// so queue.js receives our spy when it calls require('./apiClient').
// ---------------------------------------------------------------------------
const apiClientPath = require.resolve('./apiClient');
const identityServicePath = require.resolve('./identityService');

// Stub objects (mutated per-test via vi.fn())
let mockPposRequest = vi.fn();
let mockGetAuthHeaders = vi.fn(() => ({ Authorization: 'Bearer mock-token' }));
let mockBuildPayload = vi.fn(() => ({ sub: 'app', role: 'tenant_admin', scopes: [], email: null }));

// Inject stubs into the module cache before queue.js loads
require.cache[apiClientPath] = {
  id: apiClientPath,
  filename: apiClientPath,
  loaded: true,
  exports: { pposRequest: (...args) => mockPposRequest(...args) },
  parent: null,
  children: [],
  paths: [],
};

require.cache[identityServicePath] = {
  id: identityServicePath,
  filename: identityServicePath,
  loaded: true,
  exports: {
    getAuthHeaders: (...args) => mockGetAuthHeaders(...args),
    buildInternalAuthPayload: (...args) => mockBuildPayload(...args),
    getToken: () => 'mock-token',
    generateInternalToken: () => 'mock-jwt',
    getScopes: () => ['preflight:read', 'jobs:read'],
  },
  parent: null,
  children: [],
  paths: [],
};

// Now load queue.js — it will use our stubs from the cache
const { enqueueJob } = require('./queue');

function makeResponse(body, ok = true, status = 200) {
  return {
    ok,
    status,
    text: () => Promise.resolve(JSON.stringify(body)),
  };
}

beforeEach(() => {
  mockPposRequest = vi.fn();
  // Keep a reference to the stub so queue.js picks it up via the wrapper
  require.cache[apiClientPath].exports.pposRequest = (...args) => mockPposRequest(...args);
});

afterEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Contract validation — normalizeInput
// ---------------------------------------------------------------------------
describe('enqueueJob — contract validation', () => {
  it('throws QUEUE-CONTRACT-ERROR when fileUrl and filePath are both missing', async () => {
    await expect(
      enqueueJob('PREFLIGHT', { jobId: 'job_123' })
    ).rejects.toThrow('[QUEUE-CONTRACT-ERROR]');
  });

  it('does NOT throw when fileUrl is provided', async () => {
    mockPposRequest.mockResolvedValue(makeResponse({ jobId: 'job_ok', status: 'QUEUED' }));
    await expect(
      enqueueJob('PREFLIGHT', { fileUrl: 'https://example.com/file.pdf' })
    ).resolves.toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Canonical job ID resolution
// ---------------------------------------------------------------------------
describe('enqueueJob — canonical ID resolution', () => {
  it('returns jobId from response jobId field', async () => {
    mockPposRequest.mockResolvedValue(makeResponse({ jobId: 'job_abc', status: 'QUEUED' }));
    const result = await enqueueJob('PREFLIGHT', { fileUrl: 'https://example.com/file.pdf' });
    expect(result.jobId).toBe('job_abc');
    expect(result.id).toBe('job_abc');
  });

  it('returns jobId from response job_id field when jobId absent', async () => {
    mockPposRequest.mockResolvedValue(makeResponse({ job_id: 'job_from_jobid', status: 'QUEUED' }));
    const result = await enqueueJob('PREFLIGHT', { fileUrl: 'https://example.com/file.pdf' });
    expect(result.jobId).toBe('job_from_jobid');
  });

  it('returns jobId from response id field when jobId and job_id absent', async () => {
    mockPposRequest.mockResolvedValue(makeResponse({ id: 'job_from_id', status: 'QUEUED' }));
    const result = await enqueueJob('PREFLIGHT', { fileUrl: 'https://example.com/file.pdf' });
    expect(result.jobId).toBe('job_from_id');
  });

  it('rejects "SYNC" as canonical ID, falls back to payload jobId', async () => {
    mockPposRequest.mockResolvedValue(makeResponse({ jobId: 'SYNC', status: 'COMPLETED' }));
    const result = await enqueueJob('PREFLIGHT', {
      fileUrl: 'https://example.com/file.pdf',
      jobId: 'job_fallback',
    });
    expect(result.jobId).toBe('job_fallback');
  });

  it('rejects "ASYNC" as canonical ID, falls back to payload jobId', async () => {
    mockPposRequest.mockResolvedValue(makeResponse({ jobId: 'ASYNC', status: 'QUEUED' }));
    const result = await enqueueJob('PREFLIGHT', {
      fileUrl: 'https://example.com/file.pdf',
      jobId: 'job_async_fallback',
    });
    expect(result.jobId).toBe('job_async_fallback');
  });

  it('accepts fix_ prefix IDs', async () => {
    mockPposRequest.mockResolvedValue(makeResponse({ jobId: 'fix_repair_1', status: 'QUEUED' }));
    const result = await enqueueJob('AUTOFIX', { fileUrl: 'https://example.com/file.pdf' });
    expect(result.jobId).toBe('fix_repair_1');
  });
});

// ---------------------------------------------------------------------------
// Mode detection (sync vs async)
// ---------------------------------------------------------------------------
describe('enqueueJob — mode detection', () => {
  it('detects sync mode when response has issues field', async () => {
    mockPposRequest.mockResolvedValue(makeResponse({
      jobId: 'job_sync',
      status: 'COMPLETED',
      issues: [{ id: 'i1' }],
    }));
    const result = await enqueueJob('PREFLIGHT', { fileUrl: 'https://example.com/file.pdf' });
    expect(result.mode).toBe('sync');
    expect(result.inlineResult).not.toBeNull();
  });

  it('detects async mode when no inline result fields in response', async () => {
    mockPposRequest.mockResolvedValue(makeResponse({ jobId: 'job_async', status: 'QUEUED' }));
    const result = await enqueueJob('PREFLIGHT', { fileUrl: 'https://example.com/file.pdf' });
    expect(result.mode).toBe('async');
    expect(result.inlineResult).toBeNull();
  });

  it('returns QUEUED as default status when response has no status', async () => {
    mockPposRequest.mockResolvedValue(makeResponse({ jobId: 'job_nostatus' }));
    const result = await enqueueJob('PREFLIGHT', { fileUrl: 'https://example.com/file.pdf' });
    expect(result.status).toBe('QUEUED');
  });
});

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------
describe('enqueueJob — error handling', () => {
  it('throws QUEUE-PPOS-ERROR when response is not ok', async () => {
    mockPposRequest.mockResolvedValue(makeResponse({ error: 'Service unavailable' }, false, 503));
    await expect(
      enqueueJob('PREFLIGHT', { fileUrl: 'https://example.com/file.pdf' })
    ).rejects.toThrow('[QUEUE-PPOS-ERROR]');
  });

  it('propagates network errors from pposRequest', async () => {
    mockPposRequest.mockRejectedValue(new Error('Network failure'));
    await expect(
      enqueueJob('PREFLIGHT', { fileUrl: 'https://example.com/file.pdf' })
    ).rejects.toThrow('Network failure');
  });
});

// ---------------------------------------------------------------------------
// Tenant ID normalization
// ---------------------------------------------------------------------------
describe('enqueueJob — tenant normalization', () => {
  it('uses authContext2.tenantId when present', async () => {
    mockPposRequest.mockResolvedValue(makeResponse({ jobId: 'job_t1', status: 'QUEUED' }));
    await enqueueJob('PREFLIGHT', {
      fileUrl: 'https://example.com/file.pdf',
      authContext2: { tenantId: 'tenant-ctx2' },
    });
    const callBody = JSON.parse(mockPposRequest.mock.calls[0][1].body);
    expect(callBody.tenantId).toBe('tenant-ctx2');
  });

  it('falls back to authContext.tenantId when authContext2 is absent', async () => {
    mockPposRequest.mockResolvedValue(makeResponse({ jobId: 'job_t2', status: 'QUEUED' }));
    await enqueueJob('PREFLIGHT', {
      fileUrl: 'https://example.com/file.pdf',
      authContext: { tenantId: 'tenant-ctx1' },
    });
    const callBody = JSON.parse(mockPposRequest.mock.calls[0][1].body);
    expect(callBody.tenantId).toBe('tenant-ctx1');
  });

  it('uses default tenantId when no authContext is present', async () => {
    mockPposRequest.mockResolvedValue(makeResponse({ jobId: 'job_t3', status: 'QUEUED' }));
    await enqueueJob('PREFLIGHT', { fileUrl: 'https://example.com/file.pdf' });
    const callBody = JSON.parse(mockPposRequest.mock.calls[0][1].body);
    expect(callBody.tenantId).toBe('ppos-production-worker');
  });

  it('includes jobId in request body when provided in payload', async () => {
    mockPposRequest.mockResolvedValue(makeResponse({ jobId: 'job_provided', status: 'QUEUED' }));
    await enqueueJob('PREFLIGHT', {
      fileUrl: 'https://example.com/file.pdf',
      jobId: 'job_provided',
    });
    const callBody = JSON.parse(mockPposRequest.mock.calls[0][1].body);
    expect(callBody.id).toBe('job_provided');
    expect(callBody.jobId).toBe('job_provided');
  });
});
