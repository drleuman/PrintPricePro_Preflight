import { Issue } from '../types';

/**
 * Maps technical issue codes to standardized English titles for the v2.4 Monolith interface.
 * This overrides any language sent by the backend to ensure a consistent English UI.
 */
export const translateIssueTitle = (issue: Issue | null | undefined, t: (key: string) => string): string => {
    if (!issue) return "Unknown Finding";

    const code = (issue.code || issue.id || "").toString().toUpperCase();

    // Map common PPOS engine codes to English canonical names
    const codes: Record<string, string> = {
        'IND_TRIM': 'TRIM BOX ANOMALY',
        'IND_COLOR': 'COLOR SPACE COMPLIANCE',
        'IND_IMG': 'IMAGE ASSET ANALYSIS',
        'IND_FONT': 'TYPOGRAPHY INTEGRITY',
        'IND_BLEED': 'BLEED ZONE EXCEPTION',
        'IND_RESOLUTION': 'RESOLUTION DENSITY FAULT',
        'IND_METADATA': 'METADATA STRUCTURE FAULT',
        'IND_TRANSPARENCY': 'TRANSPARENCY FLATTENING RISK',
        'TRIM_BOX_MISSING': 'TRIM BOX ANOMALY',
        'COLOR_RGB': 'RGB COLOR DETECTED',
        'IMAGE_LOW_RES': 'LOW RESOLUTION ASSET',
        'FONT_NOT_EMBEDDED': 'UNEMBEDDED GLYPH FAULT',
        'BLEED_MISSING': 'BLEED ZONE EXCEPTION',
    };

    if (codes[code]) return codes[code];

    // Fallback logic: Use the translation key if it exists, otherwise clean the string
    // If it's the specific "Problema con marcas de corte", we force the trim box key
    if (issue.title?.includes('marcas de corte') || issue.message?.includes('marcas de corte')) {
        return 'TRIM BOX ANOMALY';
    }

    // Default to the title provided, but we prefer standardized names for the "Forensic" look
    return issue.title || issue.message || "CRITICAL TRACE FINDING";
};
