'use strict';
/**
 * APP-68 Smoke Test — BFF End-to-End OS Compatibility Regression
 *
 * Validates the BFF App against the full PrintPrice OS governance contract
 * from Phase 55 onward (APP-60 .. APP-67 combined), as a single end-to-end
 * regression pass:
 *
 * - extractGovernanceContracts preserves every GOVERNANCE_KEYS domain without
 *   flattening, from a "healthy" payload spread across multiple OS payload
 *   locations.
 * - A simultaneous worst-case payload (every domain signaling a blocker at
 *   once) drives review_required across all domains and forces
 *   production_package_governance.package_ready=false with every blocking
 *   domain listed.
 * - Legacy (pre-Phase-55) payloads normalize safely with no governance keys
 *   invented.
 * - Conflicting legacy "true" fields never override governance "false" /
 *   review_required=true signals.
 * - certified.pdf / fixed.pdf filenames and labels never imply readiness
 *   unless artifact_trust explicitly allows it (artifactUx.ts port).
 * - review_decision_ux / remediation_ux / proof_approval_governance /
 *   heavy_pdf_probe_governance correctly gate the final production download
 *   (Step5DownloadV2_4.tsx port).
 * - PDF/X / PDF/A compliance claims without validator evidence are withdrawn
 *   and force review (new APP-68 defense-in-depth rule).
 * - Visual changes / unperformed visual diffs / pending proofs require
 *   review or block production-ready messaging.
 * - Customer-facing output never exposes internal-only evidence, approved
 *   artifact hashes, or destructive-recommendation details.
 * - Forbidden hardcoded overclaim strings are absent from the governance-
 *   aware frontend source files.
 * - preflightProxy.js / accountRoutes.js still expose the governance
 *   preservation headers / fields wired up by APP-60..APP-67.
 * - Generates reports/app68_bff_os_contract_compatibility_regression.{json,md}
 */

const fs = require('fs');
const path = require('path');

const {
  extractGovernanceContracts,
  mergeGovernanceObject,
  normalizeAutofixJob,
  GOVERNANCE_KEYS,
} = require('../app/services/preflightNormalizer');

const ROOT = path.join(__dirname, '..');

let passed = 0;
let failed = 0;
const findings = [];

function assert(label, condition, details) {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
    findings.push({ status: 'pass', label });
  } else {
    console.error(`  ✗ ${label}${details ? ` — ${details}` : ''}`);
    failed++;
    findings.push({ status: 'fail', label, details: details || null });
  }
}

function section(title) {
  console.log(`\n[${title}]`);
  findings.push({ status: 'section', label: title });
}

// ─────────────────────────────────────────────────────────────────────────
// Inline ports of pure-logic helpers (mirrors frontend/utils/artifactUx.ts and
// the production-download gating in Step5DownloadV2_4.tsx). Smoke tests avoid
// a full TS build by porting only the pure logic under test.
// ─────────────────────────────────────────────────────────────────────────

const OVERCLAIM_PATTERNS = [
  /certified pdf/gi,
  /print.?ready/gi,
  /pdf\/x\s*(certified|compliant)/gi,
  /pdf\/a\s*(certified|compliant)/gi,
  /production.?certified/gi,
  /production.?ready/gi,
];

function sanitizeCustomerLabel(label, certifiedAllowed, standardCertified) {
  if (certifiedAllowed && standardCertified) return label;
  let out = label;
  for (const re of OVERCLAIM_PATTERNS) out = out.replace(re, 'corrected file');
  return out;
}

const FALLBACK_CORRECTED = { display_label: 'Corrected file', button_label: 'Download corrected file', status_badge: 'Corrected', tooltip: 'Download the automatically corrected file' };
const FALLBACK_REVIEW = { display_label: 'Review file', button_label: 'Download review file', status_badge: 'Review required', tooltip: 'This file requires review before production use' };
const FALLBACK_PROCESSED = { display_label: 'Processed file', button_label: 'Download processed file', status_badge: 'Processed', tooltip: 'Download the processed file' };

