const fs = require('fs');
const { PDFDocument } = require('pdf-lib');
const path = require('path');

async function validatePdf(filePath) {
    console.log(`\n🔍 Validating Prepress Geometry: ${path.basename(filePath)}`);
    console.log(`===========================================================`);

    const buffer = fs.readFileSync(filePath);
    const pdfDoc = await PDFDocument.load(buffer);
    const pages = pdfDoc.getPages();

    pages.forEach((page, i) => {
        const { width, height } = page.getSize();
        const mediaBox = page.getMediaBox();
        const cropBox = page.getCropBox();
        const bleedBox = page.getBleedBox();
        const trimBox = page.getTrimBox();
        const artBox = page.getArtBox();

        console.log(`\n📄 Page ${i + 1}:`);
        console.log(`   - Size: ${width.toFixed(2)}pt x ${height.toFixed(2)}pt`);
        console.log(`   - MediaBox: [${mediaBox.x}, ${mediaBox.y}, ${mediaBox.width}, ${mediaBox.height}]`);
        console.log(`   - TrimBox:  [${trimBox.x}, ${trimBox.y}, ${trimBox.width}, ${trimBox.height}] ${isMatch(trimBox, { x: 0, y: 0, width, height }) ? '✅ (Standard)' : '⚠️ (Custom)'}`);
        console.log(`   - BleedBox: [${bleedBox.x}, ${bleedBox.y}, ${bleedBox.width}, ${bleedBox.height}]`);

        // Calculate bleed in mm
        const bleedLeft = -bleedBox.x * 25.4 / 72;
        const bleedBottom = -bleedBox.y * 25.4 / 72;
        const bleedRight = (bleedBox.width - trimBox.width + bleedBox.x) * 25.4 / 72;
        const bleedTop = (bleedBox.height - trimBox.height + bleedBox.y) * 25.4 / 72;

        console.log(`   - Calculated Bleed (mm): L:${bleedLeft.toFixed(1)} B:${bleedBottom.toFixed(1)} R:${bleedRight.toFixed(1)} T:${bleedTop.toFixed(1)}`);

        if (Math.abs(bleedLeft - 3) < 0.1) {
            console.log(`   - Status: ✅ 3mm Bleed Detected`);
        } else {
            console.log(`   - Status: ℹ️ Non-standard bleed or no bleedBox set.`);
        }
    });

    console.log(`\n✅ Geometric check complete.`);
}

function isMatch(box, target) {
    return Math.abs(box.x - target.x) < 1 &&
        Math.abs(box.y - target.y) < 1 &&
        Math.abs(box.width - target.width) < 1 &&
        Math.abs(box.height - target.height) < 1;
}

const targetFile = process.argv[2];
if (!targetFile) {
    console.error('Usage: node scripts/validate_prepress.js <path_to_pdf>');
    process.exit(1);
}

validatePdf(targetFile).catch(err => {
    console.error('Error during validation:', err);
    process.exit(1);
});
