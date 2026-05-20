import { describe, it, expect } from 'vitest';
import {
  isTerminalDiagnosticStatus,
  isTerminalFailureStatus,
  isTerminalStatus,
  isPhase10DegradedStatus,
  TERMINAL_DIAGNOSTIC_STATUSES,
  TERMINAL_FAILURE_STATUSES,
} from './statusHelpers';

describe('isTerminalDiagnosticStatus', () => {
  it.each(TERMINAL_DIAGNOSTIC_STATUSES)('returns true for %s', (status) => {
    expect(isTerminalDiagnosticStatus(status)).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(isTerminalDiagnosticStatus('completed')).toBe(true);
    expect(isTerminalDiagnosticStatus('Succeeded')).toBe(true);
    expect(isTerminalDiagnosticStatus('sUcCeSs')).toBe(true);
  });

  it('returns false for non-terminal statuses', () => {
    expect(isTerminalDiagnosticStatus('PENDING')).toBe(false);
    expect(isTerminalDiagnosticStatus('RUNNING')).toBe(false);
    expect(isTerminalDiagnosticStatus('QUEUED')).toBe(false);
  });

  it('returns false for null or undefined', () => {
    expect(isTerminalDiagnosticStatus(null)).toBe(false);
    expect(isTerminalDiagnosticStatus(undefined)).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isTerminalDiagnosticStatus('')).toBe(false);
  });
});

describe('isTerminalFailureStatus', () => {
  it.each(TERMINAL_FAILURE_STATUSES)('returns true for %s', (status) => {
    expect(isTerminalFailureStatus(status)).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(isTerminalFailureStatus('failed')).toBe(true);
    expect(isTerminalFailureStatus('Error')).toBe(true);
  });

  it('returns false for non-failure statuses', () => {
    expect(isTerminalFailureStatus('COMPLETED')).toBe(false);
    expect(isTerminalFailureStatus('PENDING')).toBe(false);
  });

  it('returns false for null or undefined', () => {
    expect(isTerminalFailureStatus(null)).toBe(false);
    expect(isTerminalFailureStatus(undefined)).toBe(false);
  });
});

describe('isTerminalStatus', () => {
  it('returns true for diagnostic terminal statuses', () => {
    expect(isTerminalStatus('COMPLETED')).toBe(true);
    expect(isTerminalStatus('PASS')).toBe(true);
  });

  it('returns true for failure terminal statuses', () => {
    expect(isTerminalStatus('FAILED')).toBe(true);
    expect(isTerminalStatus('ERROR')).toBe(true);
  });

  it('returns false for non-terminal statuses', () => {
    expect(isTerminalStatus('RUNNING')).toBe(false);
    expect(isTerminalStatus('QUEUED')).toBe(false);
  });

  it('returns false for null or undefined', () => {
    expect(isTerminalStatus(null)).toBe(false);
    expect(isTerminalStatus(undefined)).toBe(false);
  });
});

describe('isPhase10DegradedStatus', () => {
  it('returns true for DEGRADED, PARTIAL, PARTIAL_ARTIFACTS', () => {
    expect(isPhase10DegradedStatus('DEGRADED')).toBe(true);
    expect(isPhase10DegradedStatus('PARTIAL')).toBe(true);
    expect(isPhase10DegradedStatus('PARTIAL_ARTIFACTS')).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(isPhase10DegradedStatus('degraded')).toBe(true);
    expect(isPhase10DegradedStatus('Partial')).toBe(true);
  });

  it('returns false for COMPLETED (not degraded)', () => {
    expect(isPhase10DegradedStatus('COMPLETED')).toBe(false);
  });

  it('returns false for null or undefined', () => {
    expect(isPhase10DegradedStatus(null)).toBe(false);
    expect(isPhase10DegradedStatus(undefined)).toBe(false);
  });
});
