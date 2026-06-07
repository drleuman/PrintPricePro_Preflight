import { describe, it, expect } from 'vitest';
import { translateIssueTitle, classifyNoAutofixPolicy } from './issueMapper';
import type { Issue } from '../types';

// Mock translation function that returns the key as-is for testing
const t = (key: string) => key;

function makeIssue(overrides: Partial<Issue> = {}): Issue {
  return {
    id: 'test-issue',
    severity: 'error',
    ...overrides,
  };
}

describe('translateIssueTitle — known PPOS codes', () => {
  const codeMap: [string, string][] = [
    ['IND_GEOM', 'finding.geom_anomaly'],
    ['IND_TYPE', 'finding.typography_integrity'],
    ['IND_COLOR', 'finding.color_compliance'],
    ['IND_BOX', 'finding.trim_anomaly'],
    ['IND_IMAGE', 'finding.image_analysis'],
    ['IND_BLEED', 'finding.bleed_exception'],
    ['IND_TRIM', 'finding.trim_anomaly'],
    ['IND_FONT', 'finding.typography_integrity'],
    ['IND_BLACK', 'finding.ink_limit_violation'],
    ['IND_SPOT', 'finding.spot_color_warning'],
    ['IND_PDF', 'finding.pdf_compliance_error'],
    ['IND_IMG', 'finding.image_analysis'],
    ['IND_RESOLUTION', 'finding.resolution_fault'],
    ['IND_METADATA', 'finding.metadata_fault'],
    ['IND_TRANSPARENCY', 'finding.transparency_risk'],
    ['TRIM_BOX_MISSING', 'finding.trim_anomaly'],
    ['COLOR_RGB', 'finding.rgb_detected'],
    ['IMAGE_LOW_RES', 'finding.low_res_asset'],
    ['FONT_NOT_EMBEDDED', 'finding.unembedded_glyph'],
    ['BLEED_MISSING', 'finding.bleed_exception'],
    ['INTENT_BOOK', 'finding.book_intent'],
    ['HEURISTIC_TEXT_OUTLINED', 'finding.text_outlined'],
  ];

  it.each(codeMap)('maps code %s to translation key %s', (code, expectedKey) => {
    const issue = makeIssue({ code });
    expect(translateIssueTitle(issue, t)).toBe(expectedKey);
  });

  it('is case-insensitive for the code field', () => {
    const issue = makeIssue({ code: 'ind_geom' });
    expect(translateIssueTitle(issue, t)).toBe('finding.geom_anomaly');
  });

  it('falls back to id when code is missing', () => {
    const issue = makeIssue({ code: undefined, id: 'IND_COLOR' });
    expect(translateIssueTitle(issue, t)).toBe('finding.color_compliance');
  });
});

describe('translateIssueTitle — Spanish fallback', () => {
  it('returns trim_anomaly for title containing "marcas de corte"', () => {
    const issue = makeIssue({ title: 'Problemas con marcas de corte', code: 'UNKNOWN' });
    expect(translateIssueTitle(issue, t)).toBe('finding.trim_anomaly');
  });

  it('returns trim_anomaly for message containing "marcas de corte"', () => {
    const issue = makeIssue({ message: 'Se detectaron marcas de corte', code: 'UNKNOWN' });
    expect(translateIssueTitle(issue, t)).toBe('finding.trim_anomaly');
  });

  it('returns color_compliance for title containing "Uso de RGB"', () => {
    const issue = makeIssue({ title: 'Uso de RGB detectado', code: 'UNKNOWN' });
    expect(translateIssueTitle(issue, t)).toBe('finding.color_compliance');
  });

  it('returns color_compliance for title containing "perfiles no estándar"', () => {
    const issue = makeIssue({ title: 'Uso de perfiles no estándar', code: 'UNKNOWN' });
    expect(translateIssueTitle(issue, t)).toBe('finding.color_compliance');
  });
});

