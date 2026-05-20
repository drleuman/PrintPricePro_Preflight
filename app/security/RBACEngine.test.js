// JWT_SECRET must be set before AuthService loads
import { describe, it, expect, beforeAll } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret-for-unit-tests';
});

const RBACEngine = require('./RBACEngine');
const AuthService = require('./AuthService');

const { JOBS_READ, JOBS_WRITE, ANALYTICS, BATCH_MANAGE, TENANT_ADMIN, SYSTEM_ADMIN } = AuthService.SCOPES;

// ---------------------------------------------------------------------------
// RBACEngine.authorize
// ---------------------------------------------------------------------------
describe('RBACEngine.authorize', () => {
  it('returns false when req.tenant is missing', () => {
    expect(RBACEngine.authorize({}, JOBS_READ)).toBe(false);
  });

  it('returns false when req.tenant.scopes is missing', () => {
    expect(RBACEngine.authorize({ tenant: {} }, JOBS_READ)).toBe(false);
  });

  it('returns false when required scope is not in tenant scopes', () => {
    const req = { tenant: { scopes: [JOBS_READ] } };
    expect(RBACEngine.authorize(req, JOBS_WRITE)).toBe(false);
  });

  it('returns true when required scope is present', () => {
    const req = { tenant: { scopes: [JOBS_READ, JOBS_WRITE] } };
    expect(RBACEngine.authorize(req, JOBS_WRITE)).toBe(true);
  });

  it('grants access to any scope when SYSTEM_ADMIN is present (superuser bypass)', () => {
    const req = { tenant: { scopes: [SYSTEM_ADMIN] } };
    expect(RBACEngine.authorize(req, TENANT_ADMIN)).toBe(true);
    expect(RBACEngine.authorize(req, BATCH_MANAGE)).toBe(true);
    expect(RBACEngine.authorize(req, JOBS_WRITE)).toBe(true);
  });

  it('requires exact scope match — analytics:read does not satisfy jobs:write', () => {
    const req = { tenant: { scopes: [ANALYTICS] } };
    expect(RBACEngine.authorize(req, JOBS_WRITE)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// RBACEngine.getScopesFromRole
// ---------------------------------------------------------------------------
describe('RBACEngine.getScopesFromRole', () => {
  it('returns correct scopes for TENANT_ADMIN', () => {
    const scopes = RBACEngine.getScopesFromRole('TENANT_ADMIN');
    expect(scopes).toContain(JOBS_READ);
    expect(scopes).toContain(JOBS_WRITE);
    expect(scopes).toContain(ANALYTICS);
    expect(scopes).toContain(BATCH_MANAGE);
    expect(scopes).toContain(TENANT_ADMIN);
  });

  it('returns correct scopes for OPERATOR', () => {
    const scopes = RBACEngine.getScopesFromRole('OPERATOR');
    expect(scopes).toContain(JOBS_READ);
    expect(scopes).toContain(JOBS_WRITE);
    expect(scopes).toContain(ANALYTICS);
    expect(scopes).toContain(BATCH_MANAGE);
    expect(scopes).not.toContain(TENANT_ADMIN);
  });

  it('returns correct scopes for VIEWER — read-only', () => {
    const scopes = RBACEngine.getScopesFromRole('VIEWER');
    expect(scopes).toContain(JOBS_READ);
    expect(scopes).toContain(ANALYTICS);
    expect(scopes).not.toContain(JOBS_WRITE);
    expect(scopes).not.toContain(BATCH_MANAGE);
    expect(scopes).not.toContain(TENANT_ADMIN);
  });

  it('returns empty array for unknown role', () => {
    expect(RBACEngine.getScopesFromRole('UNKNOWN_ROLE')).toEqual([]);
    expect(RBACEngine.getScopesFromRole(undefined)).toEqual([]);
    expect(RBACEngine.getScopesFromRole(null)).toEqual([]);
  });

  it('OPERATOR does not have TENANT_ADMIN scope — privilege escalation guard', () => {
    const scopes = RBACEngine.getScopesFromRole('OPERATOR');
    expect(scopes).not.toContain(TENANT_ADMIN);
    expect(scopes).not.toContain(SYSTEM_ADMIN);
  });

  it('VIEWER does not have write or admin scopes', () => {
    const scopes = RBACEngine.getScopesFromRole('VIEWER');
    expect(scopes).not.toContain(JOBS_WRITE);
    expect(scopes).not.toContain(BATCH_MANAGE);
    expect(scopes).not.toContain(TENANT_ADMIN);
    expect(scopes).not.toContain(SYSTEM_ADMIN);
  });
});

// ---------------------------------------------------------------------------
// AuthService.checkScope (unit tests for shared helper)
// ---------------------------------------------------------------------------
describe('AuthService.checkScope', () => {
  it('returns false for null scopes', () => {
    expect(AuthService.checkScope(null, JOBS_READ)).toBe(false);
  });

  it('returns true when scope is present', () => {
    expect(AuthService.checkScope([JOBS_READ], JOBS_READ)).toBe(true);
  });

  it('returns false when scope is absent', () => {
    expect(AuthService.checkScope([JOBS_READ], JOBS_WRITE)).toBe(false);
  });

  it('returns true for any scope when SYSTEM_ADMIN is in list', () => {
    expect(AuthService.checkScope([SYSTEM_ADMIN], TENANT_ADMIN)).toBe(true);
  });
});
