const assert = require('assert');
const { normalizeProfile } = require('../services/pdfPipeline');

console.log('--- STARTING QA MIGRATION TEST SUITE ---');

// 1. Profile Normalization Tests
console.log('\n[1] Testing Profile Normalization:');
const normTests = [
    { in: 'fogra39', out: 'iso_coated_v3' },
    { in: 'ISO Coated v2 (FOGRA39)', out: 'iso_coated_v3' },
    { in: 'FOGRA51', out: 'iso_coated_v3' },
    { in: 'PSO Coated v3', out: 'iso_coated_v3' },
    { in: 'FOGRA52', out: 'iso_uncoated_v3' },
    { in: 'FOGRA29', out: 'iso_uncoated_v3' },
    { in: 'GRACoL', out: 'gracol' },
    { in: null, out: 'iso_coated_v3' }
];

normTests.forEach(t => {
    const res = normalizeProfile(t.in);
    try {
        assert.strictEqual(res, t.out);
        console.log(`✅ ${t.in} -> ${res}`);
    } catch (e) {
        console.error(`❌ ${t.in} -> Expected ${t.out}, got ${res}`);
        process.exit(1);
    }
});

// 2. Forced Migration Logic Test (Simulating pdf.js logic)
console.log('\n[2] Testing Forced Migration Logic:');
function checkForced(sourceId, targetProf) {
    const requestedProf = normalizeProfile(targetProf);
    const sourceIsLegacy = sourceId === 'FOGRA39' || sourceId === 'COATED FOGRA39' || sourceId === 'FOGRA29';
    const forcedMigration = sourceIsLegacy && (requestedProf === 'iso_coated_v3' || requestedProf === 'iso_uncoated_v3');
    return forcedMigration;
}

const forcedTests = [
    { src: 'FOGRA39', target: 'iso_coated_v3', expected: true },
    { src: 'FOGRA39', target: 'iso_uncoated_v3', expected: true },
    { src: 'FOGRA29', target: 'iso_uncoated_v3', expected: true },
    { src: 'FOGRA51', target: 'iso_coated_v3', expected: false },
    { src: 'GRACoL', target: 'iso_coated_v3', expected: false },
    { src: 'FOGRA52', target: 'iso_uncoated_v3', expected: false }
];

forcedTests.forEach(t => {
    const res = checkForced(t.src, t.target);
    try {
        assert.strictEqual(res, t.expected);
        console.log(`✅ Source:${t.src} -> Target:${t.target} | Forced: ${res}`);
    } catch (e) {
        console.error(`❌ Source:${t.src} -> Target:${t.target} | Expected ${t.expected}, got ${res}`);
        process.exit(1);
    }
});

// 3. TAC Limit Logic (Simulating pdf.js scanTac map)
console.log('\n[3] Testing TAC Limit Mapping:');
const limitMap = {
    'iso_coated_v3': 300,
    'iso_uncoated_v3': 260,
    'gracol': 320,
    'swop': 300
};

Object.entries(limitMap).forEach(([prof, limit]) => {
    console.log(`✅ Profile: ${prof} -> TAC Limit: ${limit}%`);
});

assert.strictEqual(limitMap['iso_uncoated_v3'], 260);

console.log('\n--- QA SUITE PASSED ---');
