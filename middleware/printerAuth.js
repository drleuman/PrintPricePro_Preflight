// middleware/printerAuth.js
const db = require('../services/db');
const crypto = require('crypto');

/**
 * Middleware to authenticate requests from Printer Nodes.
 * Expects 'x-printer-api-key' header.
 */
async function printerAuth(req, res, next) {
    const printerId = req.headers['x-printer-id'] || req.params.id;
    const apiKey = req.headers['x-printer-api-key'];

    if (!printerId || !apiKey) {
        return res.status(401).json({ error: 'Missing printer-id or api-key.' });
    }

    try {
        const apiKeyHash = crypto.createHash('sha256').update(apiKey).digest('hex');

        const { rows } = await db.query(`
            SELECT id, status, connect_status 
            FROM printer_nodes 
            WHERE id = ? AND printer_api_key_hash = ?
        `, [printerId, apiKeyHash]);

        if (rows.length === 0) {
            return res.status(403).json({ error: 'Invalid printer credentials.' });
        }

        const printer = rows[0];

        // Attach printer info to request
        req.printer = printer;
        next();
    } catch (err) {
        console.error('[PRINTER-AUTH-ERROR]', err);
        res.status(500).json({ error: 'Internal authentication error.' });
    }
}

module.exports = printerAuth;
