import { describe, it, expect } from 'vitest';
import { validateGeometry } from './geometry';
import type { GeometryInput } from './geometry';

function makeInput(overrides: Partial<GeometryInput> = {}): GeometryInput {
  return {
    pageCount: 60,
    paperType: 'uncoated',
    paperGsm: 80,
    trimWidthMm: 148,
    trimHeightMm: 210,
    bleedMm: 3,
    pdfPageSizes: [],
    ...overrides,
  };
}

// For these tests: pageCount=60, uncoated 80gsm → expectedSpine = 30 * 0.10 = 3.0mm
// spread threshold = 148 * 2 = 296
// spread page widths use exact binary fractions to avoid floating-point issues

describe('validateGeometry — cover type detection', () => {
  it('returns unknown when pdfPageSizes is empty', () => {
    const result = validateGeometry(makeInput());
    expect(result.coverType).toBe('unknown');
  });

  it('detects single_page when first page width matches trimWidthMm exactly', () => {
    const result = validateGeometry(makeInput({
      pdfPageSizes: [{ widthMm: 148, heightMm: 210 }],
    }));
    expect(result.coverType).toBe('single_page');
  });

  it('detects single_page when width is within 4mm below trim', () => {
    const result = validateGeometry(makeInput({
      pdfPageSizes: [{ widthMm: 144, heightMm: 210 }], // |144-148|=4 < 5
    }));
    expect(result.coverType).toBe('single_page');
  });

  it('detects single_page when width is within 4mm above trim', () => {
    const result = validateGeometry(makeInput({
      pdfPageSizes: [{ widthMm: 152, heightMm: 210 }], // |152-148|=4 < 5
    }));
    expect(result.coverType).toBe('single_page');
  });

  it('does NOT match single_page at exactly 5mm above trim', () => {
    // |153-148|=5 — not strictly less than 5
    const result = validateGeometry(makeInput({
      pdfPageSizes: [{ widthMm: 153, heightMm: 210 }],
    }));
    expect(result.coverType).not.toBe('single_page');
  });

  it('detects spread_cover when width > 2*trimWidthMm', () => {
    // 296 + 3.0 = 299 > 296
    const result = validateGeometry(makeInput({
      pdfPageSizes: [{ widthMm: 299, heightMm: 210 }],
    }));
    expect(result.coverType).toBe('spread_cover');
  });

  it('computes detectedSpineMm as width minus 2*trimWidthMm', () => {
    // detectedSpine = 299 - 296 = 3.0
    const result = validateGeometry(makeInput({
      pdfPageSizes: [{ widthMm: 299, heightMm: 210 }],
    }));
    expect(result.detectedSpineMm).toBe(3);
  });

  it('only considers the first page size', () => {
    const result = validateGeometry(makeInput({
      pdfPageSizes: [
        { widthMm: 148, heightMm: 210 }, // single_page
        { widthMm: 500, heightMm: 210 }, // would be spread
      ],
    }));
    expect(result.coverType).toBe('single_page');
  });
});

describe('validateGeometry — spine thickness by paper type and gsm', () => {
  // expectedSpine = (pageCount / 2) * thickness

  it('uses 0.10mm/sheet for uncoated 80gsm', () => {
    // 60 pages → 30 sheets × 0.10 = 3.0mm
    const result = validateGeometry(makeInput({ paperType: 'uncoated', paperGsm: 80 }));
    expect(result.expectedSpineMm).toBe(3.0);
  });

  it('uses 0.11mm/sheet for uncoated 90gsm', () => {
    // 60 pages → 30 sheets × 0.11 = 3.3mm
    const result = validateGeometry(makeInput({ paperType: 'uncoated', paperGsm: 90 }));
    expect(result.expectedSpineMm).toBeCloseTo(3.3, 2);
  });

  it('uses default 0.105mm/sheet for uncoated unknown gsm', () => {
    // 60 pages → 30 sheets × 0.105 = 3.15mm
    const result = validateGeometry(makeInput({ paperType: 'uncoated', paperGsm: 120 }));
    expect(result.expectedSpineMm).toBeCloseTo(3.15, 2);
  });

  it('uses 0.09mm/sheet for coated 115gsm', () => {
    // 60 pages → 30 sheets × 0.09 = 2.7mm
    const result = validateGeometry(makeInput({ paperType: 'coated', paperGsm: 115 }));
    expect(result.expectedSpineMm).toBeCloseTo(2.7, 2);
  });

  it('uses 0.10mm/sheet for coated 130gsm', () => {
    const result = validateGeometry(makeInput({ paperType: 'coated', paperGsm: 130 }));
    expect(result.expectedSpineMm).toBe(3.0);
  });

  it('uses 0.11mm/sheet for coated 150gsm', () => {
    const result = validateGeometry(makeInput({ paperType: 'coated', paperGsm: 150 }));
    expect(result.expectedSpineMm).toBeCloseTo(3.3, 2);
  });

  it('uses default 0.10mm/sheet for coated with unknown gsm', () => {
    const result = validateGeometry(makeInput({ paperType: 'coated', paperGsm: 200 }));
    expect(result.expectedSpineMm).toBe(3.0);
  });

  it('scales linearly with page count', () => {
    // 120 pages, uncoated 80gsm → 60 * 0.10 = 6.0mm
    const result = validateGeometry(makeInput({ pageCount: 120, paperGsm: 80 }));
    expect(result.expectedSpineMm).toBe(6.0);
  });
});

