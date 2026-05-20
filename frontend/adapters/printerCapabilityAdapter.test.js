import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const adapter = require('./printerCapabilityAdapter');

// Machine capability values from frontend/services/registryAdapter.js stub
const DIGITAL_TONER = {
  binding: { saddle_stitch: true, perfect_bind: true, wire_o: false },
  format: { maxWidthMm: 330, maxHeightMm: 487 },
  constraints: { maxTac: 280, minDpi: 300, requiresBleed: false },
};

const makePrinter = (overrides = {}) => ({ id: 'printer-1', name: 'HP Indigo 12000', ...overrides });
const makeMachine = (overrides = {}) => ({
  id: 'machine-1',
  type: 'digital_toner',
  max_tac: 280,
  min_res_dpi: 300,
  requires_bleed: false,
  ...overrides,
});

describe('PrinterCapabilityAdapter', () => {
  describe('toProfile', () => {
    it('returns null when printer is null', () => {
      expect(adapter.toProfile(null, makeMachine())).toBeNull();
    });

    it('returns null when machine is null', () => {
      expect(adapter.toProfile(makePrinter(), null)).toBeNull();
    });

    it('returns null when both are null', () => {
      expect(adapter.toProfile(null, null)).toBeNull();
    });

    it('returns a profile with printerId and machineId', () => {
      const profile = adapter.toProfile(makePrinter({ id: 'p-42' }), makeMachine({ id: 'm-99' }));
      expect(profile.printerId).toBe('p-42');
      expect(profile.machineId).toBe('m-99');
    });

    it('includes capabilities with all expected sub-keys', () => {
      const profile = adapter.toProfile(makePrinter(), makeMachine());
      expect(profile.capabilities).toBeDefined();
      expect(profile.capabilities).toHaveProperty('bindingConstraints');
      expect(profile.capabilities).toHaveProperty('paperUsageLimits');
      expect(profile.capabilities).toHaveProperty('format');
      expect(profile.capabilities).toHaveProperty('colorCapabilities');
    });

    it('includes constraints with maxTac, minDpi, requiresBleed from machine', () => {
      const profile = adapter.toProfile(
        makePrinter(),
        makeMachine({ max_tac: 300, min_res_dpi: 600, requires_bleed: true })
      );
      expect(profile.constraints.maxTac).toBe(300);
      expect(profile.constraints.minDpi).toBe(600);
      expect(profile.constraints.requiresBleed).toBe(true);
    });

    it('falls back to baseline maxTac when machine.max_tac is missing', () => {
      const machine = makeMachine({ type: 'digital_toner' });
      delete machine.max_tac;
      const profile = adapter.toProfile(makePrinter(), machine);
      expect(profile.constraints.maxTac).toBe(DIGITAL_TONER.constraints.maxTac);
    });

    it('falls back to baseline minDpi when machine.min_res_dpi is missing', () => {
      const machine = makeMachine({ type: 'digital_toner' });
      delete machine.min_res_dpi;
      const profile = adapter.toProfile(makePrinter(), machine);
      expect(profile.constraints.minDpi).toBe(DIGITAL_TONER.constraints.minDpi);
    });

    it('uses digital_toner baseline for unknown machine type', () => {
      const profile = adapter.toProfile(makePrinter(), makeMachine({ type: 'unknown_type' }));
      expect(profile).not.toBeNull();
      expect(profile.constraints).toBeDefined();
    });

    it('sets rgbTolerance to "conditional" for digital machine types', () => {
      const profile = adapter.toProfile(makePrinter(), makeMachine({ type: 'digital_toner' }));
      expect(profile.capabilities.colorCapabilities.rgbTolerance).toBe('conditional');
    });

    it('sets rgbTolerance to "none" for offset machine types', () => {
      const profile = adapter.toProfile(makePrinter(), makeMachine({ type: 'offset_litho' }));
      expect(profile.capabilities.colorCapabilities.rgbTolerance).toBe('none');
    });

    it('includes FOGRA39 in supported color profiles', () => {
      const profile = adapter.toProfile(makePrinter(), makeMachine());
      expect(profile.capabilities.colorCapabilities.supportedProfiles).toContain('FOGRA39');
    });

    it('includes sourceTrace array with at least one entry', () => {
      const profile = adapter.toProfile(makePrinter(), makeMachine());
      expect(Array.isArray(profile.sourceTrace)).toBe(true);
      expect(profile.sourceTrace.length).toBeGreaterThan(0);
    });
  });

  describe('getDefaultPaperUsageLimits', () => {
    it('returns an object with interior, cover, hardcover_wrap, endpaper keys', () => {
      const limits = adapter.getDefaultPaperUsageLimits('digital_toner');
      expect(limits).toHaveProperty('interior');
      expect(limits).toHaveProperty('cover');
      expect(limits).toHaveProperty('hardcover_wrap');
      expect(limits).toHaveProperty('endpaper');
    });

    it('interior is always supported', () => {
      expect(adapter.getDefaultPaperUsageLimits('digital_toner').interior.supported).toBe(true);
    });

    it('interior has a valid gsm range', () => {
      const { interior } = adapter.getDefaultPaperUsageLimits('digital_toner');
      expect(interior.minGsm).toBeLessThan(interior.maxGsm);
    });

    it('cover minGsm is >= 170', () => {
      const { cover } = adapter.getDefaultPaperUsageLimits('digital_toner');
      expect(cover.minGsm).toBeGreaterThanOrEqual(170);
    });

    it('returns the same structure regardless of machine type', () => {
      const limitsA = adapter.getDefaultPaperUsageLimits('digital_toner');
      const limitsB = adapter.getDefaultPaperUsageLimits('offset_litho');
      expect(Object.keys(limitsA)).toEqual(Object.keys(limitsB));
    });
  });
});
