/**
 * PrintPrice OS — Unified API Client
 * 
 * Centralized fetch wrapper for the Product App to communicate with PPOS services.
 */

const PPOS_AUTH_TOKEN_KEY = 'ppos_auth_token';
const PPOS_REFRESH_TOKEN_KEY = 'ppos_refresh_token';

export const getAuthToken = () => localStorage.getItem(PPOS_AUTH_TOKEN_KEY);
export const setAuthToken = (token: string) => localStorage.setItem(PPOS_AUTH_TOKEN_KEY, token);
export const getRefreshToken = () => localStorage.getItem(PPOS_REFRESH_TOKEN_KEY);
export const setRefreshToken = (token: string) => localStorage.setItem(PPOS_REFRESH_TOKEN_KEY, token);
export const clearAuthTokens = () => {
    localStorage.removeItem(PPOS_AUTH_TOKEN_KEY);
    localStorage.removeItem(PPOS_REFRESH_TOKEN_KEY);
};

export async function pposFetch<T>(path: string, options?: RequestInit): Promise<T> {
    const token = getAuthToken();
    const requestId = crypto.randomUUID?.() || Math.random().toString(36).substring(2);
    
    // Build headers
    const headers: Record<string, string> = {
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        'X-Request-ID': requestId,
        ...(options?.headers as any || {}),
    };

    // Idempotency for mutations
    if (['POST', 'PUT', 'PATCH'].includes(options?.method || 'GET') && !headers['Idempotency-Key']) {
        headers['Idempotency-Key'] = crypto.randomUUID?.() || Math.random().toString(36).substring(2);
    }

    // Auto-set Content-Type for JSON
    if (options?.body && !(options.body instanceof FormData) && !headers['Content-Type']) {
        headers['Content-Type'] = 'application/json';
    }

    let res = await fetch(path, {
        ...options,
        headers,
    });

    // Handle Auth Failures (401) - Attempt Refresh
    if (res.status === 401) {
        const refreshToken = getRefreshToken();
        if (refreshToken) {
            try {
                const refreshRes = await fetch('/api/auth/refresh', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ refreshToken })
                });

                if (refreshRes.ok) {
                    const { token: newToken } = await refreshRes.json();
                    setAuthToken(newToken);
                    
                    // Retry original request with new token
                    headers['Authorization'] = `Bearer ${newToken}`;
                    res = await fetch(path, { ...options, headers });
                } else {
                    clearAuthTokens();
                    window.location.reload(); // Force re-auth
                }
            } catch (e) {
                clearAuthTokens();
                throw e;
            }
        }
    }

    if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        // Normalización PPOS Error Contract
        const pposError = errorData.error || {};
        const message = pposError.message || errorData.message || `Request failed with status ${res.status}`;
        
        const err: any = new Error(message);
        err.status = res.status;
        err.code = pposError.code || 'UNKNOWN_ERROR';
        err.type = pposError.type || 'SYSTEM_ERROR';
        err.retryable = pposError.retryable || false;
        err.data = errorData;
        throw err;
    }

    // Content-Type based response parsing
    const contentType = res.headers.get('content-type');
    if (contentType && contentType.includes('application/pdf')) return res.blob() as any;
    if (contentType && contentType.includes('application/json')) return res.json() as Promise<T>;
    return res.text() as any;
}
