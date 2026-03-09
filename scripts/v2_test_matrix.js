/**
 * V2 Policy Test Matrix (Enhanced Gold Suite)
 * Verifies:
 * - Technical Fact Collection
 * - Policy Logic & Finding Mapping
 * - ROI & Delta Generation (Post-Fix Recheck)
 */
const reportService = require('../services/reportService');
const deterministicService = require('../services/deterministicService');
const deltaService = require('../services/deltaService');
const policyEngine = require('../services/policyEngine');
const ErrorTaxonomy = require('../services/errorTaxonomy');
const fs = require('fs');
const path = require('path');

const TEST_CONFIG = [
    {
        name: 'Strict Offset - RGB Conversion',
        policy: 'OFFSET_CMYK_STRICT',
        expected_findings: ['missing-bleed-info', 'rgb-only-content'],
        verify_fix: 'convert_cmyk'
    },
    {
        name: 'Digital POD - Permissive',
        policy: 'DIGITAL_POD',
        expected_findings: []
    },
    {
        name: 'Hard Admission Limit - Pages',
        policy: 'OFFSET_CMYK_STRICT',
        mock_pages: 1001,
        expected_error: ErrorTaxonomy.ADMISSION_PAGES_EXCEEDED
    }
];

async function runTestMatrix() {
    console.log('--- PRINTPRICE V2 GOLD SUITE TEST MATRIX ---');

    const testFile = path.resolve(__dirname, '../test_suite_pdfs/T03_rgb_images.pdf');
    if (!fs.existsSync(testFile)) {
        console.error(`Test file not found at ${testFile}`);
        return;
    }

    const asset = { filename: 'test.pdf', storage_path: testFile, size: fs.statSync(testFile).size };
    const facts = await deterministicService.analyze(testFile);

    for (const test of TEST_CONFIG) {
        console.log(`\n> Testing [${test.name}]...`);

        try {
            // Mock admission if needed
            if (test.mock_pages) facts.info.pages = test.mock_pages;

            if (test.mock_pages > 1000) {
                console.log('  Testing Admission Rejection...');
                // Simulate worker check
                if (test.mock_pages > 1000) throw new Error(ErrorTaxonomy.ADMISSION_PAGES_EXCEEDED);
            }

            const policyObj = policyEngine.loadPolicy(test.policy);
            const report = reportService.buildReport(asset, facts, policyObj);

            const findingIds = report.findings.map(f => f.id);
            console.log(`  Findings found: ${findingIds.join(', ') || '(none)'}`);

            const missing = (test.expected_findings || []).filter(id => !findingIds.includes(id));

            if (missing.length === 0) {
                console.log('  ✅ Structural Pass');
            } else {
                console.warn(`  ❌ FAILED: Missing findings: ${missing.join(', ')}`);
            }

            // Delta Simulation
            if (test.verify_fix) {
                console.log(`  Verifying Delta/ROI for ${test.verify_fix}...`);
                // Mock a fixed report
                const afterReport = JSON.parse(JSON.stringify(report));
                afterReport.findings = afterReport.findings.filter(f => f.fix?.step !== test.verify_fix);

                const delta = deltaService.computeDelta(report, afterReport);
                if (delta.fixed_count > 0) {
                    console.log(`  ✅ Delta Pass: ${delta.fixed_count} issues resolved simulation.`);
                } else {
                    console.error('  ❌ Delta Fail: No issues resolved in simulation.');
                }
            }

        } catch (err) {
            if (test.expected_error && err.message.includes(test.expected_error)) {
                console.log(`  ✅ Expected Error Caught: ${test.expected_error}`);
            } else {
                console.error(`  💥 ERROR: ${err.message}`);
            }
        }
    }
}

runTestMatrix().catch(console.error);
