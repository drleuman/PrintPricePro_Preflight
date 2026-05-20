import React from 'react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { ThemeProvider, useTheme } from './useTheme';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider>{children}</ThemeProvider>
);

beforeEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove('light', 'dark');
});

afterEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove('light', 'dark');
});

describe('ThemeProvider / useTheme', () => {
  describe('initial theme', () => {
    it('defaults to "dark" when localStorage has no saved theme', () => {
      const { result } = renderHook(() => useTheme(), { wrapper });
      expect(result.current.theme).toBe('dark');
    });

    it('restores the saved theme from localStorage', () => {
      localStorage.setItem('ppos_theme', 'light');
      const { result } = renderHook(() => useTheme(), { wrapper });
      expect(result.current.theme).toBe('light');
    });
  });

  describe('DOM side effects', () => {
    it('adds the current theme class to documentElement', () => {
      renderHook(() => useTheme(), { wrapper });
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });

    it('persists the current theme to localStorage', () => {
      renderHook(() => useTheme(), { wrapper });
      expect(localStorage.getItem('ppos_theme')).toBe('dark');
    });
  });

  describe('toggleTheme', () => {
    it('switches from dark to light', () => {
      const { result } = renderHook(() => useTheme(), { wrapper });

      act(() => {
        result.current.toggleTheme();
      });

      expect(result.current.theme).toBe('light');
    });

    it('switches from light back to dark', () => {
      localStorage.setItem('ppos_theme', 'light');
      const { result } = renderHook(() => useTheme(), { wrapper });

      act(() => {
        result.current.toggleTheme();
      });

      expect(result.current.theme).toBe('dark');
    });

    it('updates the documentElement class after toggle', () => {
      const { result } = renderHook(() => useTheme(), { wrapper });

      act(() => {
        result.current.toggleTheme();
      });

      expect(document.documentElement.classList.contains('light')).toBe(true);
      expect(document.documentElement.classList.contains('dark')).toBe(false);
    });

    it('persists the toggled theme to localStorage', () => {
      const { result } = renderHook(() => useTheme(), { wrapper });

      act(() => {
        result.current.toggleTheme();
      });

      expect(localStorage.getItem('ppos_theme')).toBe('light');
    });
  });

  describe('error boundary', () => {
    it('throws when used outside ThemeProvider', () => {
      // Suppress React's error boundary console output for this test
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      expect(() => {
        renderHook(() => useTheme());
      }).toThrow('useTheme must be used within ThemeProvider');
      spy.mockRestore();
    });
  });
});
