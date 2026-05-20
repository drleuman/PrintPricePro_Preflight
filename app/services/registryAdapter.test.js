import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { getIssueRegistry } = require('./registryAdapter');

describe('getIssueRegistry', () => {
  it('returns an object (not null or array)', () => {
    const registry = getIssueRegistry();
    expect(registry).toBeDefined();
    expect(typeof registry).toBe('object');
    expect(Array.isArray(registry)).toBe(false);
  });

  it('contains the fonts-not-embedded entry', () => {
    const registry = getIssueRegistry();
    expect(registry['fonts-not-embedded']).toBeDefined();
  });

  it('fonts-not-embedded has required fields with correct values', () => {
    const entry = getIssueRegistry()['fonts-not-embedded'];
    expect(entry.title).toBe('Fonts Not Embedded');
    expect(entry.type).toBe('technical');
    expect(entry.severity).toBe('error');
    expect(entry.fix).toBe('EMBED_ALL_FONTS');
    expect(typeof entry.user_message).toBe('string');
    expect(entry.user_message.length).toBeGreaterThan(0);
  });

  it('contains the low-resolution-images entry as a warning', () => {
    const entry = getIssueRegistry()['low-resolution-images'];
    expect(entry).toBeDefined();
    expect(entry.severity).toBe('warning');
    expect(entry.fix).toBe('UPSCALE_OR_REPLACE');
  });

  it('contains the missing-bleed-info entry as a geometry error', () => {
    const entry = getIssueRegistry()['missing-bleed-info'];
    expect(entry).toBeDefined();
    expect(entry.type).toBe('geometry');
    expect(entry.severity).toBe('error');
    expect(entry.fix).toBe('ADD_3MM_BLEED');
  });

  it('contains text-outline-risk entry with null fix (no auto-fix available)', () => {
    const entry = getIssueRegistry()['text-outline-risk'];
    expect(entry).toBeDefined();
    expect(entry.severity).toBe('info');
    expect(entry.fix).toBeNull();
  });

  it('every entry has title, type, severity, and user_message', () => {
    const registry = getIssueRegistry();
    for (const [key, entry] of Object.entries(registry)) {
      expect(entry.title, `${key} missing title`).toBeTruthy();
      expect(entry.type, `${key} missing type`).toBeTruthy();
      expect(entry.severity, `${key} missing severity`).toBeTruthy();
      expect(entry.user_message, `${key} missing user_message`).toBeTruthy();
    }
  });

  it('returns a stable reference — same object on multiple calls', () => {
    expect(getIssueRegistry()).toBe(getIssueRegistry());
  });
});
