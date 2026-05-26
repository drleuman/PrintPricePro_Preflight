'use strict';

/**
 * Phase 39.1.2 — Autofix Report Finalization / After-State Normalization
 * Smoke Test Script
 */

const fs = require('fs');
const path = require('path');
const preflightNormalizer = require('../app/services/preflightNormalizer');

let passed = 0;
let failed = 0;
const errors = [];

function pass(label) {
  passed++;
  console.log(`  ✅ PASS: ${label}`);
}

function fail(label, reason) {
  failed++;
  const msg = `  ❌ FAIL: ${label} — ${reason}`;
  console.error(msg);
  errors.push(msg);
}

// ─── Test 1: Mock Fixture Normalization ──────────────────────────────────
function testMockFixture() {
  console.log('\n🔍 [1] Mock Fixture Autofix Report Normalization');

  // Modeled after the observed report
  const rawReport = {
    type: 'AUTOFIX',
    sourceJobId: 'job_1779804091116_eouei',
    score: 100,
    summary: {
      before: {
        risk_level: 'CRITICAL',
        issue_count: 6,
        derived: false
      },
      after: null
    },
    applied_fixes: [
      { code: 'REBUILD_TRIMBOX', status: 'APPLIED' },
      { code: 'APPLY_BLEED', status: 'APPLIED', requires_human_review: true },
      { code: 'CONVERT_CMYK', status: 'APPLIED', destructiveFixRisk: 'HIGH', requires_human_review: true },
      { code: 'INJECT_OUTPUT_INTENT', status: 'APPLIED' }
    ],
    failed_fixes: [],
    skipped_fixes: [],
    unresolved_findings: [],
    findings_before: [
      { code: 'TRIMBOX_MISSING', severity: 'error' },
      { code: 'BLEED_MISSING', severity: 'error' },
      { code: 'COLOR_RGB', severity: 'warning' },
      { code: 'FONT_NOT_EMBEDDED', severity: 'warning' },
      { code: 'IMAGE_LOW_RESOLUTION', severity: 'warning' },
      { code: 'SPOT_COLOR', severity: 'info' }
    ],
    findings_after: [],
    _isDegraded: false
  };

  const normalized = preflightNormalizer.normalizeAutofixFinalState(rawReport);

  // Assertions
  if (normalized.summary && normalized.summary.after !== null) {
    pass('summary.after is not null');
  } else {
    fail('summary.after is not null', 'was null');
  }

  if (normalized.summary?.after?.issue_count === 0) {
    pass('summary.after.issue_count = 0');
  } else {
    fail('summary.after.issue_count = 0', `got: ${normalized.summary?.after?.issue_count}`);
  }

  if (normalized.summary?.after?.unresolved_count === 0) {
    pass('summary.after.unresolved_count = 0');
  } else {
    fail('summary.after.unresolved_count = 0', `got: ${normalized.summary?.after?.unresolved_count}`);
  }

  if (normalized.summary?.after?.applied_fix_count === 4) {
    pass('summary.after.applied_fix_count = 4');
  } else {
    fail('summary.after.applied_fix_count = 4', `got: ${normalized.summary?.after?.applied_fix_count}`);
  }

  if (normalized.summary?.after?.requires_human_review === true) {
    pass('summary.after.requires_human_review = true');
  } else {
    fail('summary.after.requires_human_review = true', `got: ${normalized.summary?.after?.requires_human_review}`);
  }

  if (normalized.summary?.after?.review_reasons?.includes('APPLY_BLEED')) {
    pass('summary.after.review_reasons includes APPLY_BLEED');
  } else {
    fail('summary.after.review_reasons includes APPLY_BLEED', 'missing');
  }

  if (normalized.summary?.after?.review_reasons?.includes('CONVERT_CMYK')) {
    pass('summary.after.review_reasons includes CONVERT_CMYK');
  } else {
    fail('summary.after.review_reasons includes CONVERT_CMYK', 'missing');
  }

  if (normalized.summary?.after?.destructive_risk === 'HIGH') {
    pass('summary.after.destructive_risk = HIGH');
  } else {
    fail('summary.after.destructive_risk = HIGH', `got: ${normalized.summary?.after?.destructive_risk}`);
  }

  if (normalized.status === 'COMPLETED_WITH_REVIEW' && normalized.final_status === 'COMPLETED_WITH_REVIEW') {
    pass('status and final_status = COMPLETED_WITH_REVIEW');
  } else {
    fail('status/final_status = COMPLETED_WITH_REVIEW', `got: ${normalized.status}`);
  }

  if (normalized.technicallyFixed === true) {
    pass('technicallyFixed = true');
  } else {
    fail('technicallyFixed = true', `got: ${normalized.technicallyFixed}`);
  }

  if (normalized.productionCertified === false) {
    pass('productionCertified = false');
  } else {
    fail('productionCertified = false', `got: ${normalized.productionCertified}`);
  }

  if (normalized.requiresHumanReview === true) {
    pass('requiresHumanReview = true');
  } else {
    fail('requiresHumanReview = true', `got: ${normalized.requiresHumanReview}`);
  }

  if (normalized.reviewReasons?.includes('APPLY_BLEED') && normalized.reviewReasons?.includes('CONVERT_CMYK')) {
    pass('reviewReasons includes APPLY_BLEED and CONVERT_CMYK');
  } else {
    fail('reviewReasons includes APPLY_BLEED and CONVERT_CMYK', JSON.stringify(normalized.reviewReasons));
  }

  // Forensic preservation
  if (normalized.summary?.before && normalized.summary.before.issue_count === 6) {
    pass('Existing summary.before is preserved');
  } else {
    fail('Existing summary.before is preserved', JSON.stringify(normalized.summary?.before));
  }

  if (Array.isArray(normalized.findings_before) && normalized.findings_before.length === 6) {
    pass('findings_before is preserved');
  } else {
    fail('findings_before is preserved', `length: ${normalized.findings_before?.length}`);
  }

  if (Array.isArray(normalized.applied_fixes) && normalized.applied_fixes.length === 4) {
    pass('applied_fixes is preserved');
  } else {
    fail('applied_fixes is preserved', `length: ${normalized.applied_fixes?.length}`);
  }
}

