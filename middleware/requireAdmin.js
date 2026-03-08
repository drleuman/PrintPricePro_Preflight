// middleware/requireAdmin.js
module.exports = function requireAdmin(req, res, next) {
    const expected = process.env.ADMIN_API_KEY;

    // Si no configuraste la key, mejor bloquear explícitamente en prod
    if (!expected) {
        return res.status(503).json({
            ok: false,
            error: "ADMIN_NOT_CONFIGURED",
            message: "ADMIN_API_KEY is not configured on server."
        });
    }

    // Soporte para X-Admin-Api-Key (case insensitive via req.get) 
    // y para Authorization: Bearer <key>
    const provided =
        req.get("X-Admin-Api-Key") ||
        (req.headers.authorization?.startsWith("Bearer ")
            ? req.headers.authorization.slice(7)
            : null);

    if (!provided || provided !== expected) {
        console.warn(`[AUTH-FAILURE] Admin access denied for ${req.method} ${req.originalUrl}. Source: ${req.ip}`);
        return res.status(401).json({
            ok: false,
            error: "UNAUTHORIZED",
            message: "Admin access denied."
        });
    }

    next();
};
