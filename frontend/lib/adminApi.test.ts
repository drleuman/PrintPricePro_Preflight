import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getAdminKey,
  setAdminKey,
  clearAdminKey,
  getOverview,
  getJobs,
  getTenantsList,
  pauseQueue,
  cancelJob,
} from './adminApi';

const mockFetchOk = (body: unknown) =>
  vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  });

const mockFetchFail = (status: number, text = '') =>
  vi.fn().mockResolvedValue({
    ok: false,
    status,
    statusText: 'Error',
    text: () => Promise.resolve(text),
  });

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

// ---------------------------------------------------------------------------
// Token storage helpers
// ---------------------------------------------------------------------------

describe('getAdminKey', () => {
  it('returns empty string when nothing is stored', () => {
    expect(getAdminKey()).toBe('');
  });

  it('returns the key stored under ppp_admin_api_key', () => {
    localStorage.setItem('ppp_admin_api_key', 'my-secret-key');
    expect(getAdminKey()).toBe('my-secret-key');
  });

  it('returns the key stored under legacy admin_key', () => {
    localStorage.setItem('admin_key', 'legacy-key');
    expect(getAdminKey()).toBe('legacy-key');
  });

  it('prefers ppp_admin_api_key over admin_key', () => {
    localStorage.setItem('ppp_admin_api_key', 'primary');
    localStorage.setItem('admin_key', 'fallback');
    expect(getAdminKey()).toBe('primary');
  });
});

describe('setAdminKey', () => {
  it('persists the key to localStorage', () => {
    setAdminKey('new-key-abc');
    expect(localStorage.getItem('ppp_admin_api_key')).toBe('new-key-abc');
  });

  it('overwrites an existing key', () => {
    setAdminKey('old-key');
    setAdminKey('new-key');
    expect(localStorage.getItem('ppp_admin_api_key')).toBe('new-key');
  });
});

describe('clearAdminKey', () => {
  it('removes the stored key', () => {
    setAdminKey('to-be-removed');
    clearAdminKey();
    expect(localStorage.getItem('ppp_admin_api_key')).toBeNull();
  });

  it('does not throw when no key is stored', () => {
    expect(() => clearAdminKey()).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// adminFetch — tested through public API functions
// ---------------------------------------------------------------------------

describe('getOverview', () => {
  it('calls the correct endpoint', async () => {
    const mockFetch = mockFetchOk({ totalJobs: 42 });
    vi.stubGlobal('fetch', mockFetch);

    await getOverview('24h');

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/admin/metrics/overview?range=24h',
      expect.any(Object)
    );
  });

  it('includes X-Admin-Api-Key header when a key is stored', async () => {
    const mockFetch = mockFetchOk({});
    vi.stubGlobal('fetch', mockFetch);
    localStorage.setItem('ppp_admin_api_key', 'test-key-xyz');

    await getOverview('7d');

    const [, options] = mockFetch.mock.calls[0];
    expect(options.headers['X-Admin-Api-Key']).toBe('test-key-xyz');
  });

  it('omits X-Admin-Api-Key header when no key is stored', async () => {
    const mockFetch = mockFetchOk({});
    vi.stubGlobal('fetch', mockFetch);

    await getOverview('30d');

    const [, options] = mockFetch.mock.calls[0];
    expect(options.headers['X-Admin-Api-Key']).toBeUndefined();
  });

  it('returns the parsed JSON response', async () => {
    const expected = { totalJobs: 99, successRate: 0.95, avgLatencyMs: 120, queueBacklog: 3 };
    vi.stubGlobal('fetch', mockFetchOk(expected));

    const result = await getOverview('24h');
    expect(result).toEqual(expected);
  });

  it('throws with status code and message on non-ok response', async () => {
    vi.stubGlobal('fetch', mockFetchFail(403, 'Forbidden'));

    await expect(getOverview('24h')).rejects.toThrow('Admin API error 403: Forbidden');
  });

  it('includes credentials: include in the request', async () => {
    const mockFetch = mockFetchOk({});
    vi.stubGlobal('fetch', mockFetch);

    await getOverview('24h');

    const [, options] = mockFetch.mock.calls[0];
    expect(options.credentials).toBe('include');
  });
});

describe('getJobs', () => {
  it('builds query string with all provided params', async () => {
    const mockFetch = mockFetchOk({ total: 0, jobs: [] });
    vi.stubGlobal('fetch', mockFetch);

    await getJobs({ status: 'COMPLETED', tenant: 'tenant-1', type: 'preflight', limit: 10, offset: 5 });

    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain('status=COMPLETED');
    expect(url).toContain('tenant=tenant-1');
    expect(url).toContain('type=preflight');
    expect(url).toContain('limit=10');
    expect(url).toContain('offset=5');
  });

  it('uses default limit=50 and offset=0 when not provided', async () => {
    const mockFetch = mockFetchOk({ total: 0, jobs: [] });
    vi.stubGlobal('fetch', mockFetch);

    await getJobs({});

    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain('limit=50');
    expect(url).toContain('offset=0');
  });

  it('omits optional params from query string when not provided', async () => {
    const mockFetch = mockFetchOk({ total: 0, jobs: [] });
    vi.stubGlobal('fetch', mockFetch);

    await getJobs({});

    const [url] = mockFetch.mock.calls[0];
    expect(url).not.toContain('status=');
    expect(url).not.toContain('tenant=');
    expect(url).not.toContain('type=');
  });
});

describe('pauseQueue', () => {
  it('sends POST to the correct endpoint with queue and reason in body', async () => {
    const mockFetch = mockFetchOk({ ok: true, state: 'paused' });
    vi.stubGlobal('fetch', mockFetch);

    await pauseQueue('preflight', 'maintenance');

    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe('/api/admin/control/queue/pause');
    expect(options.method).toBe('POST');
    expect(JSON.parse(options.body)).toEqual({ queue: 'preflight', reason: 'maintenance' });
  });
});

describe('cancelJob', () => {
  it('sends POST to the correct endpoint with reason in body', async () => {
    const mockFetch = mockFetchOk({ ok: true, status: 'cancelled' });
    vi.stubGlobal('fetch', mockFetch);

    await cancelJob('job-xyz-123', 'duplicate submission');

    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe('/api/admin/control/jobs/job-xyz-123/cancel');
    expect(options.method).toBe('POST');
    expect(JSON.parse(options.body)).toEqual({ reason: 'duplicate submission' });
  });
});

describe('getTenantsList', () => {
  it('calls the correct endpoint with GET', async () => {
    const mockFetch = mockFetchOk([]);
    vi.stubGlobal('fetch', mockFetch);

    await getTenantsList();

    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe('/api/admin/tenants');
    expect(options.method).toBeUndefined();
  });
});
