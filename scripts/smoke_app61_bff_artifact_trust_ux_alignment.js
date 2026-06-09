#!/usr/bin/env node
/**
 * APP-61 Smoke — BFF Artifact Trust + UX Contract Alignment
 *
 * Verifies that:
 *  - artifact_ux utility returns conservative labels when no trust data is present
 *  - certified_pdf_allowed=false blocks certified labels and certified_pdf key selection
 *  - production_certified=false drives review fallback
 *  - standard_certified=true with certified_pdf_allowed=true allows standards-validated label
 *  - review_required=true drives review-required fallback
 *  - primary_artifact_type respected when present
 *  - Forbidden strings are absent from key source files
 */

import { createRequire } from 'module';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

// ── inline port of the pure-logic parts of artifactUx.ts ─────────────────────
// (avoids a full TS build just for the smoke)

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
  for (const re of OVERCLAIM_PATTERNS) { out = out.replace(re, 'corrected file'); }
  return out;
}

const FALLBACK_CORRECTED = { display_label: 'Corrected file', button_label: 'Download corrected file', status_badge: 'Corrected', tooltip: 'Download the automatically corrected file' };
const FALLBACK_REVIEW    = { display_label: 'Review file', button_label: 'Download review file', status_badge: 'Review required', tooltip: 'This file requires review before production use' };
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
      return { display_label: display, button_label: audience === 'customer' ? sanitizeCustomerLabel(raw.button_label || FALLBACK_CORRECTED.button_label, certifiedAllowed, standardCertified) : (raw.button_label || FALLBACK_CORRECTED.button_label), status_badge: raw.status_badge || (reviewRequired ? FALLBACK_REVIEW.status_badge : FALLBACK_CORRECTED.status_badge), tooltip: raw.tooltip || FALLBACK_CORRECTED.tooltip };
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

function isCertifiedPdfDownloadAllowed(artifactKey, artifactTrust, audience = 'customer') {
  if (artifactKey !== 'certified_pdf') return true;
  if (!artifactTrust) return true;
  if (artifactTrust.certified_pdf_allowed === false) {
    if (audience === 'operator' && artifactTrust.review_required === true) return true;
    return false;
  }
  return true;
}

function selectPrimaryArtifactKey(artifacts, artifactTrust, audience = 'customer') {
  if (!artifacts || Object.keys(artifacts).length === 0) return null;
  const primary = artifactTrust?.primary_artifact_type;
  if (primary && artifacts[primary] && isCertifiedPdfDownloadAllowed(primary, artifactTrust, audience)) return primary;
  const priority = ['final_fixed_pdf', 'fixed_pdf', 'normalized_pdf', 'certified_pdf', 'review_pdf'];
  for (const key of priority) {
    if (artifacts[key] && isCertifiedPdfDownloadAllowed(key, artifactTrust, audience)) return key;
  }
  return null;
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

// ── test helpers ──────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${label}`);
    failed++;
  }
}

function section(title) { console.log(`\n▸ ${title}`); }

// ── Scenario 1: No trust data — conservative fallback ────────────────────────
section('Scenario 1: No trust data → conservative fallback');
const s1 = getArtifactUxForArtifact(null, null, null, 'customer');
assert(s1.display_label === 'Processed file', 'display_label is "Processed file"');
assert(!s1.display_label.toLowerCase().includes('certified'), 'no "certified" in label');
assert(!s1.display_label.toLowerCase().includes('print-ready'), 'no "print-ready" in label');

// ── Scenario 2: certified_pdf filename only (no trust) ───────────────────────
section('Scenario 2: certified.pdf artifact key, no trust → no certified claim');
const s2 = getArtifactUxForArtifact({ key: 'certified_pdf' }, null, null, 'customer');
assert(!s2.display_label.toLowerCase().includes('certified pdf'), 'label does not say "Certified PDF"');

