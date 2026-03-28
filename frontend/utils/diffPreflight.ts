import type { PreflightResult, Issue } from '../types';

export interface DiffResult {
  scoreDelta: number;
  severityCounts: {
    before: { error: number; warning: number; info: number };
    after: { error: number; warning: number; info: number };
    delta: { error: number; warning: number; info: number };
  };
  categoryDeltas: {
    improvedCategories: Array<{ category: string; delta: number }>;
    worsenedCategories: Array<{ category: string; delta: number }>;
  };
  issueChanges: {
    fixedIssues: Issue[];
    remainingIssues: Issue[];
    newIssues: Issue[];
  };
}

function normalizeMessage(msg: string): string {
  return (msg ?? '')
    .toLowerCase()
    .trim()
    .replace(/\u00a0/g, ' ')      // NBSP -> space
    .replace(/\s+/g, ' ');        // collapse whitespace
}

function createIssueFingerprint(issue: Issue): string {
  if (!issue) return 'null';
  const category = issue.category || 'other';
  const severity = issue.severity;
  const page = issue.page;
  const message = normalizeMessage(issue.message || '');
  const details = issue.details ? normalizeMessage(issue.details) : '';

  const tags = (issue.tags ?? [])
    .map(normalizeMessage)
    .sort()
    .join(',');

  return `${category}|${severity}|${page}|${message}${details ? '|' + details : ''}${tags ? '|' + tags : ''}`;
}

function countIssuesBySeverity(issues: Issue[]): { error: number; warning: number; info: number } {
  const counts = { error: 0, warning: 0, info: 0 };
  for (const issue of issues ?? []) {
    if (!issue) continue;
    if (issue.severity === 'error') counts.error++;
    else if (issue.severity === 'warning') counts.warning++;
    else counts.info++;
  }
  return counts;
}

/**
 * Build a multiset-like map: fp -> Issue[]
 * This prevents losing duplicates when multiple issues share same fp.
 */
function buildFingerprintBuckets(issues: Issue[]): Map<string, Issue[]> {
  const map = new Map<string, Issue[]>();
  for (const issue of issues ?? []) {
    const fp = createIssueFingerprint(issue);
    const arr = map.get(fp);
    if (arr) arr.push(issue);
    else map.set(fp, [issue]);
  }
  return map;
}

/**
 * Consume one element from a bucket (fp -> Issue[]), returns Issue or null.
 */
function takeOne(map: Map<string, Issue[]>, fp: string): Issue | null {
  const bucket = map.get(fp);
  if (!bucket || bucket.length === 0) return null;
  const issue = bucket.pop() ?? null;
  if (bucket.length === 0) map.delete(fp);
  return issue;
}

function sortIssues(issues: Issue[]): Issue[] {
  return (issues ?? [])
    .filter(Boolean)
    .slice()
    .sort((a, b) => {
      if (a.page !== b.page) return (a.page || 0) - (b.page || 0);
      const severityOrder = { error: 0, warning: 1, info: 2 } as const;
      const aSev = severityOrder[a.severity as keyof typeof severityOrder] ?? 99;
      const bSev = severityOrder[b.severity as keyof typeof severityOrder] ?? 99;
      if (aSev !== bSev) return aSev - bSev;
      if (a.category !== b.category) return (a.category || '').localeCompare(b.category || '');
      return (a.message || '').localeCompare(b.message || '');
    });
}

export function diffPreflight(before: PreflightResult, after: PreflightResult): DiffResult {
  // Score delta
  const scoreDelta = (after?.score ?? 0) - (before?.score ?? 0);

  // Severity counts (source of truth: issues)
  const beforeCounts = countIssuesBySeverity(before?.issues ?? []);
  const afterCounts = countIssuesBySeverity(after?.issues ?? []);
  const severityDelta = {
    error: afterCounts.error - beforeCounts.error,
    warning: afterCounts.warning - beforeCounts.warning,
    info: afterCounts.info - beforeCounts.info,
  };

  // Category deltas (use categorySummaries as you already do)
  const beforeMap = new Map<string, { total: number }>();
  const afterMap = new Map<string, { total: number }>();

  for (const cat of before?.categorySummaries || []) {
    const errors = cat.errors || 0;
    const warnings = cat.warnings || 0;
    const info = cat.info || 0;
    beforeMap.set(cat.category, { total: errors + warnings + info });
  }

  for (const cat of after?.categorySummaries || []) {
    const errors = cat.errors || 0;
    const warnings = cat.warnings || 0;
    const info = cat.info || 0;
    afterMap.set(cat.category, { total: errors + warnings + info });
  }

  const allCategories = new Set([...beforeMap.keys(), ...afterMap.keys()]);

  const improvedCategories: Array<{ category: string; delta: number }> = [];
  const worsenedCategories: Array<{ category: string; delta: number }> = [];

  for (const cat of allCategories) {
    const b = beforeMap.get(cat)?.total || 0;
    const a = afterMap.get(cat)?.total || 0;
    const delta = a - b;
    if (delta < 0) improvedCategories.push({ category: cat, delta });
    else if (delta > 0) worsenedCategories.push({ category: cat, delta });
  }

  improvedCategories.sort((a, b) => a.delta - b.delta); // more negative first
  worsenedCategories.sort((a, b) => b.delta - a.delta); // more positive first

  // Issue changes using multiset buckets (prevents duplicate loss)
  const beforeBuckets = buildFingerprintBuckets(before?.issues ?? []);
  const afterBuckets = buildFingerprintBuckets(after?.issues ?? []);

  const fixedIssues: Issue[] = [];
  const remainingIssues: Issue[] = [];
  const newIssues: Issue[] = [];

  // Remaining + Fixed:
  // For each fingerprint in BEFORE, try to match with AFTER bucket.
  for (const [fp, beforeList] of beforeBuckets.entries()) {
    // We'll iterate through all issues in the bucket.
    // We must be careful: we're going to consume from afterBuckets as matches are found.
    for (const issue of beforeList) {
      const matched = takeOne(afterBuckets, fp);
      if (matched) {
        // Keep the AFTER issue as "remaining" (current state)
        remainingIssues.push(matched);
      } else {
        fixedIssues.push(issue);
      }
    }
  }

  // Whatever remains in AFTER buckets is "new"
  for (const [, afterList] of afterBuckets.entries()) {
    for (const issue of afterList) newIssues.push(issue);
  }

  return {
    scoreDelta,
    severityCounts: {
      before: beforeCounts,
      after: afterCounts,
      delta: severityDelta,
    },
    categoryDeltas: {
      improvedCategories,
      worsenedCategories,
    },
    issueChanges: {
      fixedIssues: sortIssues(fixedIssues),
      remainingIssues: sortIssues(remainingIssues),
      newIssues: sortIssues(newIssues),
    },
  };
}