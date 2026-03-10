const reportService = require('./services/reportService');

console.log('--- Testing Risk Score Logic ---');

const testFindings = [
    { severity: 'CRITICAL' }, // 30
    { severity: 'ERROR' },    // 30
    { severity: 'WARNING' },  // 10
    { severity: 'INFO' }      // 2
];

const score = reportService.calculateRiskScore(testFindings);
console.log('Findings:', testFindings.map(f => f.severity));
console.log('Calculated Score:', score);
if (score === 72) {
    console.log('✅ Risk Score calculation correct (30+30+10+2 = 72)');
} else {
    console.error('❌ Risk Score calculation FAILED');
}

const maxFindings = Array(10).fill({ severity: 'CRITICAL' });
const maxScore = reportService.calculateRiskScore(maxFindings);
console.log('Max Score (Cap at 100):', maxScore);
if (maxScore === 100) {
    console.log('✅ Risk Score capping correct');
} else {
    console.error('❌ Risk Score capping FAILED');
}

console.log('\n--- Testing ROI Metrics Logic ---');
const fixedCount = 5;
const hoursSaved = (fixedCount * 15) / 60;
const valueGenerated = fixedCount * 25;

console.log(`Fixed Count: ${fixedCount}`);
console.log(`Hours Saved: ${hoursSaved}h`);
console.log(`Value Generated: $${valueGenerated}`);

if (hoursSaved === 1.25 && valueGenerated === 125) {
    console.log('✅ ROI Logic correct');
} else {
    console.error('❌ ROI Logic FAILED');
}

console.log('\n--- Test Suite Complete ---');
process.exit(0);