describe('translateIssueTitle — default fallbacks', () => {
  it('returns "Unknown Finding" for null', () => {
    expect(translateIssueTitle(null, t)).toBe('Unknown Finding');
  });

  it('returns "Unknown Finding" for undefined', () => {
    expect(translateIssueTitle(undefined, t)).toBe('Unknown Finding');
  });

  it('returns title when code is unknown and no Spanish match', () => {
    const issue = makeIssue({ code: 'COMPLETELY_UNKNOWN', title: 'My Title', message: 'My Message' });
    expect(translateIssueTitle(issue, t)).toBe('My Title');
  });

  it('falls back to message when title is absent', () => {
    const issue = makeIssue({ code: 'COMPLETELY_UNKNOWN', title: undefined, message: 'Fallback Message' });
    expect(translateIssueTitle(issue, t)).toBe('Fallback Message');
  });

  it('falls back to critical_trace key when neither title nor message present', () => {
    const issue = makeIssue({ code: 'COMPLETELY_UNKNOWN', title: undefined, message: undefined });
    expect(translateIssueTitle(issue, t)).toBe('finding.critical_trace');
  });
});

// ---------------------------------------------------------------------------
// Phase APP-40.5 — No-Autofix Policy Enforcement
// These findings must never be presented as "Magic Fix available" /
// "Production certified" / "Fixed automatically" — they require human/customer
// involvement and are surfaced as diagnostic-only / reupload-recommended /
// operator-review-required instead.
// ---------------------------------------------------------------------------
describe('classifyNoAutofixPolicy', () => {
  it('returns null for a normal, reliably-autofixable issue', () => {
    expect(classifyNoAutofixPolicy(makeIssue({ repairStrategy: 'EMBED_FONTS' } as any))).toBeNull();
    expect(classifyNoAutofixPolicy(null)).toBeNull();
  });

  it('classifies reupload-recommended repair strategies (image-quality dependent on the source file)', () => {
    expect(classifyNoAutofixPolicy({ repairStrategy: 'UPSCALE_LOW_RESOLUTION' })).toBe('customer_reupload_recommended');
    expect(classifyNoAutofixPolicy({ repairStrategy: 'REPAIR_JPEG_ARTIFACTS' })).toBe('customer_reupload_recommended');
    expect(classifyNoAutofixPolicy({ repairStrategy: 'RASTER_TO_VECTOR' })).toBe('customer_reupload_recommended');
    expect(classifyNoAutofixPolicy({ repairStrategy: 'RECOVER_MISSING_GLYPHS' })).toBe('customer_reupload_recommended');
  });

  it('classifies REBUILD_300DPI as customer-reupload-recommended — output quality still depends on the source file', () => {
    expect(classifyNoAutofixPolicy({ repairStrategy: 'REBUILD_300DPI' })).toBe('customer_reupload_recommended');
  });

  it('classifies remaining unreliable repair strategies (font substitution, PDF/X, PDF/A, TAC) as diagnostic-only', () => {
    expect(classifyNoAutofixPolicy({ repairStrategy: 'SUBSTITUTE_FONTS' })).toBe('diagnostic_only');
    expect(classifyNoAutofixPolicy({ repairStrategy: 'CONVERT_PDFX' })).toBe('diagnostic_only');
    expect(classifyNoAutofixPolicy({ repairStrategy: 'CONVERT_PDFA' })).toBe('diagnostic_only');
    expect(classifyNoAutofixPolicy({ repairStrategy: 'CORRECT_TAC' })).toBe('diagnostic_only');
  });

  it('matches case-insensitively via repairStrategy or fix_method', () => {
    expect(classifyNoAutofixPolicy({ repairStrategy: 'upscale_low_resolution' })).toBe('customer_reupload_recommended');
    expect(classifyNoAutofixPolicy({ fix_method: 'rebuild_300dpi' })).toBe('customer_reupload_recommended');
  });

  it('falls back to keyword matching against title/message/description when no recognized strategy is present', () => {
    expect(classifyNoAutofixPolicy({ title: 'Low-resolution upscale recommended for embedded artwork' })).toBe('customer_reupload_recommended');
    expect(classifyNoAutofixPolicy({ message: 'Document requires PDF/A conversion before certification' })).toBe('operator_review_required');
    expect(classifyNoAutofixPolicy({ description: 'A 300 DPI rebuild was applied for review purposes only' })).toBe('diagnostic_only');
  });

  it('returns null when no strategy or keyword matches', () => {
    expect(classifyNoAutofixPolicy({ title: 'Trim box anomaly detected', repairStrategy: 'REBUILD_TRIMBOX' })).toBeNull();
  });
});
