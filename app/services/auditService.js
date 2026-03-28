/**
 * Stub for missing auditService.
 */
module.exports = {
    logAction: async (tenantId, action, details) => {
        console.log(`[STUB] Audit Log: Tenant=${tenantId}, Action=${action}`, details);
        return true;
    },
    generateSignedUrl: (assetId, expiry) => {
        return `/api/assets/${assetId}?sig=stub&expires=${Date.now() + expiry * 1000}`;
    },
    verifySignedUrl: (assetId, expires, sig) => {
        return sig === 'stub';
    }
};

