'use strict';
/**
 * APP-62F Smoke Test — BFF Heavy PDF Probe UX Alignment
 *
 * Validates that:
 * - heavy_pdf_probe_governance is preserved verbatim by the BFF normalizer
 *   (ANALYZE and AUTOFIX payloads, root and nested locations).
 * - qpdf/pdfimages WARNING_ONLY tool semantics survive normalization.
 * - fatal_document_failure remains fatal and overrides degraded_but_usable.
 * - review_required=true wins when merging multiple payload locations.
 * - No production/standards/PDF-X/PDF-A overclaim flags are flipped to true.
 * - Legacy payloads without heavy_pdf_probe_governance still normalize cleanly.
 * - No raw temp paths/giant transcripts are introduced by the BFF layer.
 */

const {
  extractGovernanceContracts,
  normalizeAnalyzeJob,
  normalizeAutofixJob,
} = require('../app/services/preflightNormalizer');

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

const SAMPLE_GOVERNANCE = {
  heavy_pdf_detected: true,
  file_size_bytes: 853898611,
  file_size_mb: 814.34,
  page_count: 64,
  probe_semantics_applied: true,
  analysis_degraded: true,
  degraded_but_usable: true,
  fatal_document_failure: false,
  certifiable: false,
  review_required: true,
  production_certified: false,
  standard_certified: false,
  pdfx_compliance_claimed: false,
  pdfa_compliance_claimed: false,
  compliance_claim_allowed: false,
  probe_summary: {
    total: 2,
    success: 0,
    success_with_warnings: 0,
    warning_only: 2,
    partial_success: 0,
    failed_fatal: 0,
    failed_timeout: 0,
    failed_oom: 0,
    failed_tool_missing: 0,
  },
  tools: {
    qpdf: {
      raw_status: 'FAILED',
      semantic_status: 'WARNING_ONLY',
      severity: 'warning',
      usable_output: true,
      fatal: false,
      warning_classes: [
        'PDF_LINEARIZATION_HINT_WARNING',
        'PDF_SHARED_OBJECT_HINT_MISMATCH',
        'PDF_OBJECT_COUNT_HINT_MISMATCH',
      ],
    },
    pdfimages: {
      raw_status: 'FAILED',
      semantic_status: 'WARNING_ONLY',
      severity: 'warning',
      usable_output: true,
      fatal: false,
      warning_classes: ['PDF_FONT_WEIGHT_WARNING'],
    },
  },
  warnings: [],
  review_required_reasons: [],
  evidence: {},
};

// ─── Scenario 1: ANALYZE payload — heavy_pdf_probe_governance preserved at root ──
section('Scenario 1: ANALYZE payload preserves heavy_pdf_probe_governance');
{
  const rawJob = {
    jobId: 'job_heavy_001',
    type: 'ANALYZE',
    document: { name: 'heavy.pdf', size: 853898611, page_count: 64, pdf_version: '1.6' },
    findings: [],
    heavy_pdf_probe_governance: SAMPLE_GOVERNANCE,
  };
  const normalized = normalizeAnalyzeJob(rawJob);
  assert('heavy_pdf_probe_governance present', !!normalized.heavy_pdf_probe_governance);
  assert('heavy_pdf_detected preserved', normalized.heavy_pdf_probe_governance.heavy_pdf_detected === true);
  assert('file_size_bytes preserved', normalized.heavy_pdf_probe_governance.file_size_bytes === 853898611);
  assert('page_count preserved', normalized.heavy_pdf_probe_governance.page_count === 64);
}

// ─── Scenario 2: qpdf WARNING_ONLY semantics survive normalization ───────────────
section('Scenario 2: qpdf WARNING_ONLY tool semantics preserved');
{
  const rawJob = { jobId: 'job_heavy_002', type: 'ANALYZE', findings: [], heavy_pdf_probe_governance: SAMPLE_GOVERNANCE };
  const normalized = normalizeAnalyzeJob(rawJob);
  const qpdf = normalized.heavy_pdf_probe_governance?.tools?.qpdf;
  assert('qpdf tool entry present', !!qpdf);
  assert('qpdf semantic_status is WARNING_ONLY (not generic failure)', qpdf?.semantic_status === 'WARNING_ONLY');
  assert('qpdf usable_output is true', qpdf?.usable_output === true);
  assert('qpdf fatal is false', qpdf?.fatal === false);
  assert('qpdf warning_classes preserved', Array.isArray(qpdf?.warning_classes) && qpdf.warning_classes.includes('PDF_LINEARIZATION_HINT_WARNING'));
}

