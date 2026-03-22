const Tenant = require('../kernel/domain/tenant');

/**
 * @project PrintPrice Pro - Multi-Tenant Layer
 */

/**
 * Tenant Service (V9.5)
 * Responsibility: Manage Tenant lifecycle, roles, and registry.
 */
class TenantService {
    constructor() {
        this.tenants = new Map();
    }

    /**
     * Register a new tenant.
     * @param {object} data 
     */
    registerTenant(data) {
        const tenant = new Tenant(data);
        tenant.validate();
        this.tenants.set(tenant.tenantId, tenant);
        return tenant;
    }

    getTenant(tenantId) {
        return this.tenants.get(tenantId);
    }

    listTenants() {
        return Array.from(this.tenants.values());
    }

    updateTenant(tenantId, updates) {
        const existing = this.tenants.get(tenantId);
        if (!existing) throw new Error("TENANT_NOT_FOUND");

        const updated = new Tenant({ ...existing, ...updates, tenantId });
        updated.validate();
        this.tenants.set(tenantId, updated);
        return updated;
    }
}

module.exports = new TenantService();






















