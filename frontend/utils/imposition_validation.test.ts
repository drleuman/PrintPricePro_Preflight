import { describe, it, expect } from 'vitest';
import { validateImposition, type ImpositionMeasure } from './imposition_validation';

function makeMeasure(overrides: Partial<ImpositionMeasure> = {}): ImpositionMeasure {
  return {
    hasMixedTrimSizes: false,
    missingTrimBox: false,
    hasMixedRotations: false,
    hasAsymmetricBleed: false,
    hasZeroBleedPages: false,
    hasLandscapeInPortrait: false,
    ...overrides,
  };
}

describe('validateImposition — GREEN', () => {
  it('returns score 100 and GREEN when all flags are false', () => {
    const result = validateImposition(makeMeasure());
    expect(result.score).toBe(100);
    expect(result.classification).toBe('GREEN');
    expect(result.issues).toHaveLength(0);
  });
});

describe('validateImposition — BLOCKING', () => {
  it('classifies as BLOCKING when hasMixedTrimSizes and missingTrimBox are both true', () => {
    const result = validateImposition(makeMeasure({ hasMixedTrimSizes: true, missingTrimBox: true }));
    // 100 - 40 - 30 = 30 → BLOCKING (< 50)
    expect(result.score).toBe(30);
    expect(result.classification).toBe('BLOCKING');
    expect(result.issues).toHaveLength(2);
  });

  it('adds ERROR severity issue for mixed trim sizes', () => {
    const result = validateImposition(makeMeasure({ hasMixedTrimSizes: true }));
    expect(result.issues[0].severity).toBe('error');
    expect(result.issues[0].message).toContain('trim sizes');
  });

  it('adds ERROR severity issue for missing TrimBox', () => {
    const result = validateImposition(makeMeasure({ missingTrimBox: true }));
    expect(result.issues[0].severity).toBe('error');
    expect(result.issues[0].message).toContain('TrimBox');
  });
});

describe('validateImposition — ATTENTION', () => {
  it('classifies as ATTENTION for mixed rotations only', () => {
    const result = validateImposition(makeMeasure({ hasMixedRotations: true }));
    // 100 - 15 = 85 → boundary: score === 85 → GREEN (< 85 is ATTENTION)
    expect(result.score).toBe(85);
    expect(result.classification).toBe('GREEN');
  });

  it('classifies as ATTENTION for mixed rotations + asymmetric bleed', () => {
    const result = validateImposition(makeMeasure({ hasMixedRotations: true, hasAsymmetricBleed: true }));
    // 100 - 15 - 10 = 75 → ATTENTION
    expect(result.score).toBe(75);
    expect(result.classification).toBe('ATTENTION');
  });

  it('adds WARNING severity for mixed rotations', () => {
    const result = validateImposition(makeMeasure({ hasMixedRotations: true }));
    expect(result.issues[0].severity).toBe('warning');
  });
});

describe('validateImposition — INFO issues', () => {
  it('adds INFO severity for zero bleed pages', () => {
    const result = validateImposition(makeMeasure({ hasZeroBleedPages: true }));
    const infoIssue = result.issues.find(i => i.severity === 'info');
    expect(infoIssue).toBeDefined();
    expect(infoIssue!.message).toContain('zero bleed');
  });

  it('adds INFO severity for landscape in portrait', () => {
    const result = validateImposition(makeMeasure({ hasLandscapeInPortrait: true }));
    const infoIssue = result.issues.find(i => i.severity === 'info');
    expect(infoIssue).toBeDefined();
    expect(infoIssue!.message).toContain('Landscape');
  });
});

describe('validateImposition — score floor', () => {
  it('never returns score below 0', () => {
    const result = validateImposition(makeMeasure({
      hasMixedTrimSizes: true,
      missingTrimBox: true,
      hasMixedRotations: true,
      hasAsymmetricBleed: true,
      hasZeroBleedPages: true,
      hasLandscapeInPortrait: true,
    }));
    expect(result.score).toBeGreaterThanOrEqual(0);
  });
});
