/**
 * JWT Generation Module (Internal)
 * 
 * Re-aligned in Hardening Phase for PPOS Integration.
 * Delegates to IdentityService for canonical token issuance.
 */
const identityService = require('../services/identityService');

/**
 * Signs a new JWT specifically for internal PPOS communication.
 * @deprecated Use IdentityService directly for new integrations.
 */
function generateToken(payload, expiresIn = '24h') {
    return identityService.generateInternalToken(payload, expiresIn);
}

module.exports = { generateToken };
