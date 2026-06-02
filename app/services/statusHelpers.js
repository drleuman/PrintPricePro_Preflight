'use strict';

const TERMINAL_DIAGNOSTIC_STATUSES = [
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
  'AUTOFIX_DEGRADED',
  'AUTOFIX_REVIEW_REQUIRED',
  'AUTOFIX_PARTIAL_REVIEW_REQUIRED'
];

const TERMINAL_FAILURE_STATUSES = [
  'FAILED',
  'ERROR',
  'FAILED_RUNTIME_ENVIRONMENT',
  'ENGINE_ENVIRONMENT_FAILURE',
  'AUTOFIX_FAILED'
];

function isTerminalDiagnosticStatus(status) {
  if (typeof status !== 'string') return false;
  return TERMINAL_DIAGNOSTIC_STATUSES.includes(status.toUpperCase());
}

function isTerminalFailureStatus(status) {
  if (typeof status !== 'string') return false;
  return TERMINAL_FAILURE_STATUSES.includes(status.toUpperCase());
}

function isTerminalStatus(status) {
  return isTerminalDiagnosticStatus(status) || isTerminalFailureStatus(status);
}

function isPhase10DegradedStatus(status) {
  if (typeof status !== 'string') return false;
  const s = status.toUpperCase();
  return ['DEGRADED', 'PARTIAL', 'PARTIAL_ARTIFACTS'].includes(s);
}

module.exports = {
  TERMINAL_DIAGNOSTIC_STATUSES,
  TERMINAL_FAILURE_STATUSES,
  isTerminalDiagnosticStatus,
  isTerminalFailureStatus,
  isTerminalStatus,
  isPhase10DegradedStatus
};
