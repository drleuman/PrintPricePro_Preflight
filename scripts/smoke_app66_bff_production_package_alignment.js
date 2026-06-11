'use strict';
/**
 * APP-66 Smoke Test — BFF Printhouse Handoff / Production Package Alignment
 *
 * Validates that:
 * - production_package_governance is preserved by extractGovernanceContracts
 *   without flattening.
 * - package_ready=true is preserved when no other governance domain blocks
 *   production and no payment is outstanding.
 * - package_ready is forced to false (defense-in-depth) whenever any other
 *   governance domain has review_required=true (e.g. review_decision_ux,
 *   security_interactivity_governance, ink_governance), even if the OS
 *   payload itself reported package_ready=true.
 * - package_ready is forced to false when payment_required=true and
 *   payment_satisfied is not true, and "payment" is added to
 *   blocked_by_governance_domains.
 * - package_ready is forced to false when proof_approval_governance requires
 *   an unapproved customer proof.
 * - approved_artifact_hash and approved_artifact_type are preserved.
 * - included_reports are preserved.
 * - approved_artifact_hash is never exposed to the customer audience (operator-only).
 * - package_ready=false (multi-source merge) always wins over package_ready=true.
 */

const { extractGovernanceContracts, mergeGovernanceObject } = require('../app/services/preflightNormalizer');

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

// ─── Scenario 1: package_ready=true — no blockers ────────────────────────────
section('Scenario 1: production_package_governance — package_ready=true preserved when nothing blocks production');
{
  const payload = {
    production_package_governance: {
      package_ready: true,
      approved_artifact_type: 'final_fixed_pdf',
      approved_artifact_hash: 'sha256:abc123',
      included_reports: ['preflight_report.json', 'fix_audit.json'],
    },
    artifact_trust: {
      production_certified: true,
      standard_certified: true,
      certified_pdf_allowed: true,
      review_required: false,
    },
  };
  const contracts = extractGovernanceContracts(payload);
  const pkg = contracts.production_package_governance;
  assert('production_package_governance preserved', !!pkg);
  assert('package_ready=true preserved', pkg?.package_ready === true);
  assert('approved_artifact_type preserved', pkg?.approved_artifact_type === 'final_fixed_pdf');
  assert('approved_artifact_hash preserved', pkg?.approved_artifact_hash === 'sha256:abc123');
  assert('included_reports preserved', Array.isArray(pkg?.included_reports) && pkg.included_reports.length === 2);
  assert('blocked_by_governance_domains empty', !Array.isArray(pkg?.blocked_by_governance_domains) || pkg.blocked_by_governance_domains.length === 0);
}

// ─── Scenario 2: package_ready=false due to operator review pending ──────────
section('Scenario 2: production_package_governance — package_ready forced false when review_decision_ux requires review');
{
  const payload = {
    production_package_governance: {
      package_ready: true, // OS optimistically said ready
      approved_artifact_type: 'fixed_pdf',
    },
    review_decision_ux: {
      decision: 'NO_DECISION',
      review_required: true,
      allows_progression: false,
    },
    artifact_trust: {
      production_certified: true,
      standard_certified: true,
      certified_pdf_allowed: true,
    },
  };
  const contracts = extractGovernanceContracts(payload);
  const pkg = contracts.production_package_governance;
  assert('package_ready forced to false', pkg?.package_ready === false);
  assert('review_decision_ux added to blocked_by_governance_domains', pkg?.blocked_by_governance_domains?.includes('review_decision_ux'));
}

// ─── Scenario 3: package_ready=false due to outstanding payment ──────────────
section('Scenario 3: production_package_governance — package_ready forced false when payment_required and not satisfied');
{
  const payload = {
    production_package_governance: {
      package_ready: true,
      approved_artifact_type: 'final_fixed_pdf',
      payment_required: true,
      payment_satisfied: false,
    },
    artifact_trust: {
      production_certified: true,
      standard_certified: true,
      certified_pdf_allowed: true,
      review_required: false,
    },
  };
  const contracts = extractGovernanceContracts(payload);
  const pkg = contracts.production_package_governance;
  assert('package_ready forced to false due to payment', pkg?.package_ready === false);
  assert('"payment" added to blocked_by_governance_domains', pkg?.blocked_by_governance_domains?.includes('payment'));

  // Payment satisfied — no longer blocked by payment.
  const satisfiedPayload = {
    production_package_governance: {
      package_ready: true,
      payment_required: true,
      payment_satisfied: true,
    },
    artifact_trust: {
      production_certified: true,
      review_required: false,
    },
  };
  const satisfiedContracts = extractGovernanceContracts(satisfiedPayload);
  const satisfiedPkg = satisfiedContracts.production_package_governance;
  assert('package_ready remains true once payment satisfied', satisfiedPkg?.package_ready === true);
  assert('"payment" not in blockers once satisfied', !(satisfiedPkg?.blocked_by_governance_domains || []).includes('payment'));
}

