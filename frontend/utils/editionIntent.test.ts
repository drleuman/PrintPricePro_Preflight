import { describe, it, expect } from 'vitest';
import { inferEditionIntent, type EditionSignals } from './editionIntent';

function makeSignals(overrides: Partial<EditionSignals> = {}): EditionSignals {
  return {
    avgTac: 150,
    richBlackFrequency: 0,
    grayscalePercentage: 0,
    spotColorsCount: 0,
    hasLargeBackgrounds: false,
    hasConsistentBleed: false,
    hasMarks: false,
    isPageUniform: true,
    dominantDpi: 150,
    imageCompression: 'JPEG',
    photoCoverage: 0,
    hasSmallReversedText: false,
    hasHairlines: false,
    hasKnockoutBlackText: false,
    ...overrides,
  };
}

describe('inferEditionIntent — OFFSET classification', () => {
  it('classifies as OFFSET when marks + spotColors + highTac are present', () => {
    const signals = makeSignals({
      hasMarks: true,
      spotColorsCount: 2,
      avgTac: 250,
      richBlackFrequency: 0.5,
      dominantDpi: 300,
    });
    const result = inferEditionIntent(signals, 'coated');
    expect(result.intent).toBe('OFFSET');
    expect(result.offsetScore).toBeGreaterThan(result.digitalScore + 20);
  });

  it('includes offset recommendation for coated profile', () => {
    const signals = makeSignals({
      hasMarks: true,
      spotColorsCount: 1,
      avgTac: 230,
      richBlackFrequency: 0.4,
      dominantDpi: 300,
    });
    const result = inferEditionIntent(signals, 'coated');
    expect(result.recommendation).toContain('commercial printing');
  });

  it('warns about drying issues for uncoated profile', () => {
    const signals = makeSignals({
      hasMarks: true,
      spotColorsCount: 1,
      avgTac: 230,
      richBlackFrequency: 0.4,
      dominantDpi: 300,
    });
    const result = inferEditionIntent(signals, 'uncoated');
    expect(result.recommendation).toContain('drying issues');
  });
});

describe('inferEditionIntent — DIGITAL classification', () => {
  it('classifies as DIGITAL when mostly grayscale with no marks', () => {
    const signals = makeSignals({
      grayscalePercentage: 0.9,
      hasMarks: false,
      avgTac: 100,
      dominantDpi: 150,
    });
    const result = inferEditionIntent(signals, 'coated');
    expect(result.intent).toBe('DIGITAL');
    expect(result.digitalScore).toBeGreaterThan(result.offsetScore + 20);
  });

  it('warns about banding on coated paper for digital', () => {
    const signals = makeSignals({
      grayscalePercentage: 0.9,
      hasMarks: false,
      dominantDpi: 100,
    });
    const result = inferEditionIntent(signals, 'coated');
    expect(result.recommendation).toContain('banding');
  });

  it('recommends short runs for digital on uncoated', () => {
    const signals = makeSignals({
      grayscalePercentage: 0.9,
      hasMarks: false,
      dominantDpi: 100,
    });
    const result = inferEditionIntent(signals, 'uncoated');
    expect(result.recommendation).toContain('short runs');
  });
});

describe('inferEditionIntent — MIXED classification', () => {
  it('classifies as MIXED when signals are ambiguous', () => {
    const signals = makeSignals();
    const result = inferEditionIntent(signals, 'coated');
    expect(result.intent).toBe('MIXED');
    expect(result.recommendation).toContain('Mixed');
  });
});

describe('inferEditionIntent — score normalization', () => {
  it('caps offsetScore at 100', () => {
    const signals = makeSignals({
      hasMarks: true,
      spotColorsCount: 5,
      avgTac: 300,
      richBlackFrequency: 1,
      dominantDpi: 400,
      imageCompression: 'ZIP',
      hasKnockoutBlackText: true,
      hasHairlines: true,
      hasSmallReversedText: true,
      hasConsistentBleed: true,
      hasLargeBackgrounds: true,
    });
    const result = inferEditionIntent(signals, 'coated');
    expect(result.offsetScore).toBeLessThanOrEqual(100);
  });

  it('caps digitalScore at 100', () => {
    const signals = makeSignals({
      grayscalePercentage: 1,
      hasMarks: false,
      hasConsistentBleed: false,
      isPageUniform: false,
      dominantDpi: 72,
      avgTac: 50,
    });
    const result = inferEditionIntent(signals, 'coated');
    expect(result.digitalScore).toBeLessThanOrEqual(100);
  });

  it('returns confidence >= 50 for MIXED intent', () => {
    const signals = makeSignals();
    const result = inferEditionIntent(signals, 'coated');
    expect(result.confidence).toBeGreaterThanOrEqual(50);
  });
});
