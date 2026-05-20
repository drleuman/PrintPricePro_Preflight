import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import os from 'os';

const require = createRequire(import.meta.url);
const { pdfUploadWafCheck, quarantineFile } = require('./pdfUploadWaf');

// ---------------------------------------------------------------------------
// Temporary file helpers
// ---------------------------------------------------------------------------
const TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'waf-test-'));

function writeTempFile(name, content) {
  const p = path.join(TMP_DIR, name);
  fs.writeFileSync(p, content);
  return p;
}

afterAll(() => {
  try { fs.rmSync(TMP_DIR, { recursive: true, force: true }); } catch {}
});

// Minimal valid PDF header (won't pass pdfinfo/qpdf but passes the heuristic checks)
const MIN_PDF_CONTENT = '%PDF-1.4\n1 0 obj\n<< >>\nendobj\n%%EOF\n';

// ---------------------------------------------------------------------------
// safeBasename (exported indirectly — test via pdfUploadWafCheck safeName)
// ---------------------------------------------------------------------------
describe('pdfUploadWafCheck — safeBasename (via safeName)', () => {
  it('replaces special characters with underscores', async () => {
    const fp = writeTempFile('valid_base.pdf', MIN_PDF_CONTENT);
    const result = await pdfUploadWafCheck({
      filePath: fp,
      originalName: 'my file@name!.pdf',
      config: { fastMode: true },
    });
    expect(result.safeName).toMatch(/^[a-zA-Z0-9._-]+$/);
    expect(result.safeName).not.toContain('@');
    expect(result.safeName).not.toContain('!');
  });

  it('truncates names longer than 120 characters', async () => {
    const fp = writeTempFile('long_name.pdf', MIN_PDF_CONTENT);
    const longName = 'a'.repeat(200) + '.pdf';
    const result = await pdfUploadWafCheck({
      filePath: fp,
      originalName: longName,
      config: { fastMode: true },
    });
    expect(result.safeName.length).toBeLessThanOrEqual(120);
  });
});

