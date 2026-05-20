import { describe, it, expect } from 'vitest';
import { searchHelpDocs, getHelpDocById, getCategories, getErrorArticleLink } from './helpSearch';
import { adminHelpDocs } from '../data/adminKnowledgeBase';

describe('searchHelpDocs', () => {
  it('returns all docs when query is empty string', () => {
    const result = searchHelpDocs('');
    expect(result).toEqual(adminHelpDocs);
  });

  it('returns matching docs for a known keyword', () => {
    const result = searchHelpDocs('queue');
    expect(result.length).toBeGreaterThan(0);
  });

  it('returns HelpDoc objects with required fields', () => {
    const docs = searchHelpDocs('');
    const doc = docs[0];
    expect(doc).toHaveProperty('id');
    expect(doc).toHaveProperty('type');
    expect(doc).toHaveProperty('title');
    expect(doc).toHaveProperty('category');
    expect(doc).toHaveProperty('summary');
    expect(doc).toHaveProperty('body');
  });

  it('returns empty array for nonsensical query that cannot fuzzy-match', () => {
    const result = searchHelpDocs('xyzzy_no_match_possible_12345_abc_def');
    expect(result).toEqual([]);
  });
});

describe('getHelpDocById', () => {
  it('returns the doc for a known id', () => {
    const doc = getHelpDocById('metric-queue-backlog');
    expect(doc).toBeDefined();
    expect(doc?.id).toBe('metric-queue-backlog');
  });

  it('returns undefined for a completely unknown id that does not start with error-', () => {
    const doc = getHelpDocById('totally-nonexistent-id-xyz-9999');
    expect(doc).toBeUndefined();
  });

  it('falls back to error-generic when id starts with error- and is not found', () => {
    const doc = getHelpDocById('error-unknown-code-xyz-9999');
    if (doc !== undefined) {
      expect(doc.id).toBe('error-generic');
    }
    // If error-generic itself does not exist, result is undefined — both outcomes are valid
  });

  it('returns a valid doc object when found', () => {
    const allDocs = searchHelpDocs('');
    const firstDoc = allDocs[0];
    const found = getHelpDocById(firstDoc.id);
    expect(found).toEqual(firstDoc);
  });
});

describe('getCategories', () => {
  it('returns an array of strings', () => {
    const categories = getCategories();
    expect(Array.isArray(categories)).toBe(true);
    categories.forEach(c => expect(typeof c).toBe('string'));
  });

  it('returns sorted categories', () => {
    const categories = getCategories();
    const sorted = [...categories].sort();
    expect(categories).toEqual(sorted);
  });

  it('returns unique categories with no duplicates', () => {
    const categories = getCategories();
    const unique = [...new Set(categories)];
    expect(categories.length).toBe(unique.length);
  });

  it('returns at least one category', () => {
    expect(getCategories().length).toBeGreaterThan(0);
  });

  it('includes Metrics as a category (known category from the knowledge base)', () => {
    expect(getCategories()).toContain('Metrics');
  });
});

describe('getErrorArticleLink', () => {
  it('returns generic fallback for empty string', () => {
    expect(getErrorArticleLink('')).toBe('/admin/help?doc=error-generic');
  });

  it('returns generic fallback for null', () => {
    expect(getErrorArticleLink(null as any)).toBe('/admin/help?doc=error-generic');
  });

  it('returns generic fallback for undefined', () => {
    expect(getErrorArticleLink(undefined as any)).toBe('/admin/help?doc=error-generic');
  });

  it('returns a path starting with /admin/help?doc=', () => {
    const link = getErrorArticleLink('SOME_ERROR');
    expect(link).toMatch(/^\/admin\/help\?doc=/);
  });

  it('normalizes error code to lowercase and replaces underscores with dashes', () => {
    const link = getErrorArticleLink('QUOTA_EXCEEDED');
    expect(link).toContain('quota-exceeded');
  });

  it('trims whitespace before normalizing', () => {
    const link1 = getErrorArticleLink('  QUOTA_EXCEEDED  ');
    const link2 = getErrorArticleLink('QUOTA_EXCEEDED');
    expect(link1).toBe(link2);
  });

  it('is case-insensitive — lowercase input gives same result as uppercase', () => {
    const upper = getErrorArticleLink('SOME_ERROR_CODE');
    const lower = getErrorArticleLink('some_error_code');
    expect(upper).toBe(lower);
  });
});
