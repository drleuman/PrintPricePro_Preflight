import { ISSUE_CATEGORY, Severity } from '../types';

export interface EditionSignals {
    // Color
    avgTac: number;
    richBlackFrequency: number; // 0-1
    grayscalePercentage: number; // 0-1
    spotColorsCount: number;

    // Layout
    hasLargeBackgrounds: boolean;
    hasConsistentBleed: boolean;
    hasMarks: boolean; // Crop marks, registration, etc.
    isPageUniform: boolean;

    // Images
    dominantDpi: number;
    imageCompression: 'JPEG' | 'ZIP' | 'MIXED' | 'NONE';
    photoCoverage: number; // 0-1

    // Typography
    hasSmallReversedText: boolean;
    hasHairlines: boolean;
    hasKnockoutBlackText: boolean;
}

export interface EditionIntentResult {
    intent: 'OFFSET' | 'DIGITAL' | 'MIXED';
    confidence: number;
    offsetScore: number;
    digitalScore: number;
    recommendation: string;
}

/**
 * PRINT EDITION INTENT DETECTION MODULE
 * Architecture: Measure → Infer → Classify → Guide → Certify
 */
export function inferEditionIntent(signals: EditionSignals, currentProfile: 'coated' | 'uncoated'): EditionIntentResult {
    let offsetScore = 0;
    let digitalScore = 0;

    // --- INFERENCE LOGIC ---

    // 1. Color Patterns
    if (signals.richBlackFrequency > 0.3) offsetScore += 25;
    if (signals.avgTac > 220) offsetScore += 20;
    if (signals.grayscalePercentage > 0.8) digitalScore += 30;
    if (signals.spotColorsCount > 0) offsetScore += 25;
    if (signals.avgTac < 120 && signals.grayscalePercentage > 0.4) digitalScore += 20;

    // 2. Layout & Production Signals
    if (signals.hasMarks) offsetScore += 40;
    else digitalScore += 25; // No marks is a digital indicator

    if (signals.hasConsistentBleed) offsetScore += 15;
    else digitalScore += 10; // Inconsistent bleed is a digital indicator

    if (signals.hasLargeBackgrounds) offsetScore += 15;
    if (!signals.isPageUniform) digitalScore += 20;

    // 3. Image Characteristics
    if (signals.dominantDpi >= 300) offsetScore += 15;
    if (signals.dominantDpi < 220 && signals.dominantDpi > 0) digitalScore += 25;
    if (signals.imageCompression === 'ZIP') offsetScore += 10;
    // ZIP often used in high-end offset

    // 4. Typography & Prepress focus
    if (signals.hasKnockoutBlackText || signals.hasHairlines) offsetScore += 10;
    if (signals.hasSmallReversedText) offsetScore += 5;

    // Normalize Scores (0-100)
    offsetScore = Math.min(100, offsetScore);
    digitalScore = Math.min(100, digitalScore);

    // --- CLASSIFICATION ---
    let intent: 'OFFSET' | 'DIGITAL' | 'MIXED' = 'MIXED';
    let confidence = 0;

    if (offsetScore > 70 && offsetScore > digitalScore + 20) {
        intent = 'OFFSET';
        confidence = offsetScore;
    } else if (digitalScore > 70 && digitalScore > offsetScore + 20) {
        intent = 'DIGITAL';
        confidence = digitalScore;
    } else {
        intent = 'MIXED';
        confidence = Math.max(offsetScore, digitalScore, 50);
    }

    // --- GUIDANCE OUTPUT ---
    let recommendation = '';
    if (intent === 'OFFSET') {
        if (currentProfile === 'uncoated') {
            recommendation = 'Offset design detected. Heavy ink coverage may cause drying issues on uncoated papers.';
        } else {
            recommendation = 'Professional offset intent detected. Ideal for high-volume commercial printing.';
        }
    } else if (intent === 'DIGITAL') {
        if (currentProfile === 'coated') {
            recommendation = 'Digital/POD intent detected. Large solid areas may show banding on coated paper.';
        } else {
            recommendation = 'Digital printing intent detected. Suitable for short runs and print-on-demand.';
        }
    } else {
        recommendation = 'Mixed patterns detected. Output behavior may be inconsistent across different presses.';
    }

    return {
        intent,
        confidence,
        offsetScore,
        digitalScore,
        recommendation
    };
}