// ─── Test 2: Live/Local JSON Fixture (Optional) ──────────────────────────
function testFixtureFile() {
  const fixturePath = process.env.AUTOFIX_REPORT_FIXTURE;
  if (!fixturePath) {
    console.log('\nℹ️  [2] Optional Live Fixture Test skipped (AUTOFIX_REPORT_FIXTURE env var not set)');
    return;
  }

  console.log(`\n🔍 [2] Live Fixture Test (${fixturePath})`);

  let rawReport;
  try {
    const fullPath = path.resolve(fixturePath);
    if (!fs.existsSync(fullPath)) {
      console.log(`⚠️  Fixture file not found: ${fullPath}`);
      return;
    }
    rawReport = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
  } catch (e) {
    fail('load fixture file', e.message);
    return;
  }

  const normalized = preflightNormalizer.normalizeAutofixFinalState(rawReport);
  pass(`Successfully loaded and normalized live fixture: ${fixturePath}`);
  console.log('  Normalized Status:', normalized.status);
  console.log('  Technically Fixed:', normalized.technicallyFixed);
  console.log('  Production Certified:', normalized.productionCertified);
  console.log('  Requires Review:', normalized.requiresHumanReview);
  console.log('  Review Reasons:', normalized.reviewReasons);
}

function main() {
  console.log('\n================================================================================');
  console.log(' PHASE 39.1.2 — AUTOFIX REPORT FINALIZATION SMOKE TEST');
  console.log('================================================================================');

  testMockFixture();
  testFixtureFile();

  const status = failed === 0 ? 'READY' : 'BLOCKED';
  const result = failed === 0 ? 'AUTOFIX_AFTER_STATE_NORMALIZED' : 'ALIGNMENT_INCOMPLETE';
  const blockers = failed === 0 ? 'NONE' : `${failed} FAILURE(S)`;

  console.log('\n================================================================================');
  console.log('PHASE 39.1.2 — AUTOFIX REPORT FINALIZATION');
  console.log(`STATUS: ${status}`);
  console.log(`RESULT: ${result}`);
  console.log(`BLOCKERS: ${blockers}`);
  console.log('================================================================================\n');

  process.exit(failed > 0 ? 1 : 0);
}

main();
