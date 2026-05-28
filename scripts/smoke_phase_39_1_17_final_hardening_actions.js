const fs = require('fs');
const path = require('path');

async function runTest() {
    console.log("== Phase 39.1.17 Smoke Test: Final Hardening Buttons ==");

    const engineDir = path.resolve('C:\\Users\\KIKE\\Downloads\\ppos-preflight-engine');
    const { createStandardEngine } = require(path.join(engineDir, 'index.js'));
    
    // We will test the autofix behavior by instantiating the engine manually
    // or by mocking the Ghostscript call since we only want to check the routing and UNSUPPORTED_FIX return values.

    // Let's use a dummy PDF for the engine test
    const dummyPdfPath = path.join(__dirname, 'dummy_test.pdf');
    if (!fs.existsSync(dummyPdfPath)) {
        fs.writeFileSync(dummyPdfPath, '%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF');
    }

    const engine = createStandardEngine();
    
    // Override applyCmyk to avoid actually running ghostscript
    if (engine.fixEngine) {
        engine.fixEngine.applyCmyk = async () => ({ success: true, error: null, repairs: [] });
    }

    let allPassed = true;

    async function testUnsupported(fixCode) {
        console.log(`\nTesting ${fixCode}...`);
        const result = await engine.autofixPdf(dummyPdfPath, {
            fixes: [fixCode]
        }, { outputDir: __dirname, jobId: `test_${fixCode}` });
        
        if (result.status === 'UNSUPPORTED_FIX' && 
            result.failed_fixes && result.failed_fixes.length > 0 &&
            result.failed_fixes[0].code === fixCode &&
            result.productionCertified === false &&
            result.requiresHumanReview === true) {
            console.log(`✅ ${fixCode} correctly returned UNSUPPORTED_FIX with proper payload.`);
        } else {
            console.error(`❌ ${fixCode} failed validation. Payload:`, JSON.stringify(result, null, 2));
            allPassed = false;
        }
    }

    await testUnsupported('CONVERT_GRAYSCALE');
    await testUnsupported('REBUILD_300DPI');
    await testUnsupported('BOOKLET_MODE');
    await testUnsupported('IMPOSE_BOOKLET');

    console.log(`\nTesting CONVERT_CMYK...`);
    const cmykResult = await engine.autofixPdf(dummyPdfPath, {
        fixes: ['CONVERT_CMYK'],
        forceCmyk: true
    }, { outputDir: __dirname, jobId: 'test_cmyk' });

    // Our mock will return success
    if (cmykResult.status !== 'UNSUPPORTED_FIX' && cmykResult.repairs.some(r => r.code === 'CONVERT_CMYK' && r.requires_human_review === true)) {
         console.log(`✅ CONVERT_CMYK correctly processed and flagged for human review.`);
    } else {
         console.error(`❌ CONVERT_CMYK failed validation. Payload:`, JSON.stringify(cmykResult, null, 2));
         allPassed = false;
    }

    if (fs.existsSync(dummyPdfPath)) {
        fs.unlinkSync(dummyPdfPath);
    }

    if (allPassed) {
        console.log("\n✅ All Phase 39.1.17 tests passed!");
        process.exit(0);
    } else {
        console.log("\n❌ Some tests failed.");
        process.exit(1);
    }
}

runTest().catch(console.error);