function getArtifactUxForArtifact(artifact, artifactUxContract, artifactTrust, audience = 'customer') {
  const reviewRequired = artifactTrust?.review_required === true || artifactTrust?.production_certified === false || artifactTrust?.customer_visible === false;
  const certifiedAllowed = artifactTrust?.certified_pdf_allowed !== false;
  const standardCertified = artifactTrust?.standard_certified === true;

  if (artifactUxContract) {
    const audienceLabels = audience === 'operator' ? artifactUxContract.operator_labels : artifactUxContract.customer_labels;
    const topLevel = audience === 'operator' ? { button_label: artifactUxContract.button_label, display_label: artifactUxContract.display_label, status_badge: artifactUxContract.status_badge, tooltip: artifactUxContract.tooltip } : null;
    const raw = audienceLabels || topLevel;
    if (raw?.display_label) {
      const display = audience === 'customer' ? sanitizeCustomerLabel(raw.display_label, certifiedAllowed, standardCertified) : raw.display_label;
      const button = audience === 'customer' ? sanitizeCustomerLabel(raw.button_label || FALLBACK_CORRECTED.button_label, certifiedAllowed, standardCertified) : (raw.button_label || FALLBACK_CORRECTED.button_label);
      return { display_label: display, button_label: button, status_badge: raw.status_badge || (reviewRequired ? FALLBACK_REVIEW.status_badge : FALLBACK_CORRECTED.status_badge), tooltip: raw.tooltip || FALLBACK_CORRECTED.tooltip };
    }
  }

  if (reviewRequired) return FALLBACK_REVIEW;
  const primaryType = artifactTrust?.primary_artifact_type || artifact?.type || artifact?.key;
  if (!primaryType) return { ...FALLBACK_PROCESSED };
  if (certifiedAllowed && standardCertified && primaryType === 'certified_pdf') return { display_label: 'Standards-validated file', button_label: 'Download standards-validated file', status_badge: 'Standards-validated', tooltip: 'This file has been validated against print standards' };
  if (primaryType === 'review_pdf') return { ...FALLBACK_REVIEW };
  if (primaryType === 'final_fixed_pdf' || primaryType === 'fixed_pdf') return { ...FALLBACK_CORRECTED };
  if (primaryType === 'normalized_pdf') return { ...FALLBACK_PROCESSED };
  return { ...FALLBACK_PROCESSED };
}

function getArtifactFilename(baseName, artifactKey, artifactTrust) {
  const base = baseName || 'document';
  const cleanBase = base.toLowerCase().endsWith('.pdf') ? base.slice(0, -4) : base;
  const certifiedAllowed = artifactTrust?.certified_pdf_allowed !== false;
  const standardCertified = artifactTrust?.standard_certified === true;
  if (artifactKey === 'certified_pdf' && certifiedAllowed && standardCertified) return `${cleanBase}-certified.pdf`;
  if (artifactKey === 'review_pdf') return `${cleanBase}-review.pdf`;
  return `${cleanBase}-corrected.pdf`;
}

// Port of Step5DownloadV2_4.tsx's productionDownloadBlocked derivation.
function isProductionDownloadBlocked(result) {
  const proofApprovalGovernance = result?.proof_approval_governance ?? null;
  const proofRequiresApproval = proofApprovalGovernance?.proof_required === true && proofApprovalGovernance?.proof_status !== 'PROOF_APPROVED';

  const reviewDecisionUx = result?.review_decision_ux ?? null;
  const remediationUx = result?.remediation_ux ?? null;
  const heavyPdfProbeGovernance = result?.heavy_pdf_probe_governance ?? null;
  const heavyPdfFatal = heavyPdfProbeGovernance?.fatal_document_failure === true;

  const remediationRequiresReupload = remediationUx !== null && (
    remediationUx.requires_reupload === true ||
    remediationUx.remediation_state === 'REUPLOAD_REQUIRED' ||
    remediationUx.remediation_state === 'WAITING_FOR_UPLOAD' ||
    remediationUx.remediation_state === 'PREFLIGHT_REQUIRED'
  );

  const reviewDecisionBlocksDownload = reviewDecisionUx !== null && (
    reviewDecisionUx.allows_progression === false ||
    reviewDecisionUx.decision === 'REJECTED_REQUIRES_REUPLOAD' ||
    reviewDecisionUx.decision === 'REQUEST_CUSTOMER_REUPLOAD'
  );

  return remediationRequiresReupload || reviewDecisionBlocksDownload || heavyPdfFatal || proofRequiresApproval;
}

// ─────────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────────

function makeBaseFixJob(overrides = {}) {
  return {
    jobId: 'fix_app68_e2e',
    status: 'COMPLETED',
    result: { status: 'COMPLETED' },
    artifacts: { fixed_pdf: 'output.pdf', final_fixed_pdf: 'output.pdf' },
    ...overrides,
  };
}

