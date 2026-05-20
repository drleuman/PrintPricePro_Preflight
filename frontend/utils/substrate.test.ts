import { describe, it, expect } from 'vitest';
import { validateSubstrate, type SubstrateMeasure } from './substrate';

function makeMeasure(overrides: Partial<SubstrateMeasure> = {}): SubstrateMeasure {
  return {
    paperType: 'coated',
    maxTac: 200,
    hasLargeRichBlacks: false,
    hasSmallReversedText: false,
    avgInkCoverage: 50,
    hasHeavyOverprint: false,
    ...overrides,
  };
}

describe('validateSubstrate — GREEN (no warnings)', () => {
  it('returns GREEN for coated paper with no issues', () => {
    const result = validateSubstrate(makeMeasure());
    expect(result.riskLevel).toBe('GREEN');
    expect(result.warnings).toHaveLength(0);
  });

  it('returns GREEN for uncoated paper with no issues', () => {
    const result = validateSubstrate(makeMeasure({ paperType: 'uncoated', maxTac: 200 }));
    expect(result.riskLevel).toBe('GREEN');
    expect(result.warnings).toHaveLength(0);
  });
});

describe('validateSubstrate — uncoated paper warnings', () => {
  it('warns when maxTac > 260 on uncoated', () => {
    const result = validateSubstrate(makeMeasure({ paperType: 'uncoated', maxTac: 280 }));
    const tacWarning = result.warnings.find(w => w.type === 'PHYSICS_WARNING' && w.message.includes('TAC'));
    expect(tacWarning).toBeDefined();
    expect(tacWarning!.severity).toBe('warning');
    expect(result.riskLevel).toBe('ATTENTION');
  });

  it('does NOT warn when maxTac === 260 on uncoated (boundary)', () => {
    const result = validateSubstrate(makeMeasure({ paperType: 'uncoated', maxTac: 260 }));
    const tacWarning = result.warnings.find(w => w.message.includes('TAC'));
    expect(tacWarning).toBeUndefined();
  });

  it('warns for large rich blacks on uncoated', () => {
    const result = validateSubstrate(makeMeasure({ paperType: 'uncoated', hasLargeRichBlacks: true }));
    const richBlackWarning = result.warnings.find(w => w.message.includes('rich black'));
    expect(richBlackWarning).toBeDefined();
    expect(richBlackWarning!.severity).toBe('warning');
  });

  it('warns for small reversed text on uncoated', () => {
    const result = validateSubstrate(makeMeasure({ paperType: 'uncoated', hasSmallReversedText: true }));
    const reversedWarning = result.warnings.find(w => w.message.includes('reversed text'));
    expect(reversedWarning).toBeDefined();
  });

  it('accumulates multiple uncoated warnings', () => {
    const result = validateSubstrate(makeMeasure({
      paperType: 'uncoated',
      maxTac: 300,
      hasLargeRichBlacks: true,
      hasSmallReversedText: true,
    }));
    expect(result.warnings).toHaveLength(3);
    expect(result.riskLevel).toBe('ATTENTION');
  });
});

describe('validateSubstrate — coated paper warnings', () => {
  it('warns for extremely low ink coverage (<5%) on coated', () => {
    const result = validateSubstrate(makeMeasure({ paperType: 'coated', avgInkCoverage: 2 }));
    const lowInkWarning = result.warnings.find(w => w.message.includes('low ink coverage'));
    expect(lowInkWarning).toBeDefined();
    expect(lowInkWarning!.severity).toBe('warning');
  });

  it('does NOT warn when avgInkCoverage === 0 on coated (condition is > 0)', () => {
    const result = validateSubstrate(makeMeasure({ paperType: 'coated', avgInkCoverage: 0 }));
    const lowInkWarning = result.warnings.find(w => w.message.includes('low ink coverage'));
    expect(lowInkWarning).toBeUndefined();
  });

  it('does NOT warn when avgInkCoverage >= 5 on coated', () => {
    const result = validateSubstrate(makeMeasure({ paperType: 'coated', avgInkCoverage: 5 }));
    const lowInkWarning = result.warnings.find(w => w.message.includes('low ink coverage'));
    expect(lowInkWarning).toBeUndefined();
  });

  it('warns for heavy overprint on coated', () => {
    const result = validateSubstrate(makeMeasure({ paperType: 'coated', hasHeavyOverprint: true }));
    const overprintWarning = result.warnings.find(w => w.message.includes('overprint'));
    expect(overprintWarning).toBeDefined();
  });

  it('does NOT apply uncoated rules to coated paper', () => {
    const result = validateSubstrate(makeMeasure({ paperType: 'coated', maxTac: 350, hasLargeRichBlacks: true }));
    const tacWarning = result.warnings.find(w => w.message.includes('TAC'));
    expect(tacWarning).toBeUndefined();
  });
});
