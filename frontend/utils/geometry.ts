import { ISSUE_CATEGORY, Severity } from '../types';

export interface GeometryInput {
    pageCount: number;
    paperType: 'coated' | 'uncoated';
    paperGsm?: number;
    trimWidthMm: number;
    trimHeightMm: number;
    bleedMm: number;
    pdfPageSizes: { widthMm: number; heightMm: number }[];
}

export interface SpineResult {
    expectedSpineMm: number;
    detectedSpineMm: number;
    deviationMm: number;
    classification: 'GREEN' | 'ATTENTION' | 'BLOCKING';
    coverType: 'single_page' | 'spread_cover' | 'unknown';
}

/**
 * PRODUCTION GEOMETRY MODULE
 * Measure → Classify → Certify
 */
export function validateGeometry(input: GeometryInput) {
    const { pageCount, paperType, paperGsm, pdfPageSizes, trimWidthMm } = input;

    // 1. Detect cover type
    let coverType: 'single_page' | 'spread_cover' | 'unknown' = 'unknown';
    let detectedSpineMm = 0;

    // Check first page size to determine cover structure
    if (pdfPageSizes.length > 0) {
        const firstPage = pdfPageSizes[0];
        const spreadWidthThreshold = (trimWidthMm * 2);

        if (Math.abs(firstPage.widthMm - trimWidthMm) < 5) {
            coverType = 'single_page';
        } else if (firstPage.widthMm > spreadWidthThreshold) {
            coverType = 'spread_cover';
            // Spine is the middle part: Width - 2*TrimWidth
            detectedSpineMm = firstPage.widthMm - (trimWidthMm * 2);
        }
    }

    // 2. Calculate expected spine width
    // spine_mm = page_count / 2 * paper_thickness
    let thickness = 0.1; // Default
    if (paperType === 'uncoated') {
        if (paperGsm === 80) thickness = 0.10;
        else if (paperGsm === 90) thickness = 0.11;
        else thickness = 0.105; // Average
    } else if (paperType === 'coated') {
        if (paperGsm === 115) thickness = 0.09;
        else if (paperGsm === 130) thickness = 0.10;
        else if (paperGsm === 150) thickness = 0.11;
        else thickness = 0.10;
    }

    const expectedSpineMm = (pageCount / 2) * thickness;

    // 3. Compare and classify
    let classification: 'GREEN' | 'ATTENTION' | 'BLOCKING' = 'GREEN';
    let deviationMm = 0;

    if (coverType === 'spread_cover') {
        deviationMm = Math.abs(detectedSpineMm - expectedSpineMm);
        if (deviationMm <= 0.3) {
            classification = 'GREEN';
        } else if (deviationMm <= 0.8) {
            classification = 'ATTENTION';
        } else {
            classification = 'BLOCKING';
        }
    }

    return {
        coverType,
        expectedSpineMm: Number(expectedSpineMm.toFixed(2)),
        detectedSpineMm: Number(detectedSpineMm.toFixed(2)),
        deviationMm: Number(deviationMm.toFixed(2)),
        classification
    };
}
