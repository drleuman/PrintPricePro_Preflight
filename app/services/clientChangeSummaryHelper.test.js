import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { humanizeFixCode, recommendedNextAction, buildClientChangeSummary, NO_RELIABLE_AUTOFIX_CODES } = require('./clientChangeSummaryHelper');

import { describe, it, expect } from 'vitest';

// ---------------------------------------------------------------------------
// humanizeFixCode
// ---------------------------------------------------------------------------

describe('humanizeFixCode', () => {
  it('maps REBUILD_TRIMBOX to a human label', () => {
    expect(humanizeFixCode('REBUILD_TRIMBOX')).toContain('trim area');
  });

  it('maps APPLY_BLEED to a human label', () => {
    expect(humanizeFixCode('APPLY_BLEED')).toContain('Bleed');
  });

  it('maps CONVERT_CMYK to a human label', () => {
    expect(humanizeFixCode('CONVERT_CMYK')).toContain('CMYK');
  });

  it('maps INJECT_OUTPUT_INTENT to a human label', () => {
    expect(humanizeFixCode('INJECT_OUTPUT_INTENT')).toContain('color profile');
  });

  it('maps STRIP_JAVASCRIPT to a human label', () => {
    expect(humanizeFixCode('STRIP_JAVASCRIPT')).toContain('JavaScript');
  });

  it('maps UPSCALE_LOW_RESOLUTION to a human label mentioning reupload', () => {
    expect(humanizeFixCode('UPSCALE_LOW_RESOLUTION')).toContain('reupload');
  });

  it('returns a generic fallback for unknown codes', () => {
    expect(humanizeFixCode('UNKNOWN_CODE')).toBe('Correction UNKNOWN_CODE was processed.');
  });

  it('maps all 9 NO_RELIABLE_AUTOFIX_CODES to non-generic labels', () => {
    for (const code of NO_RELIABLE_AUTOFIX_CODES) {
      const label = humanizeFixCode(code);
      expect(label).not.toBe(`Correction ${code} was processed.`);
    }
  });
});

// ---------------------------------------------------------------------------
// recommendedNextAction
// ---------------------------------------------------------------------------

