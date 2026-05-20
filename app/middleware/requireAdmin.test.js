import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRequire } from 'module';
import jwt from 'jsonwebtoken';

const require = createRequire(import.meta.url);

const TEST_SECRET = 'test-require-admin-secret';
const TEST_ADMIN_KEY = 'super-secret-admin-key-12345';

function makeReqResNext(headers = {}, overrides = {}) {
  const req = { headers, ip: '127.0.0.1', ...overrides };
  const res = {
    _status: null,
    _body: null,
    status(code) { this._status = code; return this; },
    json(body) { this._body = body; return this; },
  };
  const next = vi.fn();
  return { req, res, next };
}

function signToken(payload, secret = TEST_SECRET, options = {}) {
  return jwt.sign(payload, secret, { expiresIn: '5m', ...options });
}

beforeEach(() => {
  process.env.JWT_SECRET = TEST_SECRET;
  process.env.ADMIN_API_KEY = TEST_ADMIN_KEY;
});

afterEach(() => {
  delete process.env.JWT_SECRET;
  delete process.env.ADMIN_API_KEY;
  delete process.env.NODE_ENV;
});

// requireAdmin is loaded AFTER env is set so it reads the env values at call time
const requireAdmin = require('./requireAdmin');

describe('requireAdmin middleware', () => {
  describe('JWT authentication path', () => {
    it('calls next() for a valid JWT with role=admin', () => {
      const token = signToken({ sub: 'user-1', role: 'admin', tenantId: 't1' });
      const { req, res, next } = makeReqResNext({ authorization: `Bearer ${token}` });

      requireAdmin(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(req.user).toBeDefined();
      expect(req.user.role).toBe('admin');
    });

    it('calls next() for a valid JWT with role=super-admin', () => {
      const token = signToken({ sub: 'user-2', role: 'super-admin' });
      const { req, res, next } = makeReqResNext({ authorization: `Bearer ${token}` });

      requireAdmin(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
    });

    it('returns 403 for a valid JWT with a non-admin role', () => {
      const token = signToken({ sub: 'user-3', role: 'viewer' });
      const { req, res, next } = makeReqResNext({ authorization: `Bearer ${token}` });

      requireAdmin(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res._status).toBe(403);
      expect(res._body.error).toBe('Forbidden');
    });

    it('falls through to API key check on invalid JWT', () => {
      const { req, res, next } = makeReqResNext({
        authorization: 'Bearer not-a-valid-jwt',
        'x-admin-api-key': TEST_ADMIN_KEY,
      });

      requireAdmin(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
    });
  });

  describe('API key authentication path', () => {
    it('calls next() when a correct admin API key is provided', () => {
      const { req, res, next } = makeReqResNext({ 'x-admin-api-key': TEST_ADMIN_KEY });

      requireAdmin(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(req.user).toEqual({ id: 'system', role: 'admin' });
    });

    it('returns 401 for an incorrect admin API key', () => {
      const { req, res, next } = makeReqResNext({ 'x-admin-api-key': 'wrong-key' });

      requireAdmin(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res._status).toBe(401);
    });
  });

  describe('no authentication provided', () => {
    it('returns 401 when no Authorization header and no API key', () => {
      const { req, res, next } = makeReqResNext({});

      requireAdmin(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res._status).toBe(401);
      expect(res._body.error).toBe('Unauthorized');
    });
  });

  describe('missing environment config', () => {
    it('returns 401 when JWT_SECRET is not set (falls to API key check, also fails)', () => {
      delete process.env.JWT_SECRET;
      delete process.env.ADMIN_API_KEY;
      const token = signToken({ role: 'admin' }, TEST_SECRET);
      const { req, res, next } = makeReqResNext({ authorization: `Bearer ${token}` });

      requireAdmin(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res._status).toBe(401);
    });
  });
});
