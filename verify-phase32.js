/**
 * Verification Script: Phase 32 Editorial Geometry
 * Tests page box extraction, bleed calculation, and document classification.
 */

const { getPdfGeometryGS } = require('./utils-server/pdfInfo');
const { auditBleed, classifyDocument } = require('./services/geometryAuditService');
const path = require('path');
const fs = require('fs');

async function testGeometry() {
    console.log('--- Phase 32: Editorial Geometry Verification ---');

    // We'll use a known PDF from the project or a placeholder
    // For verification purposes, we'll try to find any PDF in the uploads or project
    const testPdf = path.join(process.cwd(), 'test-assets', 'sample.pdf');

    // Fallback: If no test-assets/sample.pdf, we'll use a mocked geometry for the logic test
    if (!fs.existsSync(testPdf)) {
        console.warn('⚠️ No physical test PDF found at test-assets/sample.pdf. Running logic validation with mocked data.');

        const mockGeometry = {
            mediaBox: [0, 0, 612, 792], // US Letter
            trimBox: [9, 9, 603, 783],  // 1/8" (9pt) margin
            bleedBox: [0, 0, 612, 792]  // Matches MediaBox
        };

        const bleedResult = auditBleed(mockGeometry);
        const classification = classifyDocument(mockGeometry, 1);

        console.log('Mocked Geometry Audit:');
        console.log('- MediaBox:', mockGeometry.mediaBox);
        console.log('- TrimBox:', mockGeometry.trimBox);
        console.log('- BleedBox:', mockGeometry.bleedBox);
        console.log('- Classification:', classification);
        console.log('- Bleed Status:', bleedResult.status);
        console.log('- Bleed Values (mm):', JSON.stringify(bleedResult.bleed, null, 2));

        if (bleedResult.bleed.top.toFixed(1) === '3.2') {
            console.log('✅ Logic Validation PASSED (9pt = 3.175mm)');
        } else {
            console.error('❌ Logic Validation FAILED');
        }
        return;
    }

    try {
        console.log(`Extracting geometry from: ${testPdf}`);
        const geometry = await getPdfGeometryGS(testPdf);
        console.log('Extracted Geometry:', JSON.stringify(geometry, null, 2));

        if (geometry.mediaBox && geometry.trimBox && geometry.bleedBox) {
            console.log('✅ Extraction PASSED');
        } else {
            console.error('❌ Extraction FAILED (One or more boxes missing)');
        }

        const audit = auditBleed(geometry);
        console.log('Audit Result:', JSON.stringify(audit, null, 2));

    } catch (err) {
        console.error('❌ Verification FAILED:', err.message);
    }
}

testGeometry();
