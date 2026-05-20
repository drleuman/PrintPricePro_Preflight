import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const auditService = require('./auditService');

describe('auditService (stub)', () => {
  describe('logAction', () => {
    it('resolves to true', async () => {
      const result = await auditService.logAction('tenant-1', 'PDF_UPLOADED', { file: 'test.pdf' });
      expect(result).toBe(true);
    });

    it('accepts any combination of tenant, action, and details', async () => {
      await expect(auditService.logAction('tenant-2', 'DELETE', null)).resolves.toBe(true);
      await expect(auditService.logAction('t3', 'ACTION', {})).resolves.toBe(true);
      await expect(auditService.logAction('t4', 'NOOP', undefined)).resolves.toBe(true);
    });

    it('is an async function', () => {
      expect(auditService.logAction('t', 'a', {})).toBeInstanceOf(Promise);
    });
  });

  describe('generateSignedUrl', () => {
    it('returns a string', () => {
      const url = auditService.generateSignedUrl('asset-123', 3600);
      expect(typeof url).toBe('string');
    });

    it('includes the assetId in the URL', () => {
      const url = auditService.generateSignedUrl('asset-abc', 60);
      expect(url).toContain('asset-abc');
    });

    it('includes sig=stub in the URL', () => {
      const url = auditService.generateSignedUrl('asset-x', 100);
      expect(url).toContain('sig=stub');
    });

    it('includes an expires= parameter in the URL', () => {
      const before = Date.now();
      const url = auditService.generateSignedUrl('asset-y', 10);
      const after = Date.now();

      const match = url.match(/expires=(\d+)/);
      expect(match).not.toBeNull();
      const expires = Number(match[1]);
      expect(expires).toBeGreaterThanOrEqual(before + 10 * 1000 - 50);
      expect(expires).toBeLessThanOrEqual(after + 10 * 1000 + 50);
    });

    it('returns a URL under /api/assets/', () => {
      const url = auditService.generateSignedUrl('asset-z', 30);
      expect(url).toMatch(/^\/api\/assets\//);
    });
  });

  describe('verifySignedUrl', () => {
    it('returns true when sig is "stub"', () => {
      expect(auditService.verifySignedUrl('asset-1', Date.now() + 10000, 'stub')).toBe(true);
    });

    it('returns false for an empty sig', () => {
      expect(auditService.verifySignedUrl('asset-1', Date.now() + 10000, '')).toBe(false);
    });

    it('returns false for any sig other than "stub"', () => {
      expect(auditService.verifySignedUrl('asset-1', Date.now() + 10000, 'valid-sig')).toBe(false);
      expect(auditService.verifySignedUrl('asset-1', Date.now() + 10000, 'STUB')).toBe(false);
      expect(auditService.verifySignedUrl('asset-1', Date.now() + 10000, null)).toBe(false);
    });
  });
});
