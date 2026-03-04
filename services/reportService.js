const fs = require('fs');
const path = require('path');

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
     * Builds a V2 Preflight Report from raw findings and metadata.
     */
    buildReport(asset, analysisResults, engines = {}) {
        const { info, fonts, findings: rawFindings } = analysisResults;

        const report = {
            document: {
                fileName: asset.filename,
                fileSize: asset.size,
                pageCount: info.pages || 0,
                pdfVersion: info.pdfVersion || 'unknown'
            },
            engines: {
                client_engine_version: engines.client || 'v2-stub',
                server_engine_version: engines.server || `v2-deterministic-1.0`
            },
            findings: []
        };

        // Merge and enrich findings using the registry
        rawFindings.forEach(raw => {
            const regEntry = this.registry[raw.id];
            if (regEntry) {
                report.findings.push({
                    id: raw.id,
                    title: regEntry.title,
                    type: regEntry.type,
                    severity: raw.severity || regEntry.severity,
                    confidence: raw.confidence || 1.0,
                    user_message: regEntry.user_message,
                    developer_message: raw.evidence ? raw.evidence.details : '',
                    tags: regEntry.tags || [],
                    evidence: raw.evidence || {},
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
                    developer_message: raw.evidence ? raw.evidence.details : '',
                    evidence: raw.evidence || {}
                });
            }
        });

        return report;
    }
}

module.exports = new ReportService();
