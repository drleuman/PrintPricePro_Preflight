const signalService = require('../services/productionSignalService');
const detector = require('../services/intentDetector');

const mockAnalysis = {
    info: {
        pages: 200,
        trimBox: "0 0 425.20 623.62" // Approx 150x220mm (Trade)
    },
    imageHeuristics: {
        totalImages: 10 // Low density
    }
};

console.log('--- V3 Full Pipeline Verification ---\n');

console.log('1. Mock Analysis Results:', JSON.stringify(mockAnalysis, null, 2));

const signals = signalService.extractSignals(mockAnalysis);
console.log('\n2. Extracted Signals:', JSON.stringify(signals, null, 2));

const intent = detector.detect(signals);
console.log('\n3. Detected Intent:', JSON.stringify(intent, null, 2));

const passed = intent.primary_intent === 'paperback_novel';
console.log(`\nStatus: ${passed ? '✅ PASS' : '❌ FAIL'}`);