describe('validateGeometry — GREEN classification', () => {
  // Base: 60 pages, uncoated 80gsm → expectedSpine = 3.0mm

  it('classifies GREEN for unknown cover (no spine measurement)', () => {
    const result = validateGeometry(makeInput({ pdfPageSizes: [] }));
    expect(result.classification).toBe('GREEN');
    expect(result.deviationMm).toBe(0);
  });

  it('classifies GREEN for single_page cover (no spine measurement)', () => {
    const result = validateGeometry(makeInput({
      pdfPageSizes: [{ widthMm: 148, heightMm: 210 }],
    }));
    expect(result.coverType).toBe('single_page');
    expect(result.classification).toBe('GREEN');
    expect(result.deviationMm).toBe(0);
  });

  it('classifies GREEN when detected spine matches expected exactly', () => {
    // detectedSpine = 3.0 = expectedSpine, deviation = 0
    const result = validateGeometry(makeInput({
      pdfPageSizes: [{ widthMm: 299, heightMm: 210 }], // 299 - 296 = 3.0
    }));
    expect(result.classification).toBe('GREEN');
    expect(result.deviationMm).toBe(0);
  });

  it('classifies GREEN when deviation is 0.25mm (well within threshold)', () => {
    // detectedSpine = 3.0 + 0.25 = 3.25 → widthMm = 296 + 3.25 = 299.25 (exact: 1197/4)
    const result = validateGeometry(makeInput({
      pdfPageSizes: [{ widthMm: 299.25, heightMm: 210 }],
    }));
    expect(result.classification).toBe('GREEN');
    expect(result.deviationMm).toBe(0.25);
  });
});

describe('validateGeometry — ATTENTION classification', () => {
  it('classifies ATTENTION when deviation is 0.5mm', () => {
    // detectedSpine = 3.5 → widthMm = 299.5 (exact: 599/2)
    const result = validateGeometry(makeInput({
      pdfPageSizes: [{ widthMm: 299.5, heightMm: 210 }],
    }));
    expect(result.classification).toBe('ATTENTION');
    expect(result.deviationMm).toBe(0.5);
  });

  it('classifies ATTENTION when deviation is 0.75mm', () => {
    // detectedSpine = 3.75 → widthMm = 299.75 (exact: 1199/4)
    const result = validateGeometry(makeInput({
      pdfPageSizes: [{ widthMm: 299.75, heightMm: 210 }],
    }));
    expect(result.classification).toBe('ATTENTION');
    expect(result.deviationMm).toBe(0.75);
  });

  it('handles undersized spine (negative direction) as ATTENTION', () => {
    // detectedSpine = 3.0 - 0.5 = 2.5 → widthMm = 298.5
    const result = validateGeometry(makeInput({
      pdfPageSizes: [{ widthMm: 298.5, heightMm: 210 }],
    }));
    expect(result.classification).toBe('ATTENTION');
    expect(result.deviationMm).toBe(0.5);
  });
});

describe('validateGeometry — BLOCKING classification', () => {
  it('classifies BLOCKING when deviation is 1.0mm', () => {
    // detectedSpine = 4.0 → widthMm = 300 (exact)
    const result = validateGeometry(makeInput({
      pdfPageSizes: [{ widthMm: 300, heightMm: 210 }],
    }));
    expect(result.classification).toBe('BLOCKING');
    expect(result.deviationMm).toBe(1);
  });

  it('classifies BLOCKING when deviation is 2.0mm (large error)', () => {
    const result = validateGeometry(makeInput({
      pdfPageSizes: [{ widthMm: 301, heightMm: 210 }], // 301 - 296 = 5.0 spine, deviation=2.0
    }));
    expect(result.classification).toBe('BLOCKING');
  });
});

describe('validateGeometry — return shape', () => {
  it('always returns all expected fields', () => {
    const result = validateGeometry(makeInput());
    expect(result).toHaveProperty('coverType');
    expect(result).toHaveProperty('expectedSpineMm');
    expect(result).toHaveProperty('detectedSpineMm');
    expect(result).toHaveProperty('deviationMm');
    expect(result).toHaveProperty('classification');
  });

  it('expectedSpineMm is rounded to 2 decimal places', () => {
    // 60 pages, uncoated 90gsm → 30 * 0.11 = 3.3000...0002 (float)
    // .toFixed(2) → 3.3
    const result = validateGeometry(makeInput({ paperType: 'uncoated', paperGsm: 90 }));
    expect(String(result.expectedSpineMm)).toMatch(/^\d+(\.\d{1,2})?$/);
  });

  it('detectedSpineMm is 0 for non-spread covers', () => {
    const result = validateGeometry(makeInput({ pdfPageSizes: [] }));
    expect(result.detectedSpineMm).toBe(0);
  });
});
