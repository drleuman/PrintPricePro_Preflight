import { useState, useCallback } from 'react';
import { getAuthToken, setAuthToken, clearAuthTokens } from '../lib/apiClient';

export function useAuth() {
    const [isAuthenticated, setIsAuthenticated] = useState(!!getAuthToken());

    /**
     * Development Login Bridge
     * Calls the PPOS Preflight Service dev-only token endpoint.
     */
    const loginDev = useCallback(async (userId: string = 'demo-user', tenantId: string = 'tenant-ppos-default') => {
        try {
            // We use raw fetch here because we don't have a token yet
            const res = await fetch('/api/auth/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId,
                    tenantId,
                    role: 'ADMIN',
                    scopes: ['preflight:write', 'preflight:analyze', 'jobs:read', 'admin:read']
                })
            });

            if (!res.ok) throw new Error('Auth bridge failed');

            const data = await res.json();
            if (data.token) {
                setAuthToken(data.token);
                setIsAuthenticated(true);
                return true;
            }
            return false;
        } catch (err) {
            console.error('[AUTH-BRIDGE-ERROR]', err);
            return false;
        }
    }, []);

    const logout = useCallback(() => {
        clearAuthTokens();
        setIsAuthenticated(false);
    }, []);

    return {
        isAuthenticated,
        loginDev,
        logout
    };
}
