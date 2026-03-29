'use strict';

/**
 * app/services/apiClient.js
 * 
 * Centralized API client for PrintPrice OS (PPOS) Integration.
 * Replaces hardcoded URLs with environment-driven configuration.
 */

const pposConfig = require('../../config/ppos');

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

    const url = `${baseUrl.replace(/\/$/, '')}${path}`;
    
    const headers = {
        'Content-Type': 'application/json',
        'x-ppp-api-key': pposConfig.apiKey,
        ...options.headers
    };

    // If an explicit content-type was provided in ANY casing (e.g. 'content-type' from form-data),
    // we must remove the default 'Content-Type' to avoid duplicate headers.
    const hasExplicitContentType = Object.keys(options.headers || {}).some(
        h => h.toLowerCase() === 'content-type'
    );
    if (hasExplicitContentType) {
        delete headers['Content-Type'];
    }

    const mergedOptions = {
        ...options,
        headers
    };

    console.log(`[PPOS-API] Requesting: ${options.method || 'GET'} ${url}`);

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
