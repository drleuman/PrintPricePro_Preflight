/**
 * Enterprise Authentication Service
 * Part of Phase 1 (Enterprise Multi-Tenant Hardening)
 */
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-for-dev';
const TOKEN_EXPIRY = '24h';

class AuthService {
    /**
     * Standard RBAC Scopes
     */
    static SCOPES = {
        JOBS_WRITE: 'jobs:write',
        JOBS_READ: 'jobs:read',
        ANALYTICS: 'analytics:read',
        BATCH_MANAGE: 'batch:manage',
        TENANT_ADMIN: 'tenant:admin',
        SYSTEM_ADMIN: 'system:admin'
    };

    /**
     * Sign a JWT for a tenant session.
     */
    static signToken(payload) {
        return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
    }

    /**
     * Verify a JWT or API Key and return the tenant context.
     */
    static async verify(token) {
        try {
            return jwt.verify(token, JWT_SECRET);
        } catch (err) {
            throw new Error('Invalid or expired authentication token.');
        }
    }

    /**
     * RBAC Policy Checker
     * Ensures the current tenant context has the required scope.
     */
    static checkScope(userScopes, requiredScope) {
        if (!userScopes) return false;
        if (userScopes.includes(this.SCOPES.SYSTEM_ADMIN)) return true; // Superuser bypass
        return userScopes.includes(requiredScope);
    }

    /**
     * Helper to hash passwords (for internal system users)
     */
    static async hashPassword(password) {
        const salt = await bcrypt.genSalt(12);
        return bcrypt.hash(password, salt);
    }

    /**
     * Helper to verify passwords
     */
    static async comparePasswords(password, hash) {
        return bcrypt.compare(password, hash);
    }
}

module.exports = AuthService;
