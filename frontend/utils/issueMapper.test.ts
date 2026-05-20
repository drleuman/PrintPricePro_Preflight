import { describe, it, expect } from 'vitest';
import { translateIssueTitle } from './issueMapper';
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
