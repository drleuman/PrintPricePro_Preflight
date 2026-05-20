// JWT_SECRET must be set BEFORE AuthService is required — it captures the value at module load time
import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
import jwt from 'jsonwebtoken';

const require = createRequire(import.meta.url);

const TEST_SECRET = 'test-auth-service-secret-for-unit-tests';

// Set before require so the module-level constant captures the right value
process.env.JWT_SECRET = TEST_SECRET;

const AuthService = require('./AuthService');
const { JOBS_READ, JOBS_WRITE, ANALYTICS, TENANT_ADMIN, SYSTEM_ADMIN } = AuthService.SCOPES;

// ---------------------------------------------------------------------------
// AuthService.signToken
// ---------------------------------------------------------------------------
describe('AuthService.signToken', () => {
  it('returns a JWT string', () => {
    const token = AuthService.signToken({ sub: 'tenant-1', scopes: [JOBS_READ] });
    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3);
  });

  it('signed token is verifiable with JWT_SECRET', () => {
    const token = AuthService.signToken({ sub: 'tenant-1', scopes: [JOBS_READ] });
    const decoded = jwt.verify(token, TEST_SECRET);
    expect(decoded.sub).toBe('tenant-1');
  });

  it('token expires after 24h (expiresIn ~86400s)', () => {
    const token = AuthService.signToken({ sub: 'tenant-1' });
    const decoded = jwt.decode(token);
    const ttl = decoded.exp - decoded.iat;
    expect(ttl).toBeGreaterThan(86300);
    expect(ttl).toBeLessThanOrEqual(86400);
  });
});

// ---------------------------------------------------------------------------
// AuthService.verify
// ---------------------------------------------------------------------------
describe('AuthService.verify', () => {
  it('resolves with decoded payload for a valid token', async () => {
    const token = AuthService.signToken({ sub: 'tenant-2', plan: 'pro' });
    const decoded = await AuthService.verify(token);
    expect(decoded.sub).toBe('tenant-2');
    expect(decoded.plan).toBe('pro');
  });

  it('rejects with error message for an invalid token', async () => {
    await expect(AuthService.verify('invalid.token.here')).rejects.toThrow(
      'Invalid or expired authentication token.'
    );
  });

  it('rejects for a token signed with a different secret', async () => {
    const badToken = jwt.sign({ sub: 'tenant-3' }, 'wrong-secret');
    await expect(AuthService.verify(badToken)).rejects.toThrow(
      'Invalid or expired authentication token.'
    );
  });

  it('rejects for an expired token', async () => {
    const expiredToken = jwt.sign({ sub: 'tenant-4' }, TEST_SECRET, { expiresIn: '-1s' });
    await expect(AuthService.verify(expiredToken)).rejects.toThrow(
      'Invalid or expired authentication token.'
    );
  });
});

// ---------------------------------------------------------------------------
// AuthService.checkScope
// ---------------------------------------------------------------------------
describe('AuthService.checkScope', () => {
  it('returns true when the required scope is present', () => {
    expect(AuthService.checkScope([JOBS_READ, JOBS_WRITE], JOBS_READ)).toBe(true);
  });

  it('returns false when the required scope is absent', () => {
    expect(AuthService.checkScope([JOBS_READ], JOBS_WRITE)).toBe(false);
  });

  it('returns true for any scope when SYSTEM_ADMIN is present (superuser bypass)', () => {
    expect(AuthService.checkScope([SYSTEM_ADMIN], TENANT_ADMIN)).toBe(true);
    expect(AuthService.checkScope([SYSTEM_ADMIN], JOBS_WRITE)).toBe(true);
    expect(AuthService.checkScope([SYSTEM_ADMIN], ANALYTICS)).toBe(true);
  });

  it('returns false when userScopes is null', () => {
    expect(AuthService.checkScope(null, JOBS_READ)).toBe(false);
  });

  it('returns false when userScopes is undefined', () => {
    expect(AuthService.checkScope(undefined, JOBS_READ)).toBe(false);
  });

  it('returns false for empty scopes array', () => {
    expect(AuthService.checkScope([], JOBS_READ)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// AuthService.hashPassword / comparePasswords
// ---------------------------------------------------------------------------
describe('AuthService password hashing', () => {
  it('hashPassword returns a bcrypt hash (starts with $2)', async () => {
    const hash = await AuthService.hashPassword('my-secure-password');
    expect(hash).toMatch(/^\$2[aby]\$/);
  });

  it('comparePasswords returns true for the correct password', async () => {
    const password = 'correct-horse-battery-staple';
    const hash = await AuthService.hashPassword(password);
    const result = await AuthService.comparePasswords(password, hash);
    expect(result).toBe(true);
  });

  it('comparePasswords returns false for an incorrect password', async () => {
    const hash = await AuthService.hashPassword('original-password');
    const result = await AuthService.comparePasswords('wrong-password', hash);
    expect(result).toBe(false);
  });

  it('each hash is unique (salted)', async () => {
    const hash1 = await AuthService.hashPassword('same-password');
    const hash2 = await AuthService.hashPassword('same-password');
    expect(hash1).not.toBe(hash2);
  });
});
