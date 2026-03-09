const matchmaker = require('../services/matchmaker');
const capabilitySync = require('../services/capabilitySyncService');

// --- Mock Data ---

const technicalFacts = {
    maxTac: 280,
    minDpi: 300,
    hasBleed: true,
    info: { pages: 200 }
};

const productionSpecs = {
    bindingType: 'perfect',
    trimWidthMm: 150,
    trimHeightMm: 210,
    pageCount: 200,
    paperGsm: 130
};

const mockProfiles = [
    {
        printerId: 'PRINTER_A_HIGH_QUALITY_EXPENSIVE',
        price_index: 2.5, // High price
        capabilities: {
            bindingConstraints: { perfect: { supported: true, minPages: 40, maxPages: 1000 } },
            paperUsageLimits: { interior: { supported: true, minGsm: 60, maxGsm: 200 } },
            format: { minWidthMm: 100, minHeightMm: 140, maxWidthMm: 720, maxHeightMm: 1000 }
        },
        constraints: { maxTac: 400, minDpi: 300, requiresBleed: true }
    },
    {
        printerId: 'PRINTER_B_CHEAP_BUT_SMALL',
        price_index: 0.8, // Low price -> High commercial score
        capabilities: {
            bindingConstraints: { perfect: { supported: true, minPages: 40, maxPages: 1000 } },
            paperUsageLimits: { interior: { supported: true, minGsm: 60, maxGsm: 200 } },
            format: { minWidthMm: 100, minHeightMm: 140, maxWidthMm: 160, maxHeightMm: 220 } // Barely fits
        },
        constraints: { maxTac: 300, minDpi: 300, requiresBleed: true }
    },
    {
        printerId: 'PRINTER_C_THRESHOLD_FAIL',
        price_index: 1.0,
        capabilities: {
            bindingConstraints: { perfect: { supported: true, minPages: 20, maxPages: 250 } }, // Smaller range
            paperUsageLimits: { interior: { supported: true, minGsm: 60, maxGsm: 105 } }, // GSM is 130 -> 0.6 penalty
            format: { minWidthMm: 100, minHeightMm: 140, maxWidthMm: 720, maxHeightMm: 1000 }
        },
        constraints: { maxTac: 300, minDpi: 300, requiresBleed: true }
    }
];

// --- Verification Logic ---

async function runVerification() {
    console.log('--- V4.1 Matchmaker Hardening Verification ---');
    console.log('Job: 150x210, 200 pages, 130gsm\n');

    capabilitySync.getActivePrinterProfiles = async () => mockProfiles;

    const result = await matchmaker.match(technicalFacts, {}, productionSpecs);

    console.log('Final Result Status:', result.status);
    console.log('Best Printer selected:', result.best_printer_id);

    console.log('\nCandidate Analysis:');
    result.candidates.forEach(c => {
        console.log(`- ${c.printerId} | Status: ${c.status}`);
        console.log(`  Scores -> Overall: ${c.scores.overall.toFixed(3)}, Phys: ${c.scores.physical}, Oper: ${c.scores.operative}, Comm: ${c.scores.commercial}`);
        console.log(`  Explanation: ${c.decisionExplanation || 'N/A'}`);
    });

    // 1. Verify Commercial Impact (B should beat A because A is expensive)
    const bBeatsA = result.best_printer_id === 'PRINTER_B_CHEAP_BUT_SMALL';

    // 2. Verify Threshold rejection for C
    const candidateC = result.candidates.find(c => c.printerId === 'PRINTER_C_THRESHOLD_FAIL');
    const cRejectedByThreshold = candidateC.status === 'conditionally_ready' && result.best_printer_id !== 'PRINTER_C_THRESHOLD_FAIL';
    // Actually C has phys score 0.6 (due to GSM penalty). Minimum physical threshold is 0.8.
    const cPhysScoreBelowThreshold = candidateC.scores.physical < 0.8;

    // 3. Verify Explanation richness
    const hasRichExplanation = result.decision_explanation.includes('Perfect match');

    console.log('\nValidation Results:');
    console.log(`- Tie-breaker/Commercial selection works (B > A): ${bBeatsA ? '✅' : '❌'}`);
    console.log(`- Printer C physical score (0.6) below threshold (0.8): ${cPhysScoreBelowThreshold ? '✅' : '❌'}`);
    console.log(`- Decisive explanation is clear: ${hasRichExplanation ? '✅' : '❌'}`);

    const finalPass = bBeatsA && cPhysScoreBelowThreshold && hasRichExplanation;
    console.log(`\nFinal Hardening Status: ${finalPass ? '✅ PASS' : '❌ FAIL'}`);
}

runVerification().catch(console.error);
