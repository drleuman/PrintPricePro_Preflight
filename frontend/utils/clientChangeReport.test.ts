import { describe, it, expect } from 'vitest';
import { generateClientChangeReport } from './clientChangeReport';

describe('clientChangeReport', () => {
  it('generates correct summary for technically repaired but not certified file', () => {
    const mockResult = {
      productionCertified: false,
      requiresHumanReview: true,
      fixes: ['REBUILD_TRIMBOX', 'APPLY_BLEED', 'INJECT_OUTPUT_INTENT'],
      skipped_fixes: ['CONVERT_CMYK'],
      reviewReasons: ['APPLY_BLEED'],
      summary: {
        before: {
          issues: ['TrimBox Not Defined', 'BleedBox Not Defined', 'RGB Objects Detected', 'OutputIntent Missing']
        }
      }
    };

    const report = generateClientChangeReport(mockResult);

    expect(report.headline).toContain('Technically corrected');
    expect(report.productionReadiness.certified).toBe(false);
    expect(report.statusTone).toBe('warning');
    
    // Changes applied
    const appliedTitles = report.changesApplied.map(c => c.title);
    expect(appliedTitles).toContain('Page trim area was rebuilt');
    expect(appliedTitles).toContain('Bleed area was added');
    expect(appliedTitles).toContain('Print color profile was added');
    
    // Skipped
    const skippedTitles = report.itemsSkipped.map(c => c.title);
    expect(skippedTitles).toContain('RGB-to-CMYK conversion was not applied automatically');
    
    // Still needs review
    const reviewTitles = report.stillNeedsReview.map(c => c.title);
    expect(reviewTitles).toContain('Confirm that the added bleed area is visually valid');
    expect(reviewTitles).toContain('Decide whether RGB objects should be converted to CMYK');
    
    // Detected before
    const detectedTitles = report.detectedBefore.map(c => c.title);
    expect(detectedTitles).toContain('RGB color objects were detected');
    expect(detectedTitles).toContain('Output intent was missing');
    
    // Message does not incorrectly say it is certified
    expect(report.customerMessage).not.toContain('production certified. We added print output intent');
    expect(report.customerMessage).toContain('not applied automatically');
  });

  it('generates correct summary for a fully certified file', () => {
    const mockResult = {
      productionCertified: true,
      requiresHumanReview: false,
      fixes: ['REBUILD_TRIMBOX'],
      skipped_fixes: [],
      reviewReasons: [],
      summary: {
        before: {
          issues: ['TrimBox Not Defined']
        }
      }
    };

    const report = generateClientChangeReport(mockResult);

    expect(report.productionReadiness.certified).toBe(true);
    expect(report.statusTone).toBe('success');
    expect(report.headline).toContain('Your PDF has been corrected');
    expect(report.customerMessage).toContain('successfully corrected');
  });

  it('artifact_trust certified_pdf_allowed=false overrides productionCertified=true', () => {
    const result = {
      productionCertified: true,
      requiresHumanReview: false,
      fixes: ['REBUILD_TRIMBOX'],
      skipped_fixes: [],
      reviewReasons: [],
      artifact_trust: {
        certified_pdf_allowed: false,
        production_certified: true,
        review_required: false,
      },
    };

    const report = generateClientChangeReport(result);

    expect(report.productionReadiness.certified).toBe(false);
    expect(report.statusTone).not.toBe('success');
  });

  it('artifact_trust production_certified=false overrides legacy productionCertified=true', () => {
    const result = {
      productionCertified: true,
      requiresHumanReview: false,
      fixes: [],
      artifact_trust: { production_certified: false },
    };

    const report = generateClientChangeReport(result);
    expect(report.productionReadiness.certified).toBe(false);
  });

  it('surfaces governanceWarnings as operatorNotes', () => {
    const result = {
      productionCertified: false,
      requiresHumanReview: true,
      fixes: [],
      artifact_trust: {
        review_required: true,
        warnings: ['Color space mismatch detected', 'Missing output intent'],
      },
    };

    const report = generateClientChangeReport(result);

    expect(report.operatorNotes).toContain('Color space mismatch detected');
    expect(report.operatorNotes).toContain('Missing output intent');
    expect(report.operatorNotes).toContain('A production operator must review this file before printing.');
  });

  it('does not add operator review note when review is not required', () => {
    const result = {
      productionCertified: true,
      requiresHumanReview: false,
      fixes: ['REBUILD_TRIMBOX'],
      artifact_trust: {
        production_certified: true,
        certified_pdf_allowed: true,
        review_required: false,
        warnings: [],
      },
    };

    const report = generateClientChangeReport(result);
    expect(report.operatorNotes).not.toContain('A production operator must review this file before printing.');
  });

  it('requiresReview with zero applied fixes → review-only headline and customer message', () => {
    const result = {
      productionCertified: false,
      requiresHumanReview: true,
      fixes: [],
      skipped_fixes: [],
      reviewReasons: [],
    };

    const report = generateClientChangeReport(result);

    expect(report.headline).toContain('not changed automatically');
    expect(report.customerMessage).toContain('not changed automatically');
    expect(report.executiveSummary).toContain('No automatic changes were applied');
    expect(report.productionReadiness.explanation).toContain('human review');
  });

  it('statusTone is neutral when not certified and no review required', () => {
    const result = {
      productionCertified: false,
      requiresHumanReview: false,
      fixes: [],
      skipped_fixes: [],
    };

    const report = generateClientChangeReport(result);
    expect(report.statusTone).toBe('neutral');
  });

  it('deduplicates detectedBefore items with the same title', () => {
    const result = {
      productionCertified: false,
      requiresHumanReview: false,
      fixes: [],
      summary: {
        before: {
          issues: [
            'RGB Objects Detected',
            'RGB Objects Detected',
            'RGB color items present',
          ],
        },
      },
    };

    const report = generateClientChangeReport(result);
    const rgbEntries = report.detectedBefore.filter(d => d.title === 'RGB color objects were detected');
    expect(rgbEntries).toHaveLength(1);
  });

  it('handles null result gracefully', () => {
    const report = generateClientChangeReport(null);

    expect(report.statusTone).toBe('neutral');
    expect(report.changesApplied).toHaveLength(0);
    expect(report.itemsSkipped).toHaveLength(0);
    expect(report.detectedBefore).toHaveLength(0);
  });

  it('reads applied_fixes when fixes array is absent', () => {
    const result = {
      productionCertified: false,
      requiresHumanReview: false,
      applied_fixes: ['REBUILD_TRIMBOX'],
    };

    const report = generateClientChangeReport(result);
    const titles = report.changesApplied.map(c => c.title);
    expect(titles).toContain('Page trim area was rebuilt');
  });

  it('CONVERT_CMYK in skipped_fixes creates both skipped and review items', () => {
    const result = {
      productionCertified: false,
      requiresHumanReview: false,
      fixes: [],
      skipped_fixes: ['CONVERT_CMYK'],
    };

    const report = generateClientChangeReport(result);
    expect(report.itemsSkipped.some(i => i.technicalCode === 'CONVERT_CMYK')).toBe(true);
    expect(report.stillNeedsReview.some(i => i.title.includes('CMYK'))).toBe(true);
  });

  it('standards-validated headline when artifact_trust.standard_certified=true', () => {
    const result = {
      requiresHumanReview: false,
      fixes: ['REBUILD_TRIMBOX'],
      artifact_trust: {
        production_certified: true,
        standard_certified: true,
        certified_pdf_allowed: true,
        review_required: false,
      },
    };

    const report = generateClientChangeReport(result);
    expect(report.headline).toContain('standards-validated');
    expect(report.productionReadiness.label).toBe('Standards-validated');
  });
});
