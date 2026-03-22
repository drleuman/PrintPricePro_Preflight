'use strict';

const express = require('express');
const axios = require('axios');
const identityService = require('../services/identityService');
const pposConfig = require('../../config/ppos');
const router = express.Router();

// Identity logic moved to identityService.js

/**
 * PPOS Preflight Proxy Router
 * 
 * Proxies requests from /api/preflight/* to the internal PPOS Service.
 * Phase 4.1: Internal Reverse Proxy.
 */

router.use(async (req, res) => {
    // Correctly reconstruct the target URL including the mandatory /api/preflight prefix
    const targetUrl = `${pposConfig.preflightServiceUrl.replace(/\/$/, '')}/api/preflight${req.url}`;
    
    console.log(`[PROXY][PPOS] ${req.method} ${req.url} -> ${targetUrl}`);

    try {
        const headers = { ...req.headers };
        // Clean headers to avoid conflicts
        delete headers.host;
        delete headers.connection;
        
        // Inject Canonical Auth Headers (JWT Bearer)
        const authHeaders = identityService.getAuthHeaders();
        Object.assign(headers, authHeaders);

        // Legacy cleanup (no longer needed if OS expects JWT)
        delete headers['x-ppos-api-key'];

        const response = await axios({
            method: req.method,
            url: targetUrl,
            data: req.body,
            headers: headers,
            params: req.query,
            responseType: 'stream',
            validateStatus: () => true, // Proxy all status codes
            timeout: pposConfig.longTimeoutMs
        });

        // Set response headers from upstream
        Object.entries(response.headers).forEach(([key, value]) => {
            res.setHeader(key, value);
        });

        res.status(response.status);
        response.data.pipe(res);

    } catch (error) {
        console.error(`[PROXY][PPOS-ERROR] ${req.method} ${req.url}:`, error.message);
        if (!res.headersSent) {
            res.status(502).json({
                error: 'Bad Gateway',
                message: 'Failed to proxy request to PPOS Service',
                details: error.message
            });
        }
    }
});

module.exports = router;
