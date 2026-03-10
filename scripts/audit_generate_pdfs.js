const { PDFDocument, PDFName, PDFDict, PDFArray, PDFNumber, StandardFonts, rgb, cmyk, degrees, drawText, PDFOperator } = require('pdf-lib');
const fs = require('fs');
const path = require('path');

const outDir = path.join(__dirname, '..', 'test_suite_pdfs');

async function ensureDir() {
    if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true });
    }
}

async function savePdf(doc, filename) {
    const bytes = await doc.save();
    fs.writeFileSync(path.join(outDir, filename), bytes);
    console.log(`Saved ${filename}`);
}

async function generateT01() {
    // T01_bleed_0mm.pdf
    const doc = await PDFDocument.create();
    const page = doc.addPage([300, 300]);
    page.node.set(PDFName.of('TrimBox'), doc.context.obj([0, 0, 300, 300]));
    page.drawRectangle({ x: 0, y: 0, width: 300, height: 300, color: cmyk(1, 0, 0, 0) });
    await savePdf(doc, 'T01_bleed_0mm.pdf');
}

async function generateT02() {
    // T02_bleed_1mm.pdf
    const doc = await PDFDocument.create();
    const mm1 = 2.834;
    const page = doc.addPage([300 + 2 * mm1, 300 + 2 * mm1]);
    page.node.set(PDFName.of('TrimBox'), doc.context.obj([mm1, mm1, mm1 + 300, mm1 + 300]));
    page.node.set(PDFName.of('BleedBox'), doc.context.obj([0, 0, 300 + 2 * mm1, 300 + 2 * mm1]));
    page.drawRectangle({ x: 0, y: 0, width: 300 + 2 * mm1, height: 300 + 2 * mm1, color: cmyk(1, 0, 0, 0) });
    await savePdf(doc, 'T02_bleed_1mm.pdf');
}

// 1x1 red pixel RGB PNG
const rgbPngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

async function generateT03() {
    // T03_rgb_images.pdf
    const doc = await PDFDocument.create();
    const page = doc.addPage([300, 300]);
    const image = await doc.embedPng(Buffer.from(rgbPngBase64, 'base64'));
    page.drawImage(image, { x: 50, y: 50, width: 200, height: 200 });
    await savePdf(doc, 'T03_rgb_images.pdf');
}

async function generateT04() {
    // T04_rgb_vector.pdf
    const doc = await PDFDocument.create();
    const page = doc.addPage([300, 300]);
    page.drawRectangle({ x: 50, y: 50, width: 200, height: 200, color: rgb(1, 0, 0) });
    await savePdf(doc, 'T04_rgb_vector.pdf');
}

async function generateT05() {
    // T05_transparency_overlay.pdf
    const doc = await PDFDocument.create();
    const page = doc.addPage([300, 300]);
    page.drawRectangle({ x: 50, y: 50, width: 150, height: 150, color: cmyk(1, 0, 0, 0) });
    page.drawRectangle({ x: 100, y: 100, width: 150, height: 150, color: cmyk(0, 1, 0, 0), opacity: 0.5 });
    await savePdf(doc, 'T05_transparency_overlay.pdf');
}

function setupSpotColor(doc, page, name) {
    const tintTransform = doc.context.obj(`<< /FunctionType 2 /Domain [0.0 1.0] /N 1.0 /C0 [0.0 0.0 0.0 0.0] /C1 [1.0 0.0 0.0 0.0] >>`);
    const tintRef = doc.context.register(tintTransform);
    const spotCs = doc.context.obj([PDFName.of('Separation'), PDFName.of(name), PDFName.of('DeviceCMYK'), tintRef]);
    const spotCsRef = doc.context.register(spotCs);
    if (!page.node.Resources()) page.node.set(PDFName.of('Resources'), doc.context.obj({}));
    const res = page.node.Resources();
    if (!res.get(PDFName.of('ColorSpace'))) res.set(PDFName.of('ColorSpace'), doc.context.obj({}));
    res.get(PDFName.of('ColorSpace')).set(PDFName.of('CS_SPOT'), spotCsRef);
}

async function generateT06() {
    // T06_spot_color_objects.pdf
    const doc = await PDFDocument.create();
    const page = doc.addPage([300, 300]);
    setupSpotColor(doc, page, 'PANTONE 123 C');
    page.pushOperators(
        PDFOperator.of('CS', [PDFName.of('CS_SPOT')]),
        PDFOperator.of('sc', [PDFNumber.of(1.0)])
    );
    page.drawRectangle({ x: 50, y: 50, width: 100, height: 100 });
    await savePdf(doc, 'T06_spot_color_objects.pdf');
}

async function generateT07() {
    // T07_spot_color_text.pdf
    const doc = await PDFDocument.create();
    const page = doc.addPage([300, 300]);
    const font = await doc.embedFont(StandardFonts.Helvetica);
    setupSpotColor(doc, page, 'PANTONE 456 C');

    const fontName = 'F1';
    if (!page.node.Resources()) page.node.set(PDFName.of('Resources'), doc.context.obj({}));
    const res = page.node.Resources();
    if (!res.get(PDFName.of('Font'))) res.set(PDFName.of('Font'), doc.context.obj({}));
    res.get(PDFName.of('Font')).set(PDFName.of(fontName), font.ref);

    page.pushOperators(
        PDFOperator.of('cs', [PDFName.of('CS_SPOT')]),
        PDFOperator.of('sc', [PDFNumber.of(1.0)])
    );
    page.pushOperators(
        PDFOperator.of('BT', []),
        PDFOperator.of('Tf', [PDFName.of(fontName), PDFNumber.of(20)]),
        PDFOperator.of('Td', [PDFNumber.of(50), PDFNumber.of(150)]),
        PDFOperator.of('Tj', [doc.context.obj('Spot Color Text')]),
        PDFOperator.of('ET', [])
    );
    await savePdf(doc, 'T07_spot_color_text.pdf');
}

