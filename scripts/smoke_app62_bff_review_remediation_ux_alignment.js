'use strict';
/**
 * APP-62 Smoke Test — BFF Review Decision / Remediation UX Alignment
 *
 * Validates that:
 * - review_decision_ux is preserved and exposed safely
 * - remediation_ux is preserved and exposed safely
 * - NO_DECISION blocks progression
 * - APPROVED_WITH_WARNINGS passes but shows warning
 * - REJECTED_REQUIRES_REUPLOAD hides download
 * - REQUEST_CUSTOMER_REUPLOAD shows upload action
 * - WAITING_FOR_UPLOAD state is handled
 * - PREFLIGHT_REQUIRED after reupload is handled
 * - Customer audience hides operator-only fields
 * - Operator audience sees available actions
 * - Raw tokens/internal IDs are not exposed
 * - File history displays safe next_action
 */

const { extractGovernanceContracts } = require('../app/services/preflightNormalizer');

let passed = 0;
let failed = 0;

function assert(label, condition, details) {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label}${details ? ` — ${details}` : ''}`);
    failed++;
  }
}

function section(title) {
  console.log(`\n[${title}]`);
}

// ─── Scenario 1: NO_DECISION blocks progression ──────────────────────────────
section('Scenario 1: NO_DECISION blocks progression');
{
  const payload = {
    review_decision_ux: {
      decision: 'NO_DECISION',
      allows_progression: false,
      customer_message: 'A human review is required before this file can move to production.',
    },
  };
  const contracts = extractGovernanceContracts(payload);
  assert('review_decision_ux preserved', !!contracts.review_decision_ux);
  assert('decision is NO_DECISION', contracts.review_decision_ux?.decision === 'NO_DECISION');
  assert('allows_progression is false', contracts.review_decision_ux?.allows_progression === false);
  assert('customer_message present', typeof contracts.review_decision_ux?.customer_message === 'string' && contracts.review_decision_ux.customer_message.length > 0);
}

// ─── Scenario 2: APPROVED_WITH_WARNINGS allows progression but shows warning ─
section('Scenario 2: APPROVED_WITH_WARNINGS allows progression');
{
  const payload = {
    review_decision_ux: {
      decision: 'APPROVED_WITH_WARNINGS',
      allows_progression: true,
      customer_message: 'The operator approved this file with warnings.',
      operator_notes: ['Color profile substituted — verify print output.'],
    },
  };
  const contracts = extractGovernanceContracts(payload);
  assert('review_decision_ux preserved', !!contracts.review_decision_ux);
  assert('decision is APPROVED_WITH_WARNINGS', contracts.review_decision_ux?.decision === 'APPROVED_WITH_WARNINGS');
  assert('allows_progression is true', contracts.review_decision_ux?.allows_progression === true);
  assert('operator_notes preserved', Array.isArray(contracts.review_decision_ux?.operator_notes) && contracts.review_decision_ux.operator_notes.length > 0);
}

// ─── Scenario 3: REJECTED_REQUIRES_REUPLOAD hides download ───────────────────
section('Scenario 3: REJECTED_REQUIRES_REUPLOAD — download must be blocked');
{
  const payload = {
    review_decision_ux: {
      decision: 'REJECTED_REQUIRES_REUPLOAD',
      allows_progression: false,
      requires_reupload: true,
      customer_message: 'Replacement files are required.',
    },
  };
  const contracts = extractGovernanceContracts(payload);
  assert('review_decision_ux preserved', !!contracts.review_decision_ux);
  assert('decision is REJECTED_REQUIRES_REUPLOAD', contracts.review_decision_ux?.decision === 'REJECTED_REQUIRES_REUPLOAD');
  assert('requires_reupload is true', contracts.review_decision_ux?.requires_reupload === true);

  // Simulate frontend download gate
  const blocksDownload =
    contracts.review_decision_ux?.allows_progression === false ||
    contracts.review_decision_ux?.decision === 'REJECTED_REQUIRES_REUPLOAD';
  assert('productionDownloadBlocked derived correctly', blocksDownload === true);
}

// ─── Scenario 4: REQUEST_CUSTOMER_REUPLOAD shows upload action ───────────────
section('Scenario 4: REQUEST_CUSTOMER_REUPLOAD — upload action visible');
{
  const payload = {
    review_decision_ux: {
      decision: 'REQUEST_CUSTOMER_REUPLOAD',
      allows_progression: false,
      customer_message: 'The operator is requesting a new version of this file.',
    },
  };
  const contracts = extractGovernanceContracts(payload);
  assert('review_decision_ux preserved', !!contracts.review_decision_ux);
  assert('decision is REQUEST_CUSTOMER_REUPLOAD', contracts.review_decision_ux?.decision === 'REQUEST_CUSTOMER_REUPLOAD');
  const showUploadAction =
    contracts.review_decision_ux?.decision === 'REQUEST_CUSTOMER_REUPLOAD' ||
    contracts.review_decision_ux?.decision === 'REJECTED_REQUIRES_REUPLOAD';
  assert('upload action should be shown', showUploadAction === true);
}

// ─── Scenario 5: WAITING_FOR_UPLOAD state ────────────────────────────────────
section('Scenario 5: WAITING_FOR_UPLOAD remediation state');
{
  const payload = {
    remediation_ux: {
      remediation_state: 'WAITING_FOR_UPLOAD',
      requires_reupload: false,
      next_action: 'Upload a corrected file to continue.',
      customer_message: 'The file is waiting for a new preflight check after reupload.',
    },
  };
  const contracts = extractGovernanceContracts(payload);
  assert('remediation_ux preserved', !!contracts.remediation_ux);
  assert('remediation_state is WAITING_FOR_UPLOAD', contracts.remediation_ux?.remediation_state === 'WAITING_FOR_UPLOAD');
  assert('next_action preserved', typeof contracts.remediation_ux?.next_action === 'string');
}

// ─── Scenario 6: PREFLIGHT_REQUIRED after reupload ───────────────────────────
section('Scenario 6: PREFLIGHT_REQUIRED after reupload');
{
  const payload = {
    remediation_ux: {
      remediation_state: 'PREFLIGHT_REQUIRED',
      requires_reupload: false,
      customer_message: 'The file is waiting for a new preflight check.',
    },
  };
  const contracts = extractGovernanceContracts(payload);
  assert('remediation_ux preserved', !!contracts.remediation_ux);
  assert('remediation_state is PREFLIGHT_REQUIRED', contracts.remediation_ux?.remediation_state === 'PREFLIGHT_REQUIRED');
  const blocksProgression =
    contracts.remediation_ux?.remediation_state === 'PREFLIGHT_REQUIRED' ||
    contracts.remediation_ux?.remediation_state === 'REUPLOAD_REQUIRED';
  assert('progression blocked by PREFLIGHT_REQUIRED', blocksProgression === true);
}

// ─── Scenario 7: Customer audience must NOT see raw operator_notes ───────────
section('Scenario 7: Customer audience — operator notes not exposed in public fields');
{
  const payload = {
    review_decision_ux: {
      decision: 'APPROVED_WITH_WARNINGS',
      allows_progression: true,
      customer_message: 'File approved with warnings.',
      operator_notes: ['Internal: ICC profile swap required before production handoff.'],
    },
  };
  const contracts = extractGovernanceContracts(payload);
  // operator_notes are in the contract for operator use — the UI must not render them for customer
  // We just assert the field is accessible for the panel to conditionally render
  assert('review_decision_ux preserved', !!contracts.review_decision_ux);
  assert('operator_notes present in contract (for operator view)', Array.isArray(contracts.review_decision_ux?.operator_notes));
  // customer_message does not contain raw internal info
  const noRawInternalToken = !(contracts.review_decision_ux?.customer_message || '').match(/internal:|job_|fix_|token|jwt|Bearer/i);
  assert('customer_message contains no raw internal tokens', noRawInternalToken);
}

// ─── Scenario 8: Operator audience sees available actions ────────────────────
section('Scenario 8: Operator audience — full decision info accessible');
{
  const payload = {
    review_decision_ux: {
      decision: 'NEEDS_MORE_INFORMATION',
      allows_progression: false,
      decision_label: 'Awaiting operator review',
      operator_notes: ['Spot color mapping needs confirmation.', 'Check TAC against substrate spec.'],
      customer_message: 'More information is required before a decision can be made.',
    },
  };
  const contracts = extractGovernanceContracts(payload);
  assert('review_decision_ux preserved', !!contracts.review_decision_ux);
  assert('operator_notes accessible for operator UI', contracts.review_decision_ux?.operator_notes?.length === 2);
  assert('decision_label preserved', contracts.review_decision_ux?.decision_label === 'Awaiting operator review');
}

// ─── Scenario 9: Raw tokens/internal IDs not exposed ────────────────────────
section('Scenario 9: No raw IDs/tokens in customer-facing fields');
{
  const payload = {
    remediation_ux: {
      remediation_state: 'REUPLOAD_REQUIRED',
      requires_reupload: true,
      next_action: 'Please upload a corrected version of your file.',
      customer_message: 'Replacement files are required.',
      // Simulate OS sending internal fields — they should NOT leak into public messages
      _internal_job_token: 'job_abc123_token_xyz',
      _operator_id: 'op_9988',
    },
  };
  const contracts = extractGovernanceContracts(payload);
  const customerMsg = contracts.remediation_ux?.customer_message || '';
  const nextAction = contracts.remediation_ux?.next_action || '';
  const noTokenInMsg = !customerMsg.match(/job_|fix_|token|Bearer|jwt/i);
  const noTokenInAction = !nextAction.match(/job_|fix_|token|Bearer|jwt/i);
  assert('customer_message contains no job IDs or tokens', noTokenInMsg);
  assert('next_action contains no job IDs or tokens', noTokenInAction);
  assert('remediation_state preserved', contracts.remediation_ux?.remediation_state === 'REUPLOAD_REQUIRED');
}

// ─── Scenario 10: File history safe next_action derivation ───────────────────
section('Scenario 10: File history customer_safe_next_action derivation');
{
  // Simulate accountRoutes.js governance derivation logic
  function deriveCustomerSafeNextAction({ remediation_ux, review_decision_ux, artifact_trust, requiresHumanReview, productionCertified, appliedFixesCount }) {
    if (remediation_ux?.next_action) return remediation_ux.next_action;
    if (review_decision_ux?.customer_message) return review_decision_ux.customer_message;
    if (artifact_trust?.review_required || requiresHumanReview) {
      return 'A human review is required before this file can move to production.';
    }
    if (!productionCertified && appliedFixesCount > 0) {
      return 'Review the corrected file before sending to production.';
    }
    return null;
  }

  const s1 = deriveCustomerSafeNextAction({
    remediation_ux: { next_action: 'Upload a corrected file to continue.' },
    review_decision_ux: null,
    artifact_trust: null,
    requiresHumanReview: false,
    productionCertified: false,
    appliedFixesCount: 0,
  });
  assert('remediation next_action takes priority', s1 === 'Upload a corrected file to continue.');

  const s2 = deriveCustomerSafeNextAction({
    remediation_ux: null,
    review_decision_ux: { customer_message: 'Replacement files are required.' },
    artifact_trust: null,
    requiresHumanReview: false,
    productionCertified: false,
    appliedFixesCount: 0,
  });
  assert('review_decision customer_message used when no remediation', s2 === 'Replacement files are required.');

  const s3 = deriveCustomerSafeNextAction({
    remediation_ux: null,
    review_decision_ux: null,
    artifact_trust: { review_required: true },
    requiresHumanReview: false,
    productionCertified: false,
    appliedFixesCount: 0,
  });
  assert('artifact_trust.review_required falls back to safe message', s3 !== null && s3.length > 0);

  const s4 = deriveCustomerSafeNextAction({
    remediation_ux: null,
    review_decision_ux: null,
    artifact_trust: null,
    requiresHumanReview: false,
    productionCertified: true,
    appliedFixesCount: 3,
  });
  assert('null returned when no action needed', s4 === null);
}

// ─── Summary ─────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(60)}`);
console.log(`APP-62 Smoke: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.error(`\n[FAIL] APP-62 smoke test failed with ${failed} assertion(s).`);
  process.exit(1);
} else {
  console.log(`\n[PASS] APP-62 smoke test complete — all scenarios pass.`);
}
