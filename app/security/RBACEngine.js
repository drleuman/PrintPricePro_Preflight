/**
 * Enterprise RBAC Engine
 * Part of Phase 3: Quotas, Plans & RBAC
 */
const AuthService = require('./AuthService');

class RBACEngine {
    /**
     * Define core roles and their default scopes.
     */
    static ROLES = {
        TENANT_ADMIN: [
            AuthService.SCOPES.JOBS_WRITE,
            AuthService.SCOPES.JOBS_READ,
            AuthService.SCOPES.ANALYTICS,
            AuthService.SCOPES.BATCH_MANAGE,
            AuthService.SCOPES.TENANT_ADMIN
        ],
        OPERATOR: [
            AuthService.SCOPES.JOBS_WRITE,
            AuthService.SCOPES.JOBS_READ,
            AuthService.SCOPES.ANALYTICS,
            AuthService.SCOPES.BATCH_MANAGE
        ],
        VIEWER: [
            AuthService.SCOPES.JOBS_READ,
            AuthService.SCOPES.ANALYTICS
        ]
    };

    /**
     * Verifies if a user has the required scopes.
     */
    static authorize(req, requiredScope) {
        if (!req.tenant || !req.tenant.scopes) return false;
        
        const tenantScopes = req.tenant.scopes;
        
        // --- 1. Superuser Check ---
        if (tenantScopes.includes(AuthService.SCOPES.SYSTEM_ADMIN)) return true;

        // --- 2. Scope Inclusion ---
        return tenantScopes.includes(requiredScope);
    }

    /**
     * Formats roles into scopes for JWT generation.
     */
    static getScopesFromRole(roleName) {
        return this.ROLES[roleName] || [];
    }
}

module.exports = RBACEngine;
