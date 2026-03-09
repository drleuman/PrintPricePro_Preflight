const bindingService = require('../services/bindingIntelligenceService');
const bpeAdapter = require('../services/bpePayloadAdapter');

const rawBPEPayload = {
    "binding method": "perfect-bound",
    "book size": "150x220",
    "interior paper weight (gsm)": "80",
    "paper interior (type)": "uncoated"
};

const mockFacts = {
    info: {
        pages: 350,
        trimBox: "0 0 425.20 623.62"
    },
    pages: [
        { width: 317.5, height: 220 } // (150*2) + 17.5 spine. 
        // Theoretical: (350/2) * 0.100 = 17.5. Delta = 0.
    ]
};

const mockIntent = {
    primary_intent: 'paperback_novel'
};

console.log('--- V3.2 Refined Binding Verification ---\n');

console.log('1. Normalizing BPE Payload...');
const specs = bpeAdapter.normalize(rawBPEPayload);
console.log(JSON.stringify(specs, null, 2));

console.log('\n2. Assessing Binding with Normalized Specs...');
const result = bindingService.assess(mockFacts, mockIntent, specs);
console.log(JSON.stringify(result, null, 2));

const passed = result.status === 'ready' && result.binding_type === 'perfect' && result.spine.detected_mm === 17.5;
console.log(`\nStatus: ${passed ? '✅ PASS' : '❌ FAIL'}`);

if (!passed) {
    if (result.status !== 'ready') console.log('   Reason: status is not ready:', result.status);
    if (result.binding_type !== 'perfect') console.log('   Reason: binding_type mismatch:', result.binding_type);
    if (result.spine.detected_mm !== 17.5) console.log('   Reason: spine detection mismatch:', result.spine.detected_mm);
}
