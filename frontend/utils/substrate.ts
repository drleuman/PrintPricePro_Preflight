import { ISSUE_CATEGORY, Severity } from '../types';

export interface SubstrateMeasure {
    paperType: 'coated' | 'uncoated';
    maxTac: number;
    hasLargeRichBlacks: boolean;
    hasSmallReversedText: boolean;
    avgInkCoverage: number;
    hasHeavyOverprint: boolean;
}

/**
 * PAPER PROFILE CONSTRAINTS MODULE
 */
export function validateSubstrate(measure: SubstrateMeasure) {
    const warnings: { type: string; message: string; severity: Severity }[] = [];

    if (measure.paperType === 'uncoated') {
        if (measure.maxTac > 260) {
            warnings.push({
                type: 'PHYSICS_WARNING',
                severity: Severity.WARNING,
                message: `Excessive TAC (${measure.maxTac}%) for Uncoated paper. Drying issues likely (Limit: 260%).`
            });
        }
        if (measure.hasLargeRichBlacks) {
            warnings.push({
                type: 'PHYSICS_WARNING',
                severity: Severity.WARNING,
                message: 'Large rich black areas detected on uncoated paper. Set-off risk is high.'
            });
        }
        if (measure.hasSmallReversedText) {
            warnings.push({
                type: 'PHYSICS_WARNING',
                severity: Severity.WARNING,
                message: 'Small reversed text over heavy background. Risk of ink filling (dot gain).'
            });
        }
    } else {
        // Coated
        if (measure.avgInkCoverage < 5 && measure.avgInkCoverage > 0) {
            warnings.push({
                type: 'PHYSICS_WARNING',
                severity: Severity.WARNING,
                message: 'Extremely low ink coverage detected (<5%). Risk of banding in smooth gradients.'
            });
        }
        if (measure.hasHeavyOverprint) {
            warnings.push({
                type: 'PHYSICS_WARNING',
                severity: Severity.WARNING,
                message: 'Heavy overprint areas (>280%) detected. Ink trapping may fail.'
            });
        }
    }

    return {
        warnings,
        riskLevel: warnings.length > 0 ? 'ATTENTION' : 'GREEN'
    };
}
