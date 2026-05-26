'use strict';

/**
 * Phase 39.1.5 — Autofix Frontend Result-State Download Normalization
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

// 1. Static Verification
function verifyStaticCode() {
  console.log('\n🔍 [1] Static Code Verification');

  // Verify frontend utilities have browser-safe ts implementation
  const payloadNormContent = fs.readFileSync(path.join(__dirname, '../frontend/utils/payloadNormalization.ts'), 'utf8');
  if (payloadNormContent.includes('export function normalizeAutofixResultState') && payloadNormContent.includes('export function normalizeAutofixFinalState')) {
    pass('frontend/utils/payloadNormalization.ts includes browser-safe normalizer exports');
  } else {
    fail('frontend/utils/payloadNormalization.ts exports', 'missing normalizeAutofixResultState or normalizeAutofixFinalState');
  }

  // Verify frontend App.tsx handles result state download normalization before stringifying
  const appContent = fs.readFileSync(path.join(__dirname, '../frontend/App.tsx'), 'utf8');
  if (appContent.includes('normalizeAutofixResultState(JSON.parse(JSON.stringify(result)))')) {
    pass('App.tsx normalizes result state before client-side JSON download serialization');
  } else {
    fail('App.tsx JSON download path', 'does not normalize result state before JSON.stringify');
  }

  // Verify backend apiV2.js includes result-state normalization and X-PPOS-Autofix-Result-Normalized headers
  const apiV2Content = fs.readFileSync(path.join(__dirname, '../app/routes/apiV2.js'), 'utf8');
  if (apiV2Content.includes('normalizeAutofixResultState') && apiV2Content.includes('X-PPOS-Autofix-Result-Normalized')) {
    pass('apiV2.js applies normalizeAutofixResultState and sets Result-Normalized headers');
  } else {
    fail('apiV2.js coverage', 'missing result-state normalization or Result-Normalized headers');
  }

  // Verify backend preflightProxy.js includes result-state normalization and X-PPOS-Autofix-Result-Normalized headers
  const proxyContent = fs.readFileSync(path.join(__dirname, '../app/routes/preflightProxy.js'), 'utf8');
  if (proxyContent.includes('normalizeAutofixResultState') && proxyContent.includes('X-PPOS-Autofix-Result-Normalized')) {
    pass('preflightProxy.js applies normalizeAutofixResultState and sets Result-Normalized headers');
  } else {
    fail('preflightProxy.js coverage', 'missing result-state normalization or Result-Normalized headers');
  }
}

// 2. Fixture-based Verification for Direct & Nested Payloads
function verifyFixtures() {
  console.log('\n🔍 [2] Fixture Verification across Direct and Nested Shapes');

  const fixturePath = path.join(__dirname, '../fixtures/autofix/Dialnet-LaElite-report.raw.json');
  let rawReport;
  try {
    rawReport = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
  } catch (e) {
    fail('Load fixture', e.message);
    return;
  }

  // Prepare nested shapes
  const testShapes = {
    'direct AUTOFIX report': JSON.parse(JSON.stringify(rawReport)),
    'payload.result': { result: JSON.parse(JSON.stringify(rawReport)) },
    'payload.data.result': { data: { result: JSON.parse(JSON.stringify(rawReport)) } },
    'payload.job.result': { job: { result: JSON.parse(JSON.stringify(rawReport)) } },
    'payload.report': { report: JSON.parse(JSON.stringify(rawReport)) },
    'payload.autofixResult': { autofixResult: JSON.parse(JSON.stringify(rawReport)) }
  };

  for (const [shapeName, rawPayload] of Object.entries(testShapes)) {
    // Assert precondition
    const rawSerialized = JSON.stringify(rawPayload);
    if (!rawSerialized.includes('"after":null')) {
      fail(`${shapeName} precondition`, 'Did not contain "after":null');
      continue;
    }

    // Call normalizer
    const normalized = preflightNormalizer.normalizeAutofixResultState(rawPayload);
    const serialized = JSON.stringify(normalized);

    // Assert "after":null is NOT present
    if (serialized.includes('"after":null')) {
      fail(shapeName, 'Serialized JSON still contains "after":null');
    } else {
      pass(`${shapeName} does not contain "after":null after normalization`);
    }

    // Assert status/final_status is COMPLETED_WITH_REVIEW
    if (!serialized.includes('COMPLETED_WITH_REVIEW')) {
      fail(shapeName, 'Serialized JSON does not contain COMPLETED_WITH_REVIEW');
    } else {
      pass(`${shapeName} contains COMPLETED_WITH_REVIEW`);
    }

    // Inspect the normalized report inside the payload structure
    let targetReport = normalized;
    if (normalized.result) targetReport = normalized.result;
    else if (normalized.data?.result) targetReport = normalized.data.result;
    else if (normalized.job?.result) targetReport = normalized.job.result;
    else if (normalized.report) targetReport = normalized.report;
    else if (normalized.autofixResult) targetReport = normalized.autofixResult;

    // Check specific required fields
    if (targetReport.summary?.after !== null && targetReport.summaryObject?.after !== null) {
      pass(`${shapeName} summary after fields are populated`);
    } else {
      fail(shapeName, 'summary.after or summaryObject.after is null');
    }

    if (targetReport.technicallyFixed === true &&
        targetReport.productionCertified === false &&
        targetReport.requiresHumanReview === true &&
        targetReport.reviewReasons.includes('APPLY_BLEED') &&
        targetReport.reviewReasons.includes('CONVERT_CMYK') &&
        targetReport.destructiveRiskSummary === 'HIGH') {
      pass(`${shapeName} has correct flags (technicallyFixed, productionCertified, requiresHumanReview, reviewReasons, destructiveRiskSummary)`);
    } else {
      fail(shapeName, 'Missing or incorrect compliance flags');
    }
  }
}

function main() {
  verifyStaticCode();
  verifyFixtures();

  console.log('\n================================================================================');
  console.log('PHASE 39.1.5 — AUTOFIX FRONTEND RESULT-STATE DOWNLOAD NORMALIZATION');
  if (failed === 0) {
    console.log('STATUS: READY');
    console.log('RESULT: FRONTEND_RESULT_DOWNLOADS_NORMALIZED');
    console.log('BLOCKERS: NONE');
  } else {
    console.log('STATUS: BLOCKED');
    console.log('RESULT: NORMALIZATION_CHECKS_FAILED');
    console.log(`BLOCKERS: ${failed} Failure(s)`);
  }
  console.log('================================================================================\n');

  process.exit(failed > 0 ? 1 : 0);
}

main();