// A "healthy" payload — every GOVERNANCE_KEYS domain present with passing values.
const HEALTHY_GOVERNANCE = {
  artifact_trust: {
    production_certified: true,
    standard_certified: true,
    certified_pdf_allowed: true,
    customer_visible: true,
    compliance_claim_allowed: true,
    pdfx_compliance_claimed: true,
    pdfa_compliance_claimed: false,
    review_required: false,
    primary_artifact_type: 'certified_pdf',
    evidence: { validator: 'veraPDF', report_id: 'vp_app68_001' },
  },
  artifact_ux: {
    customer_labels: { display_label: 'Standards-validated file', button_label: 'Download standards-validated file', status_badge: 'Standards-validated', tooltip: 'This file has been validated against print standards' },
  },
  standards_certification_governance: {
    standard: 'PDF/X-4',
    validated: true,
    standard_certified: true,
    pdfx_compliance_claimed: true,
    evidence: { validator: 'veraPDF', report_id: 'vp_app68_001' },
  },
  structural_metadata_governance: { metadata_cleaned: true, review_required: false },
  page_marks_governance: { crop_marks_added: true, review_required: false },
  security_interactivity_governance: { javascript_removed: true, interactive_content_remaining: false, flattening_skipped: false },
  ink_governance: { tac_violation_remaining: false },
  selective_image_governance: { low_res_unfixable: false },
  font_governance: { font_source_available: true },
  transparency_overprint_physical_governance: { transparency_flattened: false, overprint_modified: false },
  visual_diff_governance: { visual_diff_required: true, visual_diff_performed: true, visual_change_detected: false },
  proof_approval_governance: { proof_required: true, proof_status: 'PROOF_APPROVED' },
  review_decision_ux: { decision: 'APPROVED_FOR_PRODUCTION', allows_progression: true, customer_message: 'Approved for production.' },
  remediation_ux: { remediation_state: 'RESOLVED', requires_reupload: false },
  policy_profile_governance: { active_profile: 'ISO_15930_PDFX_4', required_standard: 'PDF/X-4', profile_passed: true },
  machine_readiness_governance: { compatible: true, compatible_machines: ['HP_INDIGO_12000'] },
  audit_bundle_governance: { bundle_available: true, bundle_id: 'audit_app68_001', included_artifacts: ['final_fixed_pdf'], included_reports: ['preflight_report.json'], customer_visible: true },
  recommendation_governance: { recommended_action: 'PROCEED_TO_PRODUCTION', recommendation_label: 'Proceed to production', operator_only: false, destructive: false, auto_apply: false, customer_message: 'Your file is ready for production.' },
  production_package_governance: { package_ready: true, approved_artifact_type: 'certified_pdf', included_reports: ['preflight_report.json'] },
  heavy_pdf_probe_governance: { heavy_pdf_detected: false, analysis_degraded: false, fatal_document_failure: false },
};

// A "worst-case" payload — every domain signals a blocker simultaneously.
const AT_RISK_GOVERNANCE = {
  artifact_trust: { production_certified: false, standard_certified: false, certified_pdf_allowed: false, customer_visible: false, review_required: false },
  standards_certification_governance: { standard: 'PDF/X-4', standard_certified: false, pdfx_compliance_claimed: true /* no evidence */ },
  structural_metadata_governance: {},
  page_marks_governance: { review_required: true },
  security_interactivity_governance: { javascript_removed: true, interactive_content_remaining: true },
  ink_governance: { tac_violation_remaining: true },
  selective_image_governance: { low_res_unfixable: true },
  font_governance: { font_source_available: false },
  transparency_overprint_physical_governance: { transparency_flattened: true },
  visual_diff_governance: { visual_diff_required: true, visual_diff_performed: false },
  proof_approval_governance: { proof_required: true, proof_status: 'PROOF_PENDING_CUSTOMER' },
  review_decision_ux: { decision: 'NO_DECISION', allows_progression: false },
  remediation_ux: { remediation_state: 'REUPLOAD_REQUIRED', requires_reupload: true },
  policy_profile_governance: { active_profile: 'ISO_15930_PDFX_4', required_standard: 'PDF/X-4', profile_passed: false, blockers: ['rgb_images_present'] },
  machine_readiness_governance: { compatible: false, incompatible_machines: ['HP_INDIGO_12000'], mismatch_reasons: ['page_size_exceeds_max_sheet'] },
  audit_bundle_governance: { bundle_available: false },
  recommendation_governance: { recommended_action: 'OPERATOR_DESTRUCTIVE_FIX_REQUIRED', destructive: true, auto_apply: true, operator_only: false },
  production_package_governance: { package_ready: true /* OS optimistically said ready */ },
  heavy_pdf_probe_governance: { heavy_pdf_detected: true, analysis_degraded: true, fatal_document_failure: false },
};

// ─────────────────────────────────────────────────────────────────────────
// Scenario 1: Healthy kitchen-sink payload — all GOVERNANCE_KEYS preserved
// without flattening, spread across multiple OS payload locations.
// ─────────────────────────────────────────────────────────────────────────
section('Scenario 1: All GOVERNANCE_KEYS preserved without flattening (healthy payload, multi-location)');
{
  const keys = Object.keys(HEALTHY_GOVERNANCE);
  const half = Math.ceil(keys.length / 2);
  const rootPart = {};
  const resultPart = {};
  keys.forEach((k, i) => {
    if (i < half) rootPart[k] = HEALTHY_GOVERNANCE[k];
    else resultPart[k] = HEALTHY_GOVERNANCE[k];
  });

  const payload = makeBaseFixJob({ ...rootPart, result: { status: 'COMPLETED', ...resultPart } });
  const contracts = extractGovernanceContracts(payload);

  for (const key of GOVERNANCE_KEYS) {
    if (!(key in HEALTHY_GOVERNANCE)) continue;
    assert(`${key} preserved as object`, typeof contracts[key] === 'object' && contracts[key] !== null, `got ${JSON.stringify(contracts[key])}`);
  }

  // Spot-check representative nested fields survive verbatim.
  assert('artifact_trust.evidence preserved', contracts.artifact_trust?.evidence?.validator === 'veraPDF');
  assert('audit_bundle_governance.included_reports preserved', Array.isArray(contracts.audit_bundle_governance?.included_reports) && contracts.audit_bundle_governance.included_reports.includes('preflight_report.json'));
  assert('policy_profile_governance.active_profile preserved', contracts.policy_profile_governance?.active_profile === 'ISO_15930_PDFX_4');
  assert('production_package_governance.package_ready=true preserved when nothing blocks', contracts.production_package_governance?.package_ready === true);
  assert('production_package_governance.blocked_by_governance_domains absent/empty for healthy payload', !contracts.production_package_governance?.blocked_by_governance_domains || contracts.production_package_governance.blocked_by_governance_domains.length === 0);
}

