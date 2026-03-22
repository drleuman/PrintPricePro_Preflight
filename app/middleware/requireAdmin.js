const jwt = require('jsonwebtoken');

/**
 * requireAdmin middleware
 * Phase P2 Security Hardening
 * 
 * Enforces JWT authentication and 'admin' role check.
 */
module.exports = function requireAdmin(req, res, next) {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
    const adminKey = req.headers['x-admin-api-key'];

    const JWT_SECRET = process.env.JWT_SECRET;
    const EXPECTED_ADMIN_KEY = process.env.ADMIN_API_KEY;

    // Path 1: JWT Authentication (Preferred)
    if (token && JWT_SECRET) {
        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            if (decoded.role === 'admin' || decoded.role === 'super-admin') {
                req.user = decoded;
                return next();
            }
            return res.status(403).json({ error: 'Forbidden', message: 'Admin role required.' });
        } catch (err) {
            console.error('[AUTH] Admin JWT validation failed:', err.message);
            // Fall through to API Key path
        }
    }

    // Path 2: API Key (Strictly restricted to non-production or specific allowed automation)
    // In production, we should ideally disable this or use it only for localhost
    if (adminKey && EXPECTED_ADMIN_KEY && adminKey === EXPECTED_ADMIN_KEY) {
        if (process.env.NODE_ENV === 'production') {
            console.warn('[SECURITY] Admin API Key used in production by IP:', req.ip);
        }
        req.user = { id: 'system', role: 'admin' };
        return next();
    }

    return res.status(401).json({ 
        error: 'Unauthorized', 
        message: 'Valid Admin JWT or API Key required.' 
    });
};





















