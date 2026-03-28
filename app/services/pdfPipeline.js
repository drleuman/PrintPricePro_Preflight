'use strict';

/**
 * services/pdfPipeline.js
 * 
 * Decoupled PDF Pipeline Bridge — Phase 18.C.
 * Proxies legacy internal fix operations to the PPOS Service.
 */

const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const pposConfig = require('../../config/ppos');
const identityService = require('./identityService');

const SERVICE_URL = pposConfig.preflightServiceUrl;

/**
 * Handles PPOS Service errors with a consistent product policy.
 */
function handleServiceError(error, context) {
    const status = error.response ? error.response.status : 'NETWORK_ERROR';
    const message = error.response?.data?.error || error.message;
    
    console.error(`[PPOS-PIPELINE-ERROR][${context}] Status: ${status} | Message: ${message}`);
    
    const productError = new Error(`Pipeline ${context} failed: ${message}`);
    productError.status = status;
    throw productError;
}

const pdfPipeline = {
    /**
     * Executes internal fix commands (Bridge to PPOS /api/preflight/autofix).
     */
    async execCmd(cmd, args, context = {}) {
        const { metadata = {} } = context;
        const filePath = metadata.filePath;

        if (cmd === 'autofix') {
            const bleedMm = metadata.bleedMm || 3;
            const profile = metadata.profile || 'ISO_COATED_V2';
            
            if (metadata.profile) {
                return await this.autofixColor(filePath, filePath + '.fixed', profile);
            } else {
                return await this.addBleedCanvasPdf(filePath, filePath + '.fixed', bleedMm);
            }
        }

        throw new Error(`Execution failed: Unsupported command ${cmd} in decoupled mode.`);
    },

    /**
     * Color Normalization Proxy (DEPRECATED)
     */
    async autofixColor(inputPath, output, profString = 'ISO_COATED_V2') {
        throw new Error('LEGACY_REPAIR_DISABLED: Direct /autofix proxy is deprecated. Use V2 Jobs API.');
    },

    /**
     * Bleed Application Proxy (DEPRECATED)
     */
    async addBleedCanvasPdf(inputPath, outPath, bleedMm = 3) {
        throw new Error('LEGACY_REPAIR_DISABLED: Direct /bleed proxy is deprecated. Use V2 Jobs API.');
    }
};

module.exports = pdfPipeline;
