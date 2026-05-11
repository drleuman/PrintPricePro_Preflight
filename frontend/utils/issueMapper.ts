import { Issue } from '../types';

/**
 * Maps technical issue codes to standardized English titles for the v2.4 Monolith interface.
 * This overrides any language sent by the backend to ensure a consistent English UI.
 */
export const translateIssueTitle = (issue: Issue | null | undefined, t: (key: string) => string): string => {
    if (!issue) return "Unknown Finding";

    const code = (issue.code || issue.id || "").toString().toUpperCase();

    // Map common PPOS engine codes to localized keys
    const codes: Record<string, string> = {
        'IND_GEOM': t('finding.geom_anomaly'),
        'IND_TYPE': t('finding.typography_integrity'),
        'IND_COLOR': t('finding.color_compliance'),
        'IND_BOX': t('finding.trim_anomaly'),
        'IND_IMAGE': t('finding.image_analysis'),
        'IND_BLEED': t('finding.bleed_exception'),
        'IND_TRIM': t('finding.trim_anomaly'),
        'IND_FONT': t('finding.typography_integrity'),
        'IND_BLACK': t('finding.ink_limit_violation'),
        'IND_SPOT': t('finding.spot_color_warning'),
        'IND_PDF': t('finding.pdf_compliance_error'),
        'IND_IMG': t('finding.image_analysis'),
        'IND_RESOLUTION': t('finding.resolution_fault'),
        'IND_METADATA': t('finding.metadata_fault'),
        'IND_TRANSPARENCY': t('finding.transparency_risk'),
        'TRIM_BOX_MISSING': t('finding.trim_anomaly'),
        'COLOR_RGB': t('finding.rgb_detected'),
        'IMAGE_LOW_RES': t('finding.low_res_asset'),
        'FONT_NOT_EMBEDDED': t('finding.unembedded_glyph'),
        'BLEED_MISSING': t('finding.bleed_exception'),
        'INTENT_BOOK': t('finding.book_intent'),
        'HEURISTIC_TEXT_OUTLINED': t('finding.text_outlined'),
    };

    if (codes[code]) return codes[code];

    // Fallback logic: Detect Spanish strings and return localized keys
    if (issue.title?.includes('marcas de corte') || issue.message?.includes('marcas de corte')) {
        return t('finding.trim_anomaly');
    }

    if (issue.title?.includes('Uso de RGB') || issue.message?.includes('Uso de RGB') || issue.title?.includes('perfiles no estándar')) {
        return t('finding.color_compliance');
    }

    // Default to the title provided, but we prefer localized keys for the UI
    return issue.title || issue.message || t('finding.critical_trace');
};
