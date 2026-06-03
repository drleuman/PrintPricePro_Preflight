// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getAuthToken,
  setAuthToken,
  getRefreshToken,
  setRefreshToken,
  clearAuthTokens,
  pposFetch,
} from './apiClient';

const AUTH_KEY = 'ppos_auth_token';
const REFRESH_KEY = 'ppos_refresh_token';

const makeOkResponse = (body: unknown, contentType = 'application/json') => ({
  ok: true,
  status: 200,
  headers: { get: (h: string) => (h === 'content-type' ? contentType : null) },
  json: () => Promise.resolve(body),
  text: () => Promise.resolve(String(body)),
  blob: () => Promise.resolve(new Blob()),
});

const makeErrorResponse = (status: number, body: unknown = {}) => ({
  ok: false,
  status,
  headers: { get: () => 'application/json' },
  json: () => Promise.resolve(body),
  text: () => Promise.resolve(JSON.stringify(body)),
});

beforeEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
});

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

// ---------------------------------------------------------------------------
// Token helpers
// ---------------------------------------------------------------------------

describe('getAuthToken / setAuthToken', () => {
  it('returns null when no token is stored', () => {
    expect(getAuthToken()).toBeNull();
  });

  it('returns the token after setAuthToken', () => {
    setAuthToken('tok-abc');
    expect(getAuthToken()).toBe('tok-abc');
  });

  it('overwrites an existing token', () => {
    setAuthToken('old');
    setAuthToken('new');
    expect(getAuthToken()).toBe('new');
  });
});

describe('getRefreshToken / setRefreshToken', () => {
  it('returns null when no refresh token is stored', () => {
    expect(getRefreshToken()).toBeNull();
  });

  it('returns the refresh token after setRefreshToken', () => {
    setRefreshToken('refresh-xyz');
    expect(getRefreshToken()).toBe('refresh-xyz');
  });
});