// ─── Scenario 3: pdfimages WARNING_ONLY semantics survive normalization ──────────
section('Scenario 3: pdfimages WARNING_ONLY tool semantics preserved');
{
  const rawJob = { jobId: 'job_heavy_003', type: 'ANALYZE', findings: [], heavy_pdf_probe_governance: SAMPLE_GOVERNANCE };
  const normalized = normalizeAnalyzeJob(rawJob);
  const pdfimages = normalized.heavy_pdf_probe_governance?.tools?.pdfimages;
  assert('pdfimages tool entry present', !!pdfimages);
  assert('pdfimages semantic_status is WARNING_ONLY (not generic failure)', pdfimages?.semantic_status === 'WARNING_ONLY');
  assert('pdfimages warning_classes include font weight warning', Array.isArray(pdfimages?.warning_classes) && pdfimages.warning_classes.includes('PDF_FONT_WEIGHT_WARNING'));
}

// ─── Scenario 4: fatal_document_failure remains fatal ────────────────────────────
section('Scenario 4: fatal_document_failure stays fatal');
{
  const fatalGovernance = {
    ...SAMPLE_GOVERNANCE,
    analysis_degraded: true,
    degraded_but_usable: true,
    fatal_document_failure: true,
    tools: {
      qpdf: {
        raw_status: 'FAILED',
        semantic_status: 'FAILED_FATAL',
        severity: 'critical',
        usable_output: false,
        fatal: true,
        fatal_classes: ['PDF_STRUCTURAL_ERROR_FATAL'],
      },
    },
  };
  const rawJob = { jobId: 'job_heavy_004', type: 'ANALYZE', findings: [], heavy_pdf_probe_governance: fatalGovernance };
  const normalized = normalizeAnalyzeJob(rawJob);
  assert('fatal_document_failure preserved as true', normalized.heavy_pdf_probe_governance.fatal_document_failure === true);
  assert('qpdf semantic_status is FAILED_FATAL', normalized.heavy_pdf_probe_governance.tools.qpdf.semantic_status === 'FAILED_FATAL');
}

// ─── Scenario 5: fatal_document_failure wins over degraded_but_usable on merge ───
section('Scenario 5: fatal_document_failure overrides degraded_but_usable when merged');
{
  const payload = {
    heavy_pdf_probe_governance: { ...SAMPLE_GOVERNANCE, fatal_document_failure: false, degraded_but_usable: true },
    result: {
      heavy_pdf_probe_governance: { ...SAMPLE_GOVERNANCE, fatal_document_failure: true, degraded_but_usable: false, review_required: true },
    },
  };
  const contracts = extractGovernanceContracts(payload);
  assert('heavy_pdf_probe_governance present after merge', !!contracts.heavy_pdf_probe_governance);
  assert('fatal_document_failure=true wins', contracts.heavy_pdf_probe_governance.fatal_document_failure === true);
  assert('degraded_but_usable forced to false when fatal', contracts.heavy_pdf_probe_governance.degraded_but_usable === false);
}

// ─── Scenario 6: review_required=true wins across merged locations ──────────────
section('Scenario 6: review_required=true wins across merged locations');
{
  const payload = {
    heavy_pdf_probe_governance: { ...SAMPLE_GOVERNANCE, review_required: false },
    report: {
      heavy_pdf_probe_governance: { ...SAMPLE_GOVERNANCE, review_required: true },
    },
  };
  const contracts = extractGovernanceContracts(payload);
  assert('review_required=true wins on merge', contracts.heavy_pdf_probe_governance.review_required === true);
}

