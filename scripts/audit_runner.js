const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const testSuiteDir = path.join(__dirname, '..', 'test_suite_pdfs');
const outputReportPath = path.join(__dirname, '..', 'audit_results.json');

const FILES = [
    'T01_bleed_0mm.pdf',
    'T02_bleed_1mm.pdf',
    'T03_rgb_images.pdf',
    'T04_rgb_vector.pdf',
    'T05_transparency_overlay.pdf',
    'T06_spot_color_objects.pdf',
    'T07_spot_color_text.pdf',
    'T08_tac_over_limit.pdf',
    'T09_overprint_objects.pdf',
    'T10_rich_black_text.pdf',
    'T11_fonts_not_embedded.pdf',
    'T12_type3_fonts.pdf'
];

async function runPreflight(page, filePath, filename) {
    const buffer = fs.readFileSync(filePath);
    const base64 = buffer.toString('base64');

    return await page.evaluate(async (b64, name) => {
        return await window.runPreflightBase64(b64, name);
    }, base64, filename);
}

async function runAutoFix(filePath, issues) {
    const formData = new FormData();
    const fileBuffer = fs.readFileSync(filePath);
    const blob = new Blob([fileBuffer], { type: 'application/pdf' });
    formData.append('file', blob, path.basename(filePath));
    formData.append('issues', JSON.stringify(issues));
    formData.append('target', 'cmyk');
    formData.append('profile', 'iso_coated_v3');
    formData.append('bleedMm', '3');
    formData.append('forceBleed', '1');
    const API_KEY = process.env.VITE_API_KEY || 'DEV_OVERRIDE_KEY';

    try {
        const response = await fetch('http://localhost:8080/api/convert/autofix', {
            method: 'POST',
            body: formData,
            headers: {
                'x-ppp-api-key': API_KEY
            }
        });

        const reportJsonBase64 = response.headers.get('x-ppp-autofix-report');
        let fixReport = null;
        if (reportJsonBase64) {
            fixReport = JSON.parse(Buffer.from(reportJsonBase64, 'base64').toString('utf8'));
        }

        if (!response.ok) {
            const errText = await response.text();
            return { ok: false, status: response.status, data: errText };
        }

        const buffer = await response.arrayBuffer();
        return { ok: true, buffer: Buffer.from(buffer), report: fixReport };
    } catch (err) {
        return { ok: false, error: err.message };
    }
}

async function main() {
    console.log("Starting Chrome Headless...");
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();

    // We expect the Vite dev server to be running on 3000
    console.log("Navigating to http://localhost:3000/scripts/headless.html");
    await page.goto('http://localhost:3000/scripts/headless.html');

    // Wait until window.runPreflightBase64 is defined
    await page.waitForFunction('window.runPreflightBase64 !== undefined', { timeout: 10000 });
    console.log("Headless Worker ready.");

    const results = {};

    for (const filename of FILES) {
        const filePath = path.join(testSuiteDir, filename);
        if (!fs.existsSync(filePath)) {
            console.warn(`File ${filename} not found, skipping.`);
            continue;
        }

        console.log(`\n--- Processing ${filename} ---`);
        const result = {
            filename,
            preflight_before: null,
            autofix_report: null,
            preflight_after: null,
            fix_applied: false,
            fix_success: false,
            error: null
        };

        try {
            // 1. Initial Preflight
            console.log(`[1/3] Running Preflight...`);
            const reportBefore = await runPreflight(page, filePath, filename);
            result.preflight_before = reportBefore;

            // 2. AutoFix
            console.log(`[2/3] Running AutoFix...`);
            const fixResult = await runAutoFix(filePath, reportBefore.issues);

            if (fixResult.ok) {
                result.fix_applied = true;
                result.autofix_report = fixResult.report;

                const fixedFileName = `Fixed_${filename}`;
                const fixedPath = path.join(testSuiteDir, fixedFileName);
                fs.writeFileSync(fixedPath, fixResult.buffer);

                // 3. Second Preflight
                console.log(`[3/3] Running Post-fix Preflight...`);
                const reportAfter = await runPreflight(page, fixedPath, fixedFileName);
                result.preflight_after = reportAfter;
                result.fix_success = true;

            } else {
                console.log(`AutoFix failed:`, fixResult.error || fixResult.data);
                result.error = fixResult.error || fixResult.data;
            }

        } catch (err) {
            console.error(`Error processing ${filename}:`, err.message);
            result.error = err.message;
        }

        results[filename] = result;
    }

    fs.writeFileSync(outputReportPath, JSON.stringify(results, null, 2));
    console.log(`\n✅ Audit completed. Results saved to ${outputReportPath}`);
    await browser.close();
}

main().catch(console.error);
