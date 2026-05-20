/**
 * apiClient.js tests
 *
 * pposRequest depends on three external modules (pposConfig, identityService, axios)
 * and global fetch. We inject stubs via require.cache before loading apiClient.js
 * so each test controls behavior without real HTTP calls.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

// ---------------------------------------------------------------------------
// Mocks — injected into require.cache before apiClient is loaded
// ---------------------------------------------------------------------------
const pposConfigPath = require.resolve('../../config/ppos');
const identityServicePath = require.resolve('./identityService');
const axiosPath = require.resolve('axios');

let mockPposConfig = {
  preflightServiceUrl: 'http://ppos.test',
  apiKey: 'test-api-key',
};

let mockGetAuthHeaders = vi.fn(() => ({ Authorization: 'Bearer injected-token' }));
let mockAxios = vi.fn();

require.cache[pposConfigPath] = {
  id: pposConfigPath,
  filename: pposConfigPath,
  loaded: true,
  exports: mockPposConfig,
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
    generateInternalToken: () => 'stub-token',
    getScopes: () => [],
    buildInternalAuthPayload: () => ({}),
    getToken: () => 'stub',
  },
  parent: null,
  children: [],
  paths: [],
};

require.cache[axiosPath] = {
  id: axiosPath,
  filename: axiosPath,
  loaded: true,
  exports: (...args) => mockAxios(...args),
  parent: null,
  children: [],
  paths: [],
};

// Load apiClient AFTER stubs are in place
const { pposRequest } = require('./apiClient');

// Helper: make a node-form-data-like object (has getHeaders + append)
function makeNodeFormData() {
  return {
    append: vi.fn(),
    getHeaders: () => ({ 'content-type': 'multipart/form-data; boundary=abc' }),
  };
}

// Helper: make a fetch-like response
function makeFetchResponse(body, ok = true, status = 200) {
  return {
    ok,
    status,
    clone: () => ({
      text: () => Promise.resolve(JSON.stringify(body)),
    }),
    text: () => Promise.resolve(JSON.stringify(body)),
    json: () => Promise.resolve(body),
  };
}

beforeEach(() => {
  mockGetAuthHeaders = vi.fn(() => ({ Authorization: 'Bearer injected-token' }));
  require.cache[identityServicePath].exports.getAuthHeaders = (...args) => mockGetAuthHeaders(...args);

  mockAxios = vi.fn();

  // Reset pposConfig to working defaults
  mockPposConfig.preflightServiceUrl = 'http://ppos.test';
  mockPposConfig.apiKey = 'test-api-key';

  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(makeFetchResponse({ ok: true }))));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// URL construction
// ---------------------------------------------------------------------------
describe('pposRequest — URL construction', () => {
  it('constructs full URL by appending relative path to baseUrl', async () => {
    await pposRequest('/api/jobs', { method: 'GET' });
    const callUrl = global.fetch.mock.calls[0][0];
    expect(callUrl).toBe('http://ppos.test/api/jobs');
  });

  it('strips trailing slash from baseUrl before appending path', async () => {
    mockPposConfig.preflightServiceUrl = 'http://ppos.test/';
    await pposRequest('/api/jobs', { method: 'GET' });
    const callUrl = global.fetch.mock.calls[0][0];
    expect(callUrl).toBe('http://ppos.test/api/jobs');
  });

  it('uses absolute path as-is without prepending baseUrl', async () => {
    await pposRequest('http://other-service.internal/status', { method: 'GET' });
    const callUrl = global.fetch.mock.calls[0][0];
    expect(callUrl).toBe('http://other-service.internal/status');
  });

  it('throws when preflightServiceUrl is not configured', async () => {
    mockPposConfig.preflightServiceUrl = '';
    await expect(pposRequest('/api/jobs')).rejects.toThrow('PPOS_SERVICE_URL not defined');
  });
});

// ---------------------------------------------------------------------------
// Authorization header injection
// ---------------------------------------------------------------------------
describe('pposRequest — authorization header injection', () => {
  it('injects Authorization header when none provided', async () => {
    await pposRequest('/api/jobs', { method: 'GET', headers: {} });
    const callHeaders = global.fetch.mock.calls[0][1].headers;
    expect(callHeaders.Authorization).toBe('Bearer injected-token');
  });

  it('calls identityService.getAuthHeaders when auth is missing', async () => {
    await pposRequest('/api/jobs', { method: 'GET' });
    expect(mockGetAuthHeaders).toHaveBeenCalledOnce();
  });

  it('does NOT inject Authorization when caller provides it', async () => {
    await pposRequest('/api/jobs', {
      method: 'GET',
      headers: { Authorization: 'Bearer caller-token' },
    });
    expect(mockGetAuthHeaders).not.toHaveBeenCalled();
    const callHeaders = global.fetch.mock.calls[0][1].headers;
    expect(callHeaders.Authorization).toBe('Bearer caller-token');
  });

  it('respects lowercase authorization header', async () => {
    await pposRequest('/api/jobs', {
      method: 'GET',
      headers: { authorization: 'Bearer lowercase-token' },
    });
    expect(mockGetAuthHeaders).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Content-Type handling
// ---------------------------------------------------------------------------
describe('pposRequest — Content-Type handling', () => {
  it('sets application/json for requests without a body', async () => {
    await pposRequest('/api/jobs', { method: 'GET' });
    const callHeaders = global.fetch.mock.calls[0][1].headers;
    expect(callHeaders['Content-Type']).toBe('application/json');
  });

  it('does NOT override an explicit Content-Type from the caller', async () => {
    await pposRequest('/api/jobs', {
      method: 'POST',
      headers: { 'content-type': 'application/xml' },
    });
    const callHeaders = global.fetch.mock.calls[0][1].headers;
    // Caller's type is preserved; no application/json injected
    expect(callHeaders['Content-Type']).toBeUndefined();
  });

  it('removes Content-Type for native FormData so boundary is auto-generated', async () => {
    const nativeFormData = new FormData();
    await pposRequest('/api/jobs', { method: 'POST', body: nativeFormData });
    const callHeaders = global.fetch.mock.calls[0][1].headers;
    const hasContentType = Object.keys(callHeaders).some(k => k.toLowerCase() === 'content-type');
    expect(hasContentType).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Node form-data path (axios)
// ---------------------------------------------------------------------------
describe('pposRequest — node form-data uses axios', () => {
  it('calls axios instead of fetch for node form-data', async () => {
    const nodeForm = makeNodeFormData();
    mockAxios.mockResolvedValue({
      status: 200,
      headers: {},
      data: { jobId: 'job_axio_1' },
    });
    await pposRequest('/api/jobs', { method: 'POST', body: nodeForm });
    expect(mockAxios).toHaveBeenCalledOnce();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('returns response-like object from axios path', async () => {
    const nodeForm = makeNodeFormData();
    mockAxios.mockResolvedValue({
      status: 201,
      headers: {},
      data: { jobId: 'job_created' },
    });
    const response = await pposRequest('/api/jobs', { method: 'POST', body: nodeForm });
    expect(response.ok).toBe(true);
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.jobId).toBe('job_created');
  });

  it('marks ok=false for axios 4xx responses', async () => {
    const nodeForm = makeNodeFormData();
    mockAxios.mockResolvedValue({ status: 422, headers: {}, data: { error: 'invalid' } });
    const response = await pposRequest('/api/jobs', { method: 'POST', body: nodeForm });
    expect(response.ok).toBe(false);
    expect(response.status).toBe(422);
  });

  it('propagates axios network errors', async () => {
    const nodeForm = makeNodeFormData();
    mockAxios.mockRejectedValue(new Error('ECONNREFUSED'));
    await expect(
      pposRequest('/api/jobs', { method: 'POST', body: nodeForm })
    ).rejects.toThrow('ECONNREFUSED');
  });
});

// ---------------------------------------------------------------------------
// Standard fetch path
// ---------------------------------------------------------------------------
describe('pposRequest — standard fetch path', () => {
  it('returns the fetch response', async () => {
    global.fetch.mockResolvedValue(makeFetchResponse({ status: 'QUEUED' }));
    const response = await pposRequest('/api/jobs', { method: 'GET' });
    expect(response.ok).toBe(true);
    expect(response.status).toBe(200);
  });

  it('propagates fetch network errors', async () => {
    global.fetch.mockRejectedValue(new Error('Network unreachable'));
    await expect(pposRequest('/api/jobs', { method: 'GET' })).rejects.toThrow(
      'Network unreachable'
    );
  });

  it('injects x-ppp-api-key header when apiKey is configured', async () => {
    await pposRequest('/api/jobs', { method: 'GET' });
    const callHeaders = global.fetch.mock.calls[0][1].headers;
    expect(callHeaders['x-ppp-api-key']).toBe('test-api-key');
  });
});
