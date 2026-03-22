'use strict';

const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const pposConfig = require('../../config/ppos');
const identityService = require('./identityService');

const SERVICE_URL = pposConfig.preflightServiceUrl;

/**
 * Handles PPOS Service errors with a consistent product policy.
 */
function handleServiceError(error, context) {
    const status = error.response ? error.response.status : 'NETWORK_ERROR';
    const message = error.response?.data?.error || error.message;
    
    console.error(`[PPOS-INTEGRATION-ERROR][${context}] Status: ${status} | Message: ${message}`);
    
    // In decoupled mode, we throw to let the product route handle UI feedback.
    const productError = new Error(`Preflight Service ${context} failed: ${message}`);
    productError.status = status;
    productError.code = 'PPOS_SERVICE_FAILURE';
    throw productError;
}

/**
 * PdfPipeline (Phase 18.C - Decoupled)
 * 
 * Provides an orchestrating interface for PDF processing via PrintPrice OS Services.
 * Delegating all deterministic execution to the platform layer.
 */

// Mapping of profile names (Legacy support)
function normalizeProfile(p) {
    if (!p) return 'iso_coated_v3';
    const low = p.toLowerCase();
    if (low.includes('fogra51') || low.includes('coated_v3')) return 'iso_coated_v3';
    if (low.includes('fogra52') || low.includes('uncoated_v3')) return 'iso_uncoated_v3';
    return low.replace(/[^a-z0-9_]/g, '_');
}

module.exports = {
    /**
     * Legacy command execution. Now delegating to PPOS Service /analyze.
     */
    async execCmd(cmd, args, opts = {}) {
        console.log(`[PIPELINE][SERVICE-DELEGATION] cmd: ${cmd}`);

        if (cmd === 'gs' && args.includes('pdfwrite')) {
             return { skipped: true, note: 'Redirecting to specialized converters' };
        }

        const filePath = opts.metadata?.filePath || args[args.length - 1];
        if (filePath && fs.existsSync(filePath)) {
            const form = new FormData();
            form.append('file', fs.createReadStream(filePath));
            
            try {
                const headers = { 
                    ...form.getHeaders(),
                    ...identityService.getAuthHeaders()
                };

                const response = await axios.post(`${SERVICE_URL}${pposConfig.routes.analyze}`, form, {
                    headers,
                    timeout: pposConfig.timeoutMs
                });

                // Return delegated results
                return response.data.data;
            } catch (err) {
                handleServiceError(err, 'ANALYZE');
            }
        }
        
        throw new Error(`Execution failed: Unsupported command or missing file in decoupled mode.`);
    },

    /**
     * Color Conversion Proxy.
     */
    async gsConvertColor(input, output, profile, opts = {}) {
        const prof = normalizeProfile(profile);
        console.log(`[PIPELINE][SERVICE-DELEGATION] Color Conversion -> ${prof}`);

        const form = new FormData();
        form.append('file', fs.createReadStream(input));

        try {
            const headers = { 
                ...form.getHeaders(),
                ...identityService.getAuthHeaders()
            };

            const response = await axios.post(`${SERVICE_URL}${pposConfig.routes.autofix}?fix=color&profile=${prof}`, form, {
                headers,
                responseType: 'arraybuffer',
                timeout: pposConfig.longTimeoutMs
            });

            await fs.promises.writeFile(output, Buffer.from(response.data));
            return { success: true, output };
        } catch (err) {
            handleServiceError(err, 'AUTOFIX_COLOR');
        }
    },

    /**
     * Bleed Application Proxy.
     */
    async addBleedCanvasPdf(inputPath, outPath, bleedMm = 3) {
        console.log(`[PIPELINE][SERVICE-DELEGATION] Bleed Application -> ${bleedMm}mm`);

        const form = new FormData();
        form.append('file', fs.createReadStream(inputPath));

        try {
            const headers = { 
                ...form.getHeaders(),
                ...identityService.getAuthHeaders()
            };

            const response = await axios.post(`${SERVICE_URL}${pposConfig.routes.autofix}?fix=bleed&bleedMm=${bleedMm}`, form, {
                headers,
                responseType: 'arraybuffer',
                timeout: pposConfig.longTimeoutMs
            });

            await fs.promises.writeFile(outPath, Buffer.from(response.data));
            return { success: true, outPath };
        } catch (err) {
            handleServiceError(err, 'AUTOFIX_BLEED');
        }
    },

    // Legacy Stubs for backward compatibility
    normalizeProfile,
    gsFlattenTransparency: async (i, o) => module.exports.gsConvertColor(i, o, 'cmyk', { flatten: true }),
    rebuildAtDpi: async (i, o, dpi = 300) => module.exports.gsConvertColor(i, o, 'cmyk', { dpi })
};






















