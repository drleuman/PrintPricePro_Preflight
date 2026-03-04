const { spawnSafe } = require('./processRunner');
const colorService = require('./colorService');
const heuristicService = require('./heuristicService');
const os = require('os');
const path = require('path');
const fs = require('fs');
const { PDFDocument, PDFName } = require('pdf-lib');

class DeterministicService {
    /**
     * Analyzes a PDF using Poppler's pdfinfo and pdffonts.
     */
    async analyze(filePath) {
        const tmpDir = os.tmpdir();

        // pdf-lib inspection for dictionary keys
        const pdfBytes = fs.readFileSync(filePath);
        const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
        const catalog = pdfDoc.catalog;
        const hasOutputIntent = catalog.has(PDFName.of('OutputIntents'));

        const results = {
            info: await this.getPdfInfo(filePath),
            fonts: await this.getPdfFonts(filePath),
            color: await colorService.getInkCoverage(filePath),
            separations: await colorService.getSeparations(filePath, tmpDir),
            imageHeuristics: await heuristicService.getImageHeuristics(filePath),
            hasOutputIntent,
            findings: []
        };

        this.evaluateFindings(results);
        return results;
    }

    async getPdfInfo(filePath) {
        try {
            const { stdout } = await spawnSafe('pdfinfo', ['-box', filePath]);
            const lines = stdout.split('\n');
            const info = {};

            lines.forEach(line => {
                const parts = line.split(':');
                if (parts.length >= 2) {
                    const key = parts[0].trim();
                    const value = parts.slice(1).join(':').trim();
                    info[key] = value;
                }
            });

            return {
                pages: parseInt(info['Pages'], 10) || 0,
                pdfVersion: info['PDF version'] || 'unknown',
                fileSize: info['File size'] || 'unknown',
                hasBleedBox: !!info['BleedBox'],
                hasTrimBox: !!info['TrimBox'],
                mediaBox: info['MediaBox'],
                bleedBox: info['BleedBox'],
                trimBox: info['TrimBox']
            };
        } catch (err) {
            console.error('[DET-SERVICE] pdfinfo failed:', err.message);
            return { error: err.message };
        }
    }

    async getPdfFonts(filePath) {
        try {
            const { stdout } = await spawnSafe('pdffonts', [filePath]);
            const lines = stdout.split('\n');
            // Skip the first two header lines
            const fontLines = lines.slice(2).filter(l => l.trim().length > 0);

            return fontLines.map(line => {
                // Poppler pdffonts output uses fixed column widths.
                // name (column 0), type (column 37), emb (column 64), sub (column 68)
                // This regex is a simpler heuristic for parsing
                const parts = line.trim().split(/\s+/);
                return {
                    name: parts[0],
                    type: parts[1],
                    emb: parts[3] === 'yes',
                    sub: parts[4] === 'yes'
                };
            });
        } catch (err) {
            console.error('[DET-SERVICE] pdffonts failed:', err.message);
            return [];
        }
    }

    evaluateFindings(results) {
        const { info, fonts } = results;

        // 1. Font Findings
        if (fonts.length > 0) {
            const notEmbedded = fonts.filter(f => !f.emb);
            if (notEmbedded.length > 0) {
                results.findings.push({
                    id: 'fonts-not-embedded',
                    severity: 'error',
                    evidence: {
                        source: 'pdf_struct',
                        details: `Found ${notEmbedded.length} fonts not embedded: ${notEmbedded.map(f => f.name).join(', ')}`
                    }
                });
            }

            const type3 = fonts.filter(f => f.type === 'Type 3');
            if (type3.length > 0) {
                results.findings.push({
                    id: 'type3-fonts-present',
                    severity: 'warning',
                    evidence: {
                        source: 'pdf_struct',
                        details: `Found Type 3 (bitmap) fonts: ${type3.map(f => f.name).join(', ')}`
                    }
                });
            }
        }

        // 2. Geometry Findings
        if (info.pages > 0) {
            if (!info.hasBleedBox) {
                results.findings.push({
                    id: 'missing-bleed-info',
                    severity: 'warning',
                    evidence: {
                        source: 'pdf_struct',
                        details: 'BleedBox is not defined in the PDF dictionary.'
                    }
                });
            }
        }

        // 3. Color Findings (BE-402)
        if (results.separations && results.separations.hasSpots) {
            results.findings.push({
                id: 'spot-color-detected',
                severity: 'info',
                evidence: {
                    source: 'rip_probe',
                    details: `Found ${results.separations.spotColors.length} spot colors: ${results.separations.spotColors.join(', ')}`
                }
            });
        }

        if (!results.hasOutputIntent) {
            results.findings.push({
                id: 'missing-output-intent',
                severity: 'warning',
                evidence: {
                    source: 'pdf_dictionary',
                    details: 'No /OutputIntents found in PDF Catalog.'
                }
            });
        }

        // 4. Heuristic Findings (BE-501/2)
        if (results.imageHeuristics && results.imageHeuristics.findings) {
            results.findings.push(...results.imageHeuristics.findings.map(f => ({
                ...f,
                type: 'heuristic',
                evidence: { source: 'image_probe', details: f.details }
            })));
        }

        const editRisk = heuristicService.detectVectorTextRisk(info, fonts);
        if (editRisk.length > 0) {
            results.findings.push(...editRisk.map(f => ({
                id: f.id,
                severity: f.severity,
                type: 'heuristic',
                evidence: { source: 'font_heuristic', details: f.details }
            })));
        }

        const intents = heuristicService.classifyEditionIntent(info);
        intents.forEach(intent => {
            results.findings.push({
                id: intent.id,
                severity: 'info',
                type: 'heuristic',
                confidence: intent.confidence,
                evidence: {
                    source: 'layout_heuristic',
                    details: intent.user_message
                }
            });
        });
    }
}

module.exports = new DeterministicService();