// ─── Scenario 7: No production/standards overclaim survives merge ───────────────
section('Scenario 7: No production/standards/PDF-X/PDF-A overclaim');
{
  const payload = {
    heavy_pdf_probe_governance: { ...SAMPLE_GOVERNANCE, production_certified: true, standard_certified: true, pdfx_compliance_claimed: true, pdfa_compliance_claimed: true, compliance_claim_allowed: true },
    fix_audit: {
      heavy_pdf_probe_governance: { ...SAMPLE_GOVERNANCE, production_certified: false, standard_certified: false, pdfx_compliance_claimed: false, pdfa_compliance_claimed: false, compliance_claim_allowed: false },
    },
  };
  const contracts = extractGovernanceContracts(payload);
  const g = contracts.heavy_pdf_probe_governance;
  assert('production_certified=false wins', g.production_certified === false);
  assert('standard_certified=false wins', g.standard_certified === false);
  assert('pdfx_compliance_claimed=false wins', g.pdfx_compliance_claimed === false);
  assert('pdfa_compliance_claimed=false wins', g.pdfa_compliance_claimed === false);
  assert('compliance_claim_allowed=false wins', g.compliance_claim_allowed === false);
}

// ─── Scenario 8: AUTOFIX payload preserves heavy_pdf_probe_governance from delta_report
section('Scenario 8: AUTOFIX payload preserves governance from delta_report');
{
  const rawFixJob = {
    jobId: 'fix_heavy_008',
    status: 'AUTOFIX_COMPLETED',
    result: {
      jobId: 'fix_heavy_008',
      artifacts: { fixed_pdf: 'fixed.pdf' },
      delta_report: {
        heavy_pdf_probe_governance: SAMPLE_GOVERNANCE,
      },
    },
  };
  const normalized = normalizeAutofixJob(rawFixJob, null);
  assert('heavy_pdf_probe_governance present on AUTOFIX result', !!normalized.heavy_pdf_probe_governance);
  assert('review_required preserved', normalized.heavy_pdf_probe_governance.review_required === true);
  assert('probe_summary preserved', normalized.heavy_pdf_probe_governance.probe_summary?.warning_only === 2);
}

// ─── Scenario 9: Legacy payload without heavy_pdf_probe_governance still works ───
section('Scenario 9: Legacy payload without heavy_pdf_probe_governance normalizes cleanly');
{
  const rawJob = {
    jobId: 'job_legacy_009',
    type: 'ANALYZE',
    document: { name: 'normal.pdf', size: 1024, page_count: 2, pdf_version: '1.7' },
    findings: [],
  };
  let normalized;
  let threw = false;
  try {
    normalized = normalizeAnalyzeJob(rawJob);
  } catch (err) {
    threw = true;
  }
  assert('normalizeAnalyzeJob does not throw on legacy payload', threw === false);
  assert('heavy_pdf_probe_governance absent for legacy payload', normalized.heavy_pdf_probe_governance === undefined);
  assert('jobId preserved', normalized.jobId === 'job_legacy_009');
}

// ─── Scenario 10: No raw temp paths or giant transcripts introduced ─────────────
section('Scenario 10: BFF does not introduce raw temp paths or giant transcripts');
{
  const rawJob = { jobId: 'job_heavy_010', type: 'ANALYZE', findings: [], heavy_pdf_probe_governance: SAMPLE_GOVERNANCE };
  const normalized = normalizeAnalyzeJob(rawJob);
  const serialized = JSON.stringify(normalized.heavy_pdf_probe_governance);
  const hasTempPath = /\/tmp\/|C:\\\\Users|\\\\AppData\\\\Temp/i.test(serialized);
  assert('no local filesystem paths in heavy_pdf_probe_governance', !hasTempPath);
  assert('serialized governance is reasonably sized (no giant transcript)', serialized.length < 5000);
}

// ─── Summary ─────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(60)}`);
console.log(`APP-62F Smoke: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.error(`\n[FAIL] APP-62F smoke test failed with ${failed} assertion(s).`);
  process.exit(1);
} else {
  console.log(`\n[PASS] APP-62F smoke test complete — all scenarios pass.`);
}
