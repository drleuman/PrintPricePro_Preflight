import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const adapter = require('./paperCapabilityAdapter');

// Caliper values come from the stub in frontend/services/registryAdapter.js
const COATED_CALIPERS = { 90: 0.08, 115: 0.10, 135: 0.11, 150: 0.12, 170: 0.14, 200: 0.17 };
const UNCOATED_CALIPERS = { 80: 0.09, 90: 0.10, 100: 0.11, 120: 0.12 };

describe('PaperCapabilityAdapter', () => {
  describe('toProfile', () => {
    it('returns null when dbRecord is null', () => {
      expect(adapter.toProfile(null)).toBeNull();
    });

    it('returns null when dbRecord is undefined', () => {
      expect(adapter.toProfile(undefined)).toBeNull();
    });

    it('returns a PaperStockProfile with all required fields', () => {
      const profile = adapter.toProfile({ id: 'paper-1', name: 'Silk Coated 90gsm', weight: 90 });
      expect(profile).toMatchObject({
        paperId: 'paper-1',
        name: 'Silk Coated 90gsm',
        gsm: 90,
      });
      expect(profile).toHaveProperty('caliperMmPerSheet');
      expect(profile).toHaveProperty('tacLimit');
      expect(profile).toHaveProperty('finish');
      expect(profile).toHaveProperty('usageCompatibility');
      expect(profile).toHaveProperty('sourceTrace');
    });

    it('defaults gsm to 90 when weight is missing', () => {
      const profile = adapter.toProfile({ id: 'p2', name: 'Offset Paper' });
      expect(profile.gsm).toBe(90);
    });

    it('infers finish from name and uses it in the profile', () => {
      const coated = adapter.toProfile({ id: 'c1', name: 'Gloss 115', weight: 115 });
      expect(coated.finish).toBe('coated');

      const uncoated = adapter.toProfile({ id: 'u1', name: 'Offset 80', weight: 80 });
      expect(uncoated.finish).toBe('uncoated');
    });

    it('includes sourceTrace array', () => {
      const profile = adapter.toProfile({ id: 'p3', name: 'Gloss 115', weight: 115 });
      expect(Array.isArray(profile.sourceTrace)).toBe(true);
      expect(profile.sourceTrace.length).toBeGreaterThan(0);
    });
  });

  describe('inferFinish', () => {
    it('returns "coated" for names containing "silk"', () => {
      expect(adapter.inferFinish('Silk 90')).toBe('coated');
    });

    it('returns "coated" for names containing "gloss"', () => {
      expect(adapter.inferFinish('High Gloss 115')).toBe('coated');
    });

    it('returns "coated" for names containing "matte"', () => {
      expect(adapter.inferFinish('Matte Coated')).toBe('coated');
    });

    it('returns "coated" for names containing "coated"', () => {
      expect(adapter.inferFinish('Coated Paper 135')).toBe('coated');
    });

    it('returns "uncoated" for names containing "offset"', () => {
      expect(adapter.inferFinish('Offset Bond 80')).toBe('uncoated');
    });

    it('returns "uncoated" for names containing "uncoated"', () => {
      expect(adapter.inferFinish('Uncoated Natural')).toBe('uncoated');
    });

    it('returns "uncoated" for names containing "bond"', () => {
      expect(adapter.inferFinish('Bond 60')).toBe('uncoated');
    });

    it('defaults to "uncoated" for unrecognized names', () => {
      expect(adapter.inferFinish('Mystery Paper')).toBe('uncoated');
    });

    it('is case-insensitive', () => {
      expect(adapter.inferFinish('GLOSS COATED 90')).toBe('coated');
      expect(adapter.inferFinish('OFFSET 80')).toBe('uncoated');
    });

    it('handles null gracefully', () => {
      expect(adapter.inferFinish(null)).toBe('uncoated');
    });

    it('handles empty string gracefully', () => {
      expect(adapter.inferFinish('')).toBe('uncoated');
    });
  });

  describe('lookupCaliper', () => {
    it.each(Object.entries(COATED_CALIPERS))(
      'returns %s mm/sheet for coated paper at %s gsm',
      (gsm, expected) => {
        expect(adapter.lookupCaliper('coated', Number(gsm))).toBe(expected);
      }
    );

    it.each(Object.entries(UNCOATED_CALIPERS))(
      'returns %s mm/sheet for uncoated paper at %s gsm',
      (gsm, expected) => {
        expect(adapter.lookupCaliper('uncoated', Number(gsm))).toBe(expected);
      }
    );

    it('returns the default caliper (0.10) when gsm is not in the lookup table', () => {
      expect(adapter.lookupCaliper('coated', 999)).toBe(0.10);
      expect(adapter.lookupCaliper('uncoated', 999)).toBe(0.10);
    });

    it('falls back to uncoated calipers for unknown finish', () => {
      const result = adapter.lookupCaliper('unknown_finish', 90);
      expect(typeof result).toBe('number');
      expect(result).toBeGreaterThan(0);
    });
  });

  describe('inferTacLimit', () => {
    it('returns 240 for uncoated paper', () => {
      expect(adapter.inferTacLimit('uncoated', 0.5)).toBe(240);
    });

    it('returns 300 for coated paper', () => {
      expect(adapter.inferTacLimit('coated', 0.3)).toBe(300);
    });

    it('returns 300 for any finish other than uncoated', () => {
      expect(adapter.inferTacLimit('silk', 0.3)).toBe(300);
      expect(adapter.inferTacLimit('gloss', 0.3)).toBe(300);
    });
  });

  describe('inferUsageCompatibility', () => {
    it('always returns interior: true', () => {
      expect(adapter.inferUsageCompatibility('coated', 90).interior).toBe(true);
      expect(adapter.inferUsageCompatibility('uncoated', 60).interior).toBe(true);
    });

    it('cover is true only when gsm >= 170', () => {
      expect(adapter.inferUsageCompatibility('coated', 170).cover).toBe(true);
      expect(adapter.inferUsageCompatibility('coated', 169).cover).toBe(false);
    });

    it('hardcover_wrap is true only for coated paper between 115 and 150 gsm', () => {
      expect(adapter.inferUsageCompatibility('coated', 130).hardcover_wrap).toBe(true);
      expect(adapter.inferUsageCompatibility('uncoated', 130).hardcover_wrap).toBe(false);
      expect(adapter.inferUsageCompatibility('coated', 114).hardcover_wrap).toBe(false);
      expect(adapter.inferUsageCompatibility('coated', 151).hardcover_wrap).toBe(false);
    });

    it('endpaper is true only for uncoated paper between 120 and 170 gsm', () => {
      expect(adapter.inferUsageCompatibility('uncoated', 140).endpaper).toBe(true);
      expect(adapter.inferUsageCompatibility('coated', 140).endpaper).toBe(false);
      expect(adapter.inferUsageCompatibility('uncoated', 119).endpaper).toBe(false);
      expect(adapter.inferUsageCompatibility('uncoated', 171).endpaper).toBe(false);
    });
  });
});
