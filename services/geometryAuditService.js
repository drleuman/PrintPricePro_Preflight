/**
 * Editorial Geometry Audit Service
 * Validates professional print requirements: Bleed and Safe Area.
 */

/**
 * Calculates bleed width on all 4 sides based on TrimBox and BleedBox.
 * Units are in PDF points (1/72 inch).
 */
function auditBleed(geometry) {
    const { trimBox, bleedBox } = geometry;
    if (!trimBox || !bleedBox) return { status: 'WARNING', message: 'Missing TrimBox or BleedBox' };

    // [x1, y1, x2, y2]
    const bleedTop = bleedBox[3] - trimBox[3];
    const bleedBottom = trimBox[1] - bleedBox[1];
    const bleedLeft = trimBox[0] - bleedBox[0];
    const bleedRight = bleedBox[2] - trimBox[2];

    // Convert to mm (1 pt = 0.3528 mm)
    const toMm = (pt) => pt * 0.3528;

    const bleed = {
        top: toMm(bleedTop),
        bottom: toMm(bleedBottom),
        left: toMm(bleedLeft),
        right: toMm(bleedRight)
    };

    const minBleed = 3.0; // 3mm is the standard
    const isInsufficient = bleed.top < minBleed || bleed.bottom < minBleed || bleed.left < minBleed || bleed.right < minBleed;

    return {
        status: isInsufficient ? 'FAIL' : 'PASS',
        bleed,
        message: isInsufficient ? `Insufficient bleed detected (min ${minBleed}mm required)` : 'Bleed requirements met'
    };
}

/**
 * Estimates document classification and spine width.
 */
function classifyDocument(geometry, pageCount) {
    const { trimBox } = geometry;
    if (!trimBox) return { type: 'UNKNOWN', spineMm: 0 };

    const widthPt = trimBox[2] - trimBox[0];
    const heightPt = trimBox[3] - trimBox[1];
    const widthMm = widthPt * 0.3528;
    const heightMm = heightPt * 0.3528;

    let type = 'FLYER';
    let spineMm = 0;

    // Spine estimation logic (Standard 80gsm paper ~ 0.05mm per page)
    const estimSpine = (pages) => (pages / 2) * 0.1; // 0.1mm for 2 pages (1 sheet)

    if (pageCount === 1) {
        if (widthMm > 300 || heightMm > 400) type = 'POSTER';
        else type = 'FLYER';
    } else if (pageCount <= 8) {
        type = 'BROCHURE';
    } else if (pageCount > 40) {
        type = 'BOOK_INTERIOR';
        spineMm = estimSpine(pageCount);
    } else {
        type = 'MAGAZINE';
        spineMm = estimSpine(pageCount);
    }

    // Dimension labels (Heuristic)
    const isA4 = Math.abs(widthMm - 210) < 5 && Math.abs(heightMm - 297) < 5;
    const isA5 = Math.abs(widthMm - 148) < 5 && Math.abs(heightMm - 210) < 5;

    return {
        type,
        spineMm,
        format: isA4 ? 'A4' : isA5 ? 'A5' : `${Math.round(widthMm)}x${Math.round(heightMm)}mm`,
        pageCount
    };
}

module.exports = { auditBleed, classifyDocument };
