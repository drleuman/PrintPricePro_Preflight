import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

const {
  getJobId,
  getSourceJobId,
  extractDocumentMetadata,
  extractFindings,
  extractSummary,
  deriveCategorySummaries,
  derivePages,
  buildDegradedState,
  normalizeAnalyzeJob,
  normalizeAutofixJob,
  resolveArtifactAliases,
  cacheSourceJob,
  linkFixJob,
  getLinkedSourceJobId,
  getCachedSourceJob,
  mergeGovernanceObject,
  extractGovernanceContracts,
} = require('./preflightNormalizer');

// ---------------------------------------------------------------------------
// getJobId
// ---------------------------------------------------------------------------
describe('getJobId', () => {
  it('returns fix_ prefixed ID when present at top level', () => {
    expect(getJobId({ jobId: 'fix_abc' })).toBe('fix_abc');
  });

  it('returns fix_ ID from result.fixJobId', () => {
    expect(getJobId({ result: { fixJobId: 'fix_nested' } })).toBe('fix_nested');
  });

  it('returns job_ ID when no fix_ ID is found', () => {
    expect(getJobId({ jobId: 'job_xyz' })).toBe('job_xyz');
  });

  it('prefers fix_ over job_ at the same level', () => {
    expect(getJobId({ jobId: 'fix_first', id: 'job_second' })).toBe('fix_first');
  });

  it('returns fix_unknown when no prefixed ID is found', () => {
    expect(getJobId({ jobId: 'plain-uuid' })).toBe('fix_unknown');
  });

  it('returns fix_unknown for empty input', () => {
    expect(getJobId({})).toBe('fix_unknown');
  });

  it('returns fix_unknown for null input', () => {
    expect(getJobId(null)).toBe('fix_unknown');
  });

  it('picks up fix_ ID from result.targetJobId', () => {
    expect(getJobId({ result: { targetJobId: 'fix_target' } })).toBe('fix_target');
  });
});

// ---------------------------------------------------------------------------
// getSourceJobId
// ---------------------------------------------------------------------------
describe('getSourceJobId', () => {
  it('returns job_ from rawFixJob.sourceJobId', () => {
    expect(getSourceJobId({ sourceJobId: 'job_source' }, null)).toBe('job_source');
  });

  it('returns job_ from rawFixJob.parentJobId', () => {
    expect(getSourceJobId({ parentJobId: 'job_parent' }, null)).toBe('job_parent');
  });

  it('returns job_ from sourceAnalyzeJob.jobId when not in rawFixJob', () => {
    expect(getSourceJobId({}, { jobId: 'job_analyze' })).toBe('job_analyze');
  });

  it('returns job_unknown when no job_ ID found', () => {
    expect(getSourceJobId({}, null)).toBe('job_unknown');
  });

  it('ignores non-job_ prefixed IDs', () => {
    expect(getSourceJobId({ sourceJobId: 'plain-uuid' }, null)).toBe('job_unknown');
  });
});

// ---------------------------------------------------------------------------
// extractDocumentMetadata
// ---------------------------------------------------------------------------
describe('extractDocumentMetadata', () => {
  it('extracts from job.document.name', () => {
    const result = extractDocumentMetadata({
      document: { name: 'brochure.pdf', size: 1024, page_count: 8, pdf_version: '1.6' },
    });
    expect(result).not.toBeNull();
    expect(result.name).toBe('brochure.pdf');
    expect(result.size).toBe(1024);
    expect(result.page_count).toBe(8);
    expect(result.pdf_version).toBe('1.6');
  });

  it('falls back to job.meta.fileName', () => {
    const result = extractDocumentMetadata({ meta: { fileName: 'catalog.pdf', fileSize: 2048 } });
    expect(result).not.toBeNull();
    expect(result.name).toBe('catalog.pdf');
    expect(result.size).toBe(2048);
  });

  it('extracts from result.document path', () => {
    const result = extractDocumentMetadata({ result: { document: { name: 'nested.pdf', size: 512, page_count: 2 } } });
    expect(result).not.toBeNull();
    expect(result.name).toBe('nested.pdf');
  });

  it('returns null for null input', () => {
    expect(extractDocumentMetadata(null)).toBeNull();
  });

  it('returns null when name is unknown', () => {
    expect(extractDocumentMetadata({ document: { name: 'unknown' } })).toBeNull();
  });

  it('returns null when document name is a status word', () => {
    expect(extractDocumentMetadata({ document: { name: 'completed' } })).toBeNull();
    expect(extractDocumentMetadata({ document: { name: 'analyze' } })).toBeNull();
  });

  it('returns null for empty input', () => {
    expect(extractDocumentMetadata({})).toBeNull();
  });

  it('defaults pdf_version to 1.7 when not provided', () => {
    const result = extractDocumentMetadata({ document: { name: 'test.pdf' } });
    expect(result.pdf_version).toBe('1.7');
  });
});

