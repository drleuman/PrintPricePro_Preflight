import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getBestArtifactKey,
  pickCanonicalJobId,
  isBleedIssue,
  isTrimBoxIssue,
  getReadableFixFailure,
  normalizePreflightResult,
  analyzeWorkflow,
  getCanonicalFileName,
} from './payloadNormalization';
import { Severity } from '../types';

// Silence internal diagnostic logs so test output stays clean
beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

// ---------------------------------------------------------------------------
// getBestArtifactKey
// ---------------------------------------------------------------------------
describe('getBestArtifactKey', () => {
  it('returns null for null or undefined', () => {
    expect(getBestArtifactKey(null)).toBeNull();
    expect(getBestArtifactKey(undefined)).toBeNull();
  });

  it('returns null for empty artifacts object', () => {
    expect(getBestArtifactKey({})).toBeNull();
  });

  it('returns null when only unknown artifact keys are present', () => {
    expect(getBestArtifactKey({ preview_pdf: 'url' })).toBeNull();
  });

  it('returns certified_pdf when only that key is present', () => {
    expect(getBestArtifactKey({ certified_pdf: 'url/cert.pdf' })).toBe('certified_pdf');
  });

  it('prefers fixed_pdf over certified_pdf', () => {
    expect(getBestArtifactKey({ certified_pdf: 'a', fixed_pdf: 'b' })).toBe('fixed_pdf');
  });

  it('prefers normalized_pdf over certified_pdf', () => {
    expect(getBestArtifactKey({ certified_pdf: 'a', normalized_pdf: 'b' })).toBe('normalized_pdf');
  });

  it('Review mode prefers review_pdf over certified_pdf', () => {
    expect(getBestArtifactKey({ certified_pdf: 'cert', review_pdf: 'review' }, true)).toBe('review_pdf');
  });

  it('Review mode falls back to fixed_pdf when review_pdf is missing', () => {
    expect(getBestArtifactKey({ fixed_pdf: 'fixed', certified_pdf: 'cert' }, true)).toBe('fixed_pdf');
  });

  it('Review mode does not select certified_pdf if safer review artifacts exist', () => {
    expect(getBestArtifactKey({ normalized_pdf: 'norm', certified_pdf: 'cert' }, true)).toBe('normalized_pdf');
  });
  
  it('Review mode returns null if no valid review artifacts exist (never certified_pdf)', () => {
    expect(getBestArtifactKey({ certified_pdf: 'cert' }, true)).toBeNull();
  });

  it('Returns correct logical key when values are physical filenames (B)', () => {
    expect(getBestArtifactKey({ review_pdf: 'fixed.pdf', fixed_pdf: 'fixed.pdf' }, true)).toBe('review_pdf');
  });

  it('Remaps .pdf keys to logical keys when they are inadvertently passed as keys', () => {
    expect(getBestArtifactKey({ 'fixed.pdf': 'url' }, false)).toBe('fixed_pdf');
    expect(getBestArtifactKey({ 'certified.pdf': 'url' }, false)).toBe('certified_pdf');
  });

  it('Certified mode prefers certified_pdf', () => {
    expect(getBestArtifactKey({ certified_pdf: 'cert', fixed_pdf: 'fixed' }, false)).toBe('certified_pdf');
  });

  it('Certified mode falls back to final_fixed_pdf when certified_pdf is missing', () => {
    expect(getBestArtifactKey({ final_fixed_pdf: 'a', fixed_pdf: 'b' }, false)).toBe('final_fixed_pdf');
  });

  it('ignores keys with falsy values', () => {
    expect(getBestArtifactKey({ fixed_pdf: '', certified_pdf: 'url' }, false)).toBe('certified_pdf');
  });
});

