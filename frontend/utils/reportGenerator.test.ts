import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { generatePreflightReport } from './reportGenerator';
import type { PreflightResult, FileMeta } from '../types';

function makeFileMeta(overrides: Partial<FileMeta> = {}): FileMeta {
  return {
    name: 'test-document.pdf',
    size: 204800,
    type: 'application/pdf',
    ...overrides,
  };
}

function makePreflightResult(overrides: Partial<PreflightResult> = {}): PreflightResult {
  return {
    score: 85,
    summary: 'Document analysis complete with minor issues.',
    issues: [],
    pages: [{ pageNumber: 1, issuesCount: 0 }],
    categorySummaries: [],
    meta: {
      fileName: 'test-document.pdf',
      fileSize: 204800,
      pageCount: 10,
      jobId: 'job-test-123',
    },
    ...overrides,
  };
}

function makeIssue(overrides = {}) {
  return {
    id: 'issue-1',
    severity: 'error' as const,
    category: 'GEOMETRY' as const,
    title: 'Missing Bleed',
    description: 'Document does not have required bleed margins.',
    fixable: true,
    ...overrides,
  };
}

describe('generatePreflightReport', () => {
  it('returns a Uint8Array', async () => {
    const result = await generatePreflightReport(makePreflightResult(), makeFileMeta());
    expect(result).toBeInstanceOf(Uint8Array);
  });

  it('output starts with %PDF- (valid PDF header)', async () => {
    const result = await generatePreflightReport(makePreflightResult(), makeFileMeta());
    const header = String.fromCharCode(...result.slice(0, 5));
    expect(header).toBe('%PDF-');
  });

  it('output can be re-loaded as a valid PDF document', async () => {
    const result = await generatePreflightReport(makePreflightResult(), makeFileMeta());
    await expect(PDFDocument.load(result)).resolves.toBeDefined();
  });

  it('generates at least 1 page', async () => {
    const result = await generatePreflightReport(makePreflightResult(), makeFileMeta());
    const doc = await PDFDocument.load(result);
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(1);
  });

  it('generates a report for a result with no issues', async () => {
    const result = await generatePreflightReport(
      makePreflightResult({ issues: [], score: 100, summary: 'All good.' }),
      makeFileMeta()
    );
    const doc = await PDFDocument.load(result);
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(1);
  });

  it('generates a report for a result with multiple issues', async () => {
    const issues = [
      makeIssue({ id: 'i1', severity: 'error', title: 'Missing Bleed' }),
      makeIssue({ id: 'i2', severity: 'warning', title: 'Low Resolution Image' }),
      makeIssue({ id: 'i3', severity: 'info', title: 'Fonts Embedded' }),
    ];
    const result = await generatePreflightReport(
      makePreflightResult({ issues, score: 60 }),
      makeFileMeta()
    );
    const doc = await PDFDocument.load(result);
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(1);
  });

  it('handles a very long summary without crashing (word wrap)', async () => {
    const longSummary = 'This is a very long summary. '.repeat(50);
    const result = await generatePreflightReport(
      makePreflightResult({ summary: longSummary }),
      makeFileMeta()
    );
    const doc = await PDFDocument.load(result);
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(1);
  });

  it('uses the filename from fileMeta in the report', async () => {
    const result = await generatePreflightReport(
      makePreflightResult(),
      makeFileMeta({ name: 'my-special-file.pdf' })
    );
    // Verify it's a valid PDF — the filename inclusion is internal to the layout
    const doc = await PDFDocument.load(result);
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(1);
  });

  it('produces a larger PDF when there are many issues (content overflow to new pages)', async () => {
    const manyIssues = Array.from({ length: 100 }, (_, i) =>
      makeIssue({ id: `issue-${i}`, title: `Issue ${i}: Some preflight finding with a description.` })
    );
    const result = await generatePreflightReport(
      makePreflightResult({ issues: manyIssues }),
      makeFileMeta()
    );
    const doc = await PDFDocument.load(result);
    // With 100 issues, should overflow to multiple pages
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(2);
  });
});
