import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

// TenantContext is a singleton — import once for all tests
const tenantCtx = require('./TenantContext');

describe('TenantContext', () => {
  describe('get()', () => {
    it('returns undefined outside any run() context', () => {
      expect(tenantCtx.get()).toBeUndefined();
    });

    it('returns the context object inside run()', async () => {
      const context = { id: 'tenant-123', role: 'admin' };
      let captured;
      await tenantCtx.run(context, async () => {
        captured = tenantCtx.get();
      });
      expect(captured).toEqual(context);
    });

    it('returns undefined after run() completes', async () => {
      await tenantCtx.run({ id: 'ephemeral' }, async () => {});
      expect(tenantCtx.get()).toBeUndefined();
    });

    it('isolates context between independent run() calls', async () => {
      let capturedA;
      let capturedB;
      await Promise.all([
        tenantCtx.run({ id: 'tenant-A' }, async () => {
          await new Promise(r => setTimeout(r, 5));
          capturedA = tenantCtx.get();
        }),
        tenantCtx.run({ id: 'tenant-B' }, async () => {
          await new Promise(r => setTimeout(r, 5));
          capturedB = tenantCtx.get();
        }),
      ]);
      expect(capturedA?.id).toBe('tenant-A');
      expect(capturedB?.id).toBe('tenant-B');
    });
  });

  describe('getTenantId()', () => {
    it('returns null outside any run() context', () => {
      expect(tenantCtx.getTenantId()).toBeNull();
    });

    it('returns the id from the active context', async () => {
      let capturedId;
      await tenantCtx.run({ id: 'tenant-abc' }, async () => {
        capturedId = tenantCtx.getTenantId();
      });
      expect(capturedId).toBe('tenant-abc');
    });

    it('returns null after run() completes', async () => {
      await tenantCtx.run({ id: 'ephemeral' }, async () => {});
      expect(tenantCtx.getTenantId()).toBeNull();
    });

    it('returns undefined when context has no id field', async () => {
      let capturedId;
      await tenantCtx.run({ role: 'admin' }, async () => {
        capturedId = tenantCtx.getTenantId();
      });
      // store is truthy but store.id is undefined → getTenantId returns undefined
      expect(capturedId).toBeUndefined();
    });
  });

  describe('run()', () => {
    it('returns the value returned by the callback', async () => {
      const result = await tenantCtx.run({ id: 'tenant-x' }, async () => 42);
      expect(result).toBe(42);
    });

    it('propagates errors thrown inside the callback', async () => {
      await expect(
        tenantCtx.run({ id: 'tenant-err' }, async () => {
          throw new Error('callback error');
        })
      ).rejects.toThrow('callback error');
    });

    it('supports nested run() calls (inner context overrides outer)', async () => {
      let innerId;
      await tenantCtx.run({ id: 'outer' }, async () => {
        await tenantCtx.run({ id: 'inner' }, async () => {
          innerId = tenantCtx.getTenantId();
        });
      });
      expect(innerId).toBe('inner');
    });
  });
});
