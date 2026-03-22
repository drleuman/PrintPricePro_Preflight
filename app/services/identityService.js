'use strict';

const jwt = require('jsonwebtoken');
const pposConfig = require('../../config/ppos');

/**
 * PrintPrice Pro — Identity & Governance Service
 * 
 * Manages authentication tokens for internal and platform-level communication.
 */
class IdentityService {
    /**
     * Generates a short-lived internal JWT for PPOS Service communication.
     * Complies with the OS Governance Baseline v2.
     */
    generateInternalToken() {
        return jwt.sign({
            userId: 'preflight-app-internal',
            tenantId: pposConfig.internalTenantId,
            role: pposConfig.internalRole,
            scopes: pposConfig.internalScopes
        }, pposConfig.jwtSecret, {
            issuer: pposConfig.jwtIssuer,
            audience: pposConfig.jwtAudience,
            expiresIn: '10m' // Slightly increased for long-running pipeline uploads
        });
    }

    /**
     * Returns the canonical authorization headers for PPOS requests.
     */
    getAuthHeaders() {
        const token = this.generateInternalToken();
        const headers = {
            'Authorization': `Bearer ${token}`
        };

        // Maintain legacy API key for backward compatibility Transition Phase
        if (pposConfig.apiKey) {
            headers['X-PPOS-API-KEY'] = pposConfig.apiKey;
        }

        return headers;
    }
}

module.exports = new IdentityService();
