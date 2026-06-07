import { describe, it, expect, vi } from 'vitest';
import {
  normalizeLongPollingStatus,
  logLongPollingStatus,
  LONG_POLLING_STATUS_COPY,
  LongPollingStatus,
} from './longPollingStatus';

describe('normalizeLongPollingStatus', () => {
  it('normalizes upload stage statuses', () => {
    expect(normalizeLongPollingStatus({ rawStatus: 'UPLOADING', stage: 'upload' })).toBe('UPLOAD_STARTED');
    expect(normalizeLongPollingStatus({ rawStatus: 'COMPLETED', stage: 'upload' })).toBe('UPLOAD_COMPLETE');
    expect(normalizeLongPollingStatus({ rawStatus: '', stage: 'upload' })).toBe('UPLOAD_STARTED');
  });

  it('normalizes preflight/analysis stage statuses by raw status pattern', () => {
    expect(normalizeLongPollingStatus({ rawStatus: 'QUEUED', stage: 'preflight' })).toBe('ANALYSIS_QUEUED');
    expect(normalizeLongPollingStatus({ rawStatus: 'PENDING', stage: 'preflight' })).toBe('ANALYSIS_QUEUED');
    expect(normalizeLongPollingStatus({ rawStatus: 'ANALYZING', stage: 'preflight' })).toBe('ANALYSIS_RUNNING');
    expect(normalizeLongPollingStatus({ rawStatus: 'IN_PROGRESS', stage: 'preflight' })).toBe('ANALYSIS_RUNNING');
    expect(normalizeLongPollingStatus({ rawStatus: 'COMPLETED', stage: 'preflight' })).toBe('ANALYSIS_COMPLETED');
    expect(normalizeLongPollingStatus({ rawStatus: 'SUCCEEDED', stage: 'preflight' })).toBe('ANALYSIS_COMPLETED');
  });

  it('falls back to ANALYSIS_RUNNING for unrecognized in-flight preflight statuses (heavy files report engine-specific strings)', () => {
    expect(normalizeLongPollingStatus({ rawStatus: 'SOME_WEIRD_ENGINE_STATE', stage: 'preflight' })).toBe('ANALYSIS_RUNNING');
  });

  it('normalizes fix stage statuses, including the requested/running/completed lifecycle', () => {
    expect(normalizeLongPollingStatus({ rawStatus: 'REQUESTED', stage: 'fix' })).toBe('FIX_REQUESTED');
    expect(normalizeLongPollingStatus({ rawStatus: 'CREATED', stage: 'fix' })).toBe('FIX_REQUESTED');
    expect(normalizeLongPollingStatus({ rawStatus: 'RUNNING', stage: 'fix' })).toBe('FIX_RUNNING');
    expect(normalizeLongPollingStatus({ rawStatus: 'PROCESSING', stage: 'fix' })).toBe('FIX_RUNNING');
  });

  it('only reports FIX_COMPLETED_CERTIFIED when the engine vouches for production certification AND no review is pending', () => {
    expect(normalizeLongPollingStatus({
      rawStatus: 'COMPLETED',
      stage: 'fix',
      productionCertified: true,
      requiresHumanReview: false,
    })).toBe('FIX_COMPLETED_CERTIFIED');

    expect(normalizeLongPollingStatus({
      rawStatus: 'COMPLETED',
      stage: 'fix',
      productionCertified: true,
      requiresHumanReview: true,
    })).toBe('FIX_COMPLETED_REVIEW_REQUIRED');

    expect(normalizeLongPollingStatus({
      rawStatus: 'COMPLETED',
      stage: 'fix',
      productionCertified: false,
    })).toBe('FIX_COMPLETED_REVIEW_REQUIRED');

    expect(normalizeLongPollingStatus({
      rawStatus: 'SUCCEEDED',
      stage: 'fix',
    })).toBe('FIX_COMPLETED_REVIEW_REQUIRED');
  });

  it('normalizes artifact stage statuses from explicit availability flags, not raw status text', () => {
    expect(normalizeLongPollingStatus({ stage: 'artifacts' })).toBe('ARTIFACTS_AVAILABLE');
    expect(normalizeLongPollingStatus({ stage: 'artifacts', artifactsPartial: true })).toBe('ARTIFACTS_PARTIAL');
    expect(normalizeLongPollingStatus({ stage: 'artifacts', artifactsUnavailable: true })).toBe('ARTIFACTS_UNAVAILABLE');
    // Unavailable takes precedence over partial when both are (incorrectly) set.
    expect(normalizeLongPollingStatus({ stage: 'artifacts', artifactsPartial: true, artifactsUnavailable: true })).toBe('ARTIFACTS_UNAVAILABLE');
  });
});

describe('LONG_POLLING_STATUS_COPY', () => {
  it('provides human-facing copy for every canonical long-polling status', () => {
    const allStatuses: LongPollingStatus[] = [
      'UPLOAD_STARTED', 'UPLOAD_COMPLETE',
      'ANALYSIS_QUEUED', 'ANALYSIS_RUNNING', 'ANALYSIS_COMPLETED',
      'FIX_REQUESTED', 'FIX_RUNNING', 'FIX_COMPLETED_REVIEW_REQUIRED', 'FIX_COMPLETED_CERTIFIED',
      'ARTIFACTS_AVAILABLE', 'ARTIFACTS_PARTIAL', 'ARTIFACTS_UNAVAILABLE',
    ];
    for (const status of allStatuses) {
      expect(typeof LONG_POLLING_STATUS_COPY[status]).toBe('string');
      expect(LONG_POLLING_STATUS_COPY[status].length).toBeGreaterThan(0);
    }
  });
});

describe('logLongPollingStatus', () => {
  it('emits a consistent [APP][LONG-POLL-STATUS] trace line for heavy-file diagnostics', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    logLongPollingStatus('fix_123', 'FIX_RUNNING', 'PROCESSING');
    expect(logSpy).toHaveBeenCalledWith('[APP][LONG-POLL-STATUS]', { jobId: 'fix_123', normalized: 'FIX_RUNNING', raw: 'PROCESSING' });
    logSpy.mockRestore();
  });
});
