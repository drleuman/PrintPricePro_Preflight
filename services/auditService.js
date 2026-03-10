const db = require('./db');
const crypto = require('crypto');

class AuditService {
    async logAction(tenantId, action, params = {}) {
        const { jobId, policySlug, ipAddress, details } = params;
        try {
            await db.query(`
                INSERT INTO audit_logs (id, tenant_id, action, job_id, policy_slug, ip_address, details)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [
                crypto.randomUUID(),
                tenantId || 'default',
                action,
                jobId || null,
                policySlug || null,
                ipAddress || '0.0.0.0',
                details ? JSON.stringify(details) : null
            ]);
        } catch (err) {
            console.error('[AUDIT-LOG-ERROR]', err.message);
        }
    }

    generateSignedUrl(assetId, expiresInSeconds = 3600) {
        const expires = Math.floor(Date.now() / 1000) + expiresInSeconds;
        const secret = process.env.APP_SECRET || 'dev-secret-key-123';
        const signature = crypto.createHmac('sha256', secret)
            .update(`${assetId}:${expires}`)
            .digest('hex');

        return `/api/v2/preflight/assets/${assetId}?expires=${expires}&sig=${signature}`;
    }

    verifySignedUrl(assetId, expires, signature) {
        if (!expires || !signature) return false;

        const now = Math.floor(Date.now() / 1000);
        const expiresInt = parseInt(expires);

        // 1. Check if expired
        if (now > expiresInt) return false;

        // 2. Check maximum window (Security recommendation: max 1 hour)
        const MAX_WINDOW = 3600;
        if (expiresInt - now > MAX_WINDOW) {
            console.warn(`[SECURITY][SIGNED-URL] Expiry window too large for asset ${assetId}: ${expiresInt - now}s`);
            return false;
        }

        const secret = process.env.APP_SECRET || 'dev-secret-key-123';
        const expected = crypto.createHmac('sha256', secret)
            .update(`${assetId}:${expires}`)
            .digest('hex');

        return signature === expected;
    }
}

module.exports = new AuditService();
