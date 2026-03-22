/**
 * Development Authentication Route
 * Part of Phase 1 - AUTH FOUNDATION
 */
const express = require('express');
const router = express.Router();
const { generateToken } = require('../auth/generateToken');

/**
 * POST /api/auth/token
 * Returns a JWT for testing/development.
 */
router.post('/token', (req, res) => {
    // Only allow in development OR if explicitly enabled
    if (process.env.NODE_ENV === 'production' && process.env.DEBUG_AUTH_ROUTE !== 'true') {
        return res.status(403).json({ error: 'RESTRICTED_ROUTE', message: 'Auth generators are disabled in production.' });
    }

    const { userId, tenantId, role, scopes, plan } = req.body;

    const payload = {
        userId: userId || 'test-user-123',
        tenantId: tenantId || 'default-tenant',
        role: role || 'DEVELOPER',
        scopes: scopes || ['*'],
        plan: plan || 'PREMIUM'
    };

    const token = generateToken(payload);

    res.json({ token, payload });
});

module.exports = router;
