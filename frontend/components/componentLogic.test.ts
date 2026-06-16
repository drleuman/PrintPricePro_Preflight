// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { getProofStatusConfig } from './proof/ProofApprovalPanel';
import { getRemediationConfig } from './remediation/CustomerRemediationPanel';
import { getDecisionConfig } from './review/ReviewDecisionPanel';
import { safeMetricEntries } from './proof/VisualProofPanel';
import { formatFileSize } from './reports/HeavyPdfProbePanel';

// Identity translation stub — returns the key so we can assert on structure
// without coupling tests to actual locale strings.
const t = (k: string) => k;

// ---------------------------------------------------------------------------
// getProofStatusConfig
// ---------------------------------------------------------------------------

describe('getProofStatusConfig', () => {
  it('PROOF_APPROVED does not block progression', () => {
    const cfg = getProofStatusConfig('PROOF_APPROVED', t);
    expect(cfg.blocksProgression).toBe(false);
  });

  it('PROOF_REJECTED_REUPLOAD_REQUIRED blocks progression', () => {
    const cfg = getProofStatusConfig('PROOF_REJECTED_REUPLOAD_REQUIRED', t);
    expect(cfg.blocksProgression).toBe(true);
  });

  it('PROOF_PENDING_CUSTOMER blocks progression', () => {
    const cfg = getProofStatusConfig('PROOF_PENDING_CUSTOMER', t);
    expect(cfg.blocksProgression).toBe(true);
  });

  it('PROOF_REQUIRED blocks progression', () => {
    const cfg = getProofStatusConfig('PROOF_REQUIRED', t);
    expect(cfg.blocksProgression).toBe(true);
  });

  it('PROOF_NOT_REQUIRED does not block progression and is the default', () => {
    const cfg = getProofStatusConfig('PROOF_NOT_REQUIRED', t);
    expect(cfg.blocksProgression).toBe(false);
  });

  it('unknown status falls through to PROOF_NOT_REQUIRED default', () => {
    const cfg = getProofStatusConfig('UNKNOWN_STATUS' as any, t);
    expect(cfg.blocksProgression).toBe(false);
  });

  it('PROOF_REJECTED uses red color class', () => {
    const cfg = getProofStatusConfig('PROOF_REJECTED_REUPLOAD_REQUIRED', t);
    expect(cfg.colorClass).toContain('red');
  });

  it('PROOF_APPROVED uses emerald color class', () => {
    const cfg = getProofStatusConfig('PROOF_APPROVED', t);
    expect(cfg.colorClass).toContain('emerald');
  });
});

// ---------------------------------------------------------------------------
// getRemediationConfig
// ---------------------------------------------------------------------------

