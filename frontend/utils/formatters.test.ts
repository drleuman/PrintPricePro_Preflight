import { describe, it, expect } from 'vitest';
import { formatLabel, humanize, normalizeDownloadFilename } from './formatters';

describe('formatLabel', () => {
  it('converts snake_case to Title Case', () => {
    expect(formatLabel('hello_world')).toBe('Hello World');
    expect(formatLabel('some_long_label')).toBe('Some Long Label');
  });

  it('handles a single word', () => {
    expect(formatLabel('hello')).toBe('Hello');
  });

  it('handles strings with " / " separator', () => {
    expect(formatLabel('foo_bar / baz_qux')).toBe('Foo Bar / Baz Qux');
  });

  it('handles strings with ": " separator', () => {
    expect(formatLabel('some_key: some_value')).toBe('Some Key: Some Value');
  });

  it('returns empty string for null', () => {
    expect(formatLabel(null)).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(formatLabel(undefined)).toBe('');
  });

  it('returns empty string for empty string', () => {
    expect(formatLabel('')).toBe('');
  });

  it('collapses multiple underscores (filters empty words)', () => {
    expect(formatLabel('a__b')).toBe('A B');
  });
});

describe('humanize', () => {
  it('is an alias for formatLabel', () => {
    expect(humanize('hello_world')).toBe(formatLabel('hello_world'));
    expect(humanize(null)).toBe(formatLabel(null));
  });
});

describe('normalizeDownloadFilename', () => {
  it('appends -certified.pdf for pdf type', () => {
    expect(normalizeDownloadFilename('document.pdf', 'pdf')).toBe('document-certified.pdf');
  });

  it('appends -report.json for report type', () => {
    expect(normalizeDownloadFilename('document.pdf', 'report')).toBe('document-report.json');
  });

  it('removes the file extension before appending suffix', () => {
    expect(normalizeDownloadFilename('my_file.pdf', 'pdf')).toBe('my_file-certified.pdf');
  });

  it('replaces spaces with underscores', () => {
    expect(normalizeDownloadFilename('my document.pdf', 'pdf')).toBe('my_document-certified.pdf');
  });

  it('removes special characters except . _ -', () => {
    expect(normalizeDownloadFilename('file@name!.pdf', 'pdf')).toBe('filename-certified.pdf');
  });

  it('replaces slashes with underscores', () => {
    expect(normalizeDownloadFilename('path/to/file.pdf', 'pdf')).toBe('path_to_file-certified.pdf');
  });

  it('uses "document" as fallback for null', () => {
    expect(normalizeDownloadFilename(null, 'pdf')).toBe('document-certified.pdf');
  });

  it('uses "document" as fallback for undefined', () => {
    expect(normalizeDownloadFilename(undefined, 'pdf')).toBe('document-certified.pdf');
  });

  it('handles filename with no extension', () => {
    expect(normalizeDownloadFilename('myfile', 'report')).toBe('myfile-report.json');
  });
});