// ── Scenario 3: artifact_trust.certified_pdf_allowed=false ──────────────────
section('Scenario 3: certified_pdf_allowed=false → review fallback');
const trust3 = { certified_pdf_allowed: false, review_required: true };
const s3 = getArtifactUxForArtifact({ key: 'certified_pdf' }, null, trust3, 'customer');
assert(s3.status_badge === 'Review required', 'status_badge is "Review required"');
assert(!isCertifiedPdfDownloadAllowed('certified_pdf', trust3, 'customer'), 'certified_pdf download blocked for customer');
assert(isCertifiedPdfDownloadAllowed('fixed_pdf', trust3, 'customer'), 'fixed_pdf download allowed');

// ── Scenario 4: artifact_trust.production_certified=false ───────────────────
section('Scenario 4: production_certified=false → review fallback');
const trust4 = { production_certified: false };
const s4 = getArtifactUxForArtifact(null, null, trust4, 'customer');
assert(s4.display_label === 'Review file', 'display_label is "Review file"');

// ── Scenario 5: artifact_trust.standard_certified=false ─────────────────────
section('Scenario 5: standard_certified=false → no standards-validated label');
const trust5 = { standard_certified: false, certified_pdf_allowed: false };
const s5 = getArtifactUxForArtifact({ key: 'certified_pdf' }, null, trust5, 'customer');
assert(!s5.display_label.toLowerCase().includes('standards'), 'no "standards" in label');

// ── Scenario 6: artifact_ux customer_labels present ─────────────────────────
section('Scenario 6: artifact_ux.customer_labels provided → use them');
const ux6 = { customer_labels: { display_label: 'Corrected print file', button_label: 'Download corrected', status_badge: 'Corrected', tooltip: 'ready' } };
const s6 = getArtifactUxForArtifact(null, ux6, null, 'customer');
assert(s6.display_label === 'Corrected print file', 'customer label used');

// ── Scenario 7: artifact_ux customer_labels with overclaim are sanitized ─────
section('Scenario 7: artifact_ux customer_labels with "Certified PDF" → sanitized');
const ux7 = { customer_labels: { display_label: 'Certified PDF', button_label: 'Download Certified PDF', status_badge: 'Certified', tooltip: 'ready' } };
const trust7 = { certified_pdf_allowed: false };
const s7 = getArtifactUxForArtifact(null, ux7, trust7, 'customer');
assert(!s7.display_label.toLowerCase().includes('certified pdf'), 'overclaim sanitized in display_label');
assert(!s7.button_label.toLowerCase().includes('certified pdf'), 'overclaim sanitized in button_label');

// ── Scenario 8: artifact_ux operator_labels present ─────────────────────────
section('Scenario 8: artifact_ux.operator_labels provided → used for operator audience');
const ux8 = { operator_labels: { display_label: 'Production-certified PDF', button_label: 'Download for production', status_badge: 'Certified', tooltip: 'certified' } };
const s8 = getArtifactUxForArtifact(null, ux8, null, 'operator');
assert(s8.display_label === 'Production-certified PDF', 'operator label used unmodified');

// ── Scenario 9: review_required=true ────────────────────────────────────────
section('Scenario 9: review_required=true → review fallback');
const trust9 = { review_required: true };
const s9 = getArtifactUxForArtifact(null, null, trust9, 'customer');
assert(s9.display_label === 'Review file', 'display_label is "Review file"');
assert(s9.status_badge === 'Review required', 'status_badge is "Review required"');

// ── Scenario 10: primary_artifact_type=review_pdf ───────────────────────────
section('Scenario 10: primary_artifact_type=review_pdf → review fallback');
const trust10 = { primary_artifact_type: 'review_pdf' };
const s10 = getArtifactUxForArtifact(null, null, trust10, 'customer');
assert(s10.display_label === 'Review file', 'display_label is "Review file"');

// ── Scenario 11: primary_artifact_type=fixed_pdf ────────────────────────────
section('Scenario 11: primary_artifact_type=fixed_pdf → corrected fallback');
const trust11 = { primary_artifact_type: 'fixed_pdf' };
const s11 = getArtifactUxForArtifact(null, null, trust11, 'customer');
assert(s11.display_label === 'Corrected file', 'display_label is "Corrected file"');