// ---------------------------------------------------------------------------
// pdfUploadWafCheck — size gate
// ---------------------------------------------------------------------------
describe('pdfUploadWafCheck — size gate', () => {
  it('returns ok: false with FILE_TOO_LARGE when file exceeds maxBytes', async () => {
    const fp = writeTempFile('large.pdf', MIN_PDF_CONTENT);
    const result = await pdfUploadWafCheck({
      filePath: fp,
      originalName: 'large.pdf',
      config: { maxBytes: 1 }, // 1 byte limit
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('FILE_TOO_LARGE');
    expect(result.severity).toBe('HIGH');
  });
});

// ---------------------------------------------------------------------------
// pdfUploadWafCheck — magic bytes gate
// ---------------------------------------------------------------------------
describe('pdfUploadWafCheck — magic bytes gate', () => {
  it('returns ok: false with NOT_A_PDF when file does not start with %PDF-', async () => {
    const fp = writeTempFile('notapdf.pdf', 'This is not a PDF file at all');
    const result = await pdfUploadWafCheck({
      filePath: fp,
      originalName: 'notapdf.pdf',
      config: {},
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('NOT_A_PDF');
    expect(result.severity).toBe('HIGH');
  });

  it('passes the magic bytes check for a file starting with %PDF-', async () => {
    const fp = writeTempFile('valid_magic.pdf', MIN_PDF_CONTENT);
    const result = await pdfUploadWafCheck({
      filePath: fp,
      originalName: 'valid.pdf',
      config: { fastMode: true }, // skip heavy tool checks
    });
    expect(result.reason).not.toBe('NOT_A_PDF');
  });
});

// ---------------------------------------------------------------------------
// pdfUploadWafCheck — dangerous token scan
// ---------------------------------------------------------------------------
describe('pdfUploadWafCheck — token scan', () => {
  it('returns ok: false with DANGEROUS_PDF_TOKENS when /JavaScript is found', async () => {
    const content = '%PDF-1.4\n/JavaScript (alert("xss"))\n%%EOF';
    const fp = writeTempFile('js_pdf.pdf', content);
    const result = await pdfUploadWafCheck({
      filePath: fp,
      originalName: 'dangerous.pdf',
      config: { rejectTokens: ['/JavaScript'] },
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('DANGEROUS_PDF_TOKENS');
    expect(result.detail).toContain('/JavaScript');
  });

  it('returns ok: false when /OpenAction is found and is in rejectTokens', async () => {
    const content = '%PDF-1.4\n/OpenAction << /Type /Action >>\n%%EOF';
    const fp = writeTempFile('openaction.pdf', content);
    const result = await pdfUploadWafCheck({
      filePath: fp,
      originalName: 'openaction.pdf',
      config: { rejectTokens: ['/OpenAction'] },
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('DANGEROUS_PDF_TOKENS');
  });

  it('passes when token exists in file but is NOT in rejectTokens config', async () => {
    const content = '%PDF-1.4\n/AcroForm << >>\n%%EOF';
    const fp = writeTempFile('acroform.pdf', content);
    // Only reject /JavaScript, not /AcroForm
    const result = await pdfUploadWafCheck({
      filePath: fp,
      originalName: 'acroform.pdf',
      config: { rejectTokens: ['/JavaScript'], fastMode: true },
    });
    expect(result.reason).not.toBe('DANGEROUS_PDF_TOKENS');
  });
});

// ---------------------------------------------------------------------------
// pdfUploadWafCheck — fastMode bypass
// ---------------------------------------------------------------------------
describe('pdfUploadWafCheck — fastMode', () => {
  it('returns ok: true in fastMode for a valid PDF skipping heavy tool checks', async () => {
    const fp = writeTempFile('fast_mode.pdf', MIN_PDF_CONTENT);
    const result = await pdfUploadWafCheck({
      filePath: fp,
      originalName: 'valid.pdf',
      config: { fastMode: true },
    });
    expect(result.ok).toBe(true);
    expect(result.meta?.fastMode).toBe(true);
  });

  it('includes sha256, safeName, and size in the result', async () => {
    const fp = writeTempFile('meta_check.pdf', MIN_PDF_CONTENT);
    const result = await pdfUploadWafCheck({
      filePath: fp,
      originalName: 'meta.pdf',
      config: { fastMode: true },
    });
    expect(result.sha256).toBeTruthy();
    expect(result.safeName).toBeTruthy();
    expect(result.size).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// pdfUploadWafCheck — PDF complexity (objects/streams heuristic)
// ---------------------------------------------------------------------------
describe('pdfUploadWafCheck — PDF complexity gate', () => {
  it('returns ok: false with PDF_COMPLEXITY_TOO_HIGH when objCount exceeds maxObjects', async () => {
    // Generate a fake PDF with many "obj" markers
    const objLines = Array.from({ length: 110 }, (_, i) => `${i + 1} 0 obj\n<< >>\nendobj`).join('\n');
    const content = `%PDF-1.4\n${objLines}\n%%EOF`;
    const fp = writeTempFile('complex.pdf', content);
    const result = await pdfUploadWafCheck({
      filePath: fp,
      originalName: 'complex.pdf',
      config: { maxObjects: 100, rejectTokens: [] },
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('PDF_COMPLEXITY_TOO_HIGH');
  });
});

// ---------------------------------------------------------------------------
// quarantineFile
// ---------------------------------------------------------------------------
describe('quarantineFile', () => {
  it('moves the file to the quarantine directory', () => {
    const src = writeTempFile('to_quarantine.pdf', '%PDF-1.4 quarantine test');
    const quarantineDir = path.join(TMP_DIR, 'quarantine');
    fs.mkdirSync(quarantineDir, { recursive: true });

    const dst = quarantineFile(src, quarantineDir, 'to_quarantine.pdf', 'abc123hash');

    expect(fs.existsSync(dst)).toBe(true);
    expect(fs.existsSync(src)).toBe(false);
    expect(dst).toContain(quarantineDir);
    expect(dst).toContain('abc123hash');
  });
});
