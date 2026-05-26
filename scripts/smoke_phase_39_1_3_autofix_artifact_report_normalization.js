'use strict';

/**
 * Phase 39.1.3 — Autofix Artifact Report Normalization Path
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

// Test: Load the fixture and normalize it
function testNormalization() {
  console.log('\n🔍 Running Autofix Artifact Report Normalization Smoke Test...');

  const fixturePath = process.env.AUTOFIX_REPORT_FIXTURE || path.join(__dirname, '../fixtures/autofix/Dialnet-LaElite-report.raw.json');
  console.log(`Loading fixture from: ${fixturePath}`);

  let rawReport;
  try {
    rawReport = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
  } catch (e) {
    fail('Load fixture', e.message);
    return;
  }

  // Pre-normalization assertions
  if (rawReport.summary.after === null) {
    pass('Raw fixture has summary.after === null');
  } else {
    fail('Raw fixture has summary.after === null', `got: ${JSON.stringify(rawReport.summary.after)}`);
  }

  // Perform normalization
  const normalized = preflightNormalizer.normalizeAutofixFinalState(rawReport);

  // Assertions on the normalized output
  if (normalized.summary && normalized.summary.after !== null) {
    pass('summary.after is not null');
  } else {
    fail('summary.after is not null', 'was null');
  }

  if (normalized.summaryObject && normalized.summaryObject.after !== null) {
    pass('summaryObject.after is not null');
  } else {
    fail('summaryObject.after is not null', 'was null');
  }

  if (normalized.summary.after.issue_count === 0) {
    pass('summary.after.issue_count === 0');
  } else {
    fail('summary.after.issue_count === 0', `got: ${normalized.summary.after.issue_count}`);
  }

  if (normalized.summary.after.unresolved_count === 0) {
    pass('summary.after.unresolved_count === 0');
  } else {
    fail('summary.after.unresolved_count === 0', `got: ${normalized.summary.after.unresolved_count}`);
  }

  if (normalized.summary.after.failed_fix_count === 0) {
    pass('summary.after.failed_fix_count === 0');
  } else {
    fail('summary.after.failed_fix_count === 0', `got: ${normalized.summary.after.failed_fix_count}`);
  }

  if (normalized.summary.after.skipped_fix_count === 0) {
    pass('summary.after.skipped_fix_count === 0');
  } else {
    fail('summary.after.skipped_fix_count === 0', `got: ${normalized.summary.after.skipped_fix_count}`);
  }

  if (normalized.summary.after.applied_fix_count === 4) {
    pass('summary.after.applied_fix_count === 4');
  } else {
    fail('summary.after.applied_fix_count === 4', `got: ${normalized.summary.after.applied_fix_count}`);
  }

  if (normalized.summary.after.requires_human_review === true) {
    pass('summary.after.requires_human_review === true');
  } else {
    fail('summary.after.requires_human_review === true', `got: ${normalized.summary.after.requires_human_review}`);
  }

  if (normalized.summary.after.review_reasons.includes('APPLY_BLEED')) {
    pass('summary.after.review_reasons includes APPLY_BLEED');
  } else {
    fail('summary.after.review_reasons includes APPLY_BLEED', `got: ${JSON.stringify(normalized.summary.after.review_reasons)}`);
  }

  if (normalized.summary.after.review_reasons.includes('CONVERT_CMYK')) {
    pass('summary.after.review_reasons includes CONVERT_CMYK');
  } else {
    fail('summary.after.review_reasons includes CONVERT_CMYK', `got: ${JSON.stringify(normalized.summary.after.review_reasons)}`);
  }

  if (normalized.summary.after.destructive_risk === 'HIGH') {
    pass('summary.after.destructive_risk === HIGH');
  } else {
    fail('summary.after.destructive_risk === HIGH', `got: ${normalized.summary.after.destructive_risk}`);
  }

  if (normalized.status === 'COMPLETED_WITH_REVIEW') {
    pass('status === COMPLETED_WITH_REVIEW');
  } else {
    fail('status === COMPLETED_WITH_REVIEW', `got: ${normalized.status}`);
  }

  if (normalized.final_status === 'COMPLETED_WITH_REVIEW') {
    pass('final_status === COMPLETED_WITH_REVIEW');
  } else {
    fail('final_status === COMPLETED_WITH_REVIEW', `got: ${normalized.final_status}`);
  }

  if (normalized.technicallyFixed === true) {
    pass('technicallyFixed === true');
  } else {
    fail('technicallyFixed === true', `got: ${normalized.technicallyFixed}`);
  }

  if (normalized.productionCertified === false) {
    pass('productionCertified === false');
  } else {
    fail('productionCertified === false', `got: ${normalized.productionCertified}`);
  }

  if (normalized.requiresHumanReview === true) {
    pass('requiresHumanReview === true');
  } else {
    fail('requiresHumanReview === true', `got: ${normalized.requiresHumanReview}`);
  }

  if (normalized.reviewReasons.includes('APPLY_BLEED') && normalized.reviewReasons.includes('CONVERT_CMYK')) {
    pass('reviewReasons includes APPLY_BLEED and CONVERT_CMYK');
  } else {
    fail('reviewReasons includes APPLY_BLEED and CONVERT_CMYK', `got: ${JSON.stringify(normalized.reviewReasons)}`);
  }

  if (normalized.destructiveRiskSummary === 'HIGH') {
    pass('destructiveRiskSummary === HIGH');
  } else {
    fail('destructiveRiskSummary === HIGH', `got: ${normalized.destructiveRiskSummary}`);
  }

  // Preserve forensics
  if (normalized.findings_before && normalized.findings_before.length === 7) {
    pass('findings_before is preserved');
  } else {
    fail('findings_before is preserved', `got: ${JSON.stringify(normalized.findings_before)}`);
  }

  if (normalized.findings_after && normalized.findings_after.length === 0) {
    pass('findings_after is preserved');
  } else {
    fail('findings_after is preserved', `got: ${JSON.stringify(normalized.findings_after)}`);
  }

  if (normalized.applied_fixes && normalized.applied_fixes.length === 4) {
    pass('applied_fixes is preserved');
  } else {
    fail('applied_fixes is preserved', `got: ${JSON.stringify(normalized.applied_fixes)}`);
  }

  if (normalized.fixes && normalized.fixes.length === 4) {
    pass('fixes is preserved');
  } else {
    fail('fixes is preserved', `got: ${JSON.stringify(normalized.fixes)}`);
  }

  if (normalized.repairs && normalized.repairs.length === 4) {
    pass('repairs is preserved');
  } else {
    fail('repairs is preserved', `got: ${JSON.stringify(normalized.repairs)}`);
  }

  if (normalized.artifactList && normalized.artifactList.length === 2) {
    pass('artifactList is preserved');
  } else {
    fail('artifactList is preserved', `got: ${JSON.stringify(normalized.artifactList)}`);
  }
}

function main() {
  testNormalization();

  console.log('\n================================================================================');
  console.log('PHASE 39.1.3 — AUTOFIX ARTIFACT REPORT NORMALIZATION PATH');
  if (failed === 0) {
    console.log('STATUS: READY');
    console.log('RESULT: DOWNLOADED_AUTOFIX_REPORTS_NORMALIZED');
    console.log('BLOCKERS: NONE');
  } else {
    console.log('STATUS: BLOCKED');
    console.log('RESULT: NORMALIZATION_FAILED');
    console.log(`BLOCKERS: ${failed} Assertions failed`);
  }
  console.log('================================================================================\n');

  process.exit(failed > 0 ? 1 : 0);
}

main();
