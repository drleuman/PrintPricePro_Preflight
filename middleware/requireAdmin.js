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

    const provided = req.get("X-Admin-Api-Key");
    if (!provided || provided !== expected) {
        return res.status(401).json({
            ok: false,
            error: "UNAUTHORIZED",
            message: "Admin access denied."
        });
    }

    next();
};
