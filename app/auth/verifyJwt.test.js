import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';
import jwt from 'jsonwebtoken';

const require = createRequire(import.meta.url);

const TEST_SECRET = 'test-verify-jwt-secret';
const TEST_ISSUER = 'https://auth.printprice.pro';
const TEST_AUDIENCE = 'ppos:control';

function makeValidToken(overrides = {}) {
  return jwt.sign(
    { sub: 'test-user', role: 'member', ...overrides },
    TEST_SECRET,
    {
      algorithm: 'HS256',
      issuer: TEST_ISSUER,
      audience: TEST_AUDIENCE,
      expiresIn: '1h',
    }
  );
}

describe('verifyJwt', () => {
  let verifyJwt;

  beforeEach(() => {
    process.env.JWT_SECRET = TEST_SECRET;
    process.env.JWT_ISSUER = TEST_ISSUER;
    process.env.JWT_AUDIENCE = TEST_AUDIENCE;
    process.env.JWT_ALGORITHM = 'HS256';
    delete process.env.JWT_PUBLIC_KEY;
    verifyJwt = require('./verifyJwt').verifyJwt;
  });

  afterEach(() => {
    delete process.env.JWT_SECRET;
    delete process.env.JWT_ISSUER;
    delete process.env.JWT_AUDIENCE;
    delete process.env.JWT_ALGORITHM;
  });

  it('verifies a valid token and returns the decoded payload', () => {
    const token = makeValidToken({ sub: 'user-abc' });
    const decoded = verifyJwt(token);
    expect(decoded.sub).toBe('user-abc');
  });

  it('returns all expected claims', () => {
    const token = makeValidToken({ sub: 'user-1', role: 'tenant_admin' });
    const decoded = verifyJwt(token);
    expect(decoded).toMatchObject({ sub: 'user-1', role: 'tenant_admin' });
  });

  it('throws JWT_VALIDATION_FAILED for a token signed with a different secret', () => {
    const token = jwt.sign({ sub: 'user' }, 'wrong-secret', {
      algorithm: 'HS256',
      issuer: TEST_ISSUER,
      audience: TEST_AUDIENCE,
    });
    expect(() => verifyJwt(token)).toThrow('JWT_VALIDATION_FAILED');
  });

  it('throws JWT_VALIDATION_FAILED for a token with wrong issuer', () => {
    const token = jwt.sign({ sub: 'user' }, TEST_SECRET, {
      algorithm: 'HS256',
      issuer: 'https://wrong-issuer.com',
      audience: TEST_AUDIENCE,
    });
    expect(() => verifyJwt(token)).toThrow('JWT_VALIDATION_FAILED');
  });

  it('throws JWT_VALIDATION_FAILED for a token with wrong audience', () => {
    const token = jwt.sign({ sub: 'user' }, TEST_SECRET, {
      algorithm: 'HS256',
      issuer: TEST_ISSUER,
      audience: 'wrong:audience',
    });
    expect(() => verifyJwt(token)).toThrow('JWT_VALIDATION_FAILED');
  });

  it('throws JWT_VALIDATION_FAILED for a malformed token string', () => {
    expect(() => verifyJwt('not.a.jwt')).toThrow('JWT_VALIDATION_FAILED');
  });

  it('throws JWT_VALIDATION_FAILED for an expired token', () => {
    const token = jwt.sign({ sub: 'user' }, TEST_SECRET, {
      algorithm: 'HS256',
      issuer: TEST_ISSUER,
      audience: TEST_AUDIENCE,
      expiresIn: '-1s', // already expired
    });
    expect(() => verifyJwt(token)).toThrow('JWT_VALIDATION_FAILED');
  });

  it('throws JWT_VALIDATION_FAILED for empty string', () => {
    expect(() => verifyJwt('')).toThrow('JWT_VALIDATION_FAILED');
  });
});
