import { describe, it, expect } from 'vitest';
import { diffPreflight } from './diffPreflight';
import type { PreflightResult, Issue } from '../types';

function makeResult(overrides: Partial<PreflightResult> = {}): PreflightResult {
  return {
    score: 80,
    summary: '',
    issues: [],
    pages: [],
    categorySummaries: [],
    meta: {},
    ...overrides,
  } as PreflightResult;
}

function makeIssue(overrides: Partial<Issue> = {}): Issue {
  return {
    id: 'issue-1',
    severity: 'error',
    category: 'color',
    message: 'Some issue',
    page: 1,
    ...overrides,
  };
}

describe('diffPreflight — scoreDelta', () => {
  it('returns 0 when scores are equal', () => {
    const before = makeResult({ score: 75 });
    const after = makeResult({ score: 75 });
    expect(diffPreflight(before, after).scoreDelta).toBe(0);
  });

  it('returns positive delta when after score is higher', () => {
    const before = makeResult({ score: 60 });
    const after = makeResult({ score: 85 });
    expect(diffPreflight(before, after).scoreDelta).toBe(25);
  });

  it('returns negative delta when after score is lower', () => {
    const before = makeResult({ score: 90 });
    const after = makeResult({ score: 70 });
    expect(diffPreflight(before, after).scoreDelta).toBe(-20);
  });

  it('handles undefined scores as 0', () => {
    const before = makeResult({ score: undefined as any });
    const after = makeResult({ score: 50 });
    expect(diffPreflight(before, after).scoreDelta).toBe(50);
  });
});

describe('diffPreflight — severityCounts', () => {
  it('counts issues correctly for before and after', () => {
    const before = makeResult({
      issues: [
        makeIssue({ id: 'a', severity: 'error' }),
        makeIssue({ id: 'b', severity: 'warning' }),
        makeIssue({ id: 'c', severity: 'info' }),
      ],
    });
    const after = makeResult({ issues: [] });
    const { severityCounts } = diffPreflight(before, after);
    expect(severityCounts.before).toEqual({ error: 1, warning: 1, info: 1 });
    expect(severityCounts.after).toEqual({ error: 0, warning: 0, info: 0 });
    expect(severityCounts.delta).toEqual({ error: -1, warning: -1, info: -1 });
  });

  it('handles null issues array gracefully', () => {
    const before = makeResult({ issues: null as any });
    const after = makeResult({ issues: null as any });
    const { severityCounts } = diffPreflight(before, after);
    expect(severityCounts.before).toEqual({ error: 0, warning: 0, info: 0 });
  });
});

describe('diffPreflight — issueChanges', () => {
  it('marks an issue as fixed when it disappears after fix', () => {
    const issue = makeIssue({ id: 'x', message: 'Missing bleed' });
    const before = makeResult({ issues: [issue] });
    const after = makeResult({ issues: [] });
    const { issueChanges } = diffPreflight(before, after);
    expect(issueChanges.fixedIssues).toHaveLength(1);
    expect(issueChanges.remainingIssues).toHaveLength(0);
    expect(issueChanges.newIssues).toHaveLength(0);
  });

  it('marks an issue as remaining when it persists', () => {
    const issue = makeIssue({ id: 'x', message: 'Missing bleed' });
    const before = makeResult({ issues: [issue] });
    const after = makeResult({ issues: [{ ...issue }] });
    const { issueChanges } = diffPreflight(before, after);
    expect(issueChanges.fixedIssues).toHaveLength(0);
    expect(issueChanges.remainingIssues).toHaveLength(1);
  });

  it('marks an issue as new when it appears after fix', () => {
    const before = makeResult({ issues: [] });
    const newIssue = makeIssue({ id: 'new-1', message: 'New problem found' });
    const after = makeResult({ issues: [newIssue] });
    const { issueChanges } = diffPreflight(before, after);
    expect(issueChanges.newIssues).toHaveLength(1);
    expect(issueChanges.fixedIssues).toHaveLength(0);
  });

  it('handles duplicate issues using multiset buckets', () => {
    const issue = makeIssue({ id: 'dup', message: 'Same issue', page: 1 });
    const before = makeResult({ issues: [issue, { ...issue }] });
    const after = makeResult({ issues: [{ ...issue }] });
    const { issueChanges } = diffPreflight(before, after);
    expect(issueChanges.fixedIssues).toHaveLength(1);
    expect(issueChanges.remainingIssues).toHaveLength(1);
  });

  it('normalizes NBSP in fingerprint comparison', () => {
    const before = makeResult({
      issues: [makeIssue({ id: 'a', message: 'Hello world' })],
    });
    const after = makeResult({
      issues: [makeIssue({ id: 'a', message: 'Hello world' })],
    });
    const { issueChanges } = diffPreflight(before, after);
    expect(issueChanges.remainingIssues).toHaveLength(1);
    expect(issueChanges.fixedIssues).toHaveLength(0);
  });
});

describe('diffPreflight — categoryDeltas', () => {
  it('identifies improved categories', () => {
    const before = makeResult({
      categorySummaries: [{ category: 'color' as any, errors: 2, warnings: 0, info: 0 }],
    });
    const after = makeResult({
      categorySummaries: [{ category: 'color' as any, errors: 0, warnings: 0, info: 0 }],
    });
    const { categoryDeltas } = diffPreflight(before, after);
    expect(categoryDeltas.improvedCategories).toHaveLength(1);
    expect(categoryDeltas.improvedCategories[0].category).toBe('color');
    expect(categoryDeltas.improvedCategories[0].delta).toBe(-2);
  });

  it('identifies worsened categories', () => {
    const before = makeResult({
      categorySummaries: [{ category: 'fonts' as any, errors: 0, warnings: 0, info: 0 }],
    });
    const after = makeResult({
      categorySummaries: [{ category: 'fonts' as any, errors: 3, warnings: 0, info: 0 }],
    });
    const { categoryDeltas } = diffPreflight(before, after);
    expect(categoryDeltas.worsenedCategories).toHaveLength(1);
    expect(categoryDeltas.worsenedCategories[0].delta).toBe(3);
  });

  it('returns empty arrays when there are no category changes', () => {
    const before = makeResult({ categorySummaries: [] });
    const after = makeResult({ categorySummaries: [] });
    const { categoryDeltas } = diffPreflight(before, after);
    expect(categoryDeltas.improvedCategories).toHaveLength(0);
    expect(categoryDeltas.worsenedCategories).toHaveLength(0);
  });
});

describe('diffPreflight — empty inputs', () => {
  it('handles both empty results without throwing', () => {
    const before = makeResult();
    const after = makeResult();
    expect(() => diffPreflight(before, after)).not.toThrow();
  });
});
