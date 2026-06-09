'use strict';

/**
 * APP-60 — BFF Governance Contract Foundation
 * Smoke test: verifies that extractGovernanceContracts, normalizeAutofixJob,
 * normalizeAutofixFinalState, and normalizeAutofixResultState preserve and
 * apply OS governance contracts correctly.
 */

const {
  extractGovernanceContracts,
  normalizeAutofixJob,
  normalizeAutofixFinalState,
  normalizeAutofixResultState,
  GOVERNANCE_KEYS
} = require('../app/services/preflightNormalizer');

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${label}`);
    failed++;
  }
}

function section(name) {
  console.log(`\n── Scenario: ${name}`);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeBaseFixJob(overrides = {}) {
  return {
    jobId: 'fix_001',
    type: 'AUTOFIX',
    status: 'COMPLETED',
    applied_fixes: [{ code: 'CONVERT_CMYK', status: 'APPLIED' }],
    artifacts: { fixed_pdf: 'output.pdf', final_fixed_pdf: 'output.pdf' },
    ...overrides
  };
}

// ─── Scenario 1: Payload with artifact_trust false flags ─────────────────────
section('1 – artifact_trust false flags preserved');
{
  const payload = makeBaseFixJob({
    artifact_trust: {
      production_certified: false,
      certified_pdf_allowed: false,
      review_required: true,
      trust_level: 'REVIEW_REQUIRED'
    }
  });
  const contracts = extractGovernanceContracts(payload);
  assert(contracts.artifact_trust !== undefined, 'artifact_trust extracted');
  assert(contracts.artifact_trust.production_certified === false, 'production_certified=false preserved');
  assert(contracts.artifact_trust.certified_pdf_allowed === false, 'certified_pdf_allowed=false preserved');
  assert(contracts.artifact_trust.review_required === true, 'review_required=true preserved');
}

// ─── Scenario 2: standards_certification_governance false flags ───────────────
section('2 – standards_certification_governance false flags');
{
  const payload = makeBaseFixJob({
    standards_certification_governance: {
      standard: 'PDF/X-4',
      validated: false,
      standard_certified: false,
      pdfx_compliance_claimed: false
    }
  });
  const contracts = extractGovernanceContracts(payload);
  assert(contracts.standards_certification_governance !== undefined, 'standards_certification_governance extracted');
  assert(contracts.standards_certification_governance.standard_certified === false, 'standard_certified=false preserved');
  assert(contracts.standards_certification_governance.pdfx_compliance_claimed === false, 'pdfx_compliance_claimed=false preserved');
}

// ─── Scenario 3: page_marks_governance review_required=true ──────────────────
section('3 – page_marks_governance review_required=true');
{
  const payload = makeBaseFixJob({
    page_marks_governance: {
      crop_marks_added: true,
      review_required: true,
      warnings: ['Crop marks were added — visual review recommended.']
    }
  });
  const contracts = extractGovernanceContracts(payload);
  assert(contracts.page_marks_governance !== undefined, 'page_marks_governance extracted');
  assert(contracts.page_marks_governance.review_required === true, 'review_required=true preserved');
  assert(Array.isArray(contracts.page_marks_governance.warnings), 'warnings array preserved');
}

// ─── Scenario 4: security_interactivity_governance active_content_removed=true
section('4 – security_interactivity_governance active_content_removed=true');
{
  const payload = makeBaseFixJob({
    security_interactivity_governance: {
      javascript_removed: true,
      active_content_removed: true,
      review_required: false
    }
  });
  const contracts = extractGovernanceContracts(payload);
  assert(contracts.security_interactivity_governance !== undefined, 'security_interactivity_governance extracted');
  assert(contracts.security_interactivity_governance.active_content_removed === true, 'active_content_removed=true preserved');
}

// ─── Scenario 5: remediation_ux ──────────────────────────────────────────────
section('5 – remediation_ux preserved');
{
  const payload = makeBaseFixJob({
    remediation_ux: {
      remediation_state: 'REUPLOAD_REQUIRED',
      requires_reupload: true,
      customer_message: 'Please upload a higher-resolution file.'
    }
  });
  const contracts = extractGovernanceContracts(payload);
  assert(contracts.remediation_ux !== undefined, 'remediation_ux extracted');
  assert(contracts.remediation_ux.remediation_state === 'REUPLOAD_REQUIRED', 'remediation_state preserved');
  assert(contracts.remediation_ux.requires_reupload === true, 'requires_reupload preserved');
}

// ─── Scenario 6: review_decision_ux ──────────────────────────────────────────
section('6 – review_decision_ux preserved');
{
  const payload = makeBaseFixJob({
    review_decision_ux: {
      decision: 'APPROVED_WITH_WARNINGS',
      allows_progression: true,
      customer_message: 'File approved with warnings.'
    }
  });
  const contracts = extractGovernanceContracts(payload);
  assert(contracts.review_decision_ux !== undefined, 'review_decision_ux extracted');
  assert(contracts.review_decision_ux.decision === 'APPROVED_WITH_WARNINGS', 'decision preserved');
}

// ─── Scenario 7: artifact_ux preserved ───────────────────────────────────────
section('7 – artifact_ux preserved');
{
  const payload = makeBaseFixJob({
    artifact_ux: {
      button_label: 'Download corrected file',
      display_label: 'Corrected file',
      status_badge: 'Corrections applied',
      customer_labels: {
        button_label: 'Download your file',
        display_label: 'Your corrected file'
      }
    }
  });
  const contracts = extractGovernanceContracts(payload);
  assert(contracts.artifact_ux !== undefined, 'artifact_ux extracted');
  assert(contracts.artifact_ux.button_label === 'Download corrected file', 'button_label preserved');
  assert(contracts.artifact_ux.customer_labels !== undefined, 'customer_labels preserved');
}

// ─── Scenario 8: Legacy payload without governance normalizes safely ──────────
section('8 – legacy payload without governance normalizes safely');
{
  const payload = makeBaseFixJob();
  const contracts = extractGovernanceContracts(payload);
  assert(typeof contracts === 'object', 'contracts is an object');
  assert(contracts.artifact_trust === undefined, 'no artifact_trust on legacy payload');
  assert(contracts.standards_certification_governance === undefined, 'no standards governance on legacy payload');

  const normalized = normalizeAutofixFinalState({
    ...payload,
    summary: { before: null, after: null },
    applied_fixes: [{ code: 'CONVERT_CMYK', status: 'APPLIED' }],
    skipped_fixes: [],
    failed_fixes: [],
    artifacts: { fixed_pdf: 'output.pdf', final_fixed_pdf: 'output.pdf' }
  });
  assert(normalized !== null, 'legacy payload normalizes without error');
  assert(normalized.status !== undefined, 'status field present');
}

// ─── Scenario 9: Conflicting legacy productionCertified=true but artifact_trust.production_certified=false
section('9 – artifact_trust.production_certified=false wins over legacy');
{
  const report = {
    type: 'AUTOFIX',
    status: 'AUTOFIX_COMPLETED',
    summary: { before: null, after: null },
    applied_fixes: [{ code: 'CONVERT_CMYK', status: 'APPLIED' }],
    skipped_fixes: [],
    failed_fixes: [],
    artifacts: { fixed_pdf: 'output.pdf', final_fixed_pdf: 'output.pdf', certified_pdf: 'certified.pdf' },
    artifactList: [{ type: 'certified_pdf', name: 'certified.pdf' }],
    artifact_trust: { production_certified: false, certified_pdf_allowed: false }
  };
  const normalized = normalizeAutofixFinalState(report);
  assert(normalized.productionCertified === false, 'productionCertified=false when artifact_trust says false');
  assert(!normalized.artifacts?.certified_pdf, 'certified_pdf artifact removed when certified_pdf_allowed=false');
  assert(
    !normalized.artifactList?.some(a => a.type === 'certified_pdf'),
    'certified_pdf removed from artifactList'
  );
}

// ─── Scenario 10: certified_pdf filename but certified_pdf_allowed=false ──────
section('10 – certified.pdf filename does not create trust when certified_pdf_allowed=false');
{
  const raw = makeBaseFixJob({
    artifacts: {
      certified_pdf: 'document-certified.pdf',
      fixed_pdf: 'document-fixed.pdf',
      final_fixed_pdf: 'document-fixed.pdf'
    },
    artifact_trust: {
      production_certified: true,
      certified_pdf_allowed: false
    }
  });
  const contracts = extractGovernanceContracts(raw);
  assert(contracts.artifact_trust.certified_pdf_allowed === false, 'certified_pdf_allowed=false extracted');

  const report = {
    ...raw,
    type: 'AUTOFIX',
    summary: { before: null, after: null },
    applied_fixes: [{ code: 'CONVERT_CMYK', status: 'APPLIED' }],
    skipped_fixes: [],
    failed_fixes: [],
    artifactList: [
      { type: 'certified_pdf', name: 'document-certified.pdf' },
      { type: 'fixed_pdf', name: 'document-fixed.pdf' }
    ]
  };
  const normalized = normalizeAutofixFinalState(report);
  assert(!normalized.artifacts?.certified_pdf, 'certified_pdf removed despite production_certified=true when certified_pdf_allowed=false');
}

// ─── Scenario 11: Governance from nested result location ─────────────────────
section('11 – governance extracted from nested result location');
{
  const payload = {
    jobId: 'fix_002',
    type: 'AUTOFIX',
    status: 'COMPLETED',
    result: {
      artifact_trust: { production_certified: false, review_required: true },
      page_marks_governance: { crop_marks_added: true, review_required: true }
    }
  };
  const contracts = extractGovernanceContracts(payload);
  assert(contracts.artifact_trust?.production_certified === false, 'artifact_trust extracted from result');
  assert(contracts.page_marks_governance?.review_required === true, 'page_marks_governance extracted from result');
}

// ─── Scenario 12: Conservative merge — blocked_by_governance_domains deduped ─
section('12 – conservative merge deduplicates blocked_by_governance_domains');
{
  const payload = {
    artifact_trust: {
      production_certified: true,
      blocked_by_governance_domains: ['page_marks', 'security']
    },
    result: {
      artifact_trust: {
        production_certified: false,
        blocked_by_governance_domains: ['page_marks', 'visual_diff']
      }
    }
  };
  const contracts = extractGovernanceContracts(payload);
  assert(contracts.artifact_trust.production_certified === false, 'production_certified=false wins in merge');
  const domains = contracts.artifact_trust.blocked_by_governance_domains;
  assert(Array.isArray(domains), 'blocked_by_governance_domains is array');
  assert(domains.length === 3, `deduplicated to 3 unique domains (got ${domains?.length})`);
  assert(domains.includes('page_marks'), 'page_marks included');
  assert(domains.includes('security'), 'security included');
  assert(domains.includes('visual_diff'), 'visual_diff included');
}

// ─── Scenario 13: normalizeAutofixResultState preserves governance ─────────────
section('13 – normalizeAutofixResultState preserves governance objects');
{
  const payload = {
    type: 'AUTOFIX',
    status: 'COMPLETED',
    summary: { before: null, after: null },
    applied_fixes: [{ code: 'CONVERT_CMYK', status: 'APPLIED' }],
    skipped_fixes: [],
    failed_fixes: [],
    artifacts: { fixed_pdf: 'output.pdf', final_fixed_pdf: 'output.pdf' },
    artifact_trust: { production_certified: false, review_required: true },
    standards_certification_governance: { standard: 'PDF/X-4', standard_certified: false }
  };
  const normalized = normalizeAutofixResultState(payload);
  assert(normalized.artifact_trust !== undefined, 'artifact_trust preserved through normalizeAutofixResultState');
  assert(normalized.artifact_trust.production_certified === false, 'production_certified=false preserved through normalizeAutofixResultState');
  assert(normalized.standards_certification_governance !== undefined, 'standards_certification_governance preserved');
}

// ─── Summary ──────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(60)}`);
console.log(`APP-60 Smoke: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.error(`\n[SMOKE APP-60] FAILED — ${failed} assertion(s) did not pass.`);
  process.exit(1);
} else {
  console.log('\n[SMOKE APP-60] All scenarios passed.');
}
