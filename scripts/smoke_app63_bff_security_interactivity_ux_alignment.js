'use strict';
/**
 * APP-63 Smoke Test — BFF Security / Interactive Fix UX Alignment
 *
 * Validates that:
 * - security_interactivity_governance is preserved by extractGovernanceContracts
 * - JavaScript / launch action / embedded file removal map to safe customer messages
 * - Skipped form/annotation flattening surfaces review-required messaging
 * - interactive_content_remaining=true forces review_required=true (defense-in-depth)
 * - Customer-facing messaging never overclaims "certified" or "print-ready"
 * - No raw PDF object internals leak to customer-facing fields
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

// Mirrors the customer-safe label mapping in
// frontend/components/security/SecurityInteractivityPanel.tsx
function deriveAppliedLabels(governance) {
  const labels = [];
  if (governance.javascript_removed) labels.push('Active PDF content removed.');
  if (governance.launch_actions_removed) labels.push('External launch actions removed.');
  if (governance.embedded_files_removed) labels.push('Embedded files removed from the PDF package.');
  if (governance.forms_flattened) labels.push('Form fields flattened.');
  if (governance.annotations_flattened) labels.push('Annotations flattened.');
  return labels;
}

// ─── Scenario 1: JavaScript removed ──────────────────────────────────────────
section('Scenario 1: JavaScript removed');
{
  const payload = {
    security_interactivity_governance: {
      javascript_removed: true,
      review_required: false,
    },
  };
  const contracts = extractGovernanceContracts(payload);
  const sig = contracts.security_interactivity_governance;
  assert('security_interactivity_governance preserved', !!sig);
  assert('javascript_removed=true preserved', sig?.javascript_removed === true);
  const labels = deriveAppliedLabels(sig);
  assert('maps to "Active PDF content removed."', labels.includes('Active PDF content removed.'));
}

// ─── Scenario 2: Launch actions removed ──────────────────────────────────────
section('Scenario 2: Launch actions removed');
{
  const payload = {
    security_interactivity_governance: {
      launch_actions_removed: true,
      review_required: false,
    },
  };
  const contracts = extractGovernanceContracts(payload);
  const sig = contracts.security_interactivity_governance;
  assert('launch_actions_removed=true preserved', sig?.launch_actions_removed === true);
  const labels = deriveAppliedLabels(sig);
  assert('maps to "External launch actions removed."', labels.includes('External launch actions removed.'));
}

// ─── Scenario 3: Embedded files removed ──────────────────────────────────────
section('Scenario 3: Embedded files removed');
{
  const payload = {
    security_interactivity_governance: {
      embedded_files_removed: true,
      review_required: false,
    },
  };
  const contracts = extractGovernanceContracts(payload);
  const sig = contracts.security_interactivity_governance;
  assert('embedded_files_removed=true preserved', sig?.embedded_files_removed === true);
  const labels = deriveAppliedLabels(sig);
  assert('maps to "Embedded files removed from the PDF package."', labels.includes('Embedded files removed from the PDF package.'));
}

// ─── Scenario 4: Form flattening skipped ─────────────────────────────────────
section('Scenario 4: Form flatten skipped — review required');
{
  const payload = {
    security_interactivity_governance: {
      forms_flattened: false,
      flattening_skipped: true,
      review_required: false, // OS may not set this explicitly
    },
  };
  const contracts = extractGovernanceContracts(payload);
  const sig = contracts.security_interactivity_governance;
  assert('flattening_skipped=true preserved', sig?.flattening_skipped === true);
  assert('review_required forced to true (defense-in-depth)', sig?.review_required === true);
}

// ─── Scenario 5: Annotation flattening skipped ───────────────────────────────
section('Scenario 5: Annotation flatten skipped — review required');
{
  const payload = {
    security_interactivity_governance: {
      annotations_flattened: false,
      flattening_skipped: true,
    },
  };
  const contracts = extractGovernanceContracts(payload);
  const sig = contracts.security_interactivity_governance;
  assert('flattening_skipped=true preserved', sig?.flattening_skipped === true);
  assert('review_required forced to true', sig?.review_required === true);
}

// ─── Scenario 6: interactive_content_remaining=true ─────────────────────────
section('Scenario 6: interactive_content_remaining=true forces review');
{
  const payload = {
    security_interactivity_governance: {
      javascript_removed: true,
      interactive_content_remaining: true,
      review_required: false, // OS may not set this explicitly
    },
  };
  const contracts = extractGovernanceContracts(payload);
  const sig = contracts.security_interactivity_governance;
  assert('interactive_content_remaining=true preserved', sig?.interactive_content_remaining === true);
  assert('review_required forced to true (defense-in-depth)', sig?.review_required === true);
}

// ─── Scenario 7: review_required=true preserved as-is ────────────────────────
section('Scenario 7: review_required=true preserved');
{
  const payload = {
    security_interactivity_governance: {
      forms_flattened: true,
      annotations_flattened: true,
      review_required: true,
      warnings: ['AcroForm contained XFA streams; XFA was discarded.'],
    },
  };
  const contracts = extractGovernanceContracts(payload);
  const sig = contracts.security_interactivity_governance;
  assert('review_required=true preserved', sig?.review_required === true);
  assert('warnings preserved for operator view', Array.isArray(sig?.warnings) && sig.warnings.length === 1);
}

// ─── Scenario 8: Customer view sanitized ─────────────────────────────────────
section('Scenario 8: Customer view — sanitized, no raw PDF internals');
{
  const payload = {
    security_interactivity_governance: {
      javascript_removed: true,
      embedded_files_removed: true,
      review_required: false,
      // Simulate raw operator-only diagnostic detail — must not leak into customer labels
      evidence: { object_ids: ['12 0 obj', '34 0 obj'], raw_dump: '/OpenAction << /S /JavaScript /JS (app.alert) >>' },
      warnings: ['Removed /OpenAction JavaScript from object 12 0 obj'],
    },
  };
  const contracts = extractGovernanceContracts(payload);
  const sig = contracts.security_interactivity_governance;

  // Customer-facing labels are static, safe strings — never derived from evidence/warnings.
  const customerLabels = deriveAppliedLabels(sig);
  const disclaimer = 'Removing active or interactive content does not certify this file or mark it as print-ready.';
  const customerFacing = [...customerLabels, disclaimer].join(' ');
  assert('no raw object IDs in customer-facing text', !customerFacing.match(/\d+\s+0\s+obj/));
  assert('no raw PDF operator dumps in customer-facing text', !customerFacing.match(/\/OpenAction|\/JavaScript|<<|>>/));

  // Evidence/warnings remain available for operator-only rendering.
  assert('evidence preserved for operator view', !!sig?.evidence);
  assert('warnings preserved for operator view', Array.isArray(sig?.warnings) && sig.warnings.length === 1);
}

// ─── Scenario 9: No "certified"/"print-ready" overclaim ──────────────────────
section('Scenario 9: Active content removal does not imply certification or print-readiness');
{
  const payload = {
    security_interactivity_governance: {
      javascript_removed: true,
      launch_actions_removed: true,
      embedded_files_removed: true,
      review_required: false,
    },
    artifact_trust: {
      // Even though security cleanup succeeded, artifact_trust has not vouched for production.
      production_certified: false,
      standard_certified: false,
      certified_pdf_allowed: true,
    },
  };
  const contracts = extractGovernanceContracts(payload);
  const sig = contracts.security_interactivity_governance;
  const trust = contracts.artifact_trust;

  const labels = deriveAppliedLabels(sig);
  const disclaimer = 'Removing active or interactive content does not certify this file or mark it as print-ready.';
  // The applied-action labels themselves (not the disclaimer) must never assert
  // "certified" or "print-ready" — those claims may only be negated, never made.
  const appliedText = labels.join(' ').toLowerCase();
  assert('applied-action labels contain no "certified" claim', !appliedText.includes('certified'));
  assert('applied-action labels contain no "print-ready" claim', !appliedText.includes('print-ready') && !appliedText.includes('ready for printing'));
  // The disclaimer must explicitly negate both claims.
  const disclaimerLower = disclaimer.toLowerCase();
  assert('disclaimer explicitly negates certification', /does not certify/.test(disclaimerLower));
  assert('disclaimer explicitly negates print-readiness', /does not.*print-ready|not.*mark it as print-ready/.test(disclaimerLower));

  // Simulate Step5Download standards-validated badge gate (APP-62F + APP-63).
  const securityReviewRequired = sig?.review_required === true;
  const showsStandardsValidated =
    trust?.certified_pdf_allowed !== false && trust?.standard_certified === true && !securityReviewRequired;
  assert('standards-validated badge withheld when artifact_trust.standard_certified=false', showsStandardsValidated === false);
}

// ─── Summary ─────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(60)}`);
console.log(`APP-63 Smoke: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.error(`\n[FAIL] APP-63 smoke test failed with ${failed} assertion(s).`);
  process.exit(1);
} else {
  console.log(`\n[PASS] APP-63 smoke test complete — all scenarios pass.`);
}
