import { ISSUE_CATEGORY, Severity, type Issue } from '../types';

export interface PageInkStats {
    pageIndex: number;
    avgCoverage: number;
    peakTac: number;
    heavyBackgroundArea: number; // percentage of area > 180% TAC
    isGrayscale: boolean;
    richBlackArea: number; // percentage of area using rich black (C+M+Y > 0 and K > 0 and TAC > 100)
    isPhotoHeavy: boolean;
    isLowInk: boolean;
}

export interface InkOptimizationResult {
    score: number;
    inkUsageIndex: number;
    costCategory: 'LOW' | 'MEDIUM' | 'HIGH';
    opportunities: string[];
    totalCoverageAvg: number;
    issues: Issue[];
}

/**
 * INK SAVING & PRINT COST OPTIMIZATION MODULE
 * Architecture: Measure → Classify → Suggest → Certify
 */
export function analyzeInkOptimization(pageStats: PageInkStats[]): InkOptimizationResult {
    const opportunities = new Set<string>();
    const issues: Issue[] = [];

    let totalCoverage = 0;
    let totalHeavyBg = 0;
    let totalRichBlack = 0;
    let totalPhotoHeavyCount = 0;
    let totalLowInkCount = 0;
    let grayscaleCandidatesCount = 0;

    pageStats.forEach(stat => {
        totalCoverage += stat.avgCoverage;

        // --- CLASSIFICATION RULES ---

        // Grayscale candidate removed per client feedback

        // Heavy background: only show if TAC > 300
        if (stat.heavyBackgroundArea > 40 && stat.peakTac > 300) {
            totalHeavyBg++;
            opportunities.add('Consider lighter tint or paper change');
            issues.push({
                id: `ink-heavy-bg-${stat.pageIndex}`,
                page: stat.pageIndex,
                category: ISSUE_CATEGORY.INK_SAVING,
                severity: Severity.WARNING,
                message: 'Heavy ink background detected.',
                details: `${stat.heavyBackgroundArea.toFixed(1)}% of the page area exceeds 180% TAC, with a peak of ${stat.peakTac}%. This increases cost and drying time.`
            });
        }

        // Rich black overuse: large areas using CMYK black instead of K-only
        // (Assuming stat.richBlackArea >= some threshold, e.g., 10%)
        if (stat.richBlackArea > 10) {
            totalRichBlack++;
            opportunities.add('Replace with K-only black for text areas');
            issues.push({
                id: `ink-rich-black-${stat.pageIndex}`,
                page: stat.pageIndex,
                category: ISSUE_CATEGORY.INK_SAVING,
                severity: Severity.INFO,
                message: 'Rich black overuse detected.',
                details: 'Large areas use C+M+Y+K for black. Converting text and small elements to K-only black reduces cost and registration risks.'
            });
        }

        // Photo heavy: only show if TAC > 300
        if (stat.isPhotoHeavy && stat.peakTac > 300) {
            totalPhotoHeavyCount++;
            opportunities.add('Paper coating may affect drying and cost');
            issues.push({
                id: `ink-photo-${stat.pageIndex}`,
                page: stat.pageIndex,
                category: ISSUE_CATEGORY.INK_SAVING,
                severity: Severity.INFO,
                message: 'Photo-heavy page detected.',
                details: `High coverage photographic content detected with peak TAC ${stat.peakTac}%. Ensure paper substrate is suitable for high ink loads.`
            });
        }

        // Low ink page removed per client feedback
    });

    const pageCount = pageStats.length || 1;
    const avgCoverageTotal = totalCoverage / pageCount;

    // --- COST ESTIMATION ---
    // Compute ink_usage_index 0–100
    // Simple heuristic: map 0-400% TAC to 0-100 index, weighted by coverage area
    const inkUsageIndex = Math.min(100, Math.round((avgCoverageTotal / 300) * 100));

    let costCategory: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
    if (inkUsageIndex > 60) costCategory = 'HIGH';
    else if (inkUsageIndex > 25) costCategory = 'MEDIUM';

    // Scoring (Efficiency score)
    let score = 100;
    if (totalHeavyBg > 0) score -= 10;
    if (totalRichBlack > 0) score -= 5;
    if (grayscaleCandidatesCount > 0) score -= 5;
    score = Math.max(0, score);

    return {
        score,
        inkUsageIndex,
        costCategory,
        opportunities: Array.from(opportunities),
        totalCoverageAvg: avgCoverageTotal,
        issues
    };
}
