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
        'X-Request-ID': requestId,
        ...(options?.headers as any || {}),
    };

    // P0: Strict Auth Enforcement - Do NOT allow options.headers to drop/blank the token if it exists
    const isGeminiProxy = path.startsWith('/api/gemini-proxy/');
    if (token && !isGeminiProxy) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    if (process.env.NODE_ENV === 'development') {
        console.log(`[API-FETCH][${requestId}] ${options?.method || 'GET'} ${path}`, {
            hasToken: !!token
        });
    }

    // Idempotency for mutations
    if (['POST', 'PUT', 'PATCH'].includes(options?.method || 'GET') && !headers['Idempotency-Key']) {
        headers['Idempotency-Key'] = crypto.randomUUID?.() || Math.random().toString(36).substring(2);
    }

    // Auto-set Content-Type for JSON, but NEVER for FormData (let fetch handle boundary)
    const isFormData = options?.body instanceof FormData;
    if (options?.body && !isFormData && !headers['Content-Type']) {
        headers['Content-Type'] = 'application/json';
    }

    if (process.env.NODE_ENV === 'development' && isFormData) {
        console.log(`[API-FETCH][${requestId}][MULTIPART] FormData detected, proceeding without Content-Type header.`);
    }

    let res = await fetch(path, {
        ...options,
        headers,
    });

    // Handle Auth Failures (401) - Attempt Refresh
    if (res.status === 401) {
        const refreshToken = getRefreshToken();
        const isRefreshAttempt = path.includes('/api/auth/refresh');

        if (refreshToken && !isRefreshAttempt) {
            console.log(`[API-CLIENT][${requestId}][AUTH-DRIFT] 401 detected. Attempting session recovery via refresh token...`);
            try {
                const refreshRes = await fetch('/api/auth/refresh', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ refreshToken })
                });

                if (refreshRes.ok) {
                    const { token: newToken } = await refreshRes.json();
                    console.log(`[API-CLIENT][${requestId}][REFRESH-SUCCESS] Session recovered. Retrying original request.`);
                    setAuthToken(newToken);
                    
                    // Retry original request with new token
                    if (!isGeminiProxy) {
                        headers['Authorization'] = `Bearer ${newToken}`;
                    }
                    res = await fetch(path, { ...options, headers });
                } else {
                    console.error(`[API-CLIENT][${requestId}][REFRESH-FAILURE] Refresh terminal. Clearing tokens. Status: ${refreshRes.status}`);
                    clearAuthTokens();
                    window.location.reload(); // Force re-auth
                }
            } catch (e) {
                console.error(`[API-CLIENT][${requestId}][REFRESH-CRASH]`, e);
                clearAuthTokens();
                throw e;
            }
        }
    }

    if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        
        // PPOS V2.4 Error Contract Normalization
        let errorMessage = errorData.message || errorData.error || `Request failed with status ${res.status}`;
        let errorCode = errorData.code || errorData.error || 'UNKNOWN_ERROR';

        if (res.status === 408) {
            errorCode = 'UPLOAD_TIMEOUT';
            errorMessage = 'The upload timed out. Your file may be too large for your connection speed. Please try again on a faster network.';
        }

        if (res.status === 413) {
            if (path.includes('/actions/fix')) {
                errorCode = 'MAGIC_FIX_PAYLOAD_TOO_LARGE';
                errorMessage = "The AI Magic request was too large. Magic Fix should use the stored source job and must not resend the PDF.";
            } else if (path.includes('/jobs') && options?.method === 'POST' && options?.body instanceof FormData) {
                errorCode = 'FILE_TOO_LARGE';
            } else {
                errorCode = 'PAYLOAD_TOO_LARGE';
            }
        }
        
        const err: any = new Error(errorMessage);
        err.status = res.status;
        err.code = errorCode;
        err.traceId = errorData.traceId || headers['X-Request-ID'] || 'LOCAL-TRACE';
        err.data = errorData;
        err.v2 = !!errorData.v2;
        
        console.error(`[API-ERROR][${err.traceId}]`, {
            status: err.status,
            code: err.code,
            message: err.message
        });

        throw err;
    }

    // Content-Type based response parsing
    const contentType = res.headers.get('content-type');
    if (contentType && contentType.includes('application/pdf')) return res.blob() as any;
    if (contentType && contentType.includes('application/json')) return res.json() as Promise<T>;
    return res.text() as any;
}

type FetchWithProgressOptions = Omit<RequestInit, 'body'> & {
    body?: FormData;
    onUploadProgress?: (pct: number, loaded: number, total: number) => void;
};

export function pposFetchWithProgress<T>(path: string, options: FetchWithProgressOptions = {}): Promise<T> {
    return new Promise((resolve, reject) => {
        const { onUploadProgress, body, ...restOptions } = options;
        const token = getAuthToken();
        const requestId = crypto.randomUUID?.() || Math.random().toString(36).substring(2);

        const xhr = new XMLHttpRequest();
        xhr.open(restOptions.method || 'GET', path);

        xhr.setRequestHeader('X-Request-ID', requestId);
        if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        xhr.setRequestHeader('Idempotency-Key', crypto.randomUUID?.() || Math.random().toString(36).substring(2));

        if (onUploadProgress && xhr.upload) {
            xhr.upload.onprogress = (e) => {
                if (e.lengthComputable) {
                    onUploadProgress(Math.round((e.loaded / e.total) * 100), e.loaded, e.total);
                }
            };
        }

        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                const ct = xhr.getResponseHeader('content-type') || '';
                try {
                    if (ct.includes('application/json')) {
                        resolve(JSON.parse(xhr.responseText) as T);
                    } else {
                        resolve(xhr.responseText as any);
                    }
                } catch {
                    resolve(xhr.responseText as any);
                }
            } else {
                let errorData: any = {};
                try { errorData = JSON.parse(xhr.responseText); } catch { /* empty */ }

                let errorMessage = errorData.message || errorData.error || `Request failed with status ${xhr.status}`;
                let errorCode = errorData.code || errorData.error || 'UNKNOWN_ERROR';

                if (xhr.status === 413) {
                    errorCode = 'FILE_TOO_LARGE';
                }

                const err: any = new Error(errorMessage);
                err.status = xhr.status;
                err.code = errorCode;
                err.traceId = errorData.traceId || requestId;
                err.data = errorData;
                err.v2 = !!errorData.v2;
                reject(err);
            }
        };

        xhr.onerror = () => {
            const err: any = new Error('Network error during upload');
            err.code = 'NETWORK_ERROR';
            err.traceId = requestId;
            reject(err);
        };

        xhr.send(body);
    });
}
