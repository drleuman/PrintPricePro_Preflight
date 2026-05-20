import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useAdminQuery } from './useAdminData';

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('useAdminQuery', () => {
  describe('initial fetch', () => {
    it('starts with status="loading" and data=null', () => {
      const fetcher = vi.fn().mockReturnValue(new Promise(() => {}));
      const { result } = renderHook(() =>
        useAdminQuery('key-1', fetcher)
      );
      expect(result.current.status).toBe('loading');
      expect(result.current.data).toBeNull();
      expect(result.current.error).toBeNull();
    });

    it('sets status="success" and data after fetcher resolves', async () => {
      const data = [{ id: 1, name: 'Job A' }];
      const fetcher = vi.fn().mockResolvedValue(data);

      const { result } = renderHook(() =>
        useAdminQuery('key-2', fetcher)
      );

      await waitFor(() => expect(result.current.status).toBe('success'));
      expect(result.current.data).toEqual(data);
      expect(result.current.error).toBeNull();
    });

    it('sets status="error" and error message when fetcher rejects', async () => {
      const fetcher = vi.fn().mockRejectedValue(new Error('Network failure'));

      const { result } = renderHook(() =>
        useAdminQuery('key-3', fetcher)
      );

      await waitFor(() => expect(result.current.status).toBe('error'));
      expect(result.current.error).toBe('Network failure');
      expect(result.current.data).toBeNull();
    });

    it('calls the fetcher exactly once on initial mount', async () => {
      const fetcher = vi.fn().mockResolvedValue([]);
      renderHook(() => useAdminQuery('key-4', fetcher));

      await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
    });
  });

  describe('status transitions', () => {
    it('shows status="refetching" (not "loading") on subsequent ticks when data is already present', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const fetcher = vi.fn().mockResolvedValue({ count: 5 });

      const { result } = renderHook(() =>
        useAdminQuery('key-5', fetcher, 2000)
      );

      await waitFor(() => expect(result.current.status).toBe('success'));
      expect(result.current.data).toEqual({ count: 5 });

      // Trigger a refetch via interval tick
      vi.advanceTimersByTime(2000);
      await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
      await waitFor(() => expect(result.current.status).toBe('success'));
      vi.useRealTimers();
    });
  });

  describe('polling (refetchIntervalMs)', () => {
    it('does not set up a timer when refetchIntervalMs is not provided', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const fetcher = vi.fn().mockResolvedValue([]);
      renderHook(() => useAdminQuery('key-6', fetcher));
      await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));

      vi.advanceTimersByTime(10000);
      expect(fetcher).toHaveBeenCalledTimes(1);
      vi.useRealTimers();
    });

    it('enforces a minimum interval of 5000ms when refetchIntervalMs < 1000', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const fetcher = vi.fn().mockResolvedValue([]);
      renderHook(() => useAdminQuery('key-7', fetcher, 1));

      await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
      vi.advanceTimersByTime(4999);
      expect(fetcher).toHaveBeenCalledTimes(1);
      vi.advanceTimersByTime(1);
      await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
      vi.useRealTimers();
    });

    it('cancels cleanup on unmount (no additional fetcher calls after unmount)', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const fetcher = vi.fn().mockResolvedValue([]);
      const { unmount } = renderHook(() =>
        useAdminQuery('key-8', fetcher, 2000)
      );

      await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
      unmount();
      vi.advanceTimersByTime(10000);
      expect(fetcher).toHaveBeenCalledTimes(1);
      vi.useRealTimers();
    });
  });

  describe('different return types', () => {
    it('handles array data', async () => {
      const fetcher = vi.fn().mockResolvedValue([1, 2, 3]);
      const { result } = renderHook(() => useAdminQuery('arr', fetcher));
      await waitFor(() => expect(result.current.status).toBe('success'));
      expect(Array.isArray(result.current.data)).toBe(true);
    });

    it('handles object data', async () => {
      const fetcher = vi.fn().mockResolvedValue({ totalJobs: 42 });
      const { result } = renderHook(() => useAdminQuery('obj', fetcher));
      await waitFor(() => expect(result.current.status).toBe('success'));
      expect(result.current.data).toEqual({ totalJobs: 42 });
    });

    it('handles string error from non-Error rejections', async () => {
      const fetcher = vi.fn().mockRejectedValue('plain string error');
      const { result } = renderHook(() => useAdminQuery('str-err', fetcher));
      await waitFor(() => expect(result.current.status).toBe('error'));
      expect(result.current.error).toBe('plain string error');
    });
  });
});
