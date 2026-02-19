module.exports = function apiKey(req, res, next) {
    const required = process.env.PPP_API_KEY;
    // Allow bypass in development or when no key set
    if (!required || process.env.NODE_ENV === 'development') return next();

    const provided = (req.get('x-ppp-api-key') || req.query.api_key || req.body?.api_key || '').toString();
    if (provided === required) return next();

    res.status(401).json({ error: 'unauthorized', message: 'Missing or invalid API key' });
};
