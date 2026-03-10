const crypto = require('crypto');

function safeCompare(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string') return false;
    try {
        const bufA = Buffer.from(a);
        const bufB = Buffer.from(b);
        if (bufA.length !== bufB.length) return false;
        return crypto.timingSafeEqual(bufA, bufB);
    } catch (e) {
        return false;
    }
}

module.exports = function apiKey(req, res, next) {
    const required = process.env.PPP_API_KEY;
    if (!required || process.env.NODE_ENV === 'development') return next();

    const headerKey = req.get('x-ppp-api-key') || '';
    const queryKey = req.query.api_key || '';
    const bodyKey = (req.body?.api_key || '').toString();

    if (safeCompare(headerKey, required)) return next();

    if (safeCompare(queryKey, required) || safeCompare(bodyKey, required)) {
        console.warn(`[SECURITY-WARN] API Key passed via ${queryKey ? 'query' : 'body'} instead of X-PPP-API-KEY header from ${req.ip}`);
        return next();
    }

    res.status(401).json({ error: 'unauthorized', message: 'Missing or invalid API key. Use X-PPP-API-KEY header.' });
};
