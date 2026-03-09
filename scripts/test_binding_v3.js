const bindingService = require('../services/bindingIntelligenceService');

const mockFactsNovel = {
    info: {
        pages: 350,
        trimBox: "0 0 425.20 623.62" // Trade
    },
    pages: [
        { width: 314.2, height: 220 } // Spread cover: (150*2) + 14.2 spine
    ]
};

const mockIntentNovel = {
    primary_intent: 'paperback_novel',
    intent_score: 85
};

console.log('--- V3.2 Binding Intelligence Verification ---\n');

console.log('Test 1: Paperback Novel (350 pages, spread cover)');
const result1 = bindingService.assess(mockFactsNovel, mockIntentNovel);
console.log(JSON.stringify(result1, null, 2));

console.log('\nTest 2: Booklet with too many pages for saddle stitch');
const mockFactsBooklet = {
    info: { pages: 80, trimBox: "0 0 595.28 841.89" } // A4
};
const mockIntentBooklet = {
    primary_intent: 'booklet_saddle_stitch'
};
const result2 = bindingService.assess(mockFactsBooklet, mockIntentBooklet);
console.log(JSON.stringify(result2, null, 2));

const passed = result1.feasibility_score === 1.0 && result2.findings.some(f => f.id === 'EXCESSIVE_PAGES_FOR_BINDING');
console.log(`\nGlobal Status: ${passed ? '✅ PASS' : '❌ FAIL'}`);