describe('clearAuthTokens', () => {
  it('removes both auth and refresh tokens', () => {
    setAuthToken('tok');
    setRefreshToken('rtok');
    clearAuthTokens();
    expect(getAuthToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
  });

  it('does not throw when tokens are already absent', () => {
    expect(() => clearAuthTokens()).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// pposFetch — core behavior
// ---------------------------------------------------------------------------

describe('pposFetch — auth header', () => {
  it('attaches Authorization: Bearer when token is stored', async () => {
    setAuthToken('jwt-token-123');
    const mockFetch = vi.fn().mockResolvedValue(makeOkResponse({ ok: true }));
    vi.stubGlobal('fetch', mockFetch);

    await pposFetch('/api/some/endpoint');

    const [, opts] = mockFetch.mock.calls[0];
    expect(opts.headers['Authorization']).toBe('Bearer jwt-token-123');
  });

  it('does not set Authorization header when no token is stored', async () => {
    const mockFetch = vi.fn().mockResolvedValue(makeOkResponse({}));
    vi.stubGlobal('fetch', mockFetch);

    await pposFetch('/api/some/endpoint');

    const [, opts] = mockFetch.mock.calls[0];
    expect(opts.headers['Authorization']).toBeUndefined();
  });

  it('does not attach Authorization for gemini-proxy paths even with token', async () => {
    setAuthToken('jwt-token');
    const mockFetch = vi.fn().mockResolvedValue(makeOkResponse({}));
    vi.stubGlobal('fetch', mockFetch);

    await pposFetch('/api/gemini-proxy/v1/models');

    const [, opts] = mockFetch.mock.calls[0];
    expect(opts.headers['Authorization']).toBeUndefined();
  });
});

describe('pposFetch — Content-Type', () => {
  it('sets Content-Type: application/json for JSON string body', async () => {
    const mockFetch = vi.fn().mockResolvedValue(makeOkResponse({}));
    vi.stubGlobal('fetch', mockFetch);

    await pposFetch('/api/endpoint', { method: 'POST', body: JSON.stringify({ a: 1 }) });

    const [, opts] = mockFetch.mock.calls[0];
    expect(opts.headers['Content-Type']).toBe('application/json');
  });

  it('does not set Content-Type for FormData body', async () => {
    const mockFetch = vi.fn().mockResolvedValue(makeOkResponse({}));
    vi.stubGlobal('fetch', mockFetch);

    await pposFetch('/api/upload', { method: 'POST', body: new FormData() });

    const [, opts] = mockFetch.mock.calls[0];
    expect(opts.headers['Content-Type']).toBeUndefined();
  });
});

describe('pposFetch — idempotency key', () => {
  it('adds Idempotency-Key for POST requests', async () => {
    const mockFetch = vi.fn().mockResolvedValue(makeOkResponse({}));
    vi.stubGlobal('fetch', mockFetch);

    await pposFetch('/api/jobs', { method: 'POST', body: '{}' });

    const [, opts] = mockFetch.mock.calls[0];
    expect(opts.headers['Idempotency-Key']).toBeDefined();
    expect(typeof opts.headers['Idempotency-Key']).toBe('string');
  });

  it('adds Idempotency-Key for PUT requests', async () => {
    const mockFetch = vi.fn().mockResolvedValue(makeOkResponse({}));
    vi.stubGlobal('fetch', mockFetch);

    await pposFetch('/api/resource', { method: 'PUT', body: '{}' });

    const [, opts] = mockFetch.mock.calls[0];
    expect(opts.headers['Idempotency-Key']).toBeDefined();
  });

  it('does not add Idempotency-Key for GET requests', async () => {
    const mockFetch = vi.fn().mockResolvedValue(makeOkResponse({}));
    vi.stubGlobal('fetch', mockFetch);

    await pposFetch('/api/resource');

    const [, opts] = mockFetch.mock.calls[0];
    expect(opts.headers['Idempotency-Key']).toBeUndefined();
  });
});

describe('pposFetch — response parsing', () => {
  it('parses and returns JSON for application/json responses', async () => {
    const body = { result: 'ok', count: 7 };
    const mockFetch = vi.fn().mockResolvedValue(makeOkResponse(body, 'application/json'));
    vi.stubGlobal('fetch', mockFetch);

    const result = await pposFetch<typeof body>('/api/endpoint');
    expect(result).toEqual(body);
  });

  it('returns blob for application/pdf responses', async () => {
    const mockFetch = vi.fn().mockResolvedValue(makeOkResponse(null, 'application/pdf'));
    vi.stubGlobal('fetch', mockFetch);

    const result = await pposFetch('/api/file.pdf');
    expect(result).toBeInstanceOf(Blob);
  });

  it('returns text for non-JSON, non-PDF content types', async () => {
    const mockFetch = vi.fn().mockResolvedValue(makeOkResponse('plain text', 'text/plain'));
    vi.stubGlobal('fetch', mockFetch);

    const result = await pposFetch('/api/text');
    expect(typeof result).toBe('string');
  });
});

describe('pposFetch — error handling', () => {
  it('throws with status, code, and message on non-ok response', async () => {
    const errorBody = { message: 'Job not found', code: 'JOB_NOT_FOUND' };
    const mockFetch = vi.fn().mockResolvedValue(makeErrorResponse(404, errorBody));
    vi.stubGlobal('fetch', mockFetch);

    await expect(pposFetch('/api/jobs/missing')).rejects.toMatchObject({
      status: 404,
      code: 'JOB_NOT_FOUND',
      message: 'Job not found',
    });
  });

  it('falls back to generic error message when response body is empty', async () => {
    const mockFetch = vi.fn().mockResolvedValue(makeErrorResponse(500, {}));
    vi.stubGlobal('fetch', mockFetch);

    await expect(pposFetch('/api/endpoint')).rejects.toMatchObject({
      status: 500,
      message: 'Request failed with status 500',
    });
  });

  it('includes X-Request-ID in the request headers', async () => {
    const mockFetch = vi.fn().mockResolvedValue(makeOkResponse({}));
    vi.stubGlobal('fetch', mockFetch);

    await pposFetch('/api/endpoint');

    const [, opts] = mockFetch.mock.calls[0];
    expect(opts.headers['X-Request-ID']).toBeDefined();
  });
});

describe('pposFetch — 401 refresh flow', () => {
  it('attempts refresh and retries original request on 401 with refresh token', async () => {
    setRefreshToken('refresh-tok');

    const firstCall = makeErrorResponse(401, { message: 'Unauthorized' });
    const refreshCall = {
      ok: true,
      json: () => Promise.resolve({ token: 'new-access-token' }),
    };
    const retryCall = makeOkResponse({ ok: true });

    const mockFetch = vi.fn()
      .mockResolvedValueOnce(firstCall)
      .mockResolvedValueOnce(refreshCall)
      .mockResolvedValueOnce(retryCall);
    vi.stubGlobal('fetch', mockFetch);

    await pposFetch('/api/protected');

    expect(mockFetch).toHaveBeenCalledTimes(3);
    expect(getAuthToken()).toBe('new-access-token');
  });

  it('clears tokens and reloads when refresh endpoint itself fails', async () => {
    setAuthToken('old-tok');
    setRefreshToken('bad-refresh');

    const firstCall = makeErrorResponse(401, {});
    const refreshFail = { ok: false, status: 401 };

    const mockFetch = vi.fn()
      .mockResolvedValueOnce(firstCall)
      .mockResolvedValueOnce(refreshFail);
    const mockReload = vi.fn();
    vi.stubGlobal('fetch', mockFetch);
    Object.defineProperty(window, 'location', {
      value: { reload: mockReload },
      writable: true,
    });

    await pposFetch('/api/protected').catch(() => {});

    expect(getAuthToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
  });

  it('does not attempt refresh when there is no refresh token', async () => {
    const errorRes = makeErrorResponse(401, { message: 'Unauthorized' });
    const mockFetch = vi.fn().mockResolvedValue(errorRes);
    vi.stubGlobal('fetch', mockFetch);

    await expect(pposFetch('/api/protected')).rejects.toMatchObject({ status: 401 });
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
