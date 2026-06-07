import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  filterRequestedFixesByCapability,
  getSubmittableFixes,
  logCapabilityGateDecision,
  PreflightCapability,
  RequestedFixRow,
} from './fixCapabilityGate';

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

const caps: PreflightCapability[] = [
  { code: 'EMBED_FONTS', implemented: true, autofixable: true },
  { code: 'CONVERT_CMYK', implemented: true, autofixable: true, requires_human_review: true },
  { code: 'REBUILD_300DPI', implemented: true, autofixable: true, diagnostic_only: true },
  { code: 'LEGACY_REPAIR', implemented: false, autofixable: true },
  { code: 'NOT_AUTOFIXABLE_THING', implemented: true, autofixable: false },
];

const fix = (repairStrategy: string): RequestedFixRow => ({ repairStrategy });

describe('filterRequestedFixesByCapability', () => {
  it('treats every requested fix as unsupported when no capability contract is available (cannot vouch for anything)', () => {
    const gate = filterRequestedFixesByCapability([fix('EMBED_FONTS')], null);
    expect(gate.unsupportedFixes).toHaveLength(1);
    expect(gate.allowedFixes).toHaveLength(0);

    const gateEmpty = filterRequestedFixesByCapability([fix('EMBED_FONTS')], []);
    expect(gateEmpty.unsupportedFixes).toHaveLength(1);
  });

  it('classifies an unknown code as unsupported', () => {
    const gate = filterRequestedFixesByCapability([fix('TOTALLY_UNKNOWN')], caps);
    expect(gate.unsupportedFixes.map((f) => f.repairStrategy)).toEqual(['TOTALLY_UNKNOWN']);
  });

  it('classifies implemented=false and autofixable=false as unsupported — never sent to the engine', () => {
    const gate = filterRequestedFixesByCapability([fix('LEGACY_REPAIR'), fix('NOT_AUTOFIXABLE_THING')], caps);
    expect(gate.unsupportedFixes.map((f) => f.repairStrategy)).toEqual(['LEGACY_REPAIR', 'NOT_AUTOFIXABLE_THING']);
    expect(getSubmittableFixes(gate)).toHaveLength(0);
  });

  it('classifies diagnostic_only fixes separately and never marks them submittable', () => {
    const gate = filterRequestedFixesByCapability([fix('REBUILD_300DPI')], caps);
    expect(gate.diagnosticOnlyFixes.map((f) => f.repairStrategy)).toEqual(['REBUILD_300DPI']);
    expect(getSubmittableFixes(gate)).toHaveLength(0);
  });

  it('classifies requires_human_review fixes as review-only, but still submittable', () => {
    const gate = filterRequestedFixesByCapability([fix('CONVERT_CMYK')], caps);
    expect(gate.reviewOnlyFixes.map((f) => f.repairStrategy)).toEqual(['CONVERT_CMYK']);
    expect(getSubmittableFixes(gate).map((f) => f.repairStrategy)).toEqual(['CONVERT_CMYK']);
  });

  it('classifies a normal supported fix as allowed and submittable', () => {
    const gate = filterRequestedFixesByCapability([fix('EMBED_FONTS')], caps);
    expect(gate.allowedFixes.map((f) => f.repairStrategy)).toEqual(['EMBED_FONTS']);
    expect(getSubmittableFixes(gate).map((f) => f.repairStrategy)).toEqual(['EMBED_FONTS']);
  });

  it('matches capability codes case-insensitively', () => {
    const gate = filterRequestedFixesByCapability([fix('embed_fonts')], caps);
    expect(gate.allowedFixes).toHaveLength(1);
  });

  it('mixes categories correctly across a batch and never lets diagnostic/unsupported reach the engine', () => {
    const gate = filterRequestedFixesByCapability(
      [fix('EMBED_FONTS'), fix('CONVERT_CMYK'), fix('REBUILD_300DPI'), fix('TOTALLY_UNKNOWN')],
      caps,
    );
    expect(gate.allowedFixes.map((f) => f.repairStrategy)).toEqual(['EMBED_FONTS']);
    expect(gate.reviewOnlyFixes.map((f) => f.repairStrategy)).toEqual(['CONVERT_CMYK']);
    expect(gate.diagnosticOnlyFixes.map((f) => f.repairStrategy)).toEqual(['REBUILD_300DPI']);
    expect(gate.unsupportedFixes.map((f) => f.repairStrategy)).toEqual(['TOTALLY_UNKNOWN']);

    const submittable = getSubmittableFixes(gate).map((f) => f.repairStrategy);
    expect(submittable).toEqual(['EMBED_FONTS', 'CONVERT_CMYK']);
    expect(submittable).not.toContain('REBUILD_300DPI');
    expect(submittable).not.toContain('TOTALLY_UNKNOWN');
  });
});

describe('logCapabilityGateDecision', () => {
  it('logs the gate decision under the [APP][FIX-CAPABILITY-GATE] tag', () => {
    const logSpy = vi.spyOn(console, 'log');
    const gate = filterRequestedFixesByCapability([fix('EMBED_FONTS')], caps);
    logCapabilityGateDecision(gate);
    expect(logSpy).toHaveBeenCalledWith('[APP][FIX-CAPABILITY-GATE]', expect.objectContaining({
      allowed: ['EMBED_FONTS'],
    }));
  });
});
