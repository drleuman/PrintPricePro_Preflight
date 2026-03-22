'use strict';

/**
 * services/queue.js
 * 
 * Decoupled Queue Bridge — Phase 18.C.
 * Instead of local BullMQ, this delegates enqueuing to the PPOS Preflight Service.
 */

const { pposRequest } = require('./apiClient');
const pposConfig = require('../../config/ppos');

const { generateToken } = require('../auth/generateToken');

/**
 * Handles PPOS Service errors with a consistent product policy.
 */
function handleServiceError(error, context) {
    const status = error.response ? error.response.status : 'NETWORK_ERROR';
    const message = error.response?.data?.error || (error.response?.data?.message) || error.message;
    
    console.error(`[PPOS-INTEGRATION-ERROR][${context}] Status: ${status} | Message: ${message}`);
    
    if (pposConfig.environment !== 'production' && status === 'NETWORK_ERROR') {
        console.warn(`[QUEUE] Non-production network error. Falling back to local mock.`);
        return { id: `mock-${Date.now()}`, status: 'LOCAL_PENDING' };
    }

    const productError = new Error(`Queue Service ${context} failed: ${message}`);
    productError.status = status;
    productError.code = 'PPOS_QUEUE_FAILURE';
    throw productError;
}

/**
 * Enqueue a job to the PPOS platform.
 */
async function enqueueJob(type, payload) {
    console.log(`[QUEUE] Delegating ${type} job to PPOS Service for tenant ${payload.tenant_id}...`);
    
    try {
        // Generate a Service-to-Service JWT for this operation
        const s2sToken = generateToken({
            userId: 'product-app-service',
            tenantId: payload.tenant_id,
            role: 'ADMIN',
            scopes: ['preflight:write', 'preflight:autofix', 'jobs:read', 'jobs:write']
        }, '5m'); // Short lived 5 mins

        const response = await pposRequest(pposConfig.routes.autofix, {
            method: 'POST',
            body: JSON.stringify({
                asset_id: payload.asset_id,
                policy: payload.policy || 'DEFAULT',
                metadata: {
                    origin: 'preflight-product-app',
                    timestamp: new Date().toISOString()
                }
            }),
            headers: { 
                'Authorization': `Bearer ${s2sToken}`
            },
            signal: AbortSignal.timeout(pposConfig.timeoutMs)
        });

        if (!response.ok) {
            throw new Error(`PPOS Service returned ${response.status}`);
        }

        const data = await response.json();

        if (data && data.job_id) {
            console.log(`[QUEUE] PPOS Job created: ${data.job_id}`);
            return {
                id: data.job_id,
                status: 'QUEUED'
            };
        }

        throw new Error('PPOS Service returned invalid job response');
    } catch (err) {
        return handleServiceError(err, 'ENQUEUE');
    }
}

module.exports = {
    enqueueJob
};






















