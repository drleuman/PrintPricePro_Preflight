const express = require('express');
const axios = require('axios');
const rateLimit = require('express-rate-limit');
const WebSocket = require('ws');

const router = express.Router();

const externalApiBaseUrl = 'https://generativelanguage.googleapis.com';
const externalWsBaseUrl = 'wss://generativelanguage.googleapis.com';

const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;

if (!apiKey) {
    console.warn('WARNING: GEMINI_API_KEY / API_KEY no configurada. El proxy a Gemini estará deshabilitado.');
} else {
    console.log('API KEY detectada: el proxy a Gemini usará esta clave.');
}

// -------- Rate limit --------
const proxyLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: 'Too many requests from this IP, please try again after 15 minutes',
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res, _next, options) => {
        console.warn(`Rate limit exceeded for IP: ${req.ip}. Path: ${req.path}`);
        res.status(options.statusCode).send(options.message);
    },
});

router.use(proxyLimiter);

// -------- HTTP Proxy Handler --------
router.use('/', async (req, res, next) => {
    // If upgrade to WebSocket, ignore here (logic is in server.js upgrade handler or handled separately)
    if (req.headers.upgrade && req.headers.upgrade.toLowerCase() === 'websocket') {
        return next();
    }

    // CORS preflight
    if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Goog-Api-Key');
        res.setHeader('Access-Control-Max-Age', '86400');
        return res.sendStatus(200);
    }

    if (!apiKey) {
        return res.status(503).json({ error: 'Proxy disabled: missing API key' });
    }

    try {
        // Construct target URL
        // req.url in a Router is relative to the mount point. 
        // If mounted at /api-proxy, and request is /api-proxy/v1/models..., req.url is /v1/models...
        const targetPath = req.url.startsWith('/') ? req.url.substring(1) : req.url;
        const apiUrl = `${externalApiBaseUrl}/${targetPath}`;

        // Copy headers
        const outgoingHeaders = {};
        for (const h in req.headers) {
            const low = h.toLowerCase();
            if (!['host', 'connection', 'content-length', 'transfer-encoding', 'upgrade', 'sec-websocket-key', 'sec-websocket-version', 'sec-websocket-extensions', 'referer', 'origin'].includes(low)) {
                outgoingHeaders[h] = req.headers[h];
            }
        }
        outgoingHeaders['X-Goog-Api-Key'] = apiKey;

        const method = req.method.toUpperCase();
        if (['POST', 'PUT', 'PATCH'].includes(method)) {
            outgoingHeaders['Content-Type'] = req.headers['content-type'] || 'application/json';
        } else {
            delete outgoingHeaders['Content-Type'];
            delete outgoingHeaders['content-type'];
        }
        if (!outgoingHeaders['accept']) outgoingHeaders['accept'] = '*/*';

        const axiosConfig = {
            method,
            url: apiUrl,
            headers: outgoingHeaders,
            responseType: 'stream',
            validateStatus: () => true,
            data: ['POST', 'PUT', 'PATCH'].includes(method) ? req.body : undefined,
        };

        const apiResponse = await axios(axiosConfig);

        for (const header in apiResponse.headers) {
            res.setHeader(header, apiResponse.headers[header]);
        }
        res.status(apiResponse.status);

        apiResponse.data.on('data', (chunk) => res.write(chunk));
        apiResponse.data.on('end', () => res.end());
        apiResponse.data.on('error', (err) => {
            console.error('Proxy stream error from upstream:', err);
            if (!res.headersSent) {
                res.status(500).json({ error: 'Proxy error during upstream streaming' });
            } else {
                res.end();
            }
        });
    } catch (error) {
        console.error('Proxy error before upstream:', error);
        if (!res.headersSent) {
            if (error.response) {
                res.status(error.response.status).json({
                    status: error.response.status,
                    message: (error.response.data && error.response.data.error && error.response.data.error.message) || 'Upstream error',
                    details: (error.response.data && error.response.data.error && error.response.data.error.details) || null,
                });
            } else {
                res.status(500).json({ error: 'Proxy setup error', message: error.message });
            }
        }
    }
});

/**
 * Handle WebSocket upgrade for Gemini proxy
 */
function handleWsUpgrade(wss, request, socket, head) {
    try {
        const requestUrl = new URL(request.url, `http://${request.headers.host}`);
        const pathname = requestUrl.pathname;

        if (!apiKey) {
            console.error('WS proxy: API key not configured. Closing connection.');
            socket.destroy();
            return;
        }

        wss.handleUpgrade(request, socket, head, (clientWs) => {
            console.log('Client WebSocket connected to proxy for path:', pathname);

            // Assume mounted at /api-proxy, so we strip it. 
            // Note: In server.js we passed the full pathname to this check usually. 
            // But here we need to know the mount point prefix to strip it.
            // For simplicity, we'll assume /api-proxy is the prefix, or standard logic:
            // In logical flow: pathname is /api-proxy/v1beta/....
            const targetPathSegment = pathname.replace(/^\/api-proxy/, '');
            const clientQuery = new URLSearchParams(requestUrl.search);
            clientQuery.set('key', apiKey);

            const targetGeminiWsUrl = `${externalWsBaseUrl}${targetPathSegment}?${clientQuery.toString()}`;

            const geminiWs = new WebSocket(targetGeminiWsUrl, {
                protocol: request.headers['sec-websocket-protocol'],
            });

            const messageQueue = [];

            geminiWs.on('open', () => {
                while (messageQueue.length > 0) {
                    const msg = messageQueue.shift();
                    if (geminiWs.readyState === WebSocket.OPEN) {
                        geminiWs.send(msg);
                    } else {
                        messageQueue.unshift(msg);
                        break;
                    }
                }
            });

            geminiWs.on('message', (message) => {
                if (clientWs.readyState === WebSocket.OPEN) {
                    clientWs.send(message);
                }
            });

            geminiWs.on('close', (code, reason) => {
                if (clientWs.readyState === WebSocket.OPEN || clientWs.readyState === WebSocket.CONNECTING) {
                    clientWs.close(code, reason.toString());
                }
            });

            geminiWs.on('error', (error) => {
                console.error('Upstream WS error:', error);
                if (clientWs.readyState === WebSocket.OPEN || clientWs.readyState === WebSocket.CONNECTING) {
                    clientWs.close(1011, 'Upstream WebSocket error');
                }
            });

            clientWs.on('message', (message) => {
                if (geminiWs.readyState === WebSocket.OPEN) {
                    geminiWs.send(message);
                } else if (geminiWs.readyState === WebSocket.CONNECTING) {
                    messageQueue.push(message);
                } else {
                    console.warn('Client sent message but upstream WS not open/connecting. Dropping.');
                }
            });

            clientWs.on('close', (code, reason) => {
                if (geminiWs.readyState === WebSocket.OPEN || geminiWs.readyState === WebSocket.CONNECTING) {
                    geminiWs.close(code, reason.toString());
                }
            });

            clientWs.on('error', (error) => {
                console.error('Client WS error:', error);
                if (geminiWs.readyState === WebSocket.OPEN || geminiWs.readyState === WebSocket.CONNECTING) {
                    geminiWs.close(1011, 'Client WebSocket error');
                }
            });
        });
    } catch (err) {
        console.error('WS upgrade handler error:', err);
        socket.destroy();
    }
}

module.exports = {
    router,
    handleWsUpgrade
};