// ---------------------------------------------------------------------------
// extractFindings
// ---------------------------------------------------------------------------
describe('extractFindings', () => {
  it('returns empty array for null input', () => {
    expect(extractFindings(null)).toEqual([]);
  });

  it('extracts from job.findings', () => {
    const finding = { id: 'f1', code: 'BLEED' };
    expect(extractFindings({ findings: [finding] })).toContainEqual(finding);
  });

  it('extracts from job.issues', () => {
    const issue = { id: 'i1', code: 'FONT' };
    expect(extractFindings({ issues: [issue] })).toContainEqual(issue);
  });

  it('extracts from job.result.findings', () => {
    const finding = { id: 'rf1', code: 'COLOR' };
    expect(extractFindings({ result: { findings: [finding] } })).toContainEqual(finding);
  });

  it('extracts from job.report.findings', () => {
    const finding = { id: 'rpf1', code: 'RES' };
    expect(extractFindings({ report: { findings: [finding] } })).toContainEqual(finding);
  });

  it('deduplicates findings by id', () => {
    const finding = { id: 'dup', code: 'BLEED' };
    const result = extractFindings({ findings: [finding], issues: [finding] });
    expect(result.filter(f => f.id === 'dup')).toHaveLength(1);
  });

  it('deduplicates findings without id by composite key (code+page+severity+message)', () => {
    const finding = { code: 'BLEED', page: 1, severity: 'error', message: 'Missing bleed' };
    const result = extractFindings({ findings: [finding], issues: [finding] });
    expect(result).toHaveLength(1);
  });

  it('includes both unique findings when IDs differ', () => {
    const f1 = { id: 'a', code: 'BLEED' };
    const f2 = { id: 'b', code: 'FONT' };
    const result = extractFindings({ findings: [f1, f2] });
    expect(result).toHaveLength(2);
  });

  it('handles string findings in warnings', () => {
    const result = extractFindings({ warnings: ['Low resolution detected'] });
    expect(result).toContain('Low resolution detected');
  });
});

// ---------------------------------------------------------------------------
// extractSummary
// ---------------------------------------------------------------------------
describe('extractSummary', () => {
  it('returns null for null input', () => {
    expect(extractSummary(null)).toBeNull();
  });

  it('returns existing summary object', () => {
    const summary = { risk_level: 'WARNING', issue_count: 3 };
    expect(extractSummary({ summary })).toBe(summary);
  });

  it('derives summary with CRITICAL risk when error findings present', () => {
    const result = extractSummary({
      findings: [{ id: 'f1', severity: 'error' }],
    });
    expect(result.risk_level).toBe('CRITICAL');
    expect(result.critical_count).toBeGreaterThan(0);
  });

  it('derives summary with LOW risk when no issues', () => {
    const result = extractSummary({ score: 100 });
    expect(result.risk_level).toBe('LOW');
  });
});

