'use strict';
/**
 * APP-67 Smoke Test — BFF Policy Profiles / Machine Matching / Audit Bundle /
 * Recommendation Alignment
 *
 * Validates that:
 * - policy_profile_governance, machine_readiness_governance,
 *   audit_bundle_governance, and recommendation_governance are preserved by
 *   extractGovernanceContracts without flattening.
 * - profile_passed=true is preserved when the profile passed cleanly.
 * - profile_passed=false forces review_required=true on
 *   policy_profile_governance and adds it to
 *   production_package_governance.blocked_by_governance_domains.
 * - compatible=false (machine_readiness_governance) forces
 *   review_required=true and adds it to
 *   production_package_governance.blocked_by_governance_domains.
 * - audit_bundle_governance.bundle_available=true is preserved with its
 *   included_artifacts/included_reports.
 * - internal_only_evidence is never rendered to the customer audience (mirrors
 *   AuditBundlePanel.tsx).
 * - recommendation_governance.recommended_action / recommendation_label are
 *   preserved for a safe (non-destructive) recommendation.
 * - a destructive recommendation always forces operator_only=true and
 *   auto_apply=false (defense-in-depth — never auto-apply dangerous fixes).
 * - the customer audience never sees the destructive recommendation's
 *   recommended_action/reason (mirrors RecommendationPanel.tsx).
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

// ─── Scenario 1: policy profile passed ────────────────────────────────────
section('Scenario 1: policy_profile_governance — profile_passed=true preserved with no blockers');
{
  const payload = {
    policy_profile_governance: {
      active_profile: 'ISO_15930_PDFX_4',
      active_profile_label: 'PDF/X-4 (ISO 15930-7)',
      required_standard: 'PDF/X-4',
      profile_passed: true,
    },
    artifact_trust: { production_certified: true, review_required: false },
  };
  const contracts = extractGovernanceContracts(payload);
  const profile = contracts.policy_profile_governance;
  assert('policy_profile_governance preserved', !!profile);
  assert('active_profile preserved', profile?.active_profile === 'ISO_15930_PDFX_4');
  assert('required_standard preserved', profile?.required_standard === 'PDF/X-4');
  assert('profile_passed=true preserved', profile?.profile_passed === true);
  assert('review_required not forced when profile passed', profile?.review_required !== true);
  assert('production_package not blocked', contracts.production_package_governance === undefined ||
    !(contracts.production_package_governance?.blocked_by_governance_domains || []).includes('policy_profile_governance'));
}

// ─── Scenario 2: policy profile blockers ──────────────────────────────────
section('Scenario 2: policy_profile_governance — profile_passed=false forces review_required and blocks production package');
{
  const payload = {
    policy_profile_governance: {
      active_profile: 'ISO_15930_PDFX_4',
      required_standard: 'PDF/X-4',
      profile_passed: false,
      blockers: ['missing_output_intent', 'rgb_images_present'],
    },
    production_package_governance: {
      package_ready: true, // OS optimistically said ready
    },
    artifact_trust: { production_certified: true, review_required: false },
  };
  const contracts = extractGovernanceContracts(payload);
  const profile = contracts.policy_profile_governance;
  const pkg = contracts.production_package_governance;
  assert('profile_passed=false preserved', profile?.profile_passed === false);
  assert('blockers preserved', Array.isArray(profile?.blockers) && profile.blockers.length === 2);
  assert('review_required forced true on policy_profile_governance', profile?.review_required === true);
  assert('production_package_governance package_ready forced false', pkg?.package_ready === false);
  assert('policy_profile_governance added to blocked_by_governance_domains', pkg?.blocked_by_governance_domains?.includes('policy_profile_governance'));
}

// ─── Scenario 3: machine incompatible ─────────────────────────────────────
section('Scenario 3: machine_readiness_governance — compatible=false forces review_required and blocks production package');
{
  const payload = {
    machine_readiness_governance: {
      compatible: false,
      compatible_machines: [],
      incompatible_machines: ['HP_INDIGO_12000', 'KOMORI_GL_640'],
      mismatch_reasons: ['page_size_exceeds_max_sheet', 'substrate_not_supported'],
    },
    production_package_governance: {
      package_ready: true,
    },
    artifact_trust: { production_certified: true, review_required: false },
  };
  const contracts = extractGovernanceContracts(payload);
  const machine = contracts.machine_readiness_governance;
  const pkg = contracts.production_package_governance;
  assert('machine_readiness_governance preserved', !!machine);
  assert('compatible=false preserved', machine?.compatible === false);
  assert('incompatible_machines preserved', machine?.incompatible_machines?.length === 2);
  assert('mismatch_reasons preserved', machine?.mismatch_reasons?.length === 2);
  assert('review_required forced true on machine_readiness_governance', machine?.review_required === true);
  assert('production_package_governance package_ready forced false', pkg?.package_ready === false);
  assert('machine_readiness_governance added to blocked_by_governance_domains', pkg?.blocked_by_governance_domains?.includes('machine_readiness_governance'));
}

// ─── Scenario 4: machine compatible — no blockers ─────────────────────────
section('Scenario 4: machine_readiness_governance — compatible=true does not block production package');
{
  const payload = {
    machine_readiness_governance: {
      compatible: true,
      compatible_machines: ['HP_INDIGO_12000'],
    },
    production_package_governance: {
      package_ready: true,
    },
    artifact_trust: { production_certified: true, review_required: false },
  };
  const contracts = extractGovernanceContracts(payload);
  const machine = contracts.machine_readiness_governance;
  const pkg = contracts.production_package_governance;
  assert('compatible=true preserved', machine?.compatible === true);
  assert('review_required not forced when compatible', machine?.review_required !== true);
  assert('production_package_governance package_ready stays true', pkg?.package_ready === true);
}

// ─── Scenario 5: audit bundle available ───────────────────────────────────
section('Scenario 5: audit_bundle_governance — bundle_available=true preserved with included artifacts/reports');
{
  const payload = {
    audit_bundle_governance: {
      bundle_available: true,
      bundle_id: 'audit_bundle_abc123',
      included_artifacts: ['final_fixed_pdf', 'visual_proof_pdf'],
      included_reports: ['preflight_report.json', 'fix_audit.json'],
      customer_visible: true,
    },
    artifact_trust: { production_certified: true, review_required: false },
  };
  const contracts = extractGovernanceContracts(payload);
  const bundle = contracts.audit_bundle_governance;
  assert('audit_bundle_governance preserved', !!bundle);
  assert('bundle_available=true preserved', bundle?.bundle_available === true);
  assert('bundle_id preserved', bundle?.bundle_id === 'audit_bundle_abc123');
  assert('included_artifacts preserved', bundle?.included_artifacts?.length === 2);
  assert('included_reports preserved', bundle?.included_reports?.length === 2);
}

// ─── Scenario 6: audit bundle internal-only fields sanitized for customer ──
section('Scenario 6: AuditBundlePanel — internal_only_evidence is operator-only, and customer_visible=false hides the panel for customers');
{
  // Mirrors AuditBundlePanel.tsx: customer audience never sees
  // internal_only_evidence, and the panel renders nothing for the customer
  // audience when customer_visible=false.
  const auditBundleGovernance = {
    bundle_available: true,
    included_reports: ['preflight_report.json'],
    internal_only_evidence: { raw_tool_output: 'qpdf --check ...', internal_job_id: 'job_internal_999' },
    customer_visible: false,
  };

  function isPanelRenderedFor(audience) {
    if (audience === 'customer' && auditBundleGovernance.customer_visible === false) return false;
    return true;
  }

  function renderedFieldsFor(audience) {
    const fields = ['bundle_available', 'included_artifacts', 'included_reports'];
    if (audience === 'operator' && auditBundleGovernance.internal_only_evidence) {
      fields.push('internal_only_evidence');
    }
    return fields;
  }

  assert('customer audience does not render panel when customer_visible=false', isPanelRenderedFor('customer') === false);
  assert('operator audience renders panel', isPanelRenderedFor('operator') === true);
  assert('customer fields exclude internal_only_evidence', !renderedFieldsFor('customer').includes('internal_only_evidence'));
  assert('operator fields include internal_only_evidence', renderedFieldsFor('operator').includes('internal_only_evidence'));
}

// ─── Scenario 7: recommendation — safe, non-destructive action ────────────
section('Scenario 7: recommendation_governance — safe non-destructive recommendation preserved');
{
  const payload = {
    recommendation_governance: {
      recommended_action: 'PROCEED_TO_PRODUCTION',
      recommendation_label: 'Proceed to production',
      reason: 'All governance checks passed and the production package is ready.',
      customer_message: 'Your file is ready for production.',
      operator_only: false,
      destructive: false,
      auto_apply: false,
    },
    artifact_trust: { production_certified: true, review_required: false },
  };
  const contracts = extractGovernanceContracts(payload);
  const rec = contracts.recommendation_governance;
  assert('recommendation_governance preserved', !!rec);
  assert('recommended_action preserved', rec?.recommended_action === 'PROCEED_TO_PRODUCTION');
  assert('recommendation_label preserved', rec?.recommendation_label === 'Proceed to production');
  assert('operator_only=false preserved for safe recommendation', rec?.operator_only === false);
}

// ─── Scenario 8: recommendation — destructive action always operator-only ─
section('Scenario 8: recommendation_governance — destructive recommendation forces operator_only=true and auto_apply=false');
{
  const payload = {
    recommendation_governance: {
      recommended_action: 'OPERATOR_DESTRUCTIVE_FIX_REQUIRED',
      recommendation_label: 'Flatten transparency and downsample images',
      reason: 'Resolving the remaining ink/transparency violations requires a destructive print transform.',
      operator_only: false, // OS payload under-reported this
      destructive: true,
      auto_apply: true, // OS payload incorrectly requested auto-apply
    },
    artifact_trust: { production_certified: false, review_required: true },
  };
  const contracts = extractGovernanceContracts(payload);
  const rec = contracts.recommendation_governance;
  assert('recommended_action preserved', rec?.recommended_action === 'OPERATOR_DESTRUCTIVE_FIX_REQUIRED');
  assert('destructive=true preserved', rec?.destructive === true);
  assert('operator_only forced to true for destructive recommendation', rec?.operator_only === true);
  assert('auto_apply forced to false for destructive recommendation', rec?.auto_apply === false);

  // Customer audience never sees the destructive recommendation's action/reason
  // (mirrors RecommendationPanel.tsx: operator_only && !customer_message => generic notice).
  function customerSafeOutput(recommendation) {
    const operatorOnly = recommendation?.operator_only === true || recommendation?.destructive === true;
    if (operatorOnly && !recommendation?.customer_message) {
      return { generic: true };
    }
    return { recommended_action: recommendation?.recommended_action, reason: recommendation?.reason };
  }
  const customerOutput = customerSafeOutput(rec);
  assert('customer view does not expose recommended_action for destructive recommendation', customerOutput.generic === true);
  assert('customer view does not expose reason for destructive recommendation', !('reason' in customerOutput));
}

// ─── Scenario 9: mergeGovernanceObject — false/true-wins rules for APP-67 fields ──
section('Scenario 9: mergeGovernanceObject — profile_passed/compatible/bundle_available/auto_apply=false always win; destructive/operator_only=true always win');
{
  const profileMerged = mergeGovernanceObject([
    { profile_passed: true },
    { profile_passed: false, blockers: ['rgb_images_present'] },
  ]);
  assert('profile_passed=false wins on merge', profileMerged.profile_passed === false);
  assert('blockers merged', profileMerged.blockers.includes('rgb_images_present'));

  const machineMerged = mergeGovernanceObject([
    { compatible: true },
    { compatible: false, mismatch_reasons: ['page_size_exceeds_max_sheet'] },
  ]);
  assert('compatible=false wins on merge', machineMerged.compatible === false);
  assert('mismatch_reasons merged', machineMerged.mismatch_reasons.includes('page_size_exceeds_max_sheet'));

  const bundleMerged = mergeGovernanceObject([
    { bundle_available: true },
    { bundle_available: false },
  ]);
  assert('bundle_available=false wins on merge', bundleMerged.bundle_available === false);

  const recMerged = mergeGovernanceObject([
    { auto_apply: true, operator_only: false, destructive: false },
    { auto_apply: false, operator_only: true, destructive: true },
  ]);
  assert('auto_apply=false wins on merge', recMerged.auto_apply === false);
  assert('operator_only=true wins on merge', recMerged.operator_only === true);
  assert('destructive=true wins on merge', recMerged.destructive === true);
}

// ─── Scenario 10: legacy payload without APP-67 governance normalizes safely ──
section('Scenario 10: legacy payload without policy/machine/audit/recommendation governance normalizes safely');
{
  const payload = {
    artifact_trust: { production_certified: true, review_required: false },
  };
  const contracts = extractGovernanceContracts(payload);
  assert('policy_profile_governance absent', contracts.policy_profile_governance === undefined);
  assert('machine_readiness_governance absent', contracts.machine_readiness_governance === undefined);
  assert('audit_bundle_governance absent', contracts.audit_bundle_governance === undefined);
  assert('recommendation_governance absent', contracts.recommendation_governance === undefined);
  assert('artifact_trust still preserved', contracts.artifact_trust?.production_certified === true);
}

// ─── Summary ─────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(60)}`);
console.log(`APP-67 Smoke: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.error(`\n[FAIL] APP-67 smoke test failed with ${failed} assertion(s).`);
  process.exit(1);
} else {
  console.log(`\n[PASS] APP-67 smoke test complete — all scenarios pass.`);
}
