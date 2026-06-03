// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from './useAuth';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <AuthProvider>{children}</AuthProvider>
);

const makeUser = (overrides = {}) => ({
  id: 'user-1',
  email: 'test@example.com',
  role: 'AUTHOR' as const,
  plan: 'FREE' as const,
  ai_magic_fix_enabled: false,
  daily_jobs_limit: 10,
  jobs_used_today: 0,
  ...overrides,
});

const mockOkFetch = (body: unknown) =>
  vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(body),
  });

beforeEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
});

afterEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe('AuthProvider / useAuth', () => {
  describe('initial state (no token)', () => {
    it('starts as unauthenticated when no token is stored', async () => {
      vi.stubGlobal('fetch', vi.fn());
      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => expect(result.current.isAuthenticated).toBe(false));
      expect(result.current.user).toBeNull();
    });
  });

  describe('login', () => {
    it('sets isAuthenticated=true and user after login', () => {
      vi.stubGlobal('fetch', vi.fn());
      const { result } = renderHook(() => useAuth(), { wrapper });
      const user = makeUser();

      act(() => {
        result.current.login('jwt-token-123', user);
      });

      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.user).toEqual(user);
    });

    it('stores the auth token in localStorage after login', () => {
      vi.stubGlobal('fetch', vi.fn());
      const { result } = renderHook(() => useAuth(), { wrapper });

      act(() => {
        result.current.login('jwt-token-abc', makeUser());
      });

      expect(localStorage.getItem('ppos_auth_token')).toBe('jwt-token-abc');
    });

    it('stores the refresh token when provided', () => {
      vi.stubGlobal('fetch', vi.fn());
      const { result } = renderHook(() => useAuth(), { wrapper });

      act(() => {
        result.current.login('token', makeUser(), 'refresh-tok-xyz');
      });

      expect(localStorage.getItem('ppos_refresh_token')).toBe('refresh-tok-xyz');
    });

    it('does not store a refresh token when not provided', () => {
      vi.stubGlobal('fetch', vi.fn());
      const { result } = renderHook(() => useAuth(), { wrapper });

      act(() => {
        result.current.login('token', makeUser());
      });

      expect(localStorage.getItem('ppos_refresh_token')).toBeNull();
    });
  });

  describe('logout', () => {
    it('clears isAuthenticated and user after logout', () => {
      vi.stubGlobal('fetch', vi.fn());
      const { result } = renderHook(() => useAuth(), { wrapper });

      act(() => {
        result.current.login('tok', makeUser());
      });

      act(() => {
        result.current.logout();
      });

      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.user).toBeNull();
    });

    it('removes tokens from localStorage after logout', () => {
      vi.stubGlobal('fetch', vi.fn());
      const { result } = renderHook(() => useAuth(), { wrapper });

      act(() => {
        result.current.login('tok', makeUser(), 'rtok');
      });
      act(() => {
        result.current.logout();
      });

      expect(localStorage.getItem('ppos_auth_token')).toBeNull();
      expect(localStorage.getItem('ppos_refresh_token')).toBeNull();
    });
  });

  describe('refreshSession', () => {
    it('sets user and isAuthenticated=true when /api/auth/me returns ok', async () => {
      const user = makeUser({ email: 'refreshed@example.com' });
      localStorage.setItem('ppos_auth_token', 'valid-token');
      vi.stubGlobal('fetch', mockOkFetch(user));

      const { result } = renderHook(() => useAuth(), { wrapper });

      // Wait until user is populated (isAuthenticated may already be true from localStorage)
      await waitFor(() => expect(result.current.user).not.toBeNull());
      expect(result.current.user?.email).toBe('refreshed@example.com');
      expect(result.current.isAuthenticated).toBe(true);
    });

    it('clears auth and sets isAuthenticated=false when /api/auth/me returns not-ok', async () => {
      localStorage.setItem('ppos_auth_token', 'bad-token');
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => expect(result.current.isAuthenticated).toBe(false));
      expect(result.current.user).toBeNull();
      expect(localStorage.getItem('ppos_auth_token')).toBeNull();
    });

    it('sets isAuthenticated=false when called manually with no token stored', async () => {
      vi.stubGlobal('fetch', vi.fn());
      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        await result.current.refreshSession();
      });

      expect(result.current.isAuthenticated).toBe(false);
    });
  });

  describe('error boundary', () => {
    it('throws when used outside AuthProvider', () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      expect(() => {
        renderHook(() => useAuth());
      }).toThrow('useAuth must be used within an AuthProvider');
      spy.mockRestore();
    });
  });
});
