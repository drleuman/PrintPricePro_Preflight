import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRequire } from 'module';
import jwt from 'jsonwebtoken';

const require = createRequire(import.meta.url);

const TEST_SECRET = 'test-require-auth-secret';
const TEST_ISSUER = 'https://auth.printprice.pro';
const TEST_AUDIENCE = 'ppos:control';
const TEST_LEGACY_KEY = 'legacy-ppp-api-key-xyz';

function signToken(payload, secret = TEST_SECRET, options = {}) {
  return jwt.sign(payload, secret, {
    expiresIn: '5m',
    issuer: TEST_ISSUER,
    audience: TEST_AUDIENCE,
    ...options,
  });
}

function makeReqResNext(headers = {}) {
  const req = {
    headers,
    originalUrl: '/api/v2/test',
    get: (name) => headers[name.toLowerCase()] || '',
  };
  const res = {
    _status: null,
    _body: null,
    status(code) { this._status = code; return this; },
    json(body) { this._body = body; return this; },
  };
  const next = vi.fn();
  return { req, res, next };
}

beforeEach(() => {
  process.env.JWT_SECRET = TEST_SECRET;
  process.env.JWT_ISSUER = TEST_ISSUER;
  process.env.JWT_AUDIENCE = TEST_AUDIENCE;
  delete process.env.ALLOW_LEGACY_AUTH;
  delete process.env.PPP_API_KEY;
});

afterEach(() => {
  delete process.env.JWT_SECRET;
  delete process.env.JWT_ISSUER;
  delete process.env.JWT_AUDIENCE;
  delete process.env.ALLOW_LEGACY_AUTH;
  delete process.env.PPP_API_KEY;
});

// requireAuth is loaded after env setup — the module reads env at load time for
// ALLOW_LEGACY_AUTH and LEGACY_API_KEY (module-level constants), so we reload it per test.
function loadMiddleware() {
  // Clear module cache so env vars are re-read on each require
  const middlewarePath = require.resolve('./requireAuth');
  const verifyPath = require.resolve('../auth/verifyJwt');
  delete require.cache[middlewarePath];
  delete require.cache[verifyPath];
  return require('./requireAuth');
}

describe('requireAuth middleware', () => {
  describe('JWT Bearer token path', () => {
    it('calls next() and sets req.auth for a valid JWT', () => {
      const mw = loadMiddleware();
      const token = signToken({ sub: 'user-1', tenantId: 'tenant-abc', role: 'MEMBER', email: 'u@example.com' });
      const { req, res, next } = makeReqResNext({ authorization: `Bearer ${token}` });

      mw(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(req.auth).toBeDefined();
      expect(req.auth.tenantId).toBe('tenant-abc');
    });

    it('sets req.auth.userId from decoded.sub when userId is absent', () => {
      const mw = loadMiddleware();
      const token = signToken({ sub: 'user-xyz', tenantId: 'tenant-1', role: 'AUTHOR' });
      const { req, res, next } = makeReqResNext({ authorization: `Bearer ${token}` });

      mw(req, res, next);

      expect(req.auth.userId).toBe('user-xyz');
    });

    it('defaults tenantId to "global-node" when not in JWT', () => {
      const mw = loadMiddleware();
      const token = signToken({ sub: 'u1', role: 'MEMBER' });
      const { req, res, next } = makeReqResNext({ authorization: `Bearer ${token}` });

      mw(req, res, next);

      expect(req.auth.tenantId).toBe('global-node');
    });

    it('returns 401 for an invalid JWT', () => {
      const mw = loadMiddleware();
      const { req, res, next } = makeReqResNext({ authorization: 'Bearer not-a-valid-jwt' });

      mw(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res._status).toBe(401);
      expect(res._body.error).toBe('INVALID_CREDENTIALS');
    });

    it('returns 401 for an expired JWT', () => {
      const mw = loadMiddleware();
      const token = signToken({ sub: 'u1', tenantId: 't1' }, TEST_SECRET, { expiresIn: '-1s' });
      const { req, res, next } = makeReqResNext({ authorization: `Bearer ${token}` });

      mw(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res._status).toBe(401);
    });

    it('returns 401 for a JWT signed with the wrong secret', () => {
      const mw = loadMiddleware();
      const token = signToken({ sub: 'u1' }, 'wrong-secret');
      const { req, res, next } = makeReqResNext({ authorization: `Bearer ${token}` });

      mw(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res._status).toBe(401);
    });
  });

  describe('no Authorization header', () => {
    it('returns 401 when no Authorization header is provided', () => {
      const mw = loadMiddleware();
      const { req, res, next } = makeReqResNext({});

      mw(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res._status).toBe(401);
      expect(res._body.error).toBe('AUTHENTICATION_REQUIRED');
    });

    it('returns 401 when Authorization header does not start with Bearer', () => {
      const mw = loadMiddleware();
      const { req, res, next } = makeReqResNext({ authorization: 'Basic somebase64==' });

      mw(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res._status).toBe(401);
    });
  });

  describe('legacy API key fallback', () => {
    it('calls next() with legacy auth context when ALLOW_LEGACY_AUTH=true and key matches', () => {
      process.env.ALLOW_LEGACY_AUTH = 'true';
      process.env.PPP_API_KEY = TEST_LEGACY_KEY;
      const mw = loadMiddleware();
      const req = {
        headers: {},
        originalUrl: '/api/v2/test',
        get: (name) => (name === 'x-ppp-api-key' ? TEST_LEGACY_KEY : ''),
      };
      const res = {
        _status: null,
        _body: null,
        status(code) { this._status = code; return this; },
        json(body) { this._body = body; return this; },
      };
      const next = vi.fn();

      mw(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(req.auth.role).toBe('ADMIN_LEGACY');
    });

    it('returns 401 when legacy key is wrong even with ALLOW_LEGACY_AUTH=true', () => {
      process.env.ALLOW_LEGACY_AUTH = 'true';
      process.env.PPP_API_KEY = TEST_LEGACY_KEY;
      const mw = loadMiddleware();
      const req = {
        headers: {},
        originalUrl: '/api/v2/test',
        get: (name) => (name === 'x-ppp-api-key' ? 'wrong-key' : ''),
      };
      const res = {
        _status: null, _body: null,
        status(code) { this._status = code; return this; },
        json(body) { this._body = body; return this; },
      };
      const next = vi.fn();

      mw(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res._status).toBe(401);
    });
  });
});
