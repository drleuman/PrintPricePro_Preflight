/**
 * Production Signal Service
 * 
 * Translates raw technical facts into boolean signals for 
 * production intent classification and binding analysis.
 */
class ProductionSignalService {
    /**
     * Extracts all signals from deterministic results.
     */
    extractSignals(analysisResults) {
        const info = analysisResults.info || {};
        const images = analysisResults.imageHeuristics || {};
        const pageCount = info.pages || 0;

        const signals = {};

        // 1. Page Count Buckets
        signals.page_bucket_very_low_to_low = pageCount > 0 && pageCount <= 48;
        signals.page_bucket_medium_to_very_high = pageCount > 48;
        signals.page_bucket_high_to_very_high = pageCount > 160;

        // 2. Trim Family (Heuristic based on info.trimBox if available)
        if (info.trimBox) {
            const dims = this.parseTrimBox(info.trimBox);
            const family = this.getTrimFamily(dims);

            signals.trim_family_pocket = family === 'pocket';
            signals.trim_family_pocket_or_trade = family === 'pocket' || family === 'trade';
            signals.trim_family_large_or_square = family === 'large' || family === 'square';
            signals.trim_family_large_format = family === 'large';
        }

        // 3. Image/Text Ratios (Heuristics)
        const totalImages = images.totalImages || 0;
        const avgImagesPerPage = pageCount > 0 ? totalImages / pageCount : 0;

        signals.image_area_ratio_gte_0_60 = avgImagesPerPage >= 2.0; // High image density
        signals.image_area_ratio_gte_0_40 = avgImagesPerPage >= 1.0;
        signals.image_area_ratio_lte_0_15 = avgImagesPerPage < 0.2;
        signals.text_area_ratio_gte_0_65 = avgImagesPerPage < 0.3; // High text density hint
        signals.text_area_ratio_gte_0_70 = avgImagesPerPage < 0.15;

        // 4. Binding & Structure Hints
        signals.binding_candidate_saddle = pageCount > 0 && pageCount <= 64 && pageCount % 4 === 0;

        // Spine width estimation
        const estSpine = (pageCount / 2) * 0.1; // Standard 80gsm fallback
        signals.spine_width_estimated_mm_lte_2 = estSpine <= 2.2;

        // 5. Placeholder for future signals
        signals.primary_language_text_dominant = signals.text_area_ratio_gte_0_65;
        signals.spine_zone_present = signals.page_bucket_medium_to_very_high; // Assume spine if book-ish

        return signals;
    }

    parseTrimBox(boxStr) {
        // Poppler format: "0 0 595.276 841.89"
        const pts = boxStr.split(/\s+/).map(Number);
        if (pts.length < 4) return { widthMm: 0, heightMm: 0 };

        const toMm = (pt) => pt * 0.3528;
        return {
            widthMm: toMm(pts[2] - pts[0]),
            heightMm: toMm(pts[3] - pts[1])
        };
    }

    getTrimFamily(dims) {
        const { widthMm, heightMm } = dims;
        if (widthMm === 0) return 'unknown';

        const area = widthMm * heightMm;
        const ratio = widthMm / heightMm;

        if (widthMm < 130 && heightMm < 200) return 'pocket';
        if (widthMm < 160 && heightMm < 240) return 'trade';
        if (Math.abs(ratio - 1) < 0.1) return 'square';
        if (widthMm > 210 || heightMm > 297) return 'large';
        return 'standard';
    }
}

module.exports = new ProductionSignalService();
