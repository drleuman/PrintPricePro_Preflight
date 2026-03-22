/**
 * PrintPrice OS (PPOS) Integration Configuration
 * 
 * Centralizes all environment variables and defaults for 
 * communicating with the PPOS runtime.
 */

const pposConfig = {
    // Endpoints
    preflightServiceUrl: process.env.PPOS_SERVICE_URL || 'http://localhost:3000',
    controlPlaneUrl: process.env.PPOS_CONTROL_PLANE_URL || 'http://localhost:8080',
    
    // Performance & Lifecycle
    timeoutMs: parseInt(process.env.PPOS_REQUEST_TIMEOUT_MS, 10) || 30000,
    longTimeoutMs: parseInt(process.env.PPOS_LONG_REQUEST_TIMEOUT_MS, 10) || 60000,
    
    // Feature Flags
    enableAsyncPreflight: process.env.PPOS_ENABLE_ASYNC_PREFLIGHT === 'true',
    enableAutofix: process.env.PPOS_ENABLE_AUTOFIX !== 'false', // Default true
    
    // Security
    apiKey: process.env.PPOS_API_KEY || null,
    jwtSecret: process.env.JWT_SECRET || 'ppos-dev-only-secret-2026',
    jwtIssuer: process.env.OIDC_ISSUER || 'https://auth.printprice.pro',
    jwtAudience: process.env.OIDC_AUDIENCE || 'ppos:control',
    internalTenantId: process.env.PPOS_INTERNAL_TENANT_ID || 'ppos-customer-1',
    internalRole: process.env.PPOS_INTERNAL_ROLE || 'ADMIN',
    internalScopes: process.env.PPOS_INTERNAL_SCOPES ? process.env.PPOS_INTERNAL_SCOPES.split(',') : ['preflight:write', 'preflight:analyze', 'jobs:read', 'preflight:autofix'],
    
    // Environment Context
    environment: process.env.PPOS_ENVIRONMENT || process.env.NODE_ENV || 'development',
    
    // Internal Routing
    routes: {
        analyze: '/api/preflight/analyze',
        autofix: '/api/preflight/autofix',
        status: (jobId) => `/api/preflight/status/${jobId}`,
        health: '/health'
    }
};

/**
 * Validates the current configuration for production readiness.
 * @returns {Array} List of warnings/errors
 */
function validateConfig() {
    const issues = [];
    const isProd = pposConfig.environment === 'production';
    const isStaging = pposConfig.environment === 'staging';

    if (isProd || isStaging) {
        if (pposConfig.preflightServiceUrl.includes('localhost')) {
            issues.push(`WARNING: preflightServiceUrl points to localhost in ${pposConfig.environment}.`);
        }
        
        if (!pposConfig.apiKey) {
            issues.push(`CRITICAL: No PPOS_API_KEY defined for ${pposConfig.environment} environment. External communication will be rejected.`);
        }

        if (pposConfig.timeoutMs < 1000) {
            issues.push('WARNING: timeoutMs is extremely low (< 1s).');
        }
    }

    return issues;
}

module.exports = {
    ...pposConfig,
    validateConfig
};