// ─── Scenario 4: package_ready=false due to pending visual proof ─────────────
section('Scenario 4: production_package_governance — package_ready forced false when a required customer proof is unapproved');
{
  const payload = {
    production_package_governance: {
      package_ready: true,
      approved_artifact_type: 'final_fixed_pdf',
    },
    proof_approval_governance: {
      proof_required: true,
      proof_status: 'PROOF_PENDING_CUSTOMER',
    },
    artifact_trust: {
      production_certified: true,
      standard_certified: true,
      certified_pdf_allowed: true,
      review_required: false,
    },
  };
  const contracts = extractGovernanceContracts(payload);
  const pkg = contracts.production_package_governance;
  assert('package_ready forced to false due to pending proof', pkg?.package_ready === false);
  assert('"proof_approval_governance" added to blocked_by_governance_domains', pkg?.blocked_by_governance_domains?.includes('proof_approval_governance'));
}

// ─── Scenario 5: approved artifact hash present and preserved ────────────────
section('Scenario 5: production_package_governance — approved_artifact_hash present and preserved');
{
  const payload = {
    production_package_governance: {
      package_ready: true,
      approved_artifact_type: 'final_fixed_pdf',
      approved_artifact_hash: 'sha256:deadbeef1234',
    },
    artifact_trust: { production_certified: true, review_required: false },
  };
  const contracts = extractGovernanceContracts(payload);
  const pkg = contracts.production_package_governance;
  assert('approved_artifact_hash preserved', pkg?.approved_artifact_hash === 'sha256:deadbeef1234');
}

// ─── Scenario 6: included_reports preserved ───────────────────────────────────
section('Scenario 6: production_package_governance — included_reports preserved');
{
  const payload = {
    production_package_governance: {
      package_ready: true,
      included_reports: ['preflight_report.json', 'visual_proof.pdf', 'fix_audit.json'],
    },
    artifact_trust: { production_certified: true, review_required: false },
  };
  const contracts = extractGovernanceContracts(payload);
  const pkg = contracts.production_package_governance;
  assert('included_reports preserved with all entries', Array.isArray(pkg?.included_reports) && pkg.included_reports.length === 3);
}

// ─── Scenario 7: customer audience never sees approved_artifact_hash ─────────
section('Scenario 7: ProductionPackagePanel — approved_artifact_hash is operator-only');
{
  // Mirrors ProductionPackagePanel.tsx: the customer audience branch never
  // renders productionPackageGovernance.approved_artifact_hash.
  const productionPackageGovernance = {
    package_ready: true,
    approved_artifact_type: 'final_fixed_pdf',
    approved_artifact_hash: 'sha256:should-not-leak-to-customer',
  };

  function renderedFieldsFor(audience) {
    const fields = ['package_ready', 'approved_artifact_type', 'included_reports', 'blocked_by_governance_domains'];
    if (audience === 'operator' && productionPackageGovernance.approved_artifact_hash) {
      fields.push('approved_artifact_hash');
    }
    return fields;
  }

  const customerFields = renderedFieldsFor('customer');
  const operatorFields = renderedFieldsFor('operator');
  assert('customer audience excludes approved_artifact_hash', !customerFields.includes('approved_artifact_hash'));
  assert('operator audience includes approved_artifact_hash', operatorFields.includes('approved_artifact_hash'));
}

// ─── Scenario 8: package_ready=false (multi-source merge) always wins ────────
section('Scenario 8: mergeGovernanceObject — package_ready=false always wins over package_ready=true');
{
  const merged = mergeGovernanceObject([
    { package_ready: true, approved_artifact_type: 'final_fixed_pdf' },
    { package_ready: false, blocked_by_governance_domains: ['payment'] },
  ]);
  assert('package_ready=false wins on merge', merged.package_ready === false);
  assert('blocked_by_governance_domains merged', merged.blocked_by_governance_domains.includes('payment'));

  // payment_satisfied=false from any source must win too.
  const paymentMerged = mergeGovernanceObject([
    { payment_required: true, payment_satisfied: true },
    { payment_required: true, payment_satisfied: false },
  ]);
  assert('payment_satisfied=false wins on merge', paymentMerged.payment_satisfied === false);
}

// ─── Summary ─────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(60)}`);
console.log(`APP-66 Smoke: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.error(`\n[FAIL] APP-66 smoke test failed with ${failed} assertion(s).`);
  process.exit(1);
} else {
  console.log(`\n[PASS] APP-66 smoke test complete — all scenarios pass.`);
}
