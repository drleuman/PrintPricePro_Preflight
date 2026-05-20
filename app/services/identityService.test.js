import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';
import jwt from 'jsonwebtoken';

const require = createRequire(import.meta.url);

// Must set env vars before requiring the module to ensure consistent behavior
const TEST_SECRET = 'test-identity-service-secret';
const TEST_ISSUER = 'https://auth.printprice.pro';
const TEST_AUDIENCE = 'ppos:control';

describe('identityService', () => {
  let identityService;

  beforeEach(() => {
    process.env.JWT_SECRET = TEST_SECRET;
    process.env.JWT_ISSUER = TEST_ISSUER;
    process.env.JWT_AUDIENCE = TEST_AUDIENCE;
    delete process.env.PPOS_INTERNAL_SCOPES;
    // Re-require to pick up env vars (module may be cached; test the functions directly)
    identityService = require('./identityService');
  });

  afterEach(() => {
    delete process.env.JWT_SECRET;
    delete process.env.JWT_ISSUER;
    delete process.env.JWT_AUDIENCE;
    delete process.env.PPOS_INTERNAL_SCOPES;
  });

  // ---------------------------------------------------------------------------
  // getScopes
  // ---------------------------------------------------------------------------
  describe('getScopes', () => {
    it('always includes preflight:read', () => {
      const scopes = identityService.getScopes();
      expect(scopes).toContain('preflight:read');
    });

    it('always includes jobs:read', () => {
      const scopes = identityService.getScopes();
      expect(scopes).toContain('jobs:read');
    });

    it('parses custom scopes from PPOS_INTERNAL_SCOPES env', () => {
      process.env.PPOS_INTERNAL_SCOPES = 'custom:scope,another:scope';
      const scopes = identityService.getScopes();
      expect(scopes).toContain('custom:scope');
      expect(scopes).toContain('another:scope');
      // Still forces preflight:read and jobs:read
      expect(scopes).toContain('preflight:read');
      expect(scopes).toContain('jobs:read');
    });

    it('deduplicates preflight:read when already present in env', () => {
      process.env.PPOS_INTERNAL_SCOPES = 'preflight:read,jobs:read,custom:scope';
      const scopes = identityService.getScopes();
      const count = scopes.filter(s => s === 'preflight:read').length;
      expect(count).toBe(1);
    });
  });

  // ---------------------------------------------------------------------------
  // mapProductRoleToPposRole (tested via buildInternalAuthPayload)
  // ---------------------------------------------------------------------------
  describe('mapProductRoleToPposRole', () => {
    it('maps DEVELOPER to tenant_admin', () => {
      const payload = identityService.buildInternalAuthPayload({ appRole: 'DEVELOPER' });
      expect(payload.role).toBe('tenant_admin');
    });

    it('maps AUTHOR to member', () => {
      const payload = identityService.buildInternalAuthPayload({ appRole: 'AUTHOR' });
      expect(payload.role).toBe('member');
    });

    it('maps PUBLISHER to member', () => {
      const payload = identityService.buildInternalAuthPayload({ appRole: 'PUBLISHER' });
      expect(payload.role).toBe('member');
    });

    it('maps PRINT_HOUSE to member', () => {
      const payload = identityService.buildInternalAuthPayload({ appRole: 'PRINT_HOUSE' });
      expect(payload.role).toBe('member');
    });

    it('maps unknown roles to member (fallback)', () => {
      const payload = identityService.buildInternalAuthPayload({ appRole: 'UNKNOWN_ROLE' });
      expect(payload.role).toBe('member');
    });

    it('defaults to DEVELOPER role when no role is provided', () => {
      const payload = identityService.buildInternalAuthPayload({});
      expect(payload.role).toBe('tenant_admin');
    });
  });

  // ---------------------------------------------------------------------------
  // buildInternalAuthPayload
  // ---------------------------------------------------------------------------
  describe('buildInternalAuthPayload', () => {
    it('includes sub from user.id', () => {
      const payload = identityService.buildInternalAuthPayload({ id: 'user-123' });
      expect(payload.sub).toBe('user-123');
    });

    it('falls back to user.userId for sub', () => {
      const payload = identityService.buildInternalAuthPayload({ userId: 'u-456' });
      expect(payload.sub).toBe('u-456');
    });

    it('falls back to user.sub for sub', () => {
      const payload = identityService.buildInternalAuthPayload({ sub: 'sub-789' });
      expect(payload.sub).toBe('sub-789');
    });

    it('uses default sub when no id is present', () => {
      const payload = identityService.buildInternalAuthPayload({});
      expect(payload.sub).toBe('printprice-preflight-app');
    });

    it('includes email from user', () => {
      const payload = identityService.buildInternalAuthPayload({ email: 'test@example.com' });
      expect(payload.email).toBe('test@example.com');
    });

    it('includes scopes array', () => {
      const payload = identityService.buildInternalAuthPayload({});
      expect(Array.isArray(payload.scopes)).toBe(true);
      expect(payload.scopes.length).toBeGreaterThan(0);
    });

    it('includes scope string (space-separated)', () => {
      const payload = identityService.buildInternalAuthPayload({});
      expect(typeof payload.scope).toBe('string');
      expect(payload.scope).toContain('preflight:read');
    });

    it('preserves original appRole', () => {
      const payload = identityService.buildInternalAuthPayload({ appRole: 'PUBLISHER' });
      expect(payload.appRole).toBe('PUBLISHER');
    });

    it('uses first element of roles array when roles is an array', () => {
      const payload = identityService.buildInternalAuthPayload({ roles: ['AUTHOR', 'DEVELOPER'] });
      expect(payload.appRole).toBe('AUTHOR');
    });
  });

  // ---------------------------------------------------------------------------
  // generateInternalToken
  // ---------------------------------------------------------------------------
  describe('generateInternalToken', () => {
    it('generates a valid JWT string', () => {
      const token = identityService.generateInternalToken({ id: 'user-1' });
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3);
    });

    it('JWT can be verified with the configured secret', () => {
      const token = identityService.generateInternalToken({ id: 'user-1' });
      const decoded = jwt.verify(token, TEST_SECRET, {
        algorithms: ['HS256'],
        issuer: TEST_ISSUER,
        audience: TEST_AUDIENCE,
      });
      expect(decoded.sub).toBe('user-1');
    });

    it('respects custom expiresIn', () => {
      const token = identityService.generateInternalToken({}, '1s');
      const decoded = jwt.decode(token);
      expect(decoded.exp - decoded.iat).toBeLessThanOrEqual(2); // ~1s
    });
  });

  // ---------------------------------------------------------------------------
  // getAuthHeaders
  // ---------------------------------------------------------------------------
  describe('getAuthHeaders', () => {
    it('returns an Authorization header', () => {
      const headers = identityService.getAuthHeaders({ id: 'user-1' });
      expect(headers).toHaveProperty('Authorization');
    });

    it('Authorization header starts with "Bearer "', () => {
      const headers = identityService.getAuthHeaders({});
      expect(headers.Authorization).toMatch(/^Bearer .+/);
    });

    it('the token in the header is a valid JWT', () => {
      const headers = identityService.getAuthHeaders({ id: 'user-1' });
      const token = headers.Authorization.replace('Bearer ', '');
      expect(() =>
        jwt.verify(token, TEST_SECRET, {
          algorithms: ['HS256'],
          issuer: TEST_ISSUER,
          audience: TEST_AUDIENCE,
        })
      ).not.toThrow();
    });
  });

  // ---------------------------------------------------------------------------
  // getToken (legacy)
  // ---------------------------------------------------------------------------
  describe('getToken', () => {
    it('returns a valid JWT string', () => {
      const token = identityService.getToken();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3);
    });
  });
});
