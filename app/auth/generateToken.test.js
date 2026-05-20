import { describe, it, expect, vi } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

// Inject a mock for identityService into the module cache BEFORE requiring generateToken,
// so generateToken.js gets our mock when it calls require('../services/identityService').
const identityServicePath = require.resolve('../services/identityService');

const mockGenerateInternalToken = vi.fn((payload, expiresIn) =>
  `mock-jwt.${JSON.stringify(payload)}.${expiresIn}`
);

require.cache[identityServicePath] = {
  id: identityServicePath,
  filename: identityServicePath,
  loaded: true,
  exports: {
    generateInternalToken: mockGenerateInternalToken,
    getAuthHeaders: vi.fn(),
    getToken: vi.fn(),
    getScopes: vi.fn(() => []),
    buildInternalAuthPayload: vi.fn(),
    mapProductRoleToPposRole: vi.fn(),
  },
  parent: null,
  children: [],
  paths: [],
};

const { generateToken } = require('./generateToken');

describe('generateToken', () => {
  it('delegates to identityService.generateInternalToken', () => {
    const payload = { sub: 'test-user', role: 'tenant_admin' };
    generateToken(payload, '1h');
    expect(mockGenerateInternalToken).toHaveBeenCalledWith(payload, '1h');
  });

  it('returns the value from identityService.generateInternalToken', () => {
    const payload = { sub: 'svc', role: 'internal' };
    const result = generateToken(payload, '5m');
    expect(result).toContain('mock-jwt');
  });

  it('uses "24h" as the default expiresIn when not provided', () => {
    const payload = { sub: 'default-expiry' };
    generateToken(payload);
    expect(mockGenerateInternalToken).toHaveBeenCalledWith(payload, '24h');
  });

  it('passes any payload through without modification', () => {
    const payload = { sub: 'u1', role: 'viewer', extra: { nested: true } };
    generateToken(payload, '30m');
    expect(mockGenerateInternalToken).toHaveBeenCalledWith(payload, '30m');
  });
});