// ---------------------------------------------------------------------------
// pickCanonicalJobId
// ---------------------------------------------------------------------------
describe('pickCanonicalJobId', () => {
  it('returns null when all candidates are empty or null', () => {
    expect(pickCanonicalJobId(null, undefined, '')).toBeNull();
  });

  it('accepts a job_ prefixed string', () => {
    expect(pickCanonicalJobId('job_abc123')).toBe('job_abc123');
  });

  it('accepts a fix_ prefixed string', () => {
    expect(pickCanonicalJobId('fix_xyz789')).toBe('fix_xyz789');
  });

  it('rejects a plain numeric string', () => {
    expect(pickCanonicalJobId('42')).toBeNull();
  });

  it('rejects a numeric value', () => {
    expect(pickCanonicalJobId(42)).toBeNull();
  });

  it('rejects a UUID-like string without job_/fix_ prefix', () => {
    expect(pickCanonicalJobId('550e8400-e29b-41d4-a716-446655440000')).toBeNull();
  });

  it('returns fix_ id when both fix_ and job_ candidates are provided', () => {
    // Code finds fix_ first — it has higher internal priority
    expect(pickCanonicalJobId('job_first', 'fix_second')).toBe('fix_second');
  });

  it('returns first job_ match when no fix_ candidate exists', () => {
    expect(pickCanonicalJobId(null, 'job_alpha', 'job_beta')).toBe('job_alpha');
  });

  it('skips non-canonical candidates and returns the valid one', () => {
    expect(pickCanonicalJobId('99', null, 'job_valid')).toBe('job_valid');
  });
});

