'use strict';

/**
 * app/services/apiClient.js
 * 
 * Centralized API client for PrintPrice OS (PPOS) Integration.
 * Replaces hardcoded URLs with environment-driven configuration.
 */

const axios = require('axios');
const pposConfig = require('../../config/ppos');
const identityService = require('./identityService');


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
    
    const nativeFormData = 
        typeof FormData !== 'undefined' && 
        body instanceof FormData;

    const nodeFormData = 
        body && 
        typeof body.getHeaders === 'function' && 
        typeof body.append === 'function';

    const multipartBody = nativeFormData || nodeFormData;
    const incomingHeaders = { ...(options.headers || {}) };

    // REQUIREMENT 4: Authorization Fallback (Injection)
    // If the request arrives without Authorization, we inject a signed service token.
    if (!incomingHeaders.Authorization && !incomingHeaders.authorization) {
        const fallback = identityService.getAuthHeaders({ sub: 'ppos-bff-client' });
        incomingHeaders.Authorization = fallback.Authorization;
        console.log('[API-CLIENT][AUTH-INJECTED] Fallback service token used for:', path);
    }

    const hasExplicitContentType = Object.keys(incomingHeaders).some(
        h => h.toLowerCase() === 'content-type'
    );

    const headers = {
        ...(pposConfig.apiKey ? { 'x-ppp-api-key': pposConfig.apiKey } : {}),
        'X-Deployment-Id': process.env.DEPLOYMENT_ID || 'local-dev',
        'X-Tenant-Id': process.env.PPOS_INTERNAL_TENANT_ID || 'ppos-production-worker',
        ...incomingHeaders
    };

    // Only inject JSON content-type for non-FormData requests that do not already define one.
    if (!multipartBody && !hasExplicitContentType) {
        headers['Content-Type'] = 'application/json';
    }

    // Never forward an explicit multipart Content-Type for native FormData.
    // fetch/undici must generate the boundary automatically.
    // However, for Node 'form-data', we MUST keep the content-type (bound by form.getHeaders()).
    if (nativeFormData) {
        for (const key of Object.keys(headers)) {
            if (key.toLowerCase() === 'content-type') {
                delete headers[key];
            }
        }
    }

    if (nodeFormData) {
        console.log('[PPOS-API][AXIOS-MULTIPART]', {
            method: options.method || 'POST',
            url,
            headerKeys: Object.keys(headers)
        });

        try {
            const axiosResponse = await axios({
                method: options.method || 'POST',
                url,
                headers,
                data: body,
                maxBodyLength: Infinity,
                maxContentLength: Infinity,
                validateStatus: () => true
            });

            const responseLike = {
                ok: axiosResponse.status >= 200 && axiosResponse.status < 300,
                status: axiosResponse.status,
                headers: axiosResponse.headers,
                async text() {
                    if (typeof axiosResponse.data === 'string') return axiosResponse.data;
                    return JSON.stringify(axiosResponse.data ?? {});
                },
                async json() {
                    if (typeof axiosResponse.data === 'string') {
                        try {
                            return JSON.parse(axiosResponse.data);
                        } catch {
                            return { raw: axiosResponse.data };
                        }
                    }
                    return axiosResponse.data ?? {};
                },
                clone() {
                    return this;
                }
            };

            if (!responseLike.ok) {
                const errorBody = await responseLike.text();
                console.error(`[PPOS-API] Error response from ${url}: ${responseLike.status} - ${errorBody}`);
            }

            return responseLike;
        } catch (error) {
            console.error(`[PPOS-API] Network error requesting ${url}:`, error.message);
            throw error;
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
        nativeFormData,
        nodeFormData,
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
