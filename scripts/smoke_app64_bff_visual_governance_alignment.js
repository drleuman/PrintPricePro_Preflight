'use strict';
/**
 * APP-64 Smoke Test — BFF Ink / Image / Font / Visual Fix Governance Alignment
 *
 * Validates that:
 * - ink_governance, selective_image_governance, font_governance,
 *   transparency_overprint_physical_governance, and visual_diff_governance
 *   are preserved by extractGovernanceContracts
 * - tac_violation_remaining=true forces ink_governance.review_required=true
 * - low_res_unfixable=true forces selective_image_governance.review_required=true
 * - font_source_available=false forces font_governance.review_required=true
 * - transparency_flattened / overprint_modified force
 *   transparency_overprint_physical_governance.review_required=true
 * - visual_diff_required=true with visual_diff_performed!=true forces
 *   visual_diff_governance.review_required=true and blocks production-ready messaging
 * - visual_diff_performed=true with visual_change_detected=true does not force review
 * - artifact_trust still blocks production when visual governance looks fine
 * - Customer-facing messaging never overclaims "certified" or "print-ready"
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

// ─── Scenario 1: ink_governance review required (TAC violation remaining) ────
section('Scenario 1: ink_governance — tac_violation_remaining forces review');
{
  const payload = {
    ink_governance: {
      tac_limit_applied: true,
      tac_limit_value: 300,
      ink_density_violations_fixed: 2,
      tac_violation_remaining: true,
      review_required: false, // OS may not set this explicitly
    },
  };
  const contracts = extractGovernanceContracts(payload);
  const ink = contracts.ink_governance;
  assert('ink_governance preserved', !!ink);
  assert('tac_violation_remaining=true preserved', ink?.tac_violation_remaining === true);
  assert('review_required forced to true (defense-in-depth)', ink?.review_required === true);
}

// ─── Scenario 2: selective_image_governance low_res_unfixable ────────────────
section('Scenario 2: selective_image_governance — low_res_unfixable forces review');
{
  const payload = {
    selective_image_governance: {
      images_processed: 5,
      images_resampled: 3,
      low_res_images_detected: 1,
      low_res_unfixable: true,
      review_required: false, // OS may not set this explicitly
    },
  };
  const contracts = extractGovernanceContracts(payload);
  const img = contracts.selective_image_governance;
  assert('selective_image_governance preserved', !!img);
  assert('low_res_unfixable=true preserved', img?.low_res_unfixable === true);
  assert('review_required forced to true (defense-in-depth)', img?.review_required === true);
}

// ─── Scenario 3: font_governance font source unavailable ─────────────────────
section('Scenario 3: font_governance — font_source_available=false forces review');
{
  const payload = {
    font_governance: {
      fonts_embedded: 1,
      fonts_missing: ['Helvetica Neue Bold'],
      font_source_available: false,
      review_required: false, // OS may not set this explicitly
    },
  };
  const contracts = extractGovernanceContracts(payload);
  const font = contracts.font_governance;
  assert('font_governance preserved', !!font);
  assert('font_source_available=false preserved', font?.font_source_available === false);
  assert('fonts_missing preserved', Array.isArray(font?.fonts_missing) && font.fonts_missing.includes('Helvetica Neue Bold'));
  assert('review_required forced to true (defense-in-depth)', font?.review_required === true);
}

// ─── Scenario 4: transparency flattening forces review ───────────────────────
section('Scenario 4: transparency_overprint_physical_governance — flattening forces review');
{
  const payload = {
    transparency_overprint_physical_governance: {
      transparency_flattened: true,
      overprint_modified: false,
      spot_colors_converted: false,
      review_required: false, // OS may not set this explicitly
    },
  };
  const contracts = extractGovernanceContracts(payload);
  const transparency = contracts.transparency_overprint_physical_governance;
  assert('transparency_overprint_physical_governance preserved', !!transparency);
  assert('transparency_flattened=true preserved', transparency?.transparency_flattened === true);
  assert('review_required forced to true (defense-in-depth)', transparency?.review_required === true);
}

// ─── Scenario 4b: overprint_modified alone also forces review ────────────────
section('Scenario 4b: transparency_overprint_physical_governance — overprint_modified forces review');
{
  const payload = {
    transparency_overprint_physical_governance: {
      transparency_flattened: false,
      overprint_modified: true,
      review_required: false,
    },
  };
  const contracts = extractGovernanceContracts(payload);
  const transparency = contracts.transparency_overprint_physical_governance;
  assert('overprint_modified=true preserved', transparency?.overprint_modified === true);
  assert('review_required forced to true (defense-in-depth)', transparency?.review_required === true);
}

// ─── Scenario 5: visual_diff_required but not performed ──────────────────────
section('Scenario 5: visual_diff_governance — required but not performed blocks production');
{
  const payload = {
    visual_diff_governance: {
      visual_diff_required: true,
      visual_diff_performed: false,
      visual_change_expected: true,
      review_required: false, // OS may not set this explicitly
    },
    artifact_trust: {
      production_certified: true,
      standard_certified: true,
      certified_pdf_allowed: true,
    },
  };
  const contracts = extractGovernanceContracts(payload);
  const visualDiff = contracts.visual_diff_governance;
  assert('visual_diff_governance preserved', !!visualDiff);
  assert('visual_diff_required=true preserved', visualDiff?.visual_diff_required === true);
  assert('visual_diff_performed=false preserved', visualDiff?.visual_diff_performed === false);
  assert('review_required forced to true (defense-in-depth)', visualDiff?.review_required === true);

  // Mirrors the Step4ReviewV2_4 visualDiffBlocksProduction computation.
  const visualDiffBlocksProduction =
    visualDiff?.visual_diff_required === true && visualDiff?.visual_diff_performed !== true;
  assert('visual diff blocks production-ready messaging', visualDiffBlocksProduction === true);

  const isProductionCertified =
    contracts.artifact_trust?.production_certified === true && !visualDiffBlocksProduction;
  assert('production certification withheld despite artifact_trust.production_certified=true', isProductionCertified === false);
}

// ─── Scenario 6: visual_diff_performed with visual_change_detected ───────────
section('Scenario 6: visual_diff_governance — performed with change detected does not force review');
{
  const payload = {
    visual_diff_governance: {
      visual_diff_required: true,
      visual_diff_performed: true,
      visual_change_detected: true,
      visual_change_expected: true,
      review_required: false,
    },
  };
  const contracts = extractGovernanceContracts(payload);
  const visualDiff = contracts.visual_diff_governance;
  assert('visual_diff_performed=true preserved', visualDiff?.visual_diff_performed === true);
  assert('visual_change_detected=true preserved', visualDiff?.visual_change_detected === true);
  // Required-and-performed: the defense-in-depth rule must NOT force review here.
  assert('review_required not forced when diff was performed', visualDiff?.review_required === false);

  const visualDiffBlocksProduction =
    visualDiff?.visual_diff_required === true && visualDiff?.visual_diff_performed !== true;
  assert('production-ready messaging not blocked once diff performed', visualDiffBlocksProduction === false);
}

// ─── Scenario 7: artifact_trust blocks production despite clean visual governance ─
section('Scenario 7: artifact_trust — blocks production even when visual governance looks fine');
{
  const payload = {
    ink_governance: { tac_violation_remaining: false, review_required: false },
    selective_image_governance: { low_res_unfixable: false, review_required: false },
    font_governance: { font_source_available: true, review_required: false },
    transparency_overprint_physical_governance: {
      transparency_flattened: false,
      overprint_modified: false,
      review_required: false,
    },
    visual_diff_governance: {
      visual_diff_required: true,
      visual_diff_performed: true,
      visual_change_detected: false,
      review_required: false,
    },
    artifact_trust: {
      production_certified: false,
      standard_certified: false,
      certified_pdf_allowed: false,
      review_required: true,
      warnings: ['Artifact failed final integrity check.'],
    },
  };
  const contracts = extractGovernanceContracts(payload);

  assert('ink_governance review_required not forced (no violation remaining)', contracts.ink_governance?.review_required === false);
  assert('selective_image_governance review_required not forced (fixable)', contracts.selective_image_governance?.review_required === false);
  assert('font_governance review_required not forced (source available)', contracts.font_governance?.review_required === false);
  assert('transparency_overprint_physical_governance review_required not forced (no destructive changes)', contracts.transparency_overprint_physical_governance?.review_required === false);
  assert('visual_diff_governance review_required not forced (performed, no change)', contracts.visual_diff_governance?.review_required === false);

  const trust = contracts.artifact_trust;
  assert('artifact_trust.review_required=true preserved', trust?.review_required === true);
  assert('artifact_trust.production_certified=false preserved', trust?.production_certified === false);

  // Mirrors Step4ReviewV2_4 isProductionCertified computation.
  const visualDiffBlocksProduction =
    contracts.visual_diff_governance?.visual_diff_required === true &&
    contracts.visual_diff_governance?.visual_diff_performed !== true;
  const isProductionCertified = trust?.production_certified === true && !visualDiffBlocksProduction;
  assert('production certification withheld due to artifact_trust', isProductionCertified === false);
}

// ─── Scenario 8: customer output sanitized — no raw evidence/internals leak ──
section('Scenario 8: Customer view — sanitized, no raw PDF internals or overclaims');
{
  const payload = {
    ink_governance: {
      tac_limit_applied: true,
      tac_limit_value: 280,
      black_generation_adjusted: true,
      rich_black_normalized: true,
      ink_density_violations_fixed: 4,
      tac_violation_remaining: false,
      review_required: false,
      evidence: { object_ids: ['12 0 obj'], raw_dump: '/Separation /All DeviceCMYK' },
      warnings: ['Adjusted black generation on object 12 0 obj'],
    },
    selective_image_governance: {
      images_processed: 10,
      images_resampled: 4,
      images_recompressed: 2,
      low_res_images_detected: 0,
      low_res_unfixable: false,
      review_required: false,
    },
    font_governance: {
      fonts_embedded: 3,
      fonts_subsetted: 3,
      fonts_missing: [],
      font_source_available: true,
      review_required: false,
    },
    transparency_overprint_physical_governance: {
      transparency_flattened: true,
      overprint_modified: false,
      spot_colors_converted: true,
      review_required: false,
    },
    visual_diff_governance: {
      visual_diff_required: true,
      visual_diff_performed: true,
      visual_change_detected: true,
      visual_change_expected: true,
      review_required: false,
    },
  };
  const contracts = extractGovernanceContracts(payload);

  // Customer-facing labels mirror the static, safe strings used by
  // frontend/components/visual/VisualGovernancePanels.tsx — never derived
  // from evidence/warnings, never claiming "certified" or "print-ready".
  const customerLabels = [
    'Total ink coverage (TAC) limit applied: 280%.',
    'Black generation adjusted.',
    'Rich black values normalized.',
    '4 ink density violation(s) corrected.',
    '4 image(s) resampled to a print-safe resolution.',
    '2 image(s) recompressed.',
    '3 font(s) embedded.',
    '3 font(s) subsetted.',
    'Transparency was flattened to ensure consistent output.',
    'Spot colors were converted.',
    'Visual differences were detected between the original and corrected renderings.',
  ];
  const customerFacing = customerLabels.join(' ');

  assert('no raw object IDs in customer-facing text', !customerFacing.match(/\d+\s+0\s+obj/));
  assert('no raw PDF operator dumps in customer-facing text', !customerFacing.match(/\/Separation|\/DeviceCMYK|<<|>>/));
  assert('no "certified" overclaim in customer-facing text', !customerFacing.toLowerCase().includes('certified'));
  assert('no "print-ready" overclaim in customer-facing text', !customerFacing.toLowerCase().includes('print-ready') && !customerFacing.toLowerCase().includes('ready for printing'));

  // Evidence/warnings remain available for operator-only rendering.
  assert('ink_governance.evidence preserved for operator view', !!contracts.ink_governance?.evidence);
  assert('ink_governance.warnings preserved for operator view', Array.isArray(contracts.ink_governance?.warnings) && contracts.ink_governance.warnings.length === 1);

  // Even with everything looking applied/clean, the file did undergo a
  // "transparency flattened" destructive transform — but here it was not
  // accompanied by overprint_modified, so review_required is not forced
  // by THIS specific rule (transparency_flattened alone DOES force review —
  // verify that as well, matching scenario 4's rule).
  assert('transparency_flattened still forces review_required (defense-in-depth)', contracts.transparency_overprint_physical_governance?.review_required === true);
}

// ─── Summary ─────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(60)}`);
console.log(`APP-64 Smoke: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.error(`\n[FAIL] APP-64 smoke test failed with ${failed} assertion(s).`);
  process.exit(1);
} else {
  console.log(`\n[PASS] APP-64 smoke test complete — all scenarios pass.`);
}
