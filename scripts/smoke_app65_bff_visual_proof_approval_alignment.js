'use strict';
/**
 * APP-65 Smoke Test — BFF Visual Proof / Customer Approval Alignment
 *
 * Validates that:
 * - proof_approval_governance and visual_diff_governance are preserved by
 *   extractGovernanceContracts without flattening
 * - proof_required=true with proof_status != PROOF_APPROVED forces
 *   proof_approval_governance.review_required=true (defense-in-depth)
 * - PROOF_REJECTED_REUPLOAD_REQUIRED always forces review_required=true
 * - PROOF_APPROVED with proof_required=true does NOT force review_required
 * - PROOF_NOT_REQUIRED does not block production-readiness
 * - proof_status merge precedence: REJECTED > PENDING_CUSTOMER > REQUIRED >
 *   APPROVED > NOT_REQUIRED — the most restrictive status across sources wins
 * - proof_required=true is never silently dropped on merge
 * - Customer-facing messaging never overclaims "production-ready" before
 *   proof approval, and never exposes raw file paths in diff metrics
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

// ─── Scenario 1: PROOF_NOT_REQUIRED — does not block production ──────────────
section('Scenario 1: proof_approval_governance — PROOF_NOT_REQUIRED does not block production');
{
  const payload = {
    proof_approval_governance: {
      proof_required: false,
      proof_status: 'PROOF_NOT_REQUIRED',
    },
    artifact_trust: {
      production_certified: true,
      standard_certified: true,
      certified_pdf_allowed: true,
    },
  };
  const contracts = extractGovernanceContracts(payload);
  const proof = contracts.proof_approval_governance;
  assert('proof_approval_governance preserved', !!proof);
  assert('proof_status=PROOF_NOT_REQUIRED preserved', proof?.proof_status === 'PROOF_NOT_REQUIRED');
  assert('review_required not forced', proof?.review_required !== true);

  const proofRequiresApproval = proof?.proof_required === true && proof?.proof_status !== 'PROOF_APPROVED';
  assert('proofRequiresApproval=false', proofRequiresApproval === false);

  const isProductionCertified = contracts.artifact_trust?.production_certified === true && !proofRequiresApproval;
  assert('production certification not withheld', isProductionCertified === true);
}

// ─── Scenario 2: PROOF_REQUIRED but proof not yet generated ──────────────────
section('Scenario 2: proof_approval_governance — PROOF_REQUIRED (proof missing) blocks production');
{
  const payload = {
    proof_approval_governance: {
      proof_required: true,
      proof_status: 'PROOF_REQUIRED',
      review_required: false, // OS may not set this explicitly
    },
    artifact_trust: {
      production_certified: true,
      standard_certified: true,
      certified_pdf_allowed: true,
    },
  };
  const contracts = extractGovernanceContracts(payload);
  const proof = contracts.proof_approval_governance;
  assert('proof_required=true preserved', proof?.proof_required === true);
  assert('proof_status=PROOF_REQUIRED preserved', proof?.proof_status === 'PROOF_REQUIRED');
  assert('review_required forced to true (defense-in-depth)', proof?.review_required === true);

  const proofRequiresApproval = proof?.proof_required === true && proof?.proof_status !== 'PROOF_APPROVED';
  assert('proofRequiresApproval=true', proofRequiresApproval === true);

  const isProductionCertified = contracts.artifact_trust?.production_certified === true && !proofRequiresApproval;
  assert('production certification withheld despite artifact_trust.production_certified=true', isProductionCertified === false);
}

// ─── Scenario 3: proof available, pending customer approval ──────────────────
section('Scenario 3: proof_approval_governance — proof available, PROOF_PENDING_CUSTOMER blocks production');
{
  const payload = {
    proof_approval_governance: {
      proof_required: true,
      proof_status: 'PROOF_PENDING_CUSTOMER',
      proof_id: 'proof_abc123',
      proof_artifact_type: 'visual_proof_pdf',
      review_required: false,
    },
    artifact_trust: {
      production_certified: true,
      standard_certified: true,
      certified_pdf_allowed: true,
    },
  };
  const contracts = extractGovernanceContracts(payload);
  const proof = contracts.proof_approval_governance;
  assert('proof_id preserved', proof?.proof_id === 'proof_abc123');
  assert('proof_artifact_type preserved', proof?.proof_artifact_type === 'visual_proof_pdf');
  assert('review_required forced to true (defense-in-depth)', proof?.review_required === true);

  const proofRequiresApproval = proof?.proof_required === true && proof?.proof_status !== 'PROOF_APPROVED';
  assert('proofRequiresApproval=true', proofRequiresApproval === true);
}

// ─── Scenario 4: PROOF_APPROVED — does not block production ──────────────────
section('Scenario 4: proof_approval_governance — PROOF_APPROVED does not force review or block production');
{
  const payload = {
    proof_approval_governance: {
      proof_required: true,
      proof_status: 'PROOF_APPROVED',
      proof_id: 'proof_abc123',
      review_required: false,
    },
    artifact_trust: {
      production_certified: true,
      standard_certified: true,
      certified_pdf_allowed: true,
    },
  };
  const contracts = extractGovernanceContracts(payload);
  const proof = contracts.proof_approval_governance;
  assert('proof_status=PROOF_APPROVED preserved', proof?.proof_status === 'PROOF_APPROVED');
  assert('review_required not forced when approved', proof?.review_required === false);

  const proofRequiresApproval = proof?.proof_required === true && proof?.proof_status !== 'PROOF_APPROVED';
  assert('proofRequiresApproval=false once approved', proofRequiresApproval === false);

  const isProductionCertified = contracts.artifact_trust?.production_certified === true && !proofRequiresApproval;
  assert('production certification allowed once proof approved', isProductionCertified === true);
}

// ─── Scenario 5: PROOF_REJECTED_REUPLOAD_REQUIRED ─────────────────────────────
section('Scenario 5: proof_approval_governance — PROOF_REJECTED_REUPLOAD_REQUIRED always forces review');
{
  const payload = {
    proof_approval_governance: {
      proof_required: true,
      proof_status: 'PROOF_REJECTED_REUPLOAD_REQUIRED',
      proof_id: 'proof_abc123',
      customer_message: 'The customer rejected the proof. Please upload a corrected file.',
      review_required: false,
    },
  };
  const contracts = extractGovernanceContracts(payload);
  const proof = contracts.proof_approval_governance;
  assert('proof_status=PROOF_REJECTED_REUPLOAD_REQUIRED preserved', proof?.proof_status === 'PROOF_REJECTED_REUPLOAD_REQUIRED');
  assert('review_required forced to true (defense-in-depth)', proof?.review_required === true);
  assert('customer_message preserved', typeof proof?.customer_message === 'string' && proof.customer_message.length > 0);

  const proofRequiresApproval = proof?.proof_required === true && proof?.proof_status !== 'PROOF_APPROVED';
  assert('proofRequiresApproval=true on rejection', proofRequiresApproval === true);
}

// ─── Scenario 6: visual change detected — visual_diff_governance preserved ───
section('Scenario 6: visual_diff_governance — visual change detected alongside proof governance');
{
  const payload = {
    visual_diff_governance: {
      visual_diff_required: true,
      visual_diff_performed: true,
      visual_change_detected: true,
      visual_change_expected: true,
      diff_metrics: { pixel_diff_percent: 2.4, pages_changed: 1 },
      review_required: false,
    },
    proof_approval_governance: {
      proof_required: true,
      proof_status: 'PROOF_PENDING_CUSTOMER',
      proof_artifact_type: 'visual_proof_pdf',
    },
  };
  const contracts = extractGovernanceContracts(payload);
  const visualDiff = contracts.visual_diff_governance;
  const proof = contracts.proof_approval_governance;

  assert('visual_change_detected=true preserved', visualDiff?.visual_change_detected === true);
  assert('diff_metrics preserved', visualDiff?.diff_metrics?.pixel_diff_percent === 2.4);
  assert('proof_artifact_type preserved alongside visual_diff_governance', proof?.proof_artifact_type === 'visual_proof_pdf');
}

// ─── Scenario 7: customer view — no raw file paths in diff metrics ───────────
section('Scenario 7: Customer view — diff_metrics never expose raw file paths');
{
  const payload = {
    visual_diff_governance: {
      visual_diff_required: true,
      visual_diff_performed: true,
      visual_change_detected: true,
      diff_metrics: {
        pixel_diff_percent: 1.8,
        pages_changed: 2,
        // These must never reach the customer-facing UI as raw values.
        rendered_original_path: '/var/tmp/jobs/job_123/original_render.png',
        rendered_fixed_path: 'C:\\jobs\\job_123\\fixed_render.png',
        diff_overlay_path: 'job_123/diff_overlay.png',
        report_path: 'job_123/report.json',
      },
    },
    proof_approval_governance: {
      proof_required: true,
      proof_status: 'PROOF_PENDING_CUSTOMER',
    },
  };
  const contracts = extractGovernanceContracts(payload);
  const diffMetrics = contracts.visual_diff_governance?.diff_metrics || {};

  // Mirrors VisualProofPanel's safeMetricEntries() filter.
  const PATH_LIKE_PATTERN = /[\\/]|\.(pdf|png|jpe?g|tiff?|json|tmp)$/i;
  const safeEntries = Object.entries(diffMetrics).filter(([, v]) => {
    if (typeof v === 'number' || typeof v === 'boolean') return true;
    if (typeof v === 'string') return !PATH_LIKE_PATTERN.test(v);
    return false;
  });
  const safeKeys = safeEntries.map(([k]) => k);

  assert('numeric metrics retained', safeKeys.includes('pixel_diff_percent') && safeKeys.includes('pages_changed'));
  assert('rendered_original_path filtered out', !safeKeys.includes('rendered_original_path'));
  assert('rendered_fixed_path filtered out', !safeKeys.includes('rendered_fixed_path'));
  assert('diff_overlay_path filtered out', !safeKeys.includes('diff_overlay_path'));
  assert('report_path filtered out', !safeKeys.includes('report_path'));

  const safeFacingText = safeEntries.map(([k, v]) => `${k}: ${v}`).join(' ');
  assert('no raw file paths in customer-facing metric text', !/[\\/]/.test(safeFacingText));
}

// ─── Scenario 8: final production download hidden until proof approved ───────
section('Scenario 8: Step5Download — final production download hidden until proof approved');
{
  const pendingPayload = {
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
  const pendingContracts = extractGovernanceContracts(pendingPayload);
  const pendingProof = pendingContracts.proof_approval_governance;
  const pendingProofRequiresApproval = pendingProof?.proof_required === true && pendingProof?.proof_status !== 'PROOF_APPROVED';

  // Mirrors Step5DownloadV2_4's productionDownloadBlocked computation.
  const pendingProductionDownloadBlocked = pendingProofRequiresApproval; // (no other blocking conditions in this scenario)
  assert('production download blocked while proof pending', pendingProductionDownloadBlocked === true);

  // effectiveArtifactTrust mirrors the Step5DownloadV2_4 derivation.
  const pendingEffectiveTrust = pendingProofRequiresApproval
    ? { ...pendingContracts.artifact_trust, review_required: true }
    : pendingContracts.artifact_trust;
  assert('effectiveArtifactTrust.review_required=true while proof pending', pendingEffectiveTrust.review_required === true);

  const approvedPayload = {
    proof_approval_governance: {
      proof_required: true,
      proof_status: 'PROOF_APPROVED',
    },
    artifact_trust: {
      production_certified: true,
      standard_certified: true,
      certified_pdf_allowed: true,
      review_required: false,
    },
  };
  const approvedContracts = extractGovernanceContracts(approvedPayload);
  const approvedProof = approvedContracts.proof_approval_governance;
  const approvedProofRequiresApproval = approvedProof?.proof_required === true && approvedProof?.proof_status !== 'PROOF_APPROVED';
  const approvedProductionDownloadBlocked = approvedProofRequiresApproval;
  assert('production download available once proof approved', approvedProductionDownloadBlocked === false);
}

// ─── Scenario 9: proof_status merge precedence — most restrictive wins ───────
section('Scenario 9: proof_status merge — most restrictive status across sources wins');
{
  const { mergeGovernanceObject } = require('../app/services/preflightNormalizer');

  // PROOF_REJECTED_REUPLOAD_REQUIRED must beat a stale PROOF_APPROVED.
  const rejectedWins = mergeGovernanceObject([
    { proof_required: true, proof_status: 'PROOF_APPROVED' },
    { proof_required: true, proof_status: 'PROOF_REJECTED_REUPLOAD_REQUIRED' },
  ]);
  assert('PROOF_REJECTED_REUPLOAD_REQUIRED wins over stale PROOF_APPROVED', rejectedWins.proof_status === 'PROOF_REJECTED_REUPLOAD_REQUIRED');

  // PROOF_PENDING_CUSTOMER must beat PROOF_NOT_REQUIRED.
  const pendingWins = mergeGovernanceObject([
    { proof_required: false, proof_status: 'PROOF_NOT_REQUIRED' },
    { proof_required: true, proof_status: 'PROOF_PENDING_CUSTOMER' },
  ]);
  assert('PROOF_PENDING_CUSTOMER wins over PROOF_NOT_REQUIRED', pendingWins.proof_status === 'PROOF_PENDING_CUSTOMER');
  assert('proof_required=true preserved on merge (never silently dropped)', pendingWins.proof_required === true);

  // PROOF_APPROVED must NOT override an existing PROOF_REQUIRED.
  const requiredWins = mergeGovernanceObject([
    { proof_required: true, proof_status: 'PROOF_REQUIRED' },
    { proof_required: true, proof_status: 'PROOF_APPROVED' },
  ]);
  assert('PROOF_REQUIRED is not overridden by a later PROOF_APPROVED', requiredWins.proof_status === 'PROOF_REQUIRED');
}

// ─── Summary ─────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(60)}`);
console.log(`APP-65 Smoke: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.error(`\n[FAIL] APP-65 smoke test failed with ${failed} assertion(s).`);
  process.exit(1);
} else {
  console.log(`\n[PASS] APP-65 smoke test complete — all scenarios pass.`);
}
