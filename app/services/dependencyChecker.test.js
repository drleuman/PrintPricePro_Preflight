import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

const REQUIRED_ENV_VARS = ['DATABASE_URL', 'PPOS_SERVICE_URL', 'JWT_SECRET', 'ADMIN_API_KEY'];

function setAllEnvVars() {
  process.env.DATABASE_URL = 'mysql://localhost:3306/testdb';
  process.env.PPOS_SERVICE_URL = 'http://127.0.0.1:8001';
  process.env.JWT_SECRET = 'test-secret-value';
  process.env.ADMIN_API_KEY = 'test-admin-key';
}

function clearEnvVars() {
  REQUIRED_ENV_VARS.forEach(k => delete process.env[k]);
}

beforeEach(clearEnvVars);
afterEach(clearEnvVars);

const { checkAllDependencies } = require('./dependencyChecker');

describe('checkAllDependencies', () => {
  describe('return shape', () => {
    it('returns an object with ok and deps fields', () => {
      const result = checkAllDependencies();
      expect(result).toHaveProperty('ok');
      expect(result).toHaveProperty('deps');
    });

    it('deps has env, filesystem, and services sub-objects', () => {
      const { deps } = checkAllDependencies();
      expect(deps).toHaveProperty('env');
      expect(deps).toHaveProperty('filesystem');
      expect(deps).toHaveProperty('services');
    });

    it('deps.env has ok and missing fields', () => {
      const { deps } = checkAllDependencies();
      expect(deps.env).toHaveProperty('ok');
      expect(deps.env).toHaveProperty('missing');
      expect(Array.isArray(deps.env.missing)).toBe(true);
    });

    it('deps.filesystem has ok and missing fields', () => {
      const { deps } = checkAllDependencies();
      expect(deps.filesystem).toHaveProperty('ok');
      expect(deps.filesystem).toHaveProperty('missing');
      expect(Array.isArray(deps.filesystem.missing)).toBe(true);
    });
  });

  describe('environment variable checks', () => {
    it('deps.env.ok is false and lists missing vars when none are set', () => {
      const { deps } = checkAllDependencies();
      expect(deps.env.ok).toBe(false);
      expect(deps.env.missing.length).toBeGreaterThan(0);
    });

    it('reports DATABASE_URL as missing when not set', () => {
      const { deps } = checkAllDependencies();
      expect(deps.env.missing).toContain('DATABASE_URL');
    });

    it('reports PPOS_SERVICE_URL as missing when not set', () => {
      const { deps } = checkAllDependencies();
      expect(deps.env.missing).toContain('PPOS_SERVICE_URL');
    });

    it('reports JWT_SECRET as missing when not set', () => {
      const { deps } = checkAllDependencies();
      expect(deps.env.missing).toContain('JWT_SECRET');
    });

    it('deps.env.ok is true when all required vars are set', () => {
      setAllEnvVars();
      const { deps } = checkAllDependencies();
      expect(deps.env.ok).toBe(true);
      expect(deps.env.missing).toHaveLength(0);
    });

    it('treats placeholder values as missing', () => {
      process.env.DATABASE_URL = 'placeholder_value';
      process.env.PPOS_SERVICE_URL = 'http://127.0.0.1:8001';
      process.env.JWT_SECRET = 'test-secret';
      process.env.ADMIN_API_KEY = 'test-key';
      const { deps } = checkAllDependencies();
      expect(deps.env.missing).toContain('DATABASE_URL');
    });

    it('treats "your_" prefixed values as missing', () => {
      process.env.JWT_SECRET = 'your_secret_here';
      const { deps } = checkAllDependencies();
      expect(deps.env.missing).toContain('JWT_SECRET');
    });
  });

  describe('overall ok flag', () => {
    it('ok is false when any env var is missing', () => {
      const { ok } = checkAllDependencies();
      expect(ok).toBe(false);
    });

    it('ok reflects combined env + filesystem status', () => {
      setAllEnvVars();
      const { ok, deps } = checkAllDependencies();
      // ok should be true only if BOTH env AND filesystem pass
      expect(ok).toBe(deps.env.ok && deps.filesystem.ok && deps.services.ok);
    });
  });
});