async function generateT08() {
    // T08_tac_over_limit.pdf
    const doc = await PDFDocument.create();
    const page = doc.addPage([300, 300]);
    page.drawRectangle({ x: 50, y: 50, width: 200, height: 200, color: cmyk(1.0, 0.9, 0.9, 1.0) });
    await savePdf(doc, 'T08_tac_over_limit.pdf');
}

async function generateT09() {
    // T09_overprint_objects.pdf
    const doc = await PDFDocument.create();
    const page = doc.addPage([300, 300]);
    const extGStateParams = doc.context.obj({ Type: 'ExtGState', OP: true, op: true, OPM: 1 });
    const stateRef = doc.context.register(extGStateParams);

    if (!page.node.Resources()) page.node.set(PDFName.of('Resources'), doc.context.obj({}));
    const res = page.node.Resources();
    if (!res.get(PDFName.of('ExtGState'))) res.set(PDFName.of('ExtGState'), doc.context.obj({}));
    res.get(PDFName.of('ExtGState')).set(PDFName.of('GS_OP'), stateRef);

    page.drawRectangle({ x: 50, y: 50, width: 200, height: 200, color: cmyk(1, 0, 0, 0) });
    page.pushOperators(PDFOperator.of('gs', [PDFName.of('GS_OP')]));
    page.drawRectangle({ x: 100, y: 100, width: 100, height: 100, color: cmyk(0, 1, 0, 0) });
    await savePdf(doc, 'T09_overprint_objects.pdf');
}

async function generateT10() {
    // T10_rich_black_text.pdf
    const doc = await PDFDocument.create();
    const page = doc.addPage([300, 300]);
    const font = await doc.embedFont(StandardFonts.Helvetica);
    page.drawText('This is Rich Black Text', { x: 50, y: 150, size: 20, font, color: cmyk(0.6, 0.4, 0.4, 1.0) });
    await savePdf(doc, 'T10_rich_black_text.pdf');
}

async function generateT11() {
    // T11_fonts_not_embedded.pdf
    const doc = await PDFDocument.create();
    const page = doc.addPage([300, 300]);
    const fontDict = doc.context.obj({
        Type: 'Font',
        Subtype: 'Type1',
        BaseFont: 'Arial',
        Name: 'F1',
        Encoding: 'WinAnsiEncoding'
    });
    const fontRef = doc.context.register(fontDict);
    if (!page.node.Resources()) page.node.set(PDFName.of('Resources'), doc.context.obj({}));
    const res = page.node.Resources();
    if (!res.get(PDFName.of('Font'))) res.set(PDFName.of('Font'), doc.context.obj({}));
    res.get(PDFName.of('Font')).set(PDFName.of('F1'), fontRef);

    page.pushOperators(
        PDFOperator.of('BT', []),
        PDFOperator.of('Tf', [PDFName.of('F1'), PDFNumber.of(20)]),
        PDFOperator.of('Td', [PDFNumber.of(50), PDFNumber.of(150)]),
        PDFOperator.of('Tj', [doc.context.obj('Unembedded Font Text')]),
        PDFOperator.of('ET', [])
    );
    await savePdf(doc, 'T11_fonts_not_embedded.pdf');
}

async function generateT12() {
    // T12_type3_fonts.pdf
    const doc = await PDFDocument.create();
    const page = doc.addPage([300, 300]);
    const charProc = doc.context.obj(`100 0 0 0 100 100 d1\n0 0 100 100 re f`);
    const charProcRef = doc.context.register(charProc);
    const charProcsDict = doc.context.obj({
        'A': charProcRef
    });

    const fontDict = doc.context.obj({
        Type: 'Font',
        Subtype: 'Type3',
        FontBBox: [0, 0, 100, 100],
        FontMatrix: [0.01, 0, 0, 0.01, 0, 0],
        FirstChar: 65,
        LastChar: 65,
        Widths: [100],
        CharProcs: charProcsDict,
        Encoding: doc.context.obj({
            Type: 'Encoding',
            Differences: [65, 'A']
        })
    });
    const fontRef = doc.context.register(fontDict);
    if (!page.node.Resources()) page.node.set(PDFName.of('Resources'), doc.context.obj({}));
    const res = page.node.Resources();
    if (!res.get(PDFName.of('Font'))) res.set(PDFName.of('Font'), doc.context.obj({}));
    res.get(PDFName.of('Font')).set(PDFName.of('F3'), fontRef);

    page.pushOperators(
        PDFOperator.of('BT', []),
        PDFOperator.of('Tf', [PDFName.of('F3'), PDFNumber.of(40)]),
        PDFOperator.of('Td', [PDFNumber.of(50), PDFNumber.of(150)]),
        PDFOperator.of('Tj', [doc.context.obj('<41>')]),
        PDFOperator.of('ET', [])
    );
    await savePdf(doc, 'T12_type3_fonts.pdf');
}

async function main() {
    await ensureDir();
    await generateT01();
    await generateT02();
    await generateT03();
    await generateT04();
    await generateT05();
    await generateT06();
    await generateT07();
    await generateT08();
    await generateT09();
    await generateT10();
    await generateT11();
    await generateT12();

    console.log("All 12 PDFs generated successfully.");
}

main().catch(console.error);
