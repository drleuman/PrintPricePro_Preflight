/**
 * Tenant Context Management
 * Part of Phase 2: Strict Tenant Isolation
 */
const { AsyncLocalStorage } = require('async_hooks');

class TenantContext {
    constructor() {
        this.storage = new AsyncLocalStorage();
    }

    /**
     * Set the current tenant context for the duration of the request/callback.
     */
    run(context, callback) {
        return this.storage.run(context, callback);
    }

    /**
     * Get the current active tenant context.
     */
    get() {
        return this.storage.getStore();
    }

    /**
     * Get only the tenant_id.
     */
    getTenantId() {
        const store = this.get();
        return store ? store.id : null;
    }
}

module.exports = new TenantContext();
