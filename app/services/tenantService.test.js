import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

let tenantService;

beforeEach(() => {
  // Clear cache to get a fresh in-memory Map for each test
  const svcPath = require.resolve('./tenantService');
  delete require.cache[svcPath];
  tenantService = require('./tenantService');
});

describe('TenantService', () => {
  describe('registerTenant', () => {
    it('registers and returns a tenant with tenantId and name', () => {
      const tenant = tenantService.registerTenant({ tenantId: 'tenant-1', name: 'Acme Corp' });
      expect(tenant.tenantId).toBe('tenant-1');
      expect(tenant.name).toBe('Acme Corp');
    });

    it('stores the tenant so it can be retrieved later', () => {
      tenantService.registerTenant({ tenantId: 'tenant-2', name: 'Beta Inc' });
      const found = tenantService.getTenant('tenant-2');
      expect(found).toBeDefined();
      expect(found.tenantId).toBe('tenant-2');
    });

    it('throws a validation error when tenantId is missing', () => {
      expect(() => tenantService.registerTenant({ name: 'No ID Inc' })).toThrow('VALIDATION_ERROR');
    });

    it('throws a validation error when name is missing', () => {
      expect(() => tenantService.registerTenant({ tenantId: 'tenant-x' })).toThrow('VALIDATION_ERROR');
    });

    it('returns a Tenant instance', () => {
      const tenant = tenantService.registerTenant({ tenantId: 't-inst', name: 'Instance Test' });
      expect(tenant).toBeDefined();
      expect(typeof tenant.validate).toBe('function');
    });
  });

  describe('getTenant', () => {
    it('returns undefined for an unknown tenantId', () => {
      expect(tenantService.getTenant('nonexistent')).toBeUndefined();
    });

    it('returns the exact registered tenant', () => {
      tenantService.registerTenant({ tenantId: 'tenant-abc', name: 'Test Corp' });
      const t = tenantService.getTenant('tenant-abc');
      expect(t.tenantId).toBe('tenant-abc');
      expect(t.name).toBe('Test Corp');
    });
  });

  describe('listTenants', () => {
    it('returns an empty array when no tenants are registered', () => {
      expect(tenantService.listTenants()).toEqual([]);
    });

    it('returns all registered tenants', () => {
      tenantService.registerTenant({ tenantId: 't1', name: 'Tenant One' });
      tenantService.registerTenant({ tenantId: 't2', name: 'Tenant Two' });
      const list = tenantService.listTenants();
      expect(list.length).toBe(2);
      const ids = list.map(t => t.tenantId);
      expect(ids).toContain('t1');
      expect(ids).toContain('t2');
    });

    it('reflects newly registered tenants immediately', () => {
      tenantService.registerTenant({ tenantId: 'ta', name: 'A' });
      expect(tenantService.listTenants().length).toBe(1);
      tenantService.registerTenant({ tenantId: 'tb', name: 'B' });
      expect(tenantService.listTenants().length).toBe(2);
    });
  });

  describe('updateTenant', () => {
    it('updates an existing tenant and returns the updated instance', () => {
      tenantService.registerTenant({ tenantId: 't3', name: 'Old Name' });
      const updated = tenantService.updateTenant('t3', { name: 'New Name' });
      expect(updated.name).toBe('New Name');
      expect(updated.tenantId).toBe('t3');
    });

    it('persists the update so getTenant returns the new data', () => {
      tenantService.registerTenant({ tenantId: 't4', name: 'Before' });
      tenantService.updateTenant('t4', { name: 'After' });
      expect(tenantService.getTenant('t4').name).toBe('After');
    });

    it('preserves the tenantId through an update', () => {
      tenantService.registerTenant({ tenantId: 't5', name: 'Original' });
      const updated = tenantService.updateTenant('t5', { name: 'Updated', status: 'SUSPENDED' });
      expect(updated.tenantId).toBe('t5');
    });

    it('throws TENANT_NOT_FOUND for an unknown tenantId', () => {
      expect(() => tenantService.updateTenant('ghost', { name: 'Ghost' })).toThrow('TENANT_NOT_FOUND');
    });
  });
});
