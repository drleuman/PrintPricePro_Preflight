'use strict';

/**
 * Tenant domain entity stub.
 * Provides basic tenant validation for TenantService.
 */
class Tenant {
  constructor(data = {}) {
    this.tenantId = data.tenantId || data.id || null;
    this.name = data.name || null;
    this.status = data.status || 'ACTIVE';
    this.plan = data.plan || 'FREE';
    // Copy any extra fields
    Object.keys(data).forEach(k => {
      if (!(k in this)) this[k] = data[k];
    });
  }

  validate() {
    if (!this.tenantId) throw new Error('VALIDATION_ERROR: tenantId is required');
    if (!this.name) throw new Error('VALIDATION_ERROR: name is required');
  }
}

module.exports = Tenant;
