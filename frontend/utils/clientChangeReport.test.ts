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

    expect(report.headline).toContain('technically repaired');
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
    expect(report.customerMessage).toContain('not yet production certified');
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
    expect(report.headline).toContain('ready for printing');
    expect(report.customerMessage).toContain('is now production certified');
  });
});
