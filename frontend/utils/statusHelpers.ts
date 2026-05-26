export const TERMINAL_DIAGNOSTIC_STATUSES = [
  'COMPLETED',
  'SUCCEEDED',
  'SUCCESS',
  'PASS',
  'PASS_WITH_WARNINGS',
  'COMPLETED_WITH_FINDINGS',
  'DEGRADED',
  'PARTIAL',
  'PARTIAL_ARTIFACTS',
  'COMPLETED_WITH_REVIEW',
  'FIXED_WITH_REVIEW_REQUIRED',
  'AUTOFIX_COMPLETED',
  'AUTOFIX_PARTIAL',
  'AUTOFIX_DEGRADED'
];

export const TERMINAL_FAILURE_STATUSES = [
  'FAILED',
  'ERROR',
  'FAILED_RUNTIME_ENVIRONMENT',
  'ENGINE_ENVIRONMENT_FAILURE',
  'AUTOFIX_FAILED'
];

export function isTerminalDiagnosticStatus(status: string | undefined | null): boolean {
  if (!status) return false;
  return TERMINAL_DIAGNOSTIC_STATUSES.includes(status.toUpperCase());
}

export function isTerminalFailureStatus(status: string | undefined | null): boolean {
  if (!status) return false;
  return TERMINAL_FAILURE_STATUSES.includes(status.toUpperCase());
}

export function isTerminalStatus(status: string | undefined | null): boolean {
  return isTerminalDiagnosticStatus(status) || isTerminalFailureStatus(status);
}

export function isPhase10DegradedStatus(status: string | undefined | null): boolean {
  if (!status) return false;
  const s = status.toUpperCase();
  return ['DEGRADED', 'PARTIAL', 'PARTIAL_ARTIFACTS'].includes(s);
}
