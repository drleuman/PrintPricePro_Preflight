const bindingService = require('../services/bindingIntelligenceService');
const bpeAdapter = require('../services/bpePayloadAdapter');

const rawBPEPayloadWithMismatches = {
    "binding method": "case-bound",
    "book size": "210×297 mm", // Test dimension sanitization
    "interior pages": "504", // Test mismatched with PDF (500)
    "paper interior (type)": "silk",
    "interior paper weight (gsm)": "150",
    "endpapers": "yes" // Test boolean
};

const mockAnalysisMatch = {
    info: {
        pages: 500, // Delta 4 from spec
        trimBox: "0 0 425.20 623.62" // 150x220 - Test mismatch with 210x297
    },
    pages: [
        { width: 317.5, height: 220 }
    ]
};

const mockIntentNovel = {
    primary_intent: 'paperback_novel' // Mismatch with explicit hardcover
};

console.log('--- V3.2 Hardened Physical Intelligence Verification ---\n');

console.log('1. Normalizing BPE Payload (Sanitization Test)...');
const specs = bpeAdapter.normalize(rawBPEPayloadWithMismatches);
console.log(JSON.stringify(specs, null, 2));

console.log('\n2. Assessing Binding with deliberate mismatches...');
const result = bindingService.assess(mockAnalysisMatch, mockIntentNovel, specs);
console.log(JSON.stringify(result, null, 2));

const hasPageMismatch = result.findings.some(f => f.id === 'PAGE_COUNT_MISMATCH');
const hasTrimMismatch = result.findings.some(f => f.id === 'TRIM_SIZE_MISMATCH');
const hasIntentMismatch = result.findings.some(f => f.id === 'INTENT_BINDING_MISMATCH');
const statusCorrect = result.status === 'incompatible';

const passed = hasPageMismatch && hasTrimMismatch && hasIntentMismatch && statusCorrect;
console.log(`\nHardening Status: ${passed ? '✅ PASS' : '❌ FAIL'}`);

if (!passed) {
    if (!hasPageMismatch) console.log('   Reason: Missing PAGE_COUNT_MISMATCH');
    if (!hasTrimMismatch) console.log('   Reason: Missing TRIM_SIZE_MISMATCH');
    if (!hasIntentMismatch) console.log('   Reason: Missing INTENT_BINDING_MISMATCH');
    if (!statusCorrect) console.log('   Reason: Status is not conditionally_ready:', result.status);
}
