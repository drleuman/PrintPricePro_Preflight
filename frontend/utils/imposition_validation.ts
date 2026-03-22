import { ISSUE_CATEGORY, Severity } from '../types';

export interface ImpositionMeasure {
    hasMixedTrimSizes: boolean;
    missingTrimBox: boolean;
    hasMixedRotations: boolean;
    hasAsymmetricBleed: boolean;
    hasZeroBleedPages: boolean;
    hasLandscapeInPortrait: boolean;
}

/**
 * IMPOSITION COMPATIBILITY MODULE
 */
export function validateImposition(measure: ImpositionMeasure) {
    const issues: { severity: Severity; message: string; category: any }[] = [];
    let score = 100;

    if (measure.hasMixedTrimSizes) {
        score -= 40;
        issues.push({
            severity: Severity.ERROR, // BLOCKING
            category: ISSUE_CATEGORY.PRODUCTION_GEOMETRY,
            message: 'Inconsistent trim sizes detected. Imposition software will require manual alignment.'
        });
    }

    if (measure.missingTrimBox) {
        score -= 30;
        issues.push({
            severity: Severity.ERROR, // BLOCKING
            category: ISSUE_CATEGORY.PRODUCTION_GEOMETRY,
            message: 'Missing TrimBox in some pages. Precise cutting cannot be guaranteed.'
        });
    }

    if (measure.hasMixedRotations) {
        score -= 15;
        issues.push({
            severity: Severity.WARNING, // ATTENTION
            category: ISSUE_CATEGORY.PRODUCTION_GEOMETRY,
            message: 'Mixed page rotations detected. Verify head-to-head orientation.'
        });
    }

    if (measure.hasAsymmetricBleed) {
        score -= 10;
        issues.push({
            severity: Severity.WARNING, // ATTENTION
            category: ISSUE_CATEGORY.PRODUCTION_GEOMETRY,
            message: 'Asymmetric bleed detected. Some edges may have less than 3mm.'
        });
    }

    if (measure.hasZeroBleedPages) {
        score -= 5;
        issues.push({
            severity: Severity.INFO,
            category: ISSUE_CATEGORY.PRODUCTION_GEOMETRY,
            message: 'Some pages have zero bleed. White borders may appear after cutting.'
        });
    }

    if (measure.hasLandscapeInPortrait) {
        score -= 10;
        issues.push({
            severity: Severity.INFO,
            category: ISSUE_CATEGORY.PRODUCTION_GEOMETRY,
            message: 'Landscape pages detected inside a portrait book. Manual imposition likely required.'
        });
    }

    score = Math.max(0, Math.min(100, score));

    return {
        score,
        issues,
        classification: score < 50 ? 'BLOCKING' : score < 85 ? 'ATTENTION' : 'GREEN'
    };
}
