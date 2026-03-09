const bpeAdapter = require('../services/bpePayloadAdapter');
const bindingService = require('../services/bindingIntelligenceService');
const intentDetector = require('../services/intentDetector');
const signalService = require('../services/productionSignalService');

const mockJob = {
    metadata_json: {
        "binding method": "case-bound", // Should map to hardcover_casebound
        "book size": "210x297",
        "interior pages": 500,
        "paper interior (type)": "silk",
        "interior paper weight (gsm)": "150"
    }
};

const mockAnalysis = {
    info: {
        pages: 500,
        trimBox: "0 0 595.28 841.89"
    },
    pages: [
        { width: 448.75, height: 297 } // (210*2) + 28.75 spine.
        // Theoretical Hardcover: (500/2) * 0.115 = 28.75. Delta = 0.
    ]
};

console.log('--- V3.2 End-to-End Pipeline Verification ---\n');

// 1. Signals & Intent
const signals = signalService.extractSignals(mockAnalysis);
const intent = intentDetector.detect(signals);
console.log('Intent Detected:', intent.primary_intent);

// 2. Adaptation
const specs = bpeAdapter.normalize(mockJob.metadata_json);
console.log('Adapted Specs:', JSON.stringify(specs, null, 2));

// 3. Binding Assessment
const binding = bindingService.assess(mockAnalysis, intent, specs);
console.log('\nBinding Assessment:', JSON.stringify(binding, null, 2));

const passed = binding.status === 'ready' &&
    binding.binding_type === 'hardcover_casebound' &&
    binding.binding_source === 'explicit_spec';

console.log(`\nFinal Pipeline Status: ${passed ? '✅ PASS' : '❌ FAIL'}`);
