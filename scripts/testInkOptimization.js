/**
 * Standalone Test for Ink Optimization Logic
 */

const ISSUE_CATEGORY = { INK_SAVING: 'ink_saving' };
const Severity = { INFO: 'info', WARNING: 'warning' };

function analyzeInkOptimization(pageStats) {
    const opportunities = new Set();
    const issues = [];

    let totalCoverage = 0;
    let totalHeavyBg = 0;
    let totalRichBlack = 0;
    let grayscaleCandidatesCount = 0;

    pageStats.forEach(stat => {
        totalCoverage += stat.avgCoverage;
        if (stat.avgCoverage < 20 && stat.isGrayscale) {
            grayscaleCandidatesCount++;
            opportunities.add('Print as grayscale page');
            issues.push({ page: stat.pageIndex, message: 'Grayscale candidate', details: 'Low coverage and no color pixels.' });
        }
        if (stat.heavyBackgroundArea > 40) {
            totalHeavyBg++;
            opportunities.add('Consider lighter tint or paper change');
            issues.push({ page: stat.pageIndex, message: 'Heavy background', details: `${stat.heavyBackgroundArea}% exceeds 180% TAC.` });
        }
        if (stat.richBlackArea > 10) {
            totalRichBlack++;
            opportunities.add('Replace with K-only black for text areas');
            issues.push({ page: stat.pageIndex, message: 'Rich black overuse', details: 'Large areas use C+M+Y+K.' });
        }
        if (stat.isPhotoHeavy) {
            opportunities.add('Paper coating may affect drying and cost');
        }
        if (stat.isLowInk) {
            opportunities.add('Add subtle background to stabilize print');
        }
    });

    const pageCount = pageStats.length || 1;
    const avgCoverageTotal = totalCoverage / pageCount;
    const inkUsageIndex = Math.min(100, Math.round((avgCoverageTotal / 300) * 100));

    let costCategory = 'LOW';
    if (inkUsageIndex > 60) costCategory = 'HIGH';
    else if (inkUsageIndex > 25) costCategory = 'MEDIUM';

    return {
        score: 100 - (totalHeavyBg * 10) - (grayscaleCandidatesCount * 5),
        inkUsageIndex,
        costCategory,
        opportunities: Array.from(opportunities),
        totalCoverageAvg: avgCoverageTotal,
        issues
    };
}

// Mock data for tests
const mockPages = [
    {
        pageIndex: 1,
        avgCoverage: 15,
        peakTac: 100,
        heavyBackgroundArea: 0,
        isGrayscale: true,
        richBlackArea: 0,
        isPhotoHeavy: false,
        isLowInk: false
    },
    {
        pageIndex: 2,
        avgCoverage: 220,
        peakTac: 320,
        heavyBackgroundArea: 65,
        isGrayscale: false,
        richBlackArea: 25,
        isPhotoHeavy: true,
        isLowInk: false
    },
    {
        pageIndex: 3,
        avgCoverage: 3,
        peakTac: 20,
        heavyBackgroundArea: 0,
        isGrayscale: true,
        richBlackArea: 0,
        isPhotoHeavy: false,
        isLowInk: true
    }
];

console.log("--- RUNNING INK OPTIMIZATION TEST ---");
const result = analyzeInkOptimization(mockPages);

console.log("\nAGGREGATE RESULTS:");
console.log(`Score: ${result.score}`);
console.log(`Ink Usage Index: ${result.inkUsageIndex}`);
console.log(`Cost Category: ${result.costCategory}`);
console.log(`Total Avg Coverage: ${result.totalCoverageAvg.toFixed(2)}%`);

console.log("\nOPPORTUNITIES DETECTED:");
result.opportunities.forEach(opt => console.log(` - ${opt}`));

console.log("\nINDIVIDUAL ISSUES:");
result.issues.forEach(iss => {
    console.log(`[P${iss.page}] ${iss.message}: ${iss.details}`);
});

console.log("\n--- TEST COMPLETE ---");
