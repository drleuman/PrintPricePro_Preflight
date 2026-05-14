'use strict';

/**
 * Unit Test Suite for preflightNormalizer service.
 * Verifies preservation of full source ANALYZE intelligence inside AUTOFIX payloads.
 */

const preflightNormalizer = require('./services/preflightNormalizer');

function runTests() {
  console.log('--- STARTING PREFLIGHT NORMALIZER TESTS (APP/BFF) ---\n');

  let passed = 0;
  let failed = 0;

  function assertPass(testName, cond, details) {
    if (cond) {
      console.log(`✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${testName}`, details || '');
      failed++;
    }
  }

  // --- Test 1: Autofix preserves source metadata ---
  console.log('[Test 1] Autofix preserves source metadata');
  const sourceAnalyzeJob1 = {
    jobId: 'job_src_1',
    document: {
      name: 'annual_report_final.pdf',
      size: 2523488,
      page_count: 12
    }
  };
  const rawFixJob1 = {
    jobId: 'fix_1',
    meta: {
      fileName: 'unknown',
      fileSize: 0,
      pageCount: 0
    }
  };

  const res1 = preflightNormalizer.normalizeAutofixJob(rawFixJob1, sourceAnalyzeJob1);
  assertPass(
    'Normalized document uses source metadata (name)',
    res1.document?.name === 'annual_report_final.pdf',
    { expected: 'annual_report_final.pdf', got: res1.document?.name }
  );
  assertPass(
    'meta.fileName is not "unknown"',
    res1.meta?.fileName === 'annual_report_final.pdf',
    { expected: 'annual_report_final.pdf', got: res1.meta?.fileName }
  );
  assertPass(
    'meta.fileSize is not 0',
    res1.meta?.fileSize === 2523488,
    { expected: 2523488, got: res1.meta?.fileSize }
  );
  assertPass(
    'meta.pageCount is not 0',
    res1.meta?.pageCount === 12,
    { expected: 12, got: res1.meta?.pageCount }
  );


  // --- Test 2: Autofix preserves source findings ---
  console.log('\n[Test 2] Autofix preserves source findings');
  const sourceAnalyzeJob2 = {
    jobId: 'job_src_2',
    issues: Array.from({ length: 28 }, (_, i) => ({ id: `issue_${i}`, severity: i < 12 ? 'error' : 'warning' })),
    score: 65
  };
  const rawFixJob2 = {
    jobId: 'fix_2',
    issues: []
  };

  const res2 = preflightNormalizer.normalizeAutofixJob(rawFixJob2, sourceAnalyzeJob2);
  assertPass(
    'findings_before length is 28',
    res2.findings_before?.length === 28,
    { expected: 28, got: res2.findings_before?.length }
  );
  assertPass(
    'issues is not empty when post-fix verification is missing',
    res2.issues?.length === 28,
    { expected: 28, got: res2.issues?.length }
  );
  assertPass(
    'summary.before exists and calculates correctly',
    res2.summary?.before?.issue_count === 28 && res2.summary?.before?.critical_count === 12,
    { expectedSummary: { issue_count: 28, critical_count: 12 }, got: res2.summary?.before }
  );


  // --- Test 3: Autofix preserves fixes ---
  console.log('\n[Test 3] Autofix preserves fixes');
  const rawFixJob3 = {
    jobId: 'fix_3',
    result: {
      fixes: [
        {
          code: 'APPLY_BLEED',
          status: 'APPLIED',
          strategy: 'BOX_EXPANSION_ONLY',
          rewritten: true,
          description: 'BleedBox expanded 3mm on all sides via page box adjustment.',
          bleed_fix_mode: 'BLEED_BOX_EXPANSION',
          destructiveFixRisk: 'LOW',
          industrial_quality: 'LIMITED',
          requires_human_review: true
        }
      ]
    }
  };

  const res3 = preflightNormalizer.normalizeAutofixJob(rawFixJob3, sourceAnalyzeJob2);
  assertPass(
    'fixes[] preserved exactly without dropped fields',
    res3.fixes?.length === 1 && res3.fixes[0].bleed_fix_mode === 'BLEED_BOX_EXPANSION' && res3.fixes[0].requires_human_review === true,
    { got: res3.fixes }
  );


  // --- Test 4: Missing source analysis marks degraded ---
  console.log('\n[Test 4] Missing source analysis marks degraded');
  const rawFixJob4 = {
    jobId: 'fix_4',
    meta: {
      fileName: 'unknown',
      fileSize: 0,
      pageCount: 0
    }
  };

  const res4 = preflightNormalizer.normalizeAutofixJob(rawFixJob4, null);
  assertPass(
    '_isDegraded true when source context is missing',
    res4._isDegraded === true,
    { gotDegraded: res4._isDegraded }
  );
  assertPass(
    'degraded_reasons includes MISSING_SOURCE_ANALYSIS',
    res4.degraded_reasons?.includes('MISSING_SOURCE_ANALYSIS'),
    { gotReasons: res4.degraded_reasons }
  );
  assertPass(
    'Do not fake clean pageCount/fileSize/fileName values',
    res4.meta?.fileName === 'document.pdf' && res4.meta?.fileSize === 0,
    { gotMeta: res4.meta }
  );


  // --- Test 5: Artifact aliases ---
  console.log('\n[Test 5] Artifact aliases');
  const rawFixJob5 = {
    jobId: 'fix_5',
    artifacts: {
      output_file: 'job_5_fixed_bleed.pdf'
    }
  };

  const res5 = preflightNormalizer.normalizeAutofixJob(rawFixJob5, sourceAnalyzeJob1);
  assertPass(
    'artifacts.final_fixed_pdf resolves correctly',
    res5.artifacts?.final_fixed_pdf === 'job_5_fixed_bleed.pdf',
    { got: res5.artifacts?.final_fixed_pdf }
  );
  assertPass(
    'artifacts.fixed_pdf resolves correctly',
    res5.artifacts?.fixed_pdf === 'job_5_fixed_bleed.pdf',
    { got: res5.artifacts?.fixed_pdf }
  );
  assertPass(
    'artifactList includes available artifacts',
    res5.artifactList?.some(a => a.type === 'output_file' && a.name === 'job_5_fixed_bleed.pdf'),
    { got: res5.artifactList }
  );

  // --- Test 6: Regression test with observed production payload ---
  console.log('\n[Test 6] Regression test with observed production payload');
  const rawFix = {
    id: "fix_1778746174372",
    jobId: "fix_1778746174372",
    ok: true,
    status: "COMPLETED",
    type: "AUTOFIX",
    progress: 100,
    artifacts: {
      output_file: "1bbacdd1-5d3b-444d-b514-5a7a47523a06_fixed_1778746174381.pdf",
      final_fixed_pdf: "fixed.pdf"
    },
    issues: [],
    findings: [],
    warnings: [],
    repairs: [
      {
        code: "APPLY_BLEED",
        status: "APPLIED",
        strategy: "BOX_EXPANSION_ONLY",
        rewritten: true,
        description: "BleedBox expanded 3mm on all sides via page box adjustment.",
        bleed_fix_mode: "BLEED_BOX_EXPANSION",
        destructiveFixRisk: "LOW",
        industrial_quality: "LIMITED",
        requires_human_review: true
      }
    ]
  };

  const normalized = preflightNormalizer.normalizeAutofixJob(rawFix, null);

  assertPass(
    'normalized.jobId === "fix_1778746174372"',
    normalized.jobId === "fix_1778746174372",
    { got: normalized.jobId }
  );
  assertPass(
    'normalized.type === "AUTOFIX"',
    normalized.type === "AUTOFIX",
    { got: normalized.type }
  );
  assertPass(
    'normalized.summary is an object',
    normalized.summary && typeof normalized.summary === 'object',
    { got: normalized.summary }
  );
  assertPass(
    'normalized.summary.before === null',
    normalized.summary?.before === null,
    { got: normalized.summary?.before }
  );
  assertPass(
    'normalized.summary.after === null',
    normalized.summary?.after === null,
    { got: normalized.summary?.after }
  );
  assertPass(
    'normalized.meta exists',
    normalized.meta && typeof normalized.meta === 'object',
    { got: normalized.meta }
  );
  assertPass(
    'normalized.document exists',
    normalized.document && typeof normalized.document === 'object',
    { got: normalized.document }
  );
  assertPass(
    'normalized.fixes.length === 1',
    normalized.fixes?.length === 1,
    { got: normalized.fixes }
  );
  assertPass(
    'normalized.repairs.length === 1',
    normalized.repairs?.length === 1,
    { got: normalized.repairs }
  );
  assertPass(
    'normalized.fixes[0].code === "APPLY_BLEED"',
    normalized.fixes?.[0]?.code === "APPLY_BLEED",
    { got: normalized.fixes?.[0]?.code }
  );
  assertPass(
    'normalized.artifacts.final_fixed_pdf === "fixed.pdf"',
    normalized.artifacts?.final_fixed_pdf === "fixed.pdf",
    { got: normalized.artifacts?.final_fixed_pdf }
  );
  assertPass(
    'normalized.artifacts.fixed_pdf === "fixed.pdf"',
    normalized.artifacts?.fixed_pdf === "fixed.pdf",
    { got: normalized.artifacts?.fixed_pdf }
  );
  assertPass(
    'normalized.artifactList.length >= 3',
    normalized.artifactList?.length >= 3,
    { got: normalized.artifactList }
  );
  assertPass(
    'normalized._isDegraded === true',
    normalized._isDegraded === true,
    { got: normalized._isDegraded }
  );
  assertPass(
    'normalized.degraded_reasons includes "MISSING_SOURCE_ANALYSIS"',
    normalized.degraded_reasons?.includes("MISSING_SOURCE_ANALYSIS"),
    { got: normalized.degraded_reasons }
  );
  assertPass(
    'normalized.degraded_reasons includes "MISSING_DOCUMENT_METADATA"',
    normalized.degraded_reasons?.includes("MISSING_DOCUMENT_METADATA"),
    { got: normalized.degraded_reasons }
  );
  assertPass(
    'normalized.degraded_reasons includes "MISSING_SOURCE_SUMMARY"',
    normalized.degraded_reasons?.includes("MISSING_SOURCE_SUMMARY"),
    { got: normalized.degraded_reasons }
  );
  // --- Test 7: Extended Forensic Resolution and Edge Case Degradation ---
  console.log('\n[Test 7] Extended Forensic Resolution and Edge Case Degradation');
  
  const nestedRawFix = {
    result: {
      jobId: "fix_nested_999",
      meta: {
        fileName: "AUTOFIX",
        fileSize: 1048576
      }
    },
    status: "COMPLETED"
  };

  const mockSourceWithCategories = {
    jobId: "job_src_cat_1",
    document: {
      name: "real_contract.pdf",
      size: 500000,
      page_count: 5
    },
    findings: [
      { id: "f1", severity: "error", category: "BLEED" }
    ],
    categorySummaries: [
      { category: "BLEED", issuesCount: 1 }
    ],
    summary: {
      text: "Source analysis complete",
      risk_score: 45
    }
  };

  const resNestedDegraded = preflightNormalizer.normalizeAutofixJob(nestedRawFix, null);
  assertPass(
    'Nested upstream fix resolves canonical ID',
    resNestedDegraded.jobId === "fix_nested_999",
    { got: resNestedDegraded.jobId }
  );
  assertPass(
    'Forbidden document name "AUTOFIX" defaults to document.pdf',
    resNestedDegraded.document?.name === "document.pdf",
    { got: resNestedDegraded.document?.name }
  );
  assertPass(
    'Degraded reasons includes MISSING_DOCUMENT_METADATA for fallback document.pdf',
    resNestedDegraded.degraded_reasons?.includes("MISSING_DOCUMENT_METADATA"),
    { got: resNestedDegraded.degraded_reasons }
  );

  const resEnriched = preflightNormalizer.normalizeAutofixJob(nestedRawFix, mockSourceWithCategories);
  assertPass(
    'Enriched document inherits actual source document.name',
    resEnriched.document?.name === "real_contract.pdf",
    { got: resEnriched.document?.name }
  );
  assertPass(
    'Enriched payload populates categorySummaries from source',
    resEnriched.categorySummaries?.length === 1 && resEnriched.categorySummaries[0].category === "BLEED",
    { got: resEnriched.categorySummaries }
  );
  assertPass(
    'Enriched payload preserves source summary text string',
    resEnriched.summary_text === "Source analysis complete",
    { got: resEnriched.summary_text }
  );
  assertPass(
    'Enriched payload _isDegraded becomes false when full source context is mapped',
    resEnriched._isDegraded === false,
    { gotDegraded: resEnriched._isDegraded, reasons: resEnriched.degraded_reasons }
  );

  console.log('\n--- TEST EXECUTION SUMMARY ---');
  console.log(`Total Passed: ${passed}`);
  console.log(`Total Failed: ${failed}`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