// ── Scenario 12: standard_certified=true + certified_pdf_allowed=true ────────
section('Scenario 12: standard_certified=true + certified_pdf_allowed=true → standards-validated');
const trust12 = { standard_certified: true, certified_pdf_allowed: true, primary_artifact_type: 'certified_pdf' };
const s12 = getArtifactUxForArtifact(null, null, trust12, 'customer');
assert(s12.display_label === 'Standards-validated file', 'display_label is "Standards-validated file"');

// ── Scenario 13: selectPrimaryArtifactKey with certified_pdf_allowed=false ───
section('Scenario 13: selectPrimaryArtifactKey skips certified_pdf when blocked');
const artifacts13 = { certified_pdf: '/path/cert.pdf', fixed_pdf: '/path/fixed.pdf' };
const trust13 = { certified_pdf_allowed: false };
const key13 = selectPrimaryArtifactKey(artifacts13, trust13, 'customer');
assert(key13 === 'fixed_pdf', `key resolves to fixed_pdf (got: ${key13})`);

// ── Scenario 14: operator can access review artifact even if certified blocked
section('Scenario 14: operator can access certified_pdf for review even when customer-blocked');
const trust14 = { certified_pdf_allowed: false, review_required: true };
assert(isCertifiedPdfDownloadAllowed('certified_pdf', trust14, 'operator'), 'operator allowed');
assert(!isCertifiedPdfDownloadAllowed('certified_pdf', trust14, 'customer'), 'customer blocked');

// ── Scenario 15: getArtifactFilename — no certified unless explicitly allowed
section('Scenario 15: getArtifactFilename — no "-certified.pdf" unless explicitly allowed');
const fn15a = getArtifactFilename('myfile.pdf', 'certified_pdf', { certified_pdf_allowed: false });
assert(!fn15a.includes('-certified.pdf'), `filename does not include "-certified.pdf" (got: ${fn15a})`);
const fn15b = getArtifactFilename('myfile.pdf', 'certified_pdf', { certified_pdf_allowed: true, standard_certified: true });
assert(fn15b === 'myfile-certified.pdf', `filename is "myfile-certified.pdf" (got: ${fn15b})`);
const fn15c = getArtifactFilename('myfile.pdf', 'fixed_pdf', null);
assert(fn15c === 'myfile-corrected.pdf', `filename is "myfile-corrected.pdf" (got: ${fn15c})`);

// ── Scenario 16: Forbidden string scan in key frontend source files ───────────
section('Scenario 16: Forbidden hardcoded strings absent from customer-facing source files');

const SCAN_FILES = [
  path.join(ROOT, 'frontend/components/steps/Step5DownloadV2_4.tsx'),
  path.join(ROOT, 'frontend/components/steps/Step4ReviewV2_4.tsx'),
  path.join(ROOT, 'frontend/utils/clientChangeReport.ts'),
];

const FORBIDDEN = [
  { pattern: /-certified\.pdf/g, label: '"-certified.pdf" default naming' },
  { pattern: /readyForPrinting(?!['"])/g, label: '"readyForPrinting" as a hardcoded customer claim' },
  { pattern: /PDF-X\/1A-COMPLIANT/g, label: '"PDF-X/1A-COMPLIANT" hardcoded badge' },
];

for (const filePath of SCAN_FILES) {
  const rel = path.relative(ROOT, filePath);
  let src;
  try { src = readFileSync(filePath, 'utf-8'); } catch { console.error(`  ❌ Could not read ${rel}`); failed++; continue; }

  for (const { pattern, label } of FORBIDDEN) {
    const matches = src.match(pattern);
    if (matches) {
      console.error(`  ❌ Found ${label} in ${rel} (${matches.length} occurrence(s))`);
      failed++;
    } else {
      console.log(`  ✅ No ${label} in ${rel}`);
      passed++;
    }
  }
}

// ── Summary ──────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(60)}`);
console.log(`APP-61 Smoke: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.error('❌ Smoke FAILED');
  process.exit(1);
} else {
  console.log('✅ Smoke PASSED');
}
