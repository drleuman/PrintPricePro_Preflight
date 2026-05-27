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
 * Proxies requests from /api/preflight to the internal PPOS Service.
 * Phase 4.1: Internal Reverse Proxy.
 */

router.use('/', async (req, res) => {
    // Correctly reconstruct the target URL including the mandatory /api/preflight prefix
    const targetUrl = `${pposConfig.preflightServiceUrl.replace(/\/$/, '')}/api/preflight${req.url}`;
    
    console.log(`[PROXY][PPOS] ${req.method} ${req.url} -> ${targetUrl}`);

    try {
        // CLONE HEADERS & FORCE INTERNAL IDENTITY
        const headers = { ...req.headers };

        // Clean headers to avoid host/re-request conflicts
        delete headers.host;
        delete headers.connection;
        delete headers['content-length']; // Let axios/form-data recalculate
        
        // Inject Canonical Internal Identity (JWT Bearer)
        const authHeaders = identityService.getAuthHeaders(req.auth || req.user || {});
        Object.assign(headers, authHeaders);

        console.log(`[PROXY][${req.id || 'system'}][AUTH] Identity Unified: tokenSnippet: ${headers.Authorization?.slice(0, 30)}...`);

        // Legacy cleanup (no longer needed if OS expects JWT)
        delete headers['x-ppos-api-key'];

        const isReportRequest = req.method === 'GET' && (req.url.endsWith('.json') || req.url.includes('/analysis_report') || req.url.includes('/audit_report') || req.url.includes('/report.json') || req.url.includes('/fix_audit.json'));
        const isJsonExpected = req.method === 'GET' && (
            req.url.includes('/jobs/') ||
            isReportRequest
        ) && !req.url.endsWith('.pdf') && !req.url.includes('/artifacts/certified_pdf') && !req.url.includes('/artifacts/fixed_pdf') && !req.url.includes('/artifacts/final_fixed_pdf') && !req.url.includes('/artifacts/review_pdf');

        const response = await axios({
            method: req.method,
            url: targetUrl,
            data: req.body,
            headers: headers,
            params: req.query,
            responseType: isJsonExpected ? 'text' : 'stream',
            validateStatus: () => true, // Proxy all status codes
            timeout: pposConfig.longTimeoutMs
        });

        // Set response headers from upstream
        Object.entries(response.headers).forEach(([key, value]) => {
            res.setHeader(key, value);
        });

        res.status(response.status);

        if (isJsonExpected && response.status >= 200 && response.status < 300) {
            let data = response.data;
            try {
                let json = typeof data === 'string' ? JSON.parse(data) : data;
                if (json) {
                    const preflightNormalizer = require('../services/preflightNormalizer');
                    // calls maybeNormalizeAutofixReportArtifact internally or via new helper
                    json = preflightNormalizer.normalizeAutofixResultState(json);
                    
                    let normalizedReport = null;
                    if (json.type === 'AUTOFIX') {
                        normalizedReport = json;
                    } else {
                        const nestedToCheck = [
                            json.result,
                            json.data?.result,
                            json.report,
                            json.data?.report,
                            json.job?.result,
                            json.job?.report,
                            json.fixResult,
                            json.autofixResult
                        ];
                        normalizedReport = nestedToCheck.find(r => r?.type === 'AUTOFIX');
                    }

                    if (normalizedReport) {
                        const match = req.url.match(/\/jobs\/([^\/]+)/);
                        const jobId = match ? match[1] : 'unknown';

                        if (isReportRequest) {
                            res.setHeader('X-PPOS-Autofix-Normalized', 'true');
                            res.setHeader('X-PPOS-Autofix-Status', normalizedReport.status || 'COMPLETED_WITH_REVIEW');
                            
                            const artifactMatch = req.url.match(/\/artifacts\/([^\/?#]+)/);
                            const artifactId = artifactMatch ? artifactMatch[1] : 'report.json';
                            
                            console.log(`[AUTOFIX_REPORT_NORMALIZED_AT_DOWNLOAD]\nroute=preflightProxy\njobId=${jobId}\nartifactId=${artifactId}\nstatus=${normalizedReport.status}`);
                        } else {
                            res.setHeader('X-PPOS-Autofix-Result-Normalized', 'true');
                            res.setHeader('X-PPOS-Autofix-Status', normalizedReport.status || 'COMPLETED_WITH_REVIEW');
                            
                            console.log(`[AUTOFIX_RESULT_NORMALIZED_FOR_FRONTEND]\nroute=preflightProxy\njobId=${jobId}\nstatus=${normalizedReport.status}`);
                        }
                    }
                }
                const finalBuf = Buffer.from(JSON.stringify(json, null, 2));
                res.setHeader('Content-Type', 'application/json');
                res.setHeader('Content-Length', finalBuf.length);
                return res.end(finalBuf);
            } catch (e) {
                console.warn(`[AUTOFIX_RESULT_NORMALIZATION_SKIPPED]\nreason=${e.message}\nroute=preflightProxy`);
                return res.send(data);
            }
        } else {
            if (isJsonExpected) {
                return res.send(response.data);
            } else {
                response.data.pipe(res);
            }
        }

    } catch (error) {
        console.error(`[PROXY][PPOS-ERROR] ${req.method} ${req.url}:`, error.message);
        if (!res.headersSent) {
            res.status(502).json({
                error: 'PPOS_GATEWAY_ERROR',
                message: 'Failed to proxy request to PPOS Service',
                details: error.message,
                traceId: req.headers['x-request-id'] || 'system',
                v2: true
            });
        }
    }
});

module.exports = router;
