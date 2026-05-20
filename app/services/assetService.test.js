import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';
import fs from 'fs';
import crypto from 'crypto';

const require = createRequire(import.meta.url);

// Inject mock db before requiring assetService
const dbPath = require.resolve('./db');
const mockDbQuery = vi.fn();

if (!require.cache[dbPath]) {
  require.cache[dbPath] = {
    id: dbPath,
    filename: dbPath,
    loaded: true,
    exports: { query: mockDbQuery },
    parent: null,
    children: [],
    paths: [],
  };
} else {
  require.cache[dbPath].exports.query = mockDbQuery;
}

const assetService = require('./assetService');

beforeEach(() => {
  mockDbQuery.mockReset();
  // Stub fs so createAsset doesn't touch the real filesystem
  vi.spyOn(fs, 'existsSync').mockReturnValue(true);
  vi.spyOn(fs, 'mkdirSync').mockReturnValue(undefined);
  vi.spyOn(fs, 'writeFileSync').mockReturnValue(undefined);
  vi.spyOn(fs, 'copyFileSync').mockReturnValue(undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('AssetService', () => {
  describe('createAsset', () => {
    it('throws when tenantId is missing', async () => {
      const buf = Buffer.from('fake pdf content');
      await expect(
        assetService.createAsset({ filename: 'test.pdf', buffer: buf })
      ).rejects.toThrow('tenantId is mandatory');
    });

    it('creates an asset from a buffer and returns metadata', async () => {
      mockDbQuery.mockResolvedValue({ rows: [] });
      const buf = Buffer.from('fake pdf content bytes');
      const result = await assetService.createAsset({
        filename: 'test.pdf',
        buffer: buf,
        tenantId: 'tenant-1',
      });

      expect(result).toHaveProperty('id');
      expect(result.filename).toBe('test.pdf');
      expect(result.tenant_id).toBe('tenant-1');
      expect(result.mime_type).toBe('application/pdf');
      expect(result).toHaveProperty('sha256');
      expect(result).toHaveProperty('size');
      expect(result).toHaveProperty('storage_path');
    });

    it('computes the correct SHA256 of the buffer', async () => {
      mockDbQuery.mockResolvedValue({ rows: [] });
      const content = 'deterministic content for sha';
      const buf = Buffer.from(content);
      const expectedSha = crypto.createHash('sha256').update(buf).digest('hex');

      const result = await assetService.createAsset({
        filename: 'sha-test.pdf',
        buffer: buf,
        tenantId: 'tenant-sha',
      });

      expect(result.sha256).toBe(expectedSha);
    });

    it('reports correct size from buffer length', async () => {
      mockDbQuery.mockResolvedValue({ rows: [] });
      const buf = Buffer.from('x'.repeat(42));
      const result = await assetService.createAsset({
        filename: 'size-test.pdf',
        buffer: buf,
        tenantId: 'tenant-size',
      });
      expect(result.size).toBe(42);
    });

    it('skips writing the file when it already exists (content-addressable dedup)', async () => {
      mockDbQuery.mockResolvedValue({ rows: [] });
      vi.spyOn(fs, 'existsSync').mockReturnValue(true);

      await assetService.createAsset({
        filename: 'dup.pdf',
        buffer: Buffer.from('content'),
        tenantId: 'tenant-dup',
      });

      expect(fs.writeFileSync).not.toHaveBeenCalled();
    });

    it('writes the file when it does not exist', async () => {
      mockDbQuery.mockResolvedValue({ rows: [] });
      // First call is existsSync for the dir (return true), second for the file (return false)
      vi.spyOn(fs, 'existsSync')
        .mockReturnValueOnce(true)  // dir exists
        .mockReturnValueOnce(false); // file does not exist

      await assetService.createAsset({
        filename: 'new.pdf',
        buffer: Buffer.from('new content'),
        tenantId: 'tenant-new',
      });

      expect(fs.writeFileSync).toHaveBeenCalledTimes(1);
    });

    it('calls db.query with the correct SQL and values', async () => {
      mockDbQuery.mockResolvedValue({ rows: [] });
      const buf = Buffer.from('db test content');

      await assetService.createAsset({
        filename: 'db-test.pdf',
        buffer: buf,
        tenantId: 'tenant-db',
      });

      expect(mockDbQuery).toHaveBeenCalledTimes(1);
      const [sql, values] = mockDbQuery.mock.calls[0];
      expect(sql).toContain('INSERT INTO assets');
      expect(values).toContain('tenant-db');
      expect(values).toContain('db-test.pdf');
    });
  });

  describe('getAsset', () => {
    it('returns the first row from the DB result', async () => {
      const mockRow = { id: 'asset-1', tenant_id: 'tenant-1', filename: 'test.pdf', storage_path: '/tmp/test.pdf' };
      mockDbQuery.mockResolvedValue({ rows: [mockRow] });

      const result = await assetService.getAsset('asset-1', 'tenant-1');
      expect(result).toEqual(mockRow);
    });

    it('returns undefined when no rows found', async () => {
      mockDbQuery.mockResolvedValue({ rows: [] });
      const result = await assetService.getAsset('nonexistent', 'tenant-1');
      expect(result).toBeUndefined();
    });

    it('includes tenant_id in the query when provided', async () => {
      mockDbQuery.mockResolvedValue({ rows: [] });
      await assetService.getAsset('asset-1', 'tenant-1');
      const [sql, params] = mockDbQuery.mock.calls[0];
      expect(sql).toContain('tenant_id');
      expect(params).toContain('tenant-1');
    });

    it('omits tenant_id filter when not provided', async () => {
      mockDbQuery.mockResolvedValue({ rows: [] });
      await assetService.getAsset('asset-2', null);
      const [sql, params] = mockDbQuery.mock.calls[0];
      expect(sql).not.toContain('tenant_id');
    });
  });

  describe('getAssetPath', () => {
    it('returns the storage_path of the found asset', async () => {
      const mockRow = { id: 'a1', storage_path: '/storage/a1.pdf' };
      mockDbQuery.mockResolvedValue({ rows: [mockRow] });

      const path = await assetService.getAssetPath('a1', 'tenant-1');
      expect(path).toBe('/storage/a1.pdf');
    });

    it('returns null when the asset is not found', async () => {
      mockDbQuery.mockResolvedValue({ rows: [] });
      const path = await assetService.getAssetPath('missing', 'tenant-1');
      expect(path).toBeNull();
    });
  });
});
