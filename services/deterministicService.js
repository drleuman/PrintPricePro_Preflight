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

        return results;
    }

    async getPdfInfo(filePath) {
        try {
            const { stdout } = await spawnSafe('pdfinfo', ['-box', filePath], { timeout: 30000 });
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
            const { stdout } = await spawnSafe('pdffonts', [filePath], { timeout: 30000 });
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
}

module.exports = new DeterministicService();
