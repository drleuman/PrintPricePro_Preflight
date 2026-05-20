import { describe, it, expect } from 'vitest';
import { analyzeInkOptimization, type PageInkStats } from './inkOptimization';

function makePage(overrides: Partial<PageInkStats> = {}): PageInkStats {
  return {
    pageIndex: 0,
    avgCoverage: 100,
    peakTac: 200,
    heavyBackgroundArea: 0,
    isGrayscale: false,
    richBlackArea: 0,
    isPhotoHeavy: false,
    isLowInk: false,
    ...overrides,
  };
}

describe('analyzeInkOptimization — empty input', () => {
  it('handles empty array without throwing', () => {
    const result = analyzeInkOptimization([]);
    expect(result.score).toBe(100);
    expect(result.issues).toHaveLength(0);
    expect(result.opportunities).toHaveLength(0);
    expect(result.costCategory).toBe('LOW');
  });
});

describe('analyzeInkOptimization — heavy background', () => {
  it('detects heavy background when area > 40% and peakTac > 300', () => {
    const result = analyzeInkOptimization([
      makePage({ heavyBackgroundArea: 50, peakTac: 350 }),
    ]);
    const heavyIssue = result.issues.find(i => i.id.startsWith('ink-heavy-bg'));
    expect(heavyIssue).toBeDefined();
    expect(heavyIssue!.severity).toBe('warning');
    expect(result.opportunities).toContain('Consider lighter tint or paper change');
  });

  it('does NOT detect heavy background when peakTac <= 300', () => {
    const result = analyzeInkOptimization([
      makePage({ heavyBackgroundArea: 50, peakTac: 280 }),
    ]);
    const heavyIssue = result.issues.find(i => i.id.startsWith('ink-heavy-bg'));
    expect(heavyIssue).toBeUndefined();
  });

  it('does NOT detect heavy background when area <= 40%', () => {
    const result = analyzeInkOptimization([
      makePage({ heavyBackgroundArea: 30, peakTac: 400 }),
    ]);
    const heavyIssue = result.issues.find(i => i.id.startsWith('ink-heavy-bg'));
    expect(heavyIssue).toBeUndefined();
  });
});

describe('analyzeInkOptimization — rich black', () => {
  it('detects rich black overuse when richBlackArea > 10%', () => {
    const result = analyzeInkOptimization([makePage({ richBlackArea: 15 })]);
    const richBlackIssue = result.issues.find(i => i.id.startsWith('ink-rich-black'));
    expect(richBlackIssue).toBeDefined();
    expect(richBlackIssue!.severity).toBe('info');
    expect(result.opportunities).toContain('Replace with K-only black for text areas');
  });

  it('does NOT detect rich black when area <= 10%', () => {
    const result = analyzeInkOptimization([makePage({ richBlackArea: 5 })]);
    const richBlackIssue = result.issues.find(i => i.id.startsWith('ink-rich-black'));
    expect(richBlackIssue).toBeUndefined();
  });
});

describe('analyzeInkOptimization — photo heavy', () => {
  it('detects photo-heavy when isPhotoHeavy and peakTac > 300', () => {
    const result = analyzeInkOptimization([makePage({ isPhotoHeavy: true, peakTac: 350 })]);
    const photoIssue = result.issues.find(i => i.id.startsWith('ink-photo'));
    expect(photoIssue).toBeDefined();
    expect(photoIssue!.severity).toBe('info');
  });

  it('does NOT detect photo-heavy when peakTac <= 300', () => {
    const result = analyzeInkOptimization([makePage({ isPhotoHeavy: true, peakTac: 250 })]);
    const photoIssue = result.issues.find(i => i.id.startsWith('ink-photo'));
    expect(photoIssue).toBeUndefined();
  });
});

describe('analyzeInkOptimization — costCategory', () => {
  it('returns LOW cost for low average coverage', () => {
    const result = analyzeInkOptimization([makePage({ avgCoverage: 30 })]);
    expect(result.costCategory).toBe('LOW');
  });

  it('returns MEDIUM cost for mid average coverage', () => {
    // inkUsageIndex = round((90/300)*100) = 30 → MEDIUM (> 25)
    const result = analyzeInkOptimization([makePage({ avgCoverage: 90 })]);
    expect(result.costCategory).toBe('MEDIUM');
  });

  it('returns HIGH cost for high average coverage', () => {
    // inkUsageIndex = round((210/300)*100) = 70 → HIGH (> 60)
    const result = analyzeInkOptimization([makePage({ avgCoverage: 210 })]);
    expect(result.costCategory).toBe('HIGH');
  });
});

describe('analyzeInkOptimization — score deductions', () => {
  it('deducts 10 from score for heavy background', () => {
    const result = analyzeInkOptimization([makePage({ heavyBackgroundArea: 50, peakTac: 350 })]);
    expect(result.score).toBe(90);
  });

  it('deducts 5 from score for rich black overuse', () => {
    const result = analyzeInkOptimization([makePage({ richBlackArea: 15 })]);
    expect(result.score).toBe(95);
  });

  it('never returns score below 0', () => {
    const pages = Array.from({ length: 20 }, (_, i) =>
      makePage({ pageIndex: i, heavyBackgroundArea: 50, peakTac: 400, richBlackArea: 20 })
    );
    const result = analyzeInkOptimization(pages);
    expect(result.score).toBeGreaterThanOrEqual(0);
  });
});

describe('analyzeInkOptimization — inkUsageIndex', () => {
  it('calculates inkUsageIndex as percentage of 300% TAC ceiling', () => {
    const result = analyzeInkOptimization([makePage({ avgCoverage: 150 })]);
    expect(result.inkUsageIndex).toBe(50);
  });

  it('caps inkUsageIndex at 100', () => {
    const result = analyzeInkOptimization([makePage({ avgCoverage: 500 })]);
    expect(result.inkUsageIndex).toBe(100);
  });
});