// ---------------------------------------------------------------------------
// deriveCategorySummaries
// ---------------------------------------------------------------------------
describe('deriveCategorySummaries', () => {
  it('returns empty array for empty input', () => {
    expect(deriveCategorySummaries([])).toEqual([]);
  });

  it('returns empty array for non-array input', () => {
    expect(deriveCategorySummaries(null)).toEqual([]);
  });

  it('groups findings by category', () => {
    const findings = [
      { category: 'COLOR', severity: 'error' },
      { category: 'COLOR', severity: 'warning' },
      { category: 'GEOMETRY', severity: 'error' },
    ];
    const result = deriveCategorySummaries(findings);
    const colorEntry = result.find(r => r.category === 'COLOR');
    const geoEntry = result.find(r => r.category === 'GEOMETRY');
    expect(colorEntry.count).toBe(2);
    expect(colorEntry.error_count).toBe(1);
    expect(colorEntry.warning_count).toBe(1);
    expect(geoEntry.count).toBe(1);
  });

  it('increments fixable_count when finding has fix_method', () => {
    const findings = [{ category: 'FONT', severity: 'error', fix_method: 'EMBED_FONTS' }];
    const result = deriveCategorySummaries(findings);
    expect(result[0].fixable_count).toBe(1);
  });

  it('uses GENERAL category as fallback when category is missing', () => {
    const findings = [{ severity: 'warning', message: 'Some issue' }];
    const result = deriveCategorySummaries(findings);
    expect(result[0].category).toBe('GENERAL');
  });

  it('treats critical severity as error_count', () => {
    const findings = [{ category: 'COLOR', severity: 'critical' }];
    const result = deriveCategorySummaries(findings);
    expect(result[0].error_count).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// derivePages
// ---------------------------------------------------------------------------
describe('derivePages', () => {
  it('returns empty array for empty input', () => {
    expect(derivePages([])).toEqual([]);
  });

  it('groups findings by page number', () => {
    const findings = [
      { page: 1, severity: 'error', category: 'COLOR' },
      { page: 1, severity: 'warning', category: 'FONT' },
      { page: 2, severity: 'error', category: 'GEOMETRY' },
    ];
    const result = derivePages(findings);
    const page1 = result.find(p => p.page === 1);
    const page2 = result.find(p => p.page === 2);
    expect(page1.issue_count).toBe(2);
    expect(page1.error_count).toBe(1);
    expect(page1.warning_count).toBe(1);
    expect(page2.issue_count).toBe(1);
  });

  it('returns pages sorted in ascending order', () => {
    const findings = [
      { page: 5, severity: 'info' },
      { page: 1, severity: 'error' },
      { page: 3, severity: 'warning' },
    ];
    const result = derivePages(findings);
    expect(result.map(p => p.page)).toEqual([1, 3, 5]);
  });

  it('defaults to page 1 when page is missing', () => {
    const result = derivePages([{ severity: 'warning', message: 'Test' }]);
    expect(result[0].page).toBe(1);
  });

  it('includes categories array for each page', () => {
    const findings = [
      { page: 1, category: 'COLOR', severity: 'error' },
      { page: 1, category: 'FONT', severity: 'warning' },
    ];
    const result = derivePages(findings);
    expect(result[0].categories).toContain('COLOR');
    expect(result[0].categories).toContain('FONT');
  });
});

// ---------------------------------------------------------------------------
// buildDegradedState
// ---------------------------------------------------------------------------
describe('buildDegradedState', () => {
  it('returns isDegraded=false for empty reasons', () => {
    const result = buildDegradedState([]);
    expect(result._isDegraded).toBe(false);
    expect(result.degraded_reasons).toEqual([]);
  });

  it('returns isDegraded=true when reasons are present', () => {
    const result = buildDegradedState(['MISSING_SOURCE_ANALYSIS']);
    expect(result._isDegraded).toBe(true);
    expect(result.degraded_reasons).toContain('MISSING_SOURCE_ANALYSIS');
  });

  it('handles null reasons gracefully', () => {
    const result = buildDegradedState(null);
    expect(result._isDegraded).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// resolveArtifactAliases
// ---------------------------------------------------------------------------
describe('resolveArtifactAliases', () => {
  it('extracts artifacts from rawFixJob.artifacts object', () => {
    const result = resolveArtifactAliases(
      { artifacts: { fixed_pdf: 'output.pdf' } },
      {}
    );
    expect(result.fixed_pdf).toBe('output.pdf');
  });

  it('promotes fixed_pdf to final_fixed_pdf', () => {
    const result = resolveArtifactAliases(
      { artifacts: { fixed_pdf: 'repaired.pdf' } },
      {}
    );
    expect(result.final_fixed_pdf).toBe('repaired.pdf');
  });

  it('extracts from array-format artifacts', () => {
    const result = resolveArtifactAliases(
      { artifacts: [{ type: 'fixed_pdf', name: 'out.pdf' }] },
      {}
    );
    expect(result.fixed_pdf).toBe('out.pdf');
  });

  it('returns empty map when no artifact found', () => {
    const result = resolveArtifactAliases({}, {});
    expect(result.final_fixed_pdf).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// normalizeAnalyzeJob
// ---------------------------------------------------------------------------
describe('normalizeAnalyzeJob', () => {
  it('returns null for null input', () => {
    expect(normalizeAnalyzeJob(null)).toBeNull();
  });

  it('sets normalizerApplied to true', () => {
    const result = normalizeAnalyzeJob({ jobId: 'job_001' });
    expect(result.normalizerApplied).toBe(true);
  });

  it('extracts jobId from top-level jobId field', () => {
    const result = normalizeAnalyzeJob({ jobId: 'job_analyze_1' });
    expect(result.jobId).toBe('job_analyze_1');
  });

  it('defaults document to document.pdf when metadata missing', () => {
    const result = normalizeAnalyzeJob({ jobId: 'job_001' });
    expect(result.document.name).toBe('document.pdf');
    expect(result._isDegraded).toBe(true);
    expect(result.degraded_reasons).toContain('MISSING_DOCUMENT_METADATA');
  });

  it('preserves document metadata when present', () => {
    const result = normalizeAnalyzeJob({
      jobId: 'job_002',
      document: { name: 'brochure.pdf', size: 1000, page_count: 4, pdf_version: '1.7' },
    });
    expect(result.document.name).toBe('brochure.pdf');
    expect(result._isDegraded).toBe(false);
  });

  it('derives summary when not provided and findings exist', () => {
    const result = normalizeAnalyzeJob({
      jobId: 'job_003',
      findings: [{ id: 'f1', severity: 'error' }],
    });
    expect(result.summary).not.toBeNull();
    expect(result.summary.risk_level).toBe('CRITICAL');
  });

  it('derives categorySummaries from findings when not provided', () => {
    const result = normalizeAnalyzeJob({
      jobId: 'job_004',
      findings: [{ id: 'f1', category: 'COLOR', severity: 'error' }],
    });
    const colorEntry = result.categorySummaries.find(c => c.category === 'COLOR');
    expect(colorEntry).toBeDefined();
    expect(colorEntry.count).toBe(1);
  });

  it('sets type to ANALYZE when not provided', () => {
    const result = normalizeAnalyzeJob({ jobId: 'job_005' });
    expect(result.type).toBe('ANALYZE');
  });

  it('preserves existing type field', () => {
    const result = normalizeAnalyzeJob({ jobId: 'job_006', type: 'PREFLIGHT_ADVANCED' });
    expect(result.type).toBe('PREFLIGHT_ADVANCED');
  });
});

// ---------------------------------------------------------------------------
// normalizeAutofixJob
// ---------------------------------------------------------------------------
describe('normalizeAutofixJob', () => {
  const sourceJob = {
    jobId: 'job_source_1',
    document: { name: 'catalog.pdf', size: 2000, page_count: 12, pdf_version: '1.7' },
    findings: [{ id: 'f1', severity: 'error', category: 'FONT', message: 'Font not embedded' }],
    summary: { risk_level: 'CRITICAL', issue_count: 1 },
  };

  it('sets type to AUTOFIX', () => {
    const result = normalizeAutofixJob({ jobId: 'fix_001', sourceJobId: 'job_source_1' }, sourceJob);
    expect(result.type).toBe('AUTOFIX');
  });

  it('preserves document metadata from source analyze job', () => {
    const result = normalizeAutofixJob({ jobId: 'fix_001', sourceJobId: 'job_source_1' }, sourceJob);
    expect(result.document.name).toBe('catalog.pdf');
    expect(result.document.page_count).toBe(12);
  });

  it('sets findings_before from source findings', () => {
    const result = normalizeAutofixJob({ jobId: 'fix_001', sourceJobId: 'job_source_1' }, sourceJob);
    expect(result.findings_before).toHaveLength(1);
    expect(result.findings_before[0].id).toBe('f1');
  });

  it('sets sourceJobId from rawFixJob', () => {
    const result = normalizeAutofixJob({ jobId: 'fix_001', sourceJobId: 'job_source_1' }, sourceJob);
    expect(result.sourceJobId).toBe('job_source_1');
  });

  it('marks degraded when no sourceAnalyzeJob provided', () => {
    const result = normalizeAutofixJob({ jobId: 'fix_002' }, null);
    expect(result._isDegraded).toBe(true);
    expect(result.degraded_reasons).toContain('MISSING_SOURCE_ANALYSIS');
  });

  it('includes summary.before from source job', () => {
    const result = normalizeAutofixJob({ jobId: 'fix_001', sourceJobId: 'job_source_1' }, sourceJob);
    expect(result.summary.before).not.toBeNull();
    expect(result.summary.before.risk_level).toBe('CRITICAL');
  });

  it('extracts repairs from rawFixJob.repairs', () => {
    const rawFix = {
      jobId: 'fix_003',
      repairs: [{ code: 'EMBED_FONTS', status: 'APPLIED' }],
    };
    const result = normalizeAutofixJob(rawFix, sourceJob);
    expect(result.repairs).toHaveLength(1);
    expect(result.repairs[0].code).toBe('EMBED_FONTS');
  });

  it('extracts applied_fixes from repairs with APPLIED status', () => {
    const rawFix = {
      jobId: 'fix_004',
      repairs: [
        { code: 'EMBED_FONTS', status: 'APPLIED' },
        { code: 'ADD_BLEED', status: 'FAILED' },
      ],
    };
    const result = normalizeAutofixJob(rawFix, sourceJob);
    expect(result.applied_fixes).toHaveLength(1);
    expect(result.applied_fixes[0].code).toBe('EMBED_FONTS');
  });

  it('always includes meta.jobId matching the fix job', () => {
    const result = normalizeAutofixJob({ jobId: 'fix_005', sourceJobId: 'job_source_1' }, sourceJob);
    expect(result.meta.jobId).toBe('fix_005');
  });
});

// ---------------------------------------------------------------------------
// Cache functions
// ---------------------------------------------------------------------------
describe('cacheSourceJob / linkFixJob / getLinkedSourceJobId / getCachedSourceJob', () => {
  it('stores and retrieves a source job by ID', () => {
    const jobData = { jobId: 'job_cache_1', document: { name: 'test.pdf' } };
    cacheSourceJob('job_cache_1', jobData);
    const linked = linkFixJob('fix_cache_1', 'job_cache_1');
    const result = getCachedSourceJob('fix_cache_1', null);
    expect(result).toBe(jobData);
  });

  it('getLinkedSourceJobId returns the source job ID', () => {
    linkFixJob('fix_link_1', 'job_link_1');
    expect(getLinkedSourceJobId('fix_link_1')).toBe('job_link_1');
  });

  it('getLinkedSourceJobId returns null for unknown fix ID', () => {
    expect(getLinkedSourceJobId('fix_nonexistent')).toBeNull();
  });

  it('getCachedSourceJob returns null when source not cached', () => {
    linkFixJob('fix_nocache', 'job_notcached');
    expect(getCachedSourceJob('fix_nocache', null)).toBeNull();
  });

  it('ignores null inputs in cacheSourceJob', () => {
    expect(() => cacheSourceJob(null, null)).not.toThrow();
  });

  it('ignores null inputs in linkFixJob', () => {
    expect(() => linkFixJob(null, null)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// mergeGovernanceObject
// ---------------------------------------------------------------------------
describe('mergeGovernanceObject', () => {
  it.each([
    'production_certified',
    'standard_certified',
    'certified_pdf_allowed',
    'customer_visible',
    'compliance_claim_allowed',
    'pdfx_compliance_claimed',
    'pdfa_compliance_claimed',
    'font_source_available',
    'visual_diff_performed',
    'package_ready',
    'payment_satisfied',
    'profile_passed',
    'compatible',
    'bundle_available',
    'auto_apply',
  ])('a false value for "%s" always wins over a true value', (field) => {
    const result = mergeGovernanceObject([{ [field]: true }, { [field]: false }]);
    expect(result[field]).toBe(false);
  });

  it('does not flip a false value back to true', () => {
    const result = mergeGovernanceObject([{ package_ready: false }, { package_ready: true }]);
    expect(result.package_ready).toBe(false);
  });

  it('review_required: true wins over false', () => {
    const result = mergeGovernanceObject([{ review_required: false }, { review_required: true }]);
    expect(result.review_required).toBe(true);
  });

  it.each(['fatal_document_failure', 'analysis_degraded', 'heavy_pdf_detected'])(
    '"%s": true always wins (APP-62F)',
    (field) => {
      const result = mergeGovernanceObject([{ [field]: false }, { [field]: true }]);
      expect(result[field]).toBe(true);
    }
  );

  it.each(['destructive', 'operator_only'])(
    '"%s": true always wins (APP-67)',
    (field) => {
      const result = mergeGovernanceObject([{ [field]: false }, { [field]: true }]);
      expect(result[field]).toBe(true);
    }
  );

  it.each([
    'low_res_unfixable',
    'transparency_flattened',
    'overprint_modified',
    'visual_change_detected',
    'visual_change_expected',
    'visual_diff_required',
    'proof_required',
  ])('"%s": true always wins (APP-64/65)', (field) => {
    const result = mergeGovernanceObject([{ [field]: false }, { [field]: true }]);
    expect(result[field]).toBe(true);
  });

  it('proof_status: a more restrictive status overrides a less restrictive one', () => {
    const result = mergeGovernanceObject([
      { proof_status: 'PROOF_APPROVED' },
      { proof_status: 'PROOF_REJECTED_REUPLOAD_REQUIRED' },
    ]);
    expect(result.proof_status).toBe('PROOF_REJECTED_REUPLOAD_REQUIRED');
  });

  it('proof_status: a less restrictive status does not override a more restrictive one', () => {
    const result = mergeGovernanceObject([
      { proof_status: 'PROOF_REJECTED_REUPLOAD_REQUIRED' },
      { proof_status: 'PROOF_APPROVED' },
    ]);
    expect(result.proof_status).toBe('PROOF_REJECTED_REUPLOAD_REQUIRED');
  });

  it('proof_status: PROOF_NOT_REQUIRED is the lowest rank and yields to any other status', () => {
    const result = mergeGovernanceObject([
      { proof_status: 'PROOF_NOT_REQUIRED' },
      { proof_status: 'PROOF_REQUIRED' },
    ]);
    expect(result.proof_status).toBe('PROOF_REQUIRED');
  });

  it.each(['blocked_by_governance_domains', 'warnings', 'review_required_reasons', 'blockers', 'mismatch_reasons'])(
    'deduplicates and merges the "%s" array across candidates',
    (field) => {
      const result = mergeGovernanceObject([{ [field]: ['a', 'b'] }, { [field]: ['b', 'c'] }]);
      expect(result[field]).toEqual(['a', 'b', 'c']);
    }
  );

  it.each(['tools', 'probe_summary'])('merges the "%s" object across candidates', (field) => {
    const result = mergeGovernanceObject([{ [field]: { a: 1 } }, { [field]: { b: 2 } }]);
    expect(result[field]).toEqual({ a: 1, b: 2 });
  });

  it('merges evidence objects across candidates', () => {
    const result = mergeGovernanceObject([
      { evidence: { pdfx: { tool: 'gs' } } },
      { evidence: { pdfa: { tool: 'verapdf' } } },
    ]);
    expect(result.evidence).toEqual({ pdfx: { tool: 'gs' }, pdfa: { tool: 'verapdf' } });
  });

  it('forces degraded_but_usable to false when fatal_document_failure is true', () => {
    const result = mergeGovernanceObject([{ degraded_but_usable: true, fatal_document_failure: true }]);
    expect(result.degraded_but_usable).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// extractGovernanceContracts
// ---------------------------------------------------------------------------
describe('extractGovernanceContracts', () => {
  it('returns an empty object for null/non-object payloads', () => {
    expect(extractGovernanceContracts(null)).toEqual({});
    expect(extractGovernanceContracts(undefined)).toEqual({});
    expect(extractGovernanceContracts('not an object')).toEqual({});
  });

  it('returns an empty object when no governance keys are present', () => {
    expect(extractGovernanceContracts({ jobId: 'job_1' })).toEqual({});
  });

  it('merges the same governance domain found at the top level and under result', () => {
    const contracts = extractGovernanceContracts({
      ink_governance: { warnings: ['top-level-warning'] },
      result: { ink_governance: { warnings: ['nested-warning'] } },
    });
    expect(contracts.ink_governance.warnings).toEqual(['top-level-warning', 'nested-warning']);
  });

  // APP-64: ink / image / font / transparency-overprint governance
  describe('APP-64 ink / image / font / transparency governance', () => {
    it('forces review_required when ink_governance.tac_violation_remaining is true', () => {
      const contracts = extractGovernanceContracts({ ink_governance: { tac_violation_remaining: true } });
      expect(contracts.ink_governance.review_required).toBe(true);
    });

    it('does not force review_required when ink_governance.tac_violation_remaining is false', () => {
      const contracts = extractGovernanceContracts({ ink_governance: { tac_violation_remaining: false } });
      expect(contracts.ink_governance.review_required).toBeUndefined();
    });

    it('forces review_required when selective_image_governance.low_res_unfixable is true', () => {
      const contracts = extractGovernanceContracts({ selective_image_governance: { low_res_unfixable: true } });
      expect(contracts.selective_image_governance.review_required).toBe(true);
    });

    it('forces review_required when font_governance.font_source_available is false', () => {
      const contracts = extractGovernanceContracts({ font_governance: { font_source_available: false } });
      expect(contracts.font_governance.review_required).toBe(true);
    });

    it('does not force review_required when font_governance.font_source_available is true', () => {
      const contracts = extractGovernanceContracts({ font_governance: { font_source_available: true } });
      expect(contracts.font_governance.review_required).toBeUndefined();
    });

    it.each(['transparency_flattened', 'overprint_modified'])(
      'forces review_required when transparency_overprint_physical_governance.%s is true',
      (field) => {
        const contracts = extractGovernanceContracts({
          transparency_overprint_physical_governance: { [field]: true },
        });
        expect(contracts.transparency_overprint_physical_governance.review_required).toBe(true);
      }
    );
  });

  // APP-64/65: visual diff and proof approval governance
  describe('visual diff and proof approval governance', () => {
    it('forces review_required when a visual diff was required but not performed', () => {
      const contracts = extractGovernanceContracts({
        visual_diff_governance: { visual_diff_required: true, visual_diff_performed: false },
      });
      expect(contracts.visual_diff_governance.review_required).toBe(true);
    });

    it('does not force review_required when a required visual diff was performed', () => {
      const contracts = extractGovernanceContracts({
        visual_diff_governance: { visual_diff_required: true, visual_diff_performed: true },
      });
      expect(contracts.visual_diff_governance.review_required).toBeUndefined();
    });

    it('forces review_required when a proof is required but not yet approved', () => {
      const contracts = extractGovernanceContracts({
        proof_approval_governance: { proof_required: true, proof_status: 'PROOF_PENDING_CUSTOMER' },
      });
      expect(contracts.proof_approval_governance.review_required).toBe(true);
    });

    it('does not force review_required when a required proof has been approved', () => {
      const contracts = extractGovernanceContracts({
        proof_approval_governance: { proof_required: true, proof_status: 'PROOF_APPROVED' },
      });
      expect(contracts.proof_approval_governance.review_required).toBeUndefined();
    });

    it('forces review_required for a rejected proof even if proof_required is false', () => {
      const contracts = extractGovernanceContracts({
        proof_approval_governance: { proof_required: false, proof_status: 'PROOF_REJECTED_REUPLOAD_REQUIRED' },
      });
      expect(contracts.proof_approval_governance.review_required).toBe(true);
    });
  });

  // APP-67: policy profiles / machine matching / fix recommendations
  describe('policy profile / machine readiness / recommendation governance', () => {
    it('forces review_required when policy_profile_governance.profile_passed is false', () => {
      const contracts = extractGovernanceContracts({ policy_profile_governance: { profile_passed: false } });
      expect(contracts.policy_profile_governance.review_required).toBe(true);
    });

    it('does not force review_required when policy_profile_governance.profile_passed is true', () => {
      const contracts = extractGovernanceContracts({ policy_profile_governance: { profile_passed: true } });
      expect(contracts.policy_profile_governance.review_required).toBeUndefined();
    });

    it('forces review_required when machine_readiness_governance.compatible is false', () => {
      const contracts = extractGovernanceContracts({ machine_readiness_governance: { compatible: false } });
      expect(contracts.machine_readiness_governance.review_required).toBe(true);
    });

    it('forces operator_only and auto_apply=false when a recommendation is destructive', () => {
      const contracts = extractGovernanceContracts({
        recommendation_governance: { destructive: true, operator_only: false, auto_apply: true },
      });
      expect(contracts.recommendation_governance.operator_only).toBe(true);
      expect(contracts.recommendation_governance.auto_apply).toBe(false);
    });

    it('leaves auto_apply untouched when a recommendation is not destructive', () => {
      const contracts = extractGovernanceContracts({
        recommendation_governance: { destructive: false, auto_apply: true },
      });
      expect(contracts.recommendation_governance.auto_apply).toBe(true);
    });
  });

  // APP-68: standards certification claims require evidence
  describe('APP-68 standards certification evidence requirement', () => {
    it.each(['pdfx_compliance_claimed', 'pdfa_compliance_claimed'])(
      'withdraws %s and requires review when no evidence is present (artifact_trust)',
      (field) => {
        const contracts = extractGovernanceContracts({ artifact_trust: { [field]: true } });
        expect(contracts.artifact_trust[field]).toBe(false);
        expect(contracts.artifact_trust.review_required).toBe(true);
      }
    );

    it('preserves a compliance claim when evidence is present', () => {
      const contracts = extractGovernanceContracts({
        artifact_trust: { pdfx_compliance_claimed: true, evidence: { pdfx: { tool: 'verapdf' } } },
      });
      expect(contracts.artifact_trust.pdfx_compliance_claimed).toBe(true);
      expect(contracts.artifact_trust.review_required).toBeUndefined();
    });

    it('applies the same evidence rule to standards_certification_governance', () => {
      const contracts = extractGovernanceContracts({
        standards_certification_governance: { pdfa_compliance_claimed: true },
      });
      expect(contracts.standards_certification_governance.pdfa_compliance_claimed).toBe(false);
      expect(contracts.standards_certification_governance.review_required).toBe(true);
    });
  });

  // APP-66: production package readiness gating
  describe('APP-66 production package readiness gating', () => {
    it('marks the package not-ready and lists the blocking domain when another domain requires review', () => {
      const contracts = extractGovernanceContracts({
        ink_governance: { tac_violation_remaining: true },
        production_package_governance: { package_ready: true },
      });
      expect(contracts.production_package_governance.package_ready).toBe(false);
      expect(contracts.production_package_governance.blocked_by_governance_domains).toContain('ink_governance');
    });

    it('marks the package not-ready when artifact_trust withholds production certification', () => {
      const contracts = extractGovernanceContracts({
        artifact_trust: { production_certified: false },
        production_package_governance: { package_ready: true },
      });
      expect(contracts.production_package_governance.package_ready).toBe(false);
      expect(contracts.production_package_governance.blocked_by_governance_domains).toContain('artifact_trust');
    });

    it('marks the package not-ready when payment is required but not satisfied', () => {
      const contracts = extractGovernanceContracts({
        production_package_governance: { package_ready: true, payment_required: true, payment_satisfied: false },
      });
      expect(contracts.production_package_governance.package_ready).toBe(false);
      expect(contracts.production_package_governance.blocked_by_governance_domains).toContain('payment');
    });

    it('leaves the package ready when no governance domain blocks it', () => {
      const contracts = extractGovernanceContracts({
        production_package_governance: { package_ready: true },
      });
      expect(contracts.production_package_governance.package_ready).toBe(true);
    });
  });
});