describe('getRemediationConfig', () => {
  it('REUPLOAD_REQUIRED requires action and shows upload CTA', () => {
    const cfg = getRemediationConfig('REUPLOAD_REQUIRED', t);
    expect(cfg.requiresAction).toBe(true);
    expect(cfg.showUploadCta).toBe(true);
  });

  it('WAITING_FOR_UPLOAD requires action but no upload CTA', () => {
    const cfg = getRemediationConfig('WAITING_FOR_UPLOAD', t);
    expect(cfg.requiresAction).toBe(true);
    expect(cfg.showUploadCta).toBe(false);
  });

  it('PREFLIGHT_REQUIRED requires action, no upload CTA', () => {
    const cfg = getRemediationConfig('PREFLIGHT_REQUIRED', t);
    expect(cfg.requiresAction).toBe(true);
    expect(cfg.showUploadCta).toBe(false);
  });

  it('REVIEW_REQUIRED requires action', () => {
    const cfg = getRemediationConfig('REVIEW_REQUIRED', t);
    expect(cfg.requiresAction).toBe(true);
  });

  it('APPROVED_WITH_WARNINGS does not require action', () => {
    const cfg = getRemediationConfig('APPROVED_WITH_WARNINGS', t);
    expect(cfg.requiresAction).toBe(false);
  });

  it('RESOLVED does not require action', () => {
    const cfg = getRemediationConfig('RESOLVED', t);
    expect(cfg.requiresAction).toBe(false);
    expect(cfg.colorClass).toContain('emerald');
  });

  it('unknown state falls through to muted default', () => {
    const cfg = getRemediationConfig('SOMETHING_ELSE' as any, t);
    expect(cfg.requiresAction).toBe(false);
    expect(cfg.showUploadCta).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getDecisionConfig
// ---------------------------------------------------------------------------

describe('getDecisionConfig', () => {
  it('APPROVED_FOR_PRODUCTION does not block progression', () => {
    const cfg = getDecisionConfig('APPROVED_FOR_PRODUCTION', t);
    expect(cfg.blocksProgression).toBe(false);
  });

  it('APPROVED_WITH_WARNINGS does not block progression', () => {
    const cfg = getDecisionConfig('APPROVED_WITH_WARNINGS', t);
    expect(cfg.blocksProgression).toBe(false);
  });

  it('REJECTED_REQUIRES_REUPLOAD blocks progression', () => {
    const cfg = getDecisionConfig('REJECTED_REQUIRES_REUPLOAD', t);
    expect(cfg.blocksProgression).toBe(true);
    expect(cfg.colorClass).toContain('red');
  });

  it('REQUEST_CUSTOMER_REUPLOAD blocks progression', () => {
    const cfg = getDecisionConfig('REQUEST_CUSTOMER_REUPLOAD', t);
    expect(cfg.blocksProgression).toBe(true);
  });

  it('NEEDS_MORE_INFORMATION blocks progression', () => {
    const cfg = getDecisionConfig('NEEDS_MORE_INFORMATION', t);
    expect(cfg.blocksProgression).toBe(true);
  });

  it('NO_DECISION blocks progression (conservative default)', () => {
    const cfg = getDecisionConfig('NO_DECISION', t);
    expect(cfg.blocksProgression).toBe(true);
  });

  it('unknown decision falls through to NO_DECISION default and blocks progression', () => {
    const cfg = getDecisionConfig('INVENTED' as any, t);
    expect(cfg.blocksProgression).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// safeMetricEntries — security-critical: must never expose file paths
// ---------------------------------------------------------------------------

describe('safeMetricEntries', () => {
  it('returns empty array for null input', () => {
    expect(safeMetricEntries(null)).toEqual([]);
  });

  it('returns empty array for non-object input', () => {
    expect(safeMetricEntries('string')).toEqual([]);
    expect(safeMetricEntries(42)).toEqual([]);
  });

  it('keeps numeric values', () => {
    const result = safeMetricEntries({ pixelDiff: 120, score: 0.95 });
    expect(result).toContainEqual(['pixelDiff', 120]);
    expect(result).toContainEqual(['score', 0.95]);
  });

  it('keeps boolean values', () => {
    const result = safeMetricEntries({ hasChanges: true, isIdentical: false });
    expect(result).toContainEqual(['hasChanges', true]);
    expect(result).toContainEqual(['isIdentical', false]);
  });

  it('filters out string values containing backslash paths', () => {
    const result = safeMetricEntries({ path: 'C:\\Users\\braul\\tmp\\preview.pdf' });
    expect(result).toHaveLength(0);
  });

  it('filters out string values containing forward slash paths', () => {
    const result = safeMetricEntries({ src: '/tmp/render/page1.png' });
    expect(result).toHaveLength(0);
  });

  it('filters out strings ending with .pdf extension', () => {
    const result = safeMetricEntries({ file: 'output.pdf' });
    expect(result).toHaveLength(0);
  });

  it('filters out strings ending with .png extension', () => {
    const result = safeMetricEntries({ preview: 'preview.png' });
    expect(result).toHaveLength(0);
  });

  it('filters out strings ending with .json extension', () => {
    const result = safeMetricEntries({ meta: 'report.json' });
    expect(result).toHaveLength(0);
  });

  it('filters out object and array values', () => {
    const result = safeMetricEntries({ nested: { a: 1 }, arr: [1, 2] });
    expect(result).toHaveLength(0);
  });

  it('keeps short safe strings without path-like patterns', () => {
    const result = safeMetricEntries({ status: 'ok', label: 'Pass' });
    expect(result).toContainEqual(['status', 'ok']);
    expect(result).toContainEqual(['label', 'Pass']);
  });

  it('mixed input: keeps safe values, strips unsafe ones', () => {
    const input = {
      score: 0.9,
      changed: true,
      filePath: '/renders/output.png',
      label: 'Minor diff',
    };
    const result = safeMetricEntries(input);
    const keys = result.map(([k]) => k);
    expect(keys).toContain('score');
    expect(keys).toContain('changed');
    expect(keys).toContain('label');
    expect(keys).not.toContain('filePath');
  });
});

// ---------------------------------------------------------------------------
// formatFileSize
// ---------------------------------------------------------------------------

describe('formatFileSize', () => {
  it('returns null when neither file_size_mb nor file_size_bytes is set', () => {
    expect(formatFileSize({})).toBeNull();
  });

  it('uses file_size_mb when provided (already in MB)', () => {
    expect(formatFileSize({ file_size_mb: 12.3 })).toBe('12.3 MB');
  });

  it('rounds file_size_mb to 1 decimal', () => {
    expect(formatFileSize({ file_size_mb: 12.3456 })).toBe('12.3 MB');
  });

  it('converts file_size_bytes to MB', () => {
    expect(formatFileSize({ file_size_bytes: 5 * 1024 * 1024 })).toBe('5.0 MB');
  });

  it('prefers file_size_mb over file_size_bytes when both are set', () => {
    expect(formatFileSize({ file_size_mb: 3.5, file_size_bytes: 1024 })).toBe('3.5 MB');
  });

  it('handles fractional bytes correctly', () => {
    const bytes = 1.5 * 1024 * 1024;
    expect(formatFileSize({ file_size_bytes: bytes })).toBe('1.5 MB');
  });
});