describe('recommendedNextAction', () => {
  it('returns reupload recommendation for UPSCALE_LOW_RESOLUTION', () => {
    expect(recommendedNextAction('UPSCALE_LOW_RESOLUTION')).toContain('reupload');
  });

  it('returns reupload recommendation for REPAIR_JPEG_ARTIFACTS', () => {
    expect(recommendedNextAction('REPAIR_JPEG_ARTIFACTS')).toContain('reupload');
  });

  it('returns reupload recommendation for RASTER_TO_VECTOR', () => {
    expect(recommendedNextAction('RASTER_TO_VECTOR')).toContain('reupload');
  });

  it('returns reupload recommendation for RECOVER_MISSING_GLYPHS', () => {
    expect(recommendedNextAction('RECOVER_MISSING_GLYPHS')).toContain('reupload');
  });

  it('returns operator review recommendation for SUBSTITUTE_FONTS', () => {
    expect(recommendedNextAction('SUBSTITUTE_FONTS')).toContain('Operator review');
  });

  it('returns operator review recommendation for CONVERT_PDFX', () => {
    expect(recommendedNextAction('CONVERT_PDFX')).toContain('Operator review');
  });

  it('returns operator review recommendation for CORRECT_TAC', () => {
    expect(recommendedNextAction('CORRECT_TAC')).toContain('Operator review');
  });

  it('returns null for codes that have no special next action', () => {
    expect(recommendedNextAction('REBUILD_TRIMBOX')).toBeNull();
    expect(recommendedNextAction('INJECT_OUTPUT_INTENT')).toBeNull();
    expect(recommendedNextAction('UNKNOWN')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// buildClientChangeSummary
// ---------------------------------------------------------------------------

describe('buildClientChangeSummary', () => {
  it('maps applied fix string codes to humanized labels', () => {
    const result = buildClientChangeSummary({
      jobId: 'job-1',
      appliedFixes: ['REBUILD_TRIMBOX', 'APPLY_BLEED'],
    });
    expect(result.appliedChanges).toHaveLength(2);
    expect(result.appliedChanges[0].code).toBe('REBUILD_TRIMBOX');
    expect(result.appliedChanges[0].label).toContain('trim area');
  });

  it('maps applied fix object codes', () => {
    const result = buildClientChangeSummary({
      jobId: 'job-2',
      appliedFixes: [{ code: 'INJECT_OUTPUT_INTENT', description: 'Added ICC profile' }],
    });
    expect(result.appliedChanges[0].label).toContain('color profile');
    expect(result.appliedChanges[0].description).toBe('Added ICC profile');
  });

  it('maps skipped fixes correctly', () => {
    const result = buildClientChangeSummary({
      jobId: 'job-3',
      skippedFixes: [{ code: 'CONVERT_CMYK', reason: 'customer opt-out' }],
    });
    expect(result.skippedChanges).toHaveLength(1);
    expect(result.skippedChanges[0].code).toBe('CONVERT_CMYK');
    expect(result.skippedChanges[0].reason).toBe('customer opt-out');
    expect(result.reviewWarnings).toContain('Some requested corrections were not applied automatically.');
  });

  it('maps failed fixes and adds warning', () => {
    const result = buildClientChangeSummary({
      jobId: 'job-4',
      failedFixes: [{ code: 'FLATTEN_FORMS' }],
    });
    expect(result.failedChanges).toHaveLength(1);
    expect(result.reviewWarnings).toContain('Some corrections failed and may require manual prepress intervention.');
  });

  it('adds review warning for requiresHumanReview fix', () => {
    const result = buildClientChangeSummary({
      jobId: 'job-5',
      appliedFixes: [{ code: 'APPLY_BLEED', requiresHumanReview: true }],
    });
    expect(result.reviewWarnings).toContain('This change requires visual review before production.');
    expect(result.whatRequiresReview).toHaveLength(1);
  });

  it('adds warning for HIGH destructiveFixRisk', () => {
    const result = buildClientChangeSummary({
      jobId: 'job-6',
      appliedFixes: [{ code: 'CONVERT_GRAYSCALE', destructiveFixRisk: 'HIGH' }],
    });
    expect(result.reviewWarnings).toContain('This change may alter the visual appearance of the file.');
  });

  it('adds CMYK conversion color warning', () => {
    const result = buildClientChangeSummary({
      jobId: 'job-7',
      appliedFixes: ['CONVERT_CMYK'],
    });
    expect(result.reviewWarnings).toContain('CMYK conversion can slightly change colors. Please review the output PDF.');
  });

  it('adds bleed box expansion warning when strategy is BOX_EXPANSION_ONLY', () => {
    const result = buildClientChangeSummary({
      jobId: 'job-8',
      appliedFixes: ['APPLY_BLEED'],
      strategy: 'BOX_EXPANSION_ONLY',
    });
    expect(result.reviewWarnings).toContain('Bleed was applied by adjusting PDF page boxes; no new artwork was created beyond the page edge.');
  });

  it('deduplicates review warnings for the same issue', () => {
    const result = buildClientChangeSummary({
      jobId: 'job-9',
      appliedFixes: [
        { code: 'CONVERT_CMYK', requiresHumanReview: true },
        { code: 'APPLY_BLEED', requiresHumanReview: true },
      ],
    });
    const humanReviewWarnings = result.reviewWarnings.filter(w => w === 'This change requires visual review before production.');
    expect(humanReviewWarnings).toHaveLength(1);
  });

  it('surfaces NO_RELIABLE_AUTOFIX_CODES in whatCannotBeFixedAutomatically', () => {
    const result = buildClientChangeSummary({
      jobId: 'job-10',
      appliedFixes: ['UPSCALE_LOW_RESOLUTION', 'REBUILD_TRIMBOX'],
    });
    const codes = result.whatCannotBeFixedAutomatically.map(c => c.code);
    expect(codes).toContain('UPSCALE_LOW_RESOLUTION');
    expect(codes).not.toContain('REBUILD_TRIMBOX');
  });

  it('deduplicates cannotFixAutomatically codes across applied/skipped/failed', () => {
    const result = buildClientChangeSummary({
      jobId: 'job-11',
      appliedFixes: ['SUBSTITUTE_FONTS'],
      skippedFixes: ['SUBSTITUTE_FONTS'],
    });
    expect(result.whatCannotBeFixedAutomatically).toHaveLength(1);
  });

  it('includes recommendedNextActions for relevant codes', () => {
    const result = buildClientChangeSummary({
      jobId: 'job-12',
      appliedFixes: ['SUBSTITUTE_FONTS'],
    });
    expect(result.recommendedNextActions).toHaveLength(1);
    expect(result.recommendedNextActions[0].action).toContain('Operator review');
  });

  it('productionRecommendation: certified when productionCertified=true and no review', () => {
    const result = buildClientChangeSummary({
      jobId: 'job-13',
      productionCertified: true,
      requiresHumanReview: false,
    });
    expect(result.productionRecommendation).toContain('Production certified');
  });

  it('productionRecommendation: review required when requiresHumanReview=true', () => {
    const result = buildClientChangeSummary({
      jobId: 'job-14',
      productionCertified: false,
      requiresHumanReview: true,
    });
    expect(result.productionRecommendation).toContain('Review required');
  });

  it('productionRecommendation: generic verify message otherwise', () => {
    const result = buildClientChangeSummary({ jobId: 'job-15' });
    expect(result.productionRecommendation).toContain('Please verify the output');
  });

  it('handles empty/minimal input without crashing', () => {
    const result = buildClientChangeSummary({ jobId: 'job-16' });
    expect(result.appliedChanges).toHaveLength(0);
    expect(result.skippedChanges).toHaveLength(0);
    expect(result.failedChanges).toHaveLength(0);
    expect(result.reviewWarnings).toHaveLength(0);
  });

  it('filters null entries from fix arrays', () => {
    const result = buildClientChangeSummary({
      jobId: 'job-17',
      appliedFixes: [null, 'REBUILD_TRIMBOX', null],
    });
    expect(result.appliedChanges).toHaveLength(1);
  });
});
