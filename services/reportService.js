/**
 * @project PrintPrice Pro - Report Generation & Validation
 * @author Manuel Enrique Morales (https://manuelenriquemorales.com/)
 * @social https://x.com/manuel_emorales | https://www.linkedin.com/in/manuelenriquemorales/
 */
const fs = require('fs');
const path = require('path');
const policyEngine = require('./policyEngine');

class ReportService {
    constructor() {
        const registryPath = path.join(__dirname, '..', 'registry', 'issue_registry.json');
        try {
            this.registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
        } catch (err) {
            console.error('[REPORT-SERVICE] Failed to load registry:', err.message);
            this.registry = {};
        }
    }

    /**
     * Sanitizes evidence to hide absolute server paths and limits length.
     */
    sanitizeEvidence(evidence) {
        if (!evidence || !evidence.details) return evidence;

        // Clone to avoid mutating original
        const safe = { ...evidence };
        let str = safe.details;

        if (typeof str === 'string') {
            // Redact Windows and Linux absolute paths
            str = str.replace(/[A-Z]:\\[^\s"'\n]+/gi, '[REDACTED_SECURE_TENANT_PATH]');
            str = str.replace(/(?:\/(?:var|usr|etc|opt|home|tmp)\/)[^\s"'\n]+/gi, '[REDACTED_SECURE_TENANT_PATH]');

            // Limit length
            const MAX_LEN = 10000; // 10K char limit for demo view
            if (str.length > MAX_LEN) {
                str = str.substring(0, MAX_LEN) + '\n\n... [TRUNCATED: Full log available via Audit Log API]';
            }
            safe.details = str;
        }
        return safe;
    }

    /**
     * Calculates a Risk Score (0-100).
     */
    calculateRiskScore(findings = []) {
        let score = 0;
        findings.forEach(f => {
            const severity = (f.severity || '').toUpperCase();
            if (severity === 'CRITICAL' || severity === 'ERROR') score += 30;
            else if (severity === 'WARNING') score += 10;
            else if (severity === 'INFO') score += 2;
        });
        return Math.min(100, score);
    }

    /**
     * Validates a report against the V2 internal schema.
     * Throws if critical fields are missing to prevent contract breakage.
     */
    validateReport(report) {
        const required = ['document', 'findings', 'risk_score', 'engines'];
        for (const field of required) {
            if (report[field] === undefined) {
                const err = new Error(`[REPORT-CONTRACT-VIOLATION] Missing required field: ${field}`);
                err.code = ErrorTaxonomy.REPORT_SCHEMA_VALIDATION_FAILED;
                throw err;
            }
        }

        if (!Array.isArray(report.findings)) {
            const err = new Error(`[REPORT-CONTRACT-VIOLATION] Findings must be an array`);
            err.code = ErrorTaxonomy.REPORT_SCHEMA_VALIDATION_FAILED;
            throw err;
        }

        // Deep check for findings
        report.findings.forEach((f, i) => {
            if (!f.id || !f.severity || !f.user_message) {
                const err = new Error(`[REPORT-CONTRACT-VIOLATION] Finding at index ${i} misses mandatory V2 fields (id, severity, user_message)`);
                err.code = ErrorTaxonomy.REPORT_SCHEMA_VALIDATION_FAILED;
                throw err;
            }
        });

        console.log(`[REPORT-VALIDATOR] Report for ${report.document?.fileName} passed V2 contract validation.`);
        return true;
    }

    /**
     * Builds a V2 Preflight Report from raw findings and metadata.
     */
    buildReport(asset, analysisResults, policyObj, engines = {}) {
        const { info, fonts } = analysisResults;

        // Generate findings dynamically based on policy
        const rawFindings = policyEngine.evaluateTechnicalRules(analysisResults, policyObj);

        const report = {
            // ...
            document: {
                fileName: asset.filename,
                fileSize: asset.size,
                pageCount: info.pages || 0,
                pdfVersion: info.pdfVersion || 'unknown'
            },
            engines: {
                client_engine_version: engines.client || 'v2-stub',
                server_engine_version: engines.server || `v2-deterministic-${process.env.GIT_COMMIT?.slice(0, 7) || '1.0'}`,
                policy_version: process.env.PPP_POLICY_VERSION || '2026-03'
            },
            findings: []
        };
        report.risk_score = this.calculateRiskScore(rawFindings);

        // Merge and enrich findings using the registry
        rawFindings.forEach(raw => {
            const regEntry = this.registry[raw.id];
            const safeEvidence = this.sanitizeEvidence(raw.evidence || {});

            if (regEntry) {
                report.findings.push({
                    id: raw.id,
                    title: regEntry.title,
                    type: regEntry.type,
                    severity: raw.severity || regEntry.severity,
                    confidence: raw.confidence || 1.0,
                    user_message: regEntry.user_message,
                    developer_message: safeEvidence.details || '',
                    tags: regEntry.tags || [],
                    evidence: safeEvidence,
                    fix: {
                        available: !!regEntry.fix,
                        applied: false,
                        step: regEntry.fix
                    }
                });
            } else {
                // Fallback for unregistered findings
                report.findings.push({
                    id: raw.id,
                    title: raw.id,
                    type: 'unknown',
                    severity: raw.severity || 'warning',
                    confidence: 0.5,
                    user_message: 'Unhandled preflight finding.',
                    developer_message: safeEvidence.details || '',
                    evidence: safeEvidence
                });
            }
        });

        this.validateReport(report);
        return report;
    }
    /**
     * Prunes a report for public consumption (removes sensitive telemetry).
     */
    pruneForPublic(report) {
        const publicReport = { ...report };
        delete publicReport.telemetry;
        return publicReport;
    }
}

module.exports = new ReportService();