// ---------------------------------------------------------------------------
// isBleedIssue
// ---------------------------------------------------------------------------
describe('isBleedIssue', () => {
  it('returns false for null', () => {
    expect(isBleedIssue(null)).toBe(false);
  });

  it('returns false for empty object', () => {
    expect(isBleedIssue({})).toBe(false);
  });

  it('detects by id = missing-bleed-info', () => {
    expect(isBleedIssue({ id: 'missing-bleed-info' })).toBe(true);
  });

  it('detects by id = insufficient-bleed', () => {
    expect(isBleedIssue({ id: 'insufficient-bleed' })).toBe(true);
  });

  it('detects by code = BLEED_MISSING', () => {
    expect(isBleedIssue({ code: 'BLEED_MISSING' })).toBe(true);
  });

  it('detects by code = BLEED_INSUFFICIENT', () => {
    expect(isBleedIssue({ code: 'BLEED_INSUFFICIENT' })).toBe(true);
  });

  it('detects by code = IND_BLEED', () => {
    expect(isBleedIssue({ code: 'IND_BLEED' })).toBe(true);
  });

  it('detects by message containing "bleed" and "missing"', () => {
    expect(isBleedIssue({ message: 'Document bleed area is missing' })).toBe(true);
  });

  it('detects by message containing "bleed" and "insufficient"', () => {
    expect(isBleedIssue({ message: 'bleed is insufficient' })).toBe(true);
  });

  it('returns false for unrelated issue', () => {
    expect(isBleedIssue({ id: 'fonts-not-embedded', code: 'FONT_MISSING' })).toBe(false);
  });

  it('returns false when message has bleed but no missing/insufficient qualifier', () => {
    expect(isBleedIssue({ message: 'bleed was applied correctly' })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isTrimBoxIssue
// ---------------------------------------------------------------------------
describe('isTrimBoxIssue', () => {
  it('returns false for null', () => {
    expect(isTrimBoxIssue(null)).toBe(false);
  });

  it('detects by code = TRIMBOX_MISSING', () => {
    expect(isTrimBoxIssue({ code: 'TRIMBOX_MISSING' })).toBe(true);
  });

  it('detects by code = TRIM_BOX_ANOMALY', () => {
    expect(isTrimBoxIssue({ code: 'TRIM_BOX_ANOMALY' })).toBe(true);
  });

  it('detects by code = IND_GEOM_003', () => {
    expect(isTrimBoxIssue({ code: 'IND_GEOM_003' })).toBe(true);
  });

  it('detects by code = IND_TRIM', () => {
    expect(isTrimBoxIssue({ code: 'IND_TRIM' })).toBe(true);
  });

  it('detects by code = GEOM_TRIMBOX_MISSING', () => {
    expect(isTrimBoxIssue({ code: 'GEOM_TRIMBOX_MISSING' })).toBe(true);
  });

  it('detects by title containing "trim box"', () => {
    expect(isTrimBoxIssue({ title: 'Missing Trim Box' })).toBe(true);
  });

  it('detects by title containing "trimbox" (no space)', () => {
    expect(isTrimBoxIssue({ title: 'TrimBox not defined' })).toBe(true);
  });

  it('detects by message', () => {
    expect(isTrimBoxIssue({ message: 'The trimbox is absent' })).toBe(true);
  });

  it('detects by description', () => {
    expect(isTrimBoxIssue({ description: 'trim box coordinates are invalid' })).toBe(true);
  });

  it('returns false for unrelated issue', () => {
    expect(isTrimBoxIssue({ code: 'FONT_MISSING', title: 'Font not embedded' })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getReadableFixFailure
// ---------------------------------------------------------------------------
describe('getReadableFixFailure', () => {
  it('returns safe defaults when called with null', () => {
    const result = getReadableFixFailure(null);
    expect(result.title).toBe('Automatic fix failed');
    expect(result.code).toBe('UNKNOWN_ERROR');
    expect(result.detail).toBe('No error information provided.');
  });

  it('returns safe defaults when called with undefined', () => {
    const result = getReadableFixFailure(undefined);
    expect(result.code).toBe('UNKNOWN_ERROR');
  });

  it('uses the error message when passed as a string', () => {
    const result = getReadableFixFailure('Something went wrong');
    expect(result.detail).toBe('Something went wrong');
  });

  it('detects Ghostscript failure in message', () => {
    const result = getReadableFixFailure({ message: 'Ghostscript could not produce the output file' });
    expect(result.summary).toContain('Ghostscript');
  });

  it('detects circular reference failure', () => {
    const result = getReadableFixFailure({ message: 'circular reference detected in PDF' });
    expect(result.summary).toContain('circular reference');
  });

  it('detects LuaTeX failure', () => {
    const result = getReadableFixFailure({ message: 'LuaTeX engine failed' });
    expect(result.summary).toContain('LaTeX');
  });

  it('detects gs -dNOPAUSE rendering failure', () => {
    const result = getReadableFixFailure({ message: 'gs -dNOPAUSE failed on layer 2' });
    expect(result.summary).toContain('rendering engine');
  });

  it('detects AUTOFIX-INPUT-ERROR', () => {
    const result = getReadableFixFailure({ message: 'AUTOFIX-INPUT-ERROR: file not found' });
    expect(result.summary).toContain('input file');
  });

  it('preserves custom error code from object', () => {
    const result = getReadableFixFailure({ code: 'MY_CUSTOM_CODE', message: 'oops' });
    expect(result.code).toBe('MY_CUSTOM_CODE');
  });

  it('falls back to FIX_ABORTED when no code is present', () => {
    const result = getReadableFixFailure({ message: 'generic failure' });
    expect(result.code).toBe('FIX_ABORTED');
  });

  it('uses AUTOFIX_ENGINE_FAILURE when message contains the tag', () => {
    const result = getReadableFixFailure({ message: '[AUTOFIX-ENGINE-ERROR] crash' });
    expect(result.code).toBe('AUTOFIX_ENGINE_FAILURE');
  });
});

// ---------------------------------------------------------------------------
// normalizePreflightResult
// ---------------------------------------------------------------------------
describe('normalizePreflightResult', () => {
  it('returns null for null input', () => {
    expect(normalizePreflightResult(null)).toBeNull();
  });

  it('returns null for undefined input', () => {
    expect(normalizePreflightResult(undefined)).toBeNull();
  });

  it('normalizes a payload with top-level findings array', () => {
    const result = normalizePreflightResult({
      findings: [{ id: 'f1', code: 'FONT_MISSING', severity: 'error', message: 'Font missing' }],
      meta: { jobId: 'job_001', fileName: 'test.pdf', fileSize: 1024, pageCount: 2 },
    });
    expect(result).not.toBeNull();
    expect(result!.issues).toHaveLength(1);
    expect(result!.issues[0].severity).toBe(Severity.ERROR);
  });

  it('normalizes a payload with top-level issues array', () => {
    const result = normalizePreflightResult({
      issues: [{ id: 'i1', severity: 'warning', message: 'Low resolution' }],
      meta: { jobId: 'job_002' },
    });
    expect(result!.issues).toHaveLength(1);
    expect(result!.issues[0].severity).toBe(Severity.WARNING);
  });

  it('flattens a nested result object before processing', () => {
    const result = normalizePreflightResult({
      result: {
        findings: [{ id: 'nested1', severity: 'error', message: 'Nested issue' }],
        meta: { jobId: 'job_nested' },
      },
    });
    expect(result!.issues).toHaveLength(1);
  });

  it('deduplicates issues with the same id', () => {
    const result = normalizePreflightResult({
      findings: [
        { id: 'dup', severity: 'error', message: 'Dup issue' },
        { id: 'dup', severity: 'error', message: 'Dup issue again' },
      ],
    });
    expect(result!.issues).toHaveLength(1);
  });

  it('forces TrimBox issues to category GEOMETRY and fixable=true', () => {
    const result = normalizePreflightResult({
      findings: [{ id: 'TRIMBOX_MISSING', code: 'TRIMBOX_MISSING', severity: 'error', fixable: false }],
    });
    expect(result!.issues[0].category).toBe('GEOMETRY');
    expect(result!.issues[0].fixable).toBe(true);
  });

  it('forces bleed issues to category bleed_margins and fixable=true', () => {
    const result = normalizePreflightResult({
      findings: [{ id: 'missing-bleed-info', severity: 'error', fixable: false }],
    });
    expect(result!.issues[0].category).toBe('bleed_margins');
    expect(result!.issues[0].fixable).toBe(true);
  });

  it('normalizes string-only findings into Issue objects', () => {
    const result = normalizePreflightResult({
      findings: ['PDF version is outdated'],
    });
    expect(result!.issues).toHaveLength(1);
    expect(result!.issues[0].message).toBe('PDF version is outdated');
    expect(result!.issues[0].severity).toBe(Severity.WARNING);
  });

  it('maps severity aliases: critical → ERROR, alert → WARNING, info → INFO', () => {
    const result = normalizePreflightResult({
      findings: [
        { id: 'a', severity: 'critical', message: 'Critical' },
        { id: 'b', severity: 'alert', message: 'Alert' },
        { id: 'c', severity: 'info', message: 'Info' },
      ],
    });
    expect(result!.issues[0].severity).toBe(Severity.ERROR);
    expect(result!.issues[1].severity).toBe(Severity.WARNING);
    expect(result!.issues[2].severity).toBe(Severity.INFO);
  });

  it('uses pickCanonicalJobId to set meta.jobId — rejects numeric ids', () => {
    const result = normalizePreflightResult({
      jobId: 42,
      job_id: '99',
      meta: { jobId: 'job_canonical' },
    });
    expect(result!.meta.jobId).toBe('job_canonical');
  });

  it('sets meta.jobId to "unknown" when no canonical id exists', () => {
    const result = normalizePreflightResult({ findings: [] });
    expect(result!.meta.jobId).toBe('unknown');
  });

  it('reads pageCount from multiple fallback paths', () => {
    const result = normalizePreflightResult({
      report: { meta: { pageCount: 12 } },
    });
    expect(result!.meta.pageCount).toBe(12);
  });

  it('marks _forensicDataMissing=true when payload has no detectable data', () => {
    const result = normalizePreflightResult({ status: 'FAILED' }) as any;
    expect(result._forensicDataMissing).toBe(true);
  });

  it('marks _forensicDataMissing=false when score is present', () => {
    const result = normalizePreflightResult({ score: 85 }) as any;
    expect(result._forensicDataMissing).toBe(false);
  });

  it('merges data.issues as a fallback source', () => {
    const result = normalizePreflightResult({
      data: { issues: [{ id: 'di1', severity: 'warning', message: 'Data issue' }] },
    });
    expect(result!.issues).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// analyzeWorkflow
// ---------------------------------------------------------------------------
describe('analyzeWorkflow', () => {
  const baseResult = {
    type: 'ANALYZE' as const,
    issues: [],
    artifacts: {},
    score: 100,
    summary: null,
    fixes: [],
    repairs: [],
    pages: [],
    categorySummaries: [],
    meta: { fileName: 'test.pdf', fileSize: 0, pageCount: 1, jobId: 'job_1' },
  };

  it('returns analysisFailed=true and hasResult=false when result is null', () => {
    const analysis = analyzeWorkflow(null, null, 'manual');
    expect(analysis.hasResult).toBe(false);
    expect(analysis.analysisFailed).toBe(true);
    expect(analysis.isCompliant).toBe(false);
  });

  it('marks isCompliant=true when result has no issues and no error', () => {
    const analysis = analyzeWorkflow(baseResult, null, 'manual');
    expect(analysis.isCompliant).toBe(true);
    expect(analysis.issueCount).toBe(0);
  });

  it('counts errors and warnings correctly', () => {
    const result = {
      ...baseResult,
      issues: [
        { id: '1', severity: Severity.ERROR, message: 'err' },
        { id: '2', severity: Severity.WARNING, message: 'warn' },
        { id: '3', severity: Severity.INFO, message: 'info' },
      ],
    };
    const analysis = analyzeWorkflow(result, null, 'manual');
    expect(analysis.issueCount).toBe(3);
    expect(analysis.errorCount).toBe(1);
    expect(analysis.warningCount).toBe(1);
    expect(analysis.hasIssues).toBe(true);
    expect(analysis.hasErrors).toBe(true);
    expect(analysis.isCompliant).toBe(false);
  });

  it('sets isAutofix=true when appMode is "ai"', () => {
    // Use a result with no type so only appMode drives isAutofix/isAnalyzeOnly
    const result = { ...baseResult, type: undefined as any };
    const analysis = analyzeWorkflow(result, null, 'ai');
    expect(analysis.isAutofix).toBe(true);
    expect(analysis.isAnalyzeOnly).toBe(false);
  });

  it('sets isAnalyzeOnly=true when appMode is "manual"', () => {
    const analysis = analyzeWorkflow(baseResult, null, 'manual');
    expect(analysis.isAnalyzeOnly).toBe(true);
    expect(analysis.isAutofix).toBe(false);
  });

  it('detects isAutofix from result.type = AUTOFIX', () => {
    const result = { ...baseResult, type: 'AUTOFIX' as const };
    const analysis = analyzeWorkflow(result, null, 'manual');
    expect(analysis.isAutofix).toBe(true);
  });

  it('sets isNoOpFix=true when meta.noopFix is true', () => {
    const result = { ...baseResult, type: 'AUTOFIX' as const, meta: { ...baseResult.meta, noopFix: true } };
    const analysis = analyzeWorkflow(result, null, 'ai');
    expect(analysis.isNoOpFix).toBe(true);
  });

  it('sets isNoOpFix=true when meta.certificationMode = CERTIFIED_WITHOUT_MODIFICATION', () => {
    const result = {
      ...baseResult,
      type: 'AUTOFIX' as const,
      meta: { ...baseResult.meta, certificationMode: 'CERTIFIED_WITHOUT_MODIFICATION' },
    };
    const analysis = analyzeWorkflow(result, null, 'ai');
    expect(analysis.isNoOpFix).toBe(true);
  });

  it('detects hasFixedArtifact from artifacts.fixed_pdf', () => {
    const result = { ...baseResult, artifacts: { fixed_pdf: 'url/fixed.pdf' } };
    const analysis = analyzeWorkflow(result, null, 'manual');
    expect(analysis.hasFixedArtifact).toBe(true);
  });

  it('returns correct bestArtifactKey', () => {
    const result = { ...baseResult, artifacts: { fixed_pdf: 'a', certified_pdf: 'b' } };
    const analysis = analyzeWorkflow(result, null, 'manual');
    expect(analysis.bestArtifactKey).toBe('fixed_pdf');
  });

  it('sets showComparison=true only for real autofix with a final artifact', () => {
    const result = {
      ...baseResult,
      type: 'AUTOFIX' as const,
      artifacts: { final_fixed_pdf: 'url' },
      repairs: [{ type: 'embed_fonts' }],
    };
    const analysis = analyzeWorkflow(result, null, 'ai');
    expect(analysis.showComparison).toBe(true);
  });

  it('sets showComparison=false for noop fix even with artifact', () => {
    const result = {
      ...baseResult,
      type: 'AUTOFIX' as const,
      artifacts: { final_fixed_pdf: 'url' },
      meta: { ...baseResult.meta, noopFix: true },
    };
    const analysis = analyzeWorkflow(result, null, 'ai');
    expect(analysis.showComparison).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getCanonicalFileName
// ---------------------------------------------------------------------------
describe('getCanonicalFileName', () => {
  it('returns the fileName from meta when it is a real name', () => {
    const result = getCanonicalFileName({ meta: { fileName: 'brochure.pdf' } }, null);
    expect(result).toBe('brochure.pdf');
  });

  it('falls back to originalFile.name when meta fileName is a UUID', () => {
    const uuidName = '550e8400-e29b-41d4-a716-446655440000.pdf';
    const result = getCanonicalFileName({ meta: { fileName: uuidName } }, { name: 'my-doc.pdf' });
    expect(result).toBe('my-doc.pdf');
  });

  it('falls back when meta fileName contains "unknown"', () => {
    const result = getCanonicalFileName({ meta: { fileName: 'unknown' } }, { name: 'real.pdf' });
    expect(result).toBe('real.pdf');
  });

  it('returns certified_document.pdf as last resort', () => {
    const result = getCanonicalFileName({}, null);
    expect(result).toBe('certified_document.pdf');
  });

  it('reads filename from top-level payload.filename when meta is absent', () => {
    const result = getCanonicalFileName({ filename: 'fallback.pdf' }, null);
    expect(result).toBe('fallback.pdf');
  });
});
