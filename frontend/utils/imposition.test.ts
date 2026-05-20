import { describe, it, expect } from 'vitest';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { createBooklet } from './imposition';

async function makeMinimalPdf(pageCount: number): Promise<ArrayBuffer> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 0; i < pageCount; i++) {
    const page = doc.addPage();
    // Pages must have content to be embeddable via embedPages()
    page.drawText(`Page ${i + 1}`, { x: 50, y: 50, size: 12, font });
  }
  const bytes = await doc.save();
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

async function loadOutputPdf(result: Uint8Array): Promise<PDFDocument> {
  return PDFDocument.load(result);
}

describe('createBooklet', () => {
  it('returns a Uint8Array', async () => {
    const pdf = await makeMinimalPdf(4);
    const result = await createBooklet(pdf);
    expect(result).toBeInstanceOf(Uint8Array);
  });

  it('output starts with %PDF- (valid PDF header)', async () => {
    const pdf = await makeMinimalPdf(4);
    const result = await createBooklet(pdf);
    const header = String.fromCharCode(...result.slice(0, 5));
    expect(header).toBe('%PDF-');
  });

  it('output can be re-loaded as a valid PDF document', async () => {
    const pdf = await makeMinimalPdf(4);
    const result = await createBooklet(pdf);
    await expect(loadOutputPdf(result)).resolves.toBeDefined();
  });

  it('produces 2 output pages for a 1-page input (padded to multiple of 4)', async () => {
    const pdf = await makeMinimalPdf(1);
    const result = await createBooklet(pdf);
    const outDoc = await loadOutputPdf(result);
    // 1 page → padded to 4 → sheetsCount = 4/2 = 2
    expect(outDoc.getPageCount()).toBe(2);
  });

  it('produces 2 output pages for a 4-page input', async () => {
    const pdf = await makeMinimalPdf(4);
    const result = await createBooklet(pdf);
    const outDoc = await loadOutputPdf(result);
    // 4 pages → sheetsCount = 4/2 = 2
    expect(outDoc.getPageCount()).toBe(2);
  });

  it('produces 4 output pages for an 8-page input', async () => {
    const pdf = await makeMinimalPdf(8);
    const result = await createBooklet(pdf);
    const outDoc = await loadOutputPdf(result);
    // 8 pages → sheetsCount = 8/2 = 4
    expect(outDoc.getPageCount()).toBe(4);
  });

  it('produces 4 output pages for a 5-page input (padded to 8)', async () => {
    const pdf = await makeMinimalPdf(5);
    const result = await createBooklet(pdf);
    const outDoc = await loadOutputPdf(result);
    // 5 pages → padded to 8 → sheetsCount = 8/2 = 4
    expect(outDoc.getPageCount()).toBe(4);
  });

  it('output pages are landscape (width > height)', async () => {
    const pdf = await makeMinimalPdf(4);
    const result = await createBooklet(pdf);
    const outDoc = await loadOutputPdf(result);
    const page = outDoc.getPage(0);
    const { width, height } = page.getSize();
    expect(width).toBeGreaterThan(height);
  });
});