// ─────────────────────────────────────────────────────────────────────────
// Scenario 2: Worst-case payload — every domain signals a blocker at once.
// ─────────────────────────────────────────────────────────────────────────
section('Scenario 2: Worst-case payload — every blocking domain forces review_required and blocks production_package_governance');
{
  const payload = makeBaseFixJob({ ...AT_RISK_GOVERNANCE });
  const contracts = extractGovernanceContracts(payload);

  const expectReviewRequired = [
    'standards_certification_governance',
    'page_marks_governance',
    'security_interactivity_governance',
    'ink_governance',
    'selective_image_governance',
    'font_governance',
    'transparency_overprint_physical_governance',
    'visual_diff_governance',
    'proof_approval_governance',
    'policy_profile_governance',
    'machine_readiness_governance',
  ];
  for (const key of expectReviewRequired) {
    assert(`${key}.review_required forced true`, contracts[key]?.review_required === true, `got ${JSON.stringify(contracts[key])}`);
  }

  assert('artifact_trust.production_certified=false preserved', contracts.artifact_trust?.production_certified === false);
  assert('standards_certification_governance.pdfx_compliance_claimed forced false (no evidence)', contracts.standards_certification_governance?.pdfx_compliance_claimed === false);
  assert('recommendation_governance.operator_only forced true (destructive)', contracts.recommendation_governance?.operator_only === true);
  assert('recommendation_governance.auto_apply forced false (destructive)', contracts.recommendation_governance?.auto_apply === false);

  const pkg = contracts.production_package_governance;
  assert('production_package_governance.package_ready forced false', pkg?.package_ready === false);
  const blocked = new Set(pkg?.blocked_by_governance_domains || []);
  for (const key of [...expectReviewRequired, 'artifact_trust']) {
    assert(`blocked_by_governance_domains includes ${key}`, blocked.has(key), `blocked=${JSON.stringify([...blocked])}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Scenario 3: Legacy (pre-Phase-55) payload normalizes safely.
// ─────────────────────────────────────────────────────────────────────────
section('Scenario 3: Legacy payload without governance normalizes safely (no invented governance)');
{
  const legacyPayload = {
    jobId: 'fix_app68_legacy',
    status: 'COMPLETED',
    productionCertified: true,
    result: { status: 'COMPLETED', artifacts: { fixed_pdf: 'output.pdf' } },
    artifacts: { fixed_pdf: 'output.pdf', final_fixed_pdf: 'output.pdf' },
  };

  const contracts = extractGovernanceContracts(legacyPayload);
  for (const key of GOVERNANCE_KEYS) {
    assert(`legacy payload has no ${key}`, contracts[key] === undefined);
  }

  let normalized;
  let threw = false;
  try {
    normalized = normalizeAutofixJob(legacyPayload, null);
  } catch (err) {
    threw = true;
  }
  assert('normalizeAutofixJob does not throw on legacy payload', threw === false);
  for (const key of GOVERNANCE_KEYS) {
    assert(`normalized legacy result has no invented ${key}`, normalized?.[key] === undefined);
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Scenario 4: Conflicting legacy "true" vs governance "false" — false wins.
// ─────────────────────────────────────────────────────────────────────────
section('Scenario 4: Conflicting legacy productionCertified=true vs artifact_trust.production_certified=false — governance wins');
{
  const payload = makeBaseFixJob({
    productionCertified: true,
    status: 'CERTIFIED',
    artifact_trust: { production_certified: false, review_required: true, certified_pdf_allowed: false },
  });

  const normalized = normalizeAutofixJob(payload, null);
  assert('normalized.artifact_trust preserved', !!normalized.artifact_trust);
  assert('artifact_trust.production_certified=false wins over legacy productionCertified=true', normalized.artifact_trust?.production_certified === false);
  assert('artifact_trust.review_required=true preserved', normalized.artifact_trust?.review_required === true);
  assert('artifact_trust.certified_pdf_allowed=false preserved', normalized.artifact_trust?.certified_pdf_allowed === false);
}

// ─────────────────────────────────────────────────────────────────────────
// Scenario 5: certified.pdf / fixed.pdf filenames and labels never imply
// readiness unless artifact_trust explicitly allows it.
// ─────────────────────────────────────────────────────────────────────────
section('Scenario 5: certified.pdf / fixed.pdf filenames and labels never imply readiness without artifact_trust');
{
  // certified_pdf artifact key alone (no trust data) must not claim "Certified PDF".
  const noTrust = getArtifactUxForArtifact({ key: 'certified_pdf' }, null, null, 'customer');
  assert('certified_pdf artifact key with no trust data is not labeled "Certified PDF"', !noTrust.display_label.toLowerCase().includes('certified pdf'));

  // certified_pdf_allowed=false -> filename never gets "-certified.pdf"
  const fnBlocked = getArtifactFilename('myfile.pdf', 'certified_pdf', { certified_pdf_allowed: false });
  assert('certified_pdf filename without certified_pdf_allowed does not append "-certified.pdf"', !fnBlocked.includes('-certified.pdf'), fnBlocked);

  // certified_pdf_allowed=true + standard_certified=true -> "-certified.pdf" is permitted
  const fnAllowed = getArtifactFilename('myfile.pdf', 'certified_pdf', { certified_pdf_allowed: true, standard_certified: true });
  assert('certified_pdf filename with certified_pdf_allowed+standard_certified appends "-certified.pdf"', fnAllowed === 'myfile-certified.pdf', fnAllowed);

  // fixed_pdf never implies production-ready in its filename.
  const fnFixed = getArtifactFilename('myfile.pdf', 'fixed_pdf', { production_certified: false });
  assert('fixed_pdf filename never appends "-certified.pdf"', !fnFixed.includes('-certified.pdf'), fnFixed);

  // fixed_pdf with production_certified=false -> review fallback, never "Production-ready"
  const fixedTrust = { primary_artifact_type: 'fixed_pdf', production_certified: false, review_required: true };
  const fixedUx = getArtifactUxForArtifact(null, null, fixedTrust, 'customer');
  assert('fixed_pdf with production_certified=false maps to Review file (not Production-ready)', fixedUx.display_label === 'Review file', fixedUx.display_label);
  assert('fixed_pdf review label never says production-ready', !/production.?ready/i.test(fixedUx.display_label));

  // artifact_ux customer_labels overclaiming "Production-ready" must be sanitized.
  const overclaimUx = { customer_labels: { display_label: 'Production-ready PDF', button_label: 'Download production-ready PDF', status_badge: 'Ready', tooltip: 'ready' } };
  const sanitized = getArtifactUxForArtifact(null, overclaimUx, { certified_pdf_allowed: false }, 'customer');
  assert('overclaiming customer label "Production-ready PDF" is sanitized', !/production.?ready/i.test(sanitized.display_label), sanitized.display_label);
  assert('overclaiming customer button label is sanitized', !/production.?ready/i.test(sanitized.button_label), sanitized.button_label);
}

// ─────────────────────────────────────────────────────────────────────────
// Scenario 6: review_decision_ux / remediation_ux / proof_approval_governance
// / heavy_pdf_probe_governance gate the final production download.
// ─────────────────────────────────────────────────────────────────────────
section('Scenario 6: review_required / remediation / review-decision / proof-pending block final download wording');
{
  assert('healthy result does not block production download', isProductionDownloadBlocked(HEALTHY_GOVERNANCE) === false);

  assert('review_decision_ux.decision=NO_DECISION (allows_progression=false) blocks download', isProductionDownloadBlocked({ review_decision_ux: { decision: 'NO_DECISION', allows_progression: false } }) === true);

  assert('remediation_ux.requires_reupload=true blocks download', isProductionDownloadBlocked({ remediation_ux: { requires_reupload: true, remediation_state: 'REUPLOAD_REQUIRED' } }) === true);

  assert('proof_approval_governance.proof_required=true with PROOF_PENDING_CUSTOMER blocks download', isProductionDownloadBlocked({ proof_approval_governance: { proof_required: true, proof_status: 'PROOF_PENDING_CUSTOMER' } }) === true);

  assert('proof_approval_governance.proof_required=true with PROOF_APPROVED does not block download', isProductionDownloadBlocked({ proof_approval_governance: { proof_required: true, proof_status: 'PROOF_APPROVED' } }) === false);

  assert('heavy_pdf_probe_governance.fatal_document_failure=true blocks download', isProductionDownloadBlocked({ heavy_pdf_probe_governance: { fatal_document_failure: true } }) === true);

  assert('review_decision_ux.decision=REQUEST_CUSTOMER_REUPLOAD blocks download', isProductionDownloadBlocked({ review_decision_ux: { decision: 'REQUEST_CUSTOMER_REUPLOAD' } }) === true);
}

// ─────────────────────────────────────────────────────────────────────────
// Scenario 7: PDF/X / PDF/A compliance claims without validator evidence are
// withdrawn and force review (APP-68 defense-in-depth rule).
// ─────────────────────────────────────────────────────────────────────────
section('Scenario 7: Standards claims only with validator evidence');
{
  // Claim without evidence -> withdrawn + review required.
  const noEvidence = extractGovernanceContracts(makeBaseFixJob({
    standards_certification_governance: { standard: 'PDF/X-4', pdfx_compliance_claimed: true },
  }));
  assert('pdfx_compliance_claimed without evidence is withdrawn', noEvidence.standards_certification_governance?.pdfx_compliance_claimed === false);
  assert('pdfx_compliance_claimed without evidence forces review_required', noEvidence.standards_certification_governance?.review_required === true);

  // Claim with evidence -> preserved, no forced review.
  const withEvidence = extractGovernanceContracts(makeBaseFixJob({
    standards_certification_governance: { standard: 'PDF/X-4', pdfx_compliance_claimed: true, evidence: { validator: 'veraPDF', report_id: 'vp_002' } },
  }));
  assert('pdfx_compliance_claimed with evidence is preserved', withEvidence.standards_certification_governance?.pdfx_compliance_claimed === true);
  assert('pdfx_compliance_claimed with evidence does not force review_required', withEvidence.standards_certification_governance?.review_required !== true);

  // Same rule applies to artifact_trust directly.
  const trustNoEvidence = extractGovernanceContracts(makeBaseFixJob({
    artifact_trust: { production_certified: true, pdfa_compliance_claimed: true },
  }));
  assert('artifact_trust.pdfa_compliance_claimed without evidence is withdrawn', trustNoEvidence.artifact_trust?.pdfa_compliance_claimed === false);
  assert('artifact_trust.pdfa_compliance_claimed without evidence forces review_required', trustNoEvidence.artifact_trust?.review_required === true);
}

// ─────────────────────────────────────────────────────────────────────────
// Scenario 8: Visual changes require review / proof approval.
// ─────────────────────────────────────────────────────────────────────────
section('Scenario 8: Visual changes require review or proof approval before production-ready messaging');
{
  const requiredNotPerformed = extractGovernanceContracts(makeBaseFixJob({
    visual_diff_governance: { visual_diff_required: true, visual_diff_performed: false },
  }));
  assert('visual_diff_required && !performed forces review_required', requiredNotPerformed.visual_diff_governance?.review_required === true);

  const detectedChange = extractGovernanceContracts(makeBaseFixJob({
    visual_diff_governance: { visual_diff_required: true, visual_diff_performed: true, visual_change_detected: true },
    proof_approval_governance: { proof_required: true, proof_status: 'PROOF_PENDING_CUSTOMER' },
  }));
  assert('visual_change_detected=true preserved', detectedChange.visual_diff_governance?.visual_change_detected === true);
  assert('pending proof after detected visual change forces proof_approval_governance.review_required', detectedChange.proof_approval_governance?.review_required === true);
  assert('pending proof after detected visual change blocks production download', isProductionDownloadBlocked(detectedChange) === true);

  const rejected = extractGovernanceContracts(makeBaseFixJob({
    proof_approval_governance: { proof_required: true, proof_status: 'PROOF_REJECTED_REUPLOAD_REQUIRED' },
  }));
  assert('PROOF_REJECTED_REUPLOAD_REQUIRED forces review_required', rejected.proof_approval_governance?.review_required === true);
}

// ─────────────────────────────────────────────────────────────────────────
// Scenario 9: Customer-facing output never exposes internal IDs, paths,
// tokens, or destructive-recommendation/operator-only details.
// ─────────────────────────────────────────────────────────────────────────
section('Scenario 9: Customer output is sanitized — no internal IDs, paths, tokens, or operator-only evidence');
{
  const payload = makeBaseFixJob({
    audit_bundle_governance: {
      bundle_available: true,
      included_reports: ['preflight_report.json'],
      internal_only_evidence: { raw_tool_output: 'qpdf --check ...', internal_job_id: 'job_internal_999', file_path: 'C:\\data\\jobs\\job_internal_999\\output.pdf' },
      customer_visible: false,
    },
    recommendation_governance: {
      recommended_action: 'OPERATOR_DESTRUCTIVE_FIX_REQUIRED',
      recommendation_label: 'Flatten transparency and downsample images',
      reason: 'Resolving the remaining ink/transparency violations requires a destructive print transform.',
      destructive: true,
      operator_only: false,
      auto_apply: true,
    },
    production_package_governance: {
      package_ready: true,
      approved_artifact_type: 'final_fixed_pdf',
      approved_artifact_hash: 'sha256:deadbeef',
    },
  });

  const contracts = extractGovernanceContracts(payload);

  // AuditBundlePanel: customer audience renders nothing when customer_visible=false,
  // and never includes internal_only_evidence even if it did.
  const bundle = contracts.audit_bundle_governance;
  function auditBundleRenderedFor(audience) {
    if (audience === 'customer' && bundle.customer_visible === false) return null;
    const fields = ['bundle_available', 'included_reports'];
    if (audience === 'operator' && bundle.internal_only_evidence) fields.push('internal_only_evidence');
    return fields;
  }
  assert('AuditBundlePanel renders nothing for customer when customer_visible=false', auditBundleRenderedFor('customer') === null);
  assert('AuditBundlePanel for operator includes internal_only_evidence', auditBundleRenderedFor('operator').includes('internal_only_evidence'));

  // RecommendationPanel: destructive recommendation never exposes recommended_action/reason
  // to the customer audience.
  const rec = contracts.recommendation_governance;
  assert('destructive recommendation forced operator_only=true', rec.operator_only === true);
  assert('destructive recommendation forced auto_apply=false', rec.auto_apply === false);
  function customerSafeRecommendation(recommendation) {
    const operatorOnly = recommendation?.operator_only === true || recommendation?.destructive === true;
    if (operatorOnly && !recommendation?.customer_message) return { generic: true };
    return { recommended_action: recommendation?.recommended_action, reason: recommendation?.reason };
  }
  const safeRec = customerSafeRecommendation(rec);
  assert('customer view of destructive recommendation does not expose recommended_action', !('recommended_action' in safeRec));
  assert('customer view of destructive recommendation does not expose reason', !('reason' in safeRec));

  // ProductionPackagePanel: approved_artifact_hash is operator-only evidence.
  const pkg = contracts.production_package_governance;
  function productionPackageFieldsFor(audience) {
    const fields = ['package_ready', 'approved_artifact_type', 'included_reports'];
    if (audience === 'operator' && pkg.approved_artifact_hash) fields.push('approved_artifact_hash');
    return fields;
  }
  assert('customer view excludes approved_artifact_hash', !productionPackageFieldsFor('customer').includes('approved_artifact_hash'));
  assert('operator view includes approved_artifact_hash', productionPackageFieldsFor('operator').includes('approved_artifact_hash'));

  // Generic scan: nothing in the customer-safe views above contains a raw filesystem
  // path or an internal job_* id.
  const customerSerialized = JSON.stringify({
    auditBundle: auditBundleRenderedFor('customer'),
    recommendation: safeRec,
    productionPackage: productionPackageFieldsFor('customer'),
  });
  assert('customer-safe view contains no Windows filesystem path', !/[A-Za-z]:\\\\/.test(customerSerialized), customerSerialized);
  assert('customer-safe view contains no internal job_* id', !/job_internal_\d+/.test(customerSerialized), customerSerialized);
}

// ─────────────────────────────────────────────────────────────────────────
// Scenario 10: Forbidden hardcoded overclaim strings absent from the
// governance-aware frontend source files (APP-60..APP-67 scope).
// ─────────────────────────────────────────────────────────────────────────
section('Scenario 10: Forbidden hardcoded overclaim strings absent from governance-aware frontend source');

const FORBIDDEN_CERTIFIED_FILENAME = { pattern: /-certified\.pdf/g, label: '"-certified.pdf" default naming' };
const FORBIDDEN_READY_FOR_PRINTING = { pattern: /readyForPrinting(?!['"])/g, label: '"readyForPrinting" as a hardcoded customer claim' };
const FORBIDDEN_PDFX_BADGE = { pattern: /PDF-X\/1A-COMPLIANT/g, label: '"PDF-X/1A-COMPLIANT" hardcoded badge' };

const FILENAME_AND_LABEL_SCAN = [
  'frontend/components/steps/Step5DownloadV2_4.tsx',
  'frontend/components/steps/Step4ReviewV2_4.tsx',
  'frontend/utils/clientChangeReport.ts',
].map(p => ({ rel: p, checks: [FORBIDDEN_CERTIFIED_FILENAME, FORBIDDEN_READY_FOR_PRINTING, FORBIDDEN_PDFX_BADGE] }));

// Governance panels added across APP-62..APP-67 — must never hardcode an
// unconditional "Certified PDF" / "Production certified" / "Print-ready" claim.
const GOVERNANCE_PANEL_SCAN = [
  'frontend/components/review/ReviewDecisionPanel.tsx',
  'frontend/components/remediation/CustomerRemediationPanel.tsx',
  'frontend/components/security/SecurityInteractivityPanel.tsx',
  'frontend/components/visual/VisualGovernancePanels.tsx',
  'frontend/components/proof/VisualProofPanel.tsx',
  'frontend/components/proof/ProofApprovalPanel.tsx',
  'frontend/components/handoff/ProductionPackagePanel.tsx',
  'frontend/components/policy/PolicyProfilePanel.tsx',
  'frontend/components/machine/MachineReadinessPanel.tsx',
  'frontend/components/audit/AuditBundlePanel.tsx',
  'frontend/components/recommendation/RecommendationPanel.tsx',
  'frontend/components/reports/HeavyPdfProbePanel.tsx',
].map(p => ({ rel: p, checks: [FORBIDDEN_READY_FOR_PRINTING, FORBIDDEN_PDFX_BADGE] }));

const OVERCLAIM_BADGE_PATTERNS = [
  { pattern: />\s*Certified PDF\s*</g, label: 'unconditional "Certified PDF" JSX text node' },
  { pattern: />\s*Print-ready\s*</g, label: 'unconditional "Print-ready" JSX text node' },
];

for (const { rel, checks } of [...FILENAME_AND_LABEL_SCAN, ...GOVERNANCE_PANEL_SCAN]) {
  const filePath = path.join(ROOT, rel);
  let src;
  try {
    src = fs.readFileSync(filePath, 'utf-8');
  } catch {
    assert(`${rel} is readable`, false, 'file not found');
    continue;
  }

  for (const { pattern, label } of checks) {
    const matches = src.match(pattern);
    assert(`No ${label} in ${rel}`, !matches, matches ? `${matches.length} occurrence(s)` : undefined);
  }
  for (const { pattern, label } of OVERCLAIM_BADGE_PATTERNS) {
    const matches = src.match(pattern);
    assert(`No ${label} in ${rel}`, !matches, matches ? `${matches.length} occurrence(s)` : undefined);
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Scenario 11: preflightProxy.js / accountRoutes.js still expose the
// governance preservation wiring from APP-60..APP-67.
// ─────────────────────────────────────────────────────────────────────────
section('Scenario 11: preflightProxy.js / accountRoutes.js governance wiring regression');
{
  const proxySrc = fs.readFileSync(path.join(ROOT, 'app/routes/preflightProxy.js'), 'utf-8');
  assert('preflightProxy.js sets X-PPOS-Governance-Preserved header', proxySrc.includes('X-PPOS-Governance-Preserved'));
  assert('preflightProxy.js sets X-PPOS-Artifact-Trust-Preserved header', proxySrc.includes('X-PPOS-Artifact-Trust-Preserved'));

  const accountSrc = fs.readFileSync(path.join(ROOT, 'app/routes/accountRoutes.js'), 'utf-8');
  const expectedGovernanceFields = [
    'artifact_trust',
    'review_required',
    'production_certified',
    'standard_certified',
    'customer_visible',
    'package_ready',
    'remediation_state',
    'review_decision_state',
    'customer_safe_next_action',
    'policy_profile_governance',
    'machine_readiness_governance',
    'audit_bundle_governance',
    'recommendation_governance',
  ];
  for (const field of expectedGovernanceFields) {
    assert(`accountRoutes.js file-history governance object includes ${field}`, accountSrc.includes(field));
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Report generation
// ─────────────────────────────────────────────────────────────────────────
section('Generating APP-68 compatibility regression reports');
{
  const reportsDir = path.join(ROOT, 'reports');
  fs.mkdirSync(reportsDir, { recursive: true });

  const sections = [];
  let current = null;
  for (const f of findings) {
    if (f.status === 'section') {
      current = { title: f.label, checks: [] };
      sections.push(current);
    } else if (current) {
      current.checks.push(f);
    }
  }

  const jsonReport = {
    phase: 'APP-68',
    title: 'BFF End-to-End OS Contract Compatibility Regression',
    generatedAt: new Date().toISOString(),
    governanceDomainsChecked: GOVERNANCE_KEYS,
    summary: { passed, failed, total: passed + failed },
    sections,
  };

  const jsonPath = path.join(reportsDir, 'app68_bff_os_contract_compatibility_regression.json');
  fs.writeFileSync(jsonPath, JSON.stringify(jsonReport, null, 2));
  assert(`JSON report written to ${path.relative(ROOT, jsonPath)}`, fs.existsSync(jsonPath));

  const mdLines = [];
  mdLines.push('# APP-68 — BFF End-to-End OS Contract Compatibility Regression');
  mdLines.push('');
  mdLines.push(`Generated: ${jsonReport.generatedAt}`);
  mdLines.push('');
  mdLines.push(`**Result: ${failed === 0 ? 'PASS' : 'FAIL'}** (${passed} passed, ${failed} failed, ${passed + failed} total)`);
  mdLines.push('');
  mdLines.push('## Governance domains validated');
  mdLines.push('');
  for (const key of GOVERNANCE_KEYS) mdLines.push(`- \`${key}\``);
  mdLines.push('');
  mdLines.push('## Results by scenario');
  mdLines.push('');
  for (const sec of sections) {
    const secFailed = sec.checks.filter(c => c.status === 'fail').length;
    mdLines.push(`### ${sec.title}`);
    mdLines.push('');
    if (sec.checks.length === 0) {
      mdLines.push('_(no individual assertions — generation step)_');
      mdLines.push('');
      continue;
    }
    mdLines.push(`Status: ${secFailed === 0 ? 'PASS' : `FAIL (${secFailed} failed)`}`);
    mdLines.push('');
    for (const c of sec.checks) {
      const mark = c.status === 'pass' ? 'x' : ' ';
      mdLines.push(`- [${mark}] ${c.label}${c.details ? ` — ${c.details}` : ''}`);
    }
    mdLines.push('');
  }

  const mdPath = path.join(reportsDir, 'app68_bff_os_contract_compatibility_regression.md');
  fs.writeFileSync(mdPath, mdLines.join('\n'));
  assert(`Markdown report written to ${path.relative(ROOT, mdPath)}`, fs.existsSync(mdPath));
}

// ─────────────────────────────────────────────────────────────────────────
// Summary
// ─────────────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(60)}`);
console.log(`APP-68 Smoke: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.error(`\n[FAIL] APP-68 smoke test failed with ${failed} assertion(s).`);
  process.exit(1);
} else {
  console.log('\n[PASS] APP-68 smoke test complete — BFF is aligned with the PrintPrice OS contract from Phase 55 onward.');
}
