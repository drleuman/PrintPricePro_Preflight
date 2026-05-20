/**
 * QuotaEngine.js tests
 *
 * QuotaEngine depends on redis, db, and notifier. All three are stubbed via
 * require.cache injection before QuotaEngine is loaded.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

// ---------------------------------------------------------------------------
// Stubs
// ---------------------------------------------------------------------------
const redisPath = require.resolve('./redis');
const dbPath = require.resolve('./db');
const notifierPath = require.resolve('./notifier');

let mockRedisIncr = vi.fn();
let mockRedisExpire = vi.fn();
let mockDbQuery = vi.fn();
let mockNotifyThreshold = vi.fn();

require.cache[redisPath] = {
  id: redisPath,
  filename: redisPath,
  loaded: true,
  exports: {
    incr: (...args) => mockRedisIncr(...args),
    expire: (...args) => mockRedisExpire(...args),
  },
  parent: null,
  children: [],
  paths: [],
};

require.cache[dbPath] = {
  id: dbPath,
  filename: dbPath,
  loaded: true,
  exports: {
    query: (...args) => mockDbQuery(...args),
  },
  parent: null,
  children: [],
  paths: [],
};

require.cache[notifierPath] = {
  id: notifierPath,
  filename: notifierPath,
  loaded: true,
  exports: {
    notifyThreshold: (...args) => mockNotifyThreshold(...args),
  },
  parent: null,
  children: [],
  paths: [],
};

const quotaEngine = require('./QuotaEngine');

beforeEach(() => {
  mockRedisIncr = vi.fn();
  mockRedisExpire = vi.fn();
  mockDbQuery = vi.fn();
  mockNotifyThreshold = vi.fn();

  // Wire up stubs to the cached exports so QuotaEngine picks them up
  require.cache[redisPath].exports.incr = (...args) => mockRedisIncr(...args);
  require.cache[redisPath].exports.expire = (...args) => mockRedisExpire(...args);
  require.cache[dbPath].exports.query = (...args) => mockDbQuery(...args);
  require.cache[notifierPath].exports.notifyThreshold = (...args) => mockNotifyThreshold(...args);
});

afterEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// checkJobQuota — happy path (Redis available)
// ---------------------------------------------------------------------------
describe('checkJobQuota — allowed when below limit', () => {
  it('returns allowed=true when count is below daily limit', async () => {
    mockRedisIncr.mockResolvedValue(5);
    mockRedisExpire.mockResolvedValue(1);

    const result = await quotaEngine.checkJobQuota('tenant-a', 100);
    expect(result.allowed).toBe(true);
    expect(result.current).toBe(5);
    expect(result.limit).toBe(100);
  });

  it('sets expiry when count is 1 (first job of the day)', async () => {
    mockRedisIncr.mockResolvedValue(1);
    mockRedisExpire.mockResolvedValue(1);

    await quotaEngine.checkJobQuota('tenant-b', 50);
    expect(mockRedisExpire).toHaveBeenCalledOnce();
    expect(mockRedisExpire).toHaveBeenCalledWith(
      expect.stringContaining('tenant-b'),
      90000 // 86400 + 3600
    );
  });

  it('does NOT set expiry when count > 1', async () => {
    mockRedisIncr.mockResolvedValue(10);
    mockRedisExpire.mockResolvedValue(1);

    await quotaEngine.checkJobQuota('tenant-c', 100);
    expect(mockRedisExpire).not.toHaveBeenCalled();
  });

  it('redis key includes tenantId and today date', async () => {
    mockRedisIncr.mockResolvedValue(1);
    mockRedisExpire.mockResolvedValue(1);

    await quotaEngine.checkJobQuota('tenant-d', 50);
    const today = new Date().toISOString().split('T')[0];
    const keyArg = mockRedisIncr.mock.calls[0][0];
    expect(keyArg).toContain('tenant-d');
    expect(keyArg).toContain(today);
  });
});

// ---------------------------------------------------------------------------
// checkJobQuota — quota exceeded
// ---------------------------------------------------------------------------
describe('checkJobQuota — blocked when at or above limit', () => {
  it('returns allowed=false when count equals dailyLimit', async () => {
    mockRedisIncr.mockResolvedValue(100);
    mockRedisExpire.mockResolvedValue(1);

    const result = await quotaEngine.checkJobQuota('tenant-e', 100);
    expect(result.allowed).toBe(false);
    expect(result.error).toBe('DAILY_QUOTA_EXCEEDED');
    expect(result.current).toBe(100);
  });

  it('returns allowed=false when count exceeds dailyLimit', async () => {
    mockRedisIncr.mockResolvedValue(150);
    const result = await quotaEngine.checkJobQuota('tenant-f', 100);
    expect(result.allowed).toBe(false);
    expect(result.error).toBe('DAILY_QUOTA_EXCEEDED');
  });
});

// ---------------------------------------------------------------------------
// checkJobQuota — 80% threshold alert
// ---------------------------------------------------------------------------
describe('checkJobQuota — threshold alert', () => {
  it('triggers alert when count equals floor(dailyLimit * 0.8)', async () => {
    // dailyLimit=100, 80% threshold=80
    mockRedisIncr.mockResolvedValue(80);
    mockNotifyThreshold.mockResolvedValue(undefined);

    await quotaEngine.checkJobQuota('tenant-g', 100);

    // triggerThresholdAlert is called async (no await in the source) so we wait
    await new Promise(r => setTimeout(r, 10));
    expect(mockNotifyThreshold).toHaveBeenCalledWith('tenant-g', 80, 80, 100);
  });

  it('does NOT trigger alert when count is below 80% threshold', async () => {
    mockRedisIncr.mockResolvedValue(50);
    await quotaEngine.checkJobQuota('tenant-h', 100);
    await new Promise(r => setTimeout(r, 10));
    expect(mockNotifyThreshold).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// checkJobQuota — Redis failure → DB fallback
// ---------------------------------------------------------------------------
describe('checkJobQuota — DB fallback on Redis error', () => {
  it('falls back to DB when Redis throws', async () => {
    mockRedisIncr.mockRejectedValue(new Error('Redis unavailable'));
    mockDbQuery.mockResolvedValue({ rows: [{ count: 20 }] });

    const result = await quotaEngine.checkJobQuota('tenant-i', 100);
    expect(mockDbQuery).toHaveBeenCalledOnce();
    expect(result.allowed).toBe(true);
    expect(result.current).toBe(20);
  });

  it('DB fallback returns allowed=false when over limit', async () => {
    mockRedisIncr.mockRejectedValue(new Error('Redis unavailable'));
    mockDbQuery.mockResolvedValue({ rows: [{ count: 100 }] });

    const result = await quotaEngine.checkJobQuota('tenant-j', 100);
    expect(result.allowed).toBe(false);
    expect(result.error).toBe('DAILY_QUOTA_EXCEEDED');
  });
});

// ---------------------------------------------------------------------------
// checkJobQuotaDB
// ---------------------------------------------------------------------------
describe('checkJobQuotaDB', () => {
  it('returns allowed=true when DB count is below limit', async () => {
    mockDbQuery.mockResolvedValue({ rows: [{ count: 5 }] });
    const result = await quotaEngine.checkJobQuotaDB('tenant-k', 100);
    expect(result.allowed).toBe(true);
    expect(result.current).toBe(5);
    expect(result.error).toBeNull();
  });

  it('returns allowed=false when DB count equals limit', async () => {
    mockDbQuery.mockResolvedValue({ rows: [{ count: 100 }] });
    const result = await quotaEngine.checkJobQuotaDB('tenant-l', 100);
    expect(result.allowed).toBe(false);
    expect(result.error).toBe('DAILY_QUOTA_EXCEEDED');
  });

  it('handles count=0 (no jobs today)', async () => {
    mockDbQuery.mockResolvedValue({ rows: [{ count: 0 }] });
    const result = await quotaEngine.checkJobQuotaDB('tenant-m', 50);
    expect(result.allowed).toBe(true);
    expect(result.current).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// triggerThresholdAlert
// ---------------------------------------------------------------------------
describe('triggerThresholdAlert', () => {
  it('calls notifier.notifyThreshold with correct arguments', async () => {
    mockNotifyThreshold.mockResolvedValue(undefined);
    await quotaEngine.triggerThresholdAlert('tenant-n', 80, 80, 100);
    expect(mockNotifyThreshold).toHaveBeenCalledWith('tenant-n', 80, 80, 100);
  });

  it('does NOT throw when notifier fails', async () => {
    mockNotifyThreshold.mockRejectedValue(new Error('Notifier down'));
    await expect(
      quotaEngine.triggerThresholdAlert('tenant-o', 80, 80, 100)
    ).resolves.not.toThrow();
  });
});
