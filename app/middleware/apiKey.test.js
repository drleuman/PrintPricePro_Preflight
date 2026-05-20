import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const apiKey = require('./apiKey');

const VALID_KEY = 'valid-api-key-abc123';

function makeReqResNext({ header = '', query = '', body = {} } = {}) {
  const req = {
    ip: '127.0.0.1',
    query: { ...(query ? { api_key: query } : {}) },
    body,
    get: (name) => (name === 'x-ppp-api-key' ? header : ''),
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
  process.env.PPP_API_KEY = VALID_KEY;
});

afterEach(() => {
  delete process.env.PPP_API_KEY;
});

describe('apiKey middleware', () => {
  describe('when PPP_API_KEY is not configured', () => {
    it('calls next() immediately (passthrough)', () => {
      delete process.env.PPP_API_KEY;
      const { req, res, next } = makeReqResNext();
      apiKey(req, res, next);
      expect(next).toHaveBeenCalledTimes(1);
    });
  });

  describe('valid key via header', () => {
    it('calls next() when correct key is in X-PPP-API-KEY header', () => {
      const { req, res, next } = makeReqResNext({ header: VALID_KEY });
      apiKey(req, res, next);
      expect(next).toHaveBeenCalledTimes(1);
    });
  });

  describe('valid key via query string', () => {
    it('calls next() when correct key is in api_key query param', () => {
      const { req, res, next } = makeReqResNext({ query: VALID_KEY });
      apiKey(req, res, next);
      expect(next).toHaveBeenCalledTimes(1);
    });
  });

  describe('valid key via request body', () => {
    it('calls next() when correct key is in body.api_key', () => {
      const { req, res, next } = makeReqResNext({ body: { api_key: VALID_KEY } });
      apiKey(req, res, next);
      expect(next).toHaveBeenCalledTimes(1);
    });
  });

  describe('invalid or missing key', () => {
    it('returns 401 when no key is provided', () => {
      const { req, res, next } = makeReqResNext();
      apiKey(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res._status).toBe(401);
      expect(res._body.error).toBe('unauthorized');
    });

    it('returns 401 for a wrong key in header', () => {
      const { req, res, next } = makeReqResNext({ header: 'wrong-key' });
      apiKey(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res._status).toBe(401);
    });

    it('returns 401 for a wrong key in query param', () => {
      const { req, res, next } = makeReqResNext({ query: 'wrong-key' });
      apiKey(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res._status).toBe(401);
    });

    it('returns 401 for a wrong key in body', () => {
      const { req, res, next } = makeReqResNext({ body: { api_key: 'wrong-key' } });
      apiKey(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res._status).toBe(401);
    });

    it('returns 401 for a partial match (not a timing-safe bypass)', () => {
      const partial = VALID_KEY.slice(0, 5);
      const { req, res, next } = makeReqResNext({ header: partial });
      apiKey(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res._status).toBe(401);
    });
  });

  describe('safeCompare edge cases', () => {
    it('returns 401 for empty string key in header', () => {
      const { req, res, next } = makeReqResNext({ header: '' });
      apiKey(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res._status).toBe(401);
    });

    it('returns 401 when body.api_key is non-string (gracefully handled)', () => {
      const { req, res, next } = makeReqResNext({ body: { api_key: 12345 } });
      apiKey(req, res, next);
      expect(res._status).toBe(401);
    });
  });
});
