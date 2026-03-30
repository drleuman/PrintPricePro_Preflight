'use strict';

/**
 * app/services/apiClient.js
 * 
 * Centralized API client for PrintPrice OS (PPOS) Integration.
 * Replaces hardcoded URLs with environment-driven configuration.
 */

const pposConfig = require('../../config/ppos');

function isNativeFormData(body) {
    return (
        typeof FormData !== 'undefined' &&
        body instanceof FormData
    );
}

/**
 * Standard request helper for PPOS services.
 * 
 * @param {string} path - API endpoint path (e.g., '/preflight/analyze')
 * @param {Object} options - Fetch options (method, headers, body)
 * @returns {Promise<Response>}
 */
async function pposRequest(path, options = {}) {
    const baseUrl = pposConfig.preflightServiceUrl;
    
    if (!baseUrl) {
        throw new Error('[API-CLIENT] PPOS_SERVICE_URL not defined');
    }

    const isAbsolutePath = path && (path.startsWith('http://') || path.startsWith('https://'));
    const url = isAbsolutePath ? path : `${baseUrl.replace(/\/$/, '')}${path}`;
    
    const body = options.body;
    const nativeMultipart = isNativeFormData(body);
    const incomingHeaders = { ...(options.headers || {}) };

    const hasExplicitContentType = Object.keys(incomingHeaders).some(
        h => h.toLowerCase() === 'content-type'
    );

    const headers = {
        ...(pposConfig.apiKey ? { 'x-ppp-api-key': pposConfig.apiKey } : {}),
        ...incomingHeaders
    };

    // Only inject JSON content-type for non-FormData requests that do not already define one.
    if (!nativeMultipart && !hasExplicitContentType) {
        headers['Content-Type'] = 'application/json';
    }

    // Never forward an explicit multipart Content-Type for native FormData.
    // fetch/undici must generate the boundary automatically.
    if (nativeMultipart) {
        for (const key of Object.keys(headers)) {
            if (key.toLowerCase() === 'content-type') {
                delete headers[key];
            }
        }
    }

    const mergedOptions = {
        ...options,
        headers
    };

    console.log(`[PPOS-API] Requesting: ${options.method || 'GET'} ${url}`);
    console.log('[PPOS-API][DEBUG]', {
        method: options.method || 'GET',
        url,
        nativeMultipart,
        hasExplicitContentType,
        headerKeys: Object.keys(headers)
    });

    try {
        const response = await fetch(url, mergedOptions);
        
        if (!response.ok) {
            const errorBody = await response.clone().text();
            console.error(`[PPOS-API] Error response from ${url}: ${response.status} - ${errorBody}`);
        }
        
        return response;
    } catch (error) {
        console.error(`[PPOS-API] Network error requesting ${url}:`, error.message);
        throw error;
    }
}

module.exports = {
    pposRequest
};
