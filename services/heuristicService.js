const { spawnSafe } = require('./processRunner');
const { resolveGsCmd } = require('./ghostscript');

const GS_CMD = resolveGsCmd();

class HeuristicService {
    /**
     * Detects image resolution using Poppler's pdfimages -list.
     */
    async getImageHeuristics(filePath) {
        try {
            const { stdout } = await spawnSafe('pdfimages', ['-list', filePath]);
            const lines = stdout.split('\n');
            const images = [];

            // Example headers: page num type width height color comp bpc enc interp object ID x-ppi y-ppi size ratio
            // Skip headers (first 2 lines)
            for (let i = 2; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue;

                const parts = line.split(/\s+/);
                if (parts.length < 13) continue;

                const ppiX = parseInt(parts[12], 10);
                const ppiY = parseInt(parts[13], 10);

                images.push({
                    page: parseInt(parts[0], 10),
                    width: parseInt(parts[3], 10),
                    height: parseInt(parts[4], 10),
                    ppi: Math.min(ppiX, ppiY) || 0
                });
            }

            const lowResImages = images.filter(img => img.ppi > 0 && img.ppi < 150);

            return {
                totalImages: images.length,
                lowResCount: lowResImages.length,
                minPpi: Math.min(...images.map(img => img.ppi)) || null,
                findings: lowResImages.length > 0 ? [{
                    id: 'low-resolution-images',
                    severity: 'warning',
                    details: `Detected ${lowResImages.length} images with resolution below 150 DPI.`
                }] : []
            };
        } catch (err) {
            console.error('[HEURISTIC-SERVICE] pdfimages failed:', err.message);
            return { totalImages: 0, findings: [] };
        }
    }

    /**
     * Determines the "Edition Intent" based on document geometry and metadata.
     */
    classifyEditionIntent(info) {
        const signals = [];
        const pages = info.pages || 0;

        // Signal: Book/Long-form
        if (pages >= 48) {
            signals.push({
                id: 'long-form-intent',
                title: 'Book/Catalog detected',
                confidence: 0.9,
                user_message: "This document has a high page count, typical of books or catalogs."
            });
        } else if (pages >= 4 && pages % 4 === 0) {
            signals.push({
                id: 'brochure-intent',
                title: 'Brochure layout detected',
                confidence: 0.7,
                user_message: "Page count is a multiple of 4, suggestive of a folded brochure or booklet."
            });
        }

        return signals;
    }

    /**
     * Detects if text has been converted to outlines (paths).
     * Heuristic: High page complexity + Very low font count.
     */
    detectVectorTextRisk(info, fonts) {
        if (info.pages > 0 && fonts.length === 0) {
            // Document has pages but NO fonts. Likely vector-only or text-to-outlines.
            return [{
                id: 'text-outline-risk',
                severity: 'info',
                details: "No fonts detected. The text might be converted to outlines, which limits searchability and last-minute edits."
            }];
        }
        return [];
    }
}

module.exports = new HeuristicService();
