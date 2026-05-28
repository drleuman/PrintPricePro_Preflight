const fs = require('fs');
const path = require('path');

async function runTest() {
    console.log("== Phase 39.1.17c Smoke Test: Magic Profile Passthrough ==");

    const engineDir = path.resolve('C:\\Users\\KIKE\\Downloads\\ppos-preflight-engine');
    const { createStandardEngine } = require(path.join(engineDir, 'index.js'));
    
    const dummyPdfPath = path.join(__dirname, 'dummy_test.pdf');
    if (!fs.existsSync(dummyPdfPath)) {
        fs.writeFileSync(dummyPdfPath, '%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF');
    }

    const engine = createStandardEngine();
    if (engine.fixEngine) {
        engine.fixEngine.applyCmyk = async () => ({ success: true, error: null, repairs: [] });
    }

    let allPassed = true;

    console.log(`\nTesting CONVERT_CMYK with MAGIC_FIX_SAFE (should skip)...`);
    const safeResult = await engine.autofixPdf(dummyPdfPath, {
        fixes: ['CONVERT_CMYK'],
        magicFixProfile: 'MAGIC_FIX_SAFE'
    }, { outputDir: __dirname, jobId: 'test_safe' });

    if (safeResult.status === 'NO_CHANGE' && safeResult.repairs?.some(f => f.code === 'CONVERT_CMYK' && f.status === 'SKIPPED')) {
         console.log(`✅ MAGIC_FIX_SAFE correctly skipped CONVERT_CMYK.`);
    } else {
         console.error(`❌ MAGIC_FIX_SAFE failed. Payload:`, JSON.stringify(safeResult, null, 2));
         allPassed = false;
    }

    console.log(`\nTesting CONVERT_CMYK with MAGIC_FIX_FORCE_CMYK (should execute)...`);
    const forceResult = await engine.autofixPdf(dummyPdfPath, {
        fixes: ['CONVERT_CMYK'],
        magicFixProfile: 'MAGIC_FIX_FORCE_CMYK'
    }, { outputDir: __dirname, jobId: 'test_force' });

    if (forceResult.status !== 'UNSUPPORTED_FIX' && forceResult.repairs.some(r => r.code === 'CONVERT_CMYK')) {
         console.log(`✅ MAGIC_FIX_FORCE_CMYK correctly executed CONVERT_CMYK.`);
    } else {
         console.error(`❌ MAGIC_FIX_FORCE_CMYK failed. Payload:`, JSON.stringify(forceResult, null, 2));
         allPassed = false;
    }

    if (fs.existsSync(dummyPdfPath)) {
        fs.unlinkSync(dummyPdfPath);
    }

    if (allPassed) {
        console.log("\n✅ All Phase 39.1.17c tests passed!");
        process.exit(0);
    } else {
        console.log("\n❌ Some tests failed.");
        process.exit(1);
    }
}

runTest().catch(console.error);
