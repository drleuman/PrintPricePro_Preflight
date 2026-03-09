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
        printerId: 'PRINTER_ALPHA_STRICT',
        machineId: 'MACHINE_OFFSET',
        capabilities: {
            bindingConstraints: { perfect: { supported: true, minPages: 40, maxPages: 1000 } },
            paperUsageLimits: { interior: { supported: true, minGsm: 60, maxGsm: 200 } },
            format: { minWidthMm: 100, minHeightMm: 140, maxWidthMm: 720, maxHeightMm: 1000 }
        },
        constraints: { maxTac: 300, minDpi: 300, requiresBleed: true }
    },
    {
        printerId: 'PRINTER_BETA_RELAXED',
        machineId: 'MACHINE_DIGITAL',
        capabilities: {
            bindingConstraints: { perfect: { supported: true, minPages: 20, maxPages: 500 } },
            paperUsageLimits: { interior: { supported: true, minGsm: 60, maxGsm: 150 } },
            format: { minWidthMm: 90, minHeightMm: 120, maxWidthMm: 330, maxHeightMm: 480 }
        },
        constraints: { maxTac: 240, minDpi: 600, requiresBleed: false } // TAC limit will hurt score
    },
    {
        printerId: 'PRINTER_GAMMA_INCOMPATIBLE',
        machineId: 'MACHINE_SMALL',
        capabilities: {
            bindingConstraints: { perfect: { supported: false } }, // Incompatible
            paperUsageLimits: { interior: { supported: true, minGsm: 60, maxGsm: 100 } },
            format: { minWidthMm: 100, minHeightMm: 100, maxWidthMm: 140, maxHeightMm: 140 } // Too small
        },
        constraints: { maxTac: 200, minDpi: 300, requiresBleed: true }
    }
];

// --- Verification Logic ---

async function runVerification() {
    console.log('--- V4 Matchmaker Verification ---');
    console.log('Job: Perfect Bound, 200 pages, 150x210, 130gsm, 280% TAC\n');

    // Override getActivePrinterProfiles for testing
    capabilitySync.getActivePrinterProfiles = async () => mockProfiles;

    const result = await matchmaker.match(technicalFacts, {}, productionSpecs);

    console.log('Matchmaking Result:');
    console.log(`Status: ${result.status}`);
    console.log(`Best Printer: ${result.best_printer_id}`);
    console.log(`Explanation: ${result.decision_explanation}`);

    console.log('\nCandidate Rankings:');
    result.candidates.forEach((c, i) => {
        console.log(`${i + 1}. ${c.printerId} | Status: ${c.status} | Overall: ${c.scores.overall.toFixed(2)} (Phys: ${c.scores.physical}, Oper: ${c.scores.operative})`);
        if (c.blockingReasons.length > 0) {
            console.log(`   Blockers: ${c.blockingReasons.map(r => r.id).join(', ')}`);
        }
    });

    // Validations
    const alphaBest = result.best_printer_id === 'PRINTER_ALPHA_STRICT';
    const gammaBlocked = result.candidates.find(c => c.printerId === 'PRINTER_GAMMA_INCOMPATIBLE').status === 'incompatible';
    const betaConditionally = result.candidates.find(c => c.printerId === 'PRINTER_BETA_RELAXED').status === 'conditionally_ready';

    console.log('\nValidation Checks:');
    console.log(`- Alpha is winner: ${alphaBest ? '✅' : '❌'}`);
    console.log(`- Gamma is blocked: ${gammaBlocked ? '✅' : '❌'}`);
    console.log(`- Beta is conditionally ready (TAC issue): ${betaConditionally ? '✅' : '❌'}`);

    const finalPass = alphaBest && gammaBlocked && betaConditionally;
    console.log(`\nFinal Matchmaking Status: ${finalPass ? '✅ PASS' : '❌ FAIL'}`);
}

runVerification().catch(console.error);
