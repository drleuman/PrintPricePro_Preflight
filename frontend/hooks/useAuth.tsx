import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { getAuthToken, setAuthToken, setRefreshToken, clearAuthTokens } from '../lib/apiClient';

interface User {
    id: string;
    email: string;
    role: 'AUTHOR' | 'PUBLISHER' | 'PRINT_HOUSE' | 'DEVELOPER';
    // Phase 39.1: plan now sourced from Control Plane (may include FOUNDING_PRINTHOUSE, CUSTOM, SYSTEM)
    plan: 'FREE' | 'PRO' | 'ENTERPRISE' | 'FOUNDING_PRINTHOUSE' | 'CUSTOM' | 'SYSTEM';
    ai_magic_fix_enabled: boolean;
    daily_jobs_limit: number | null;
    jobs_used_today: number;
    organization_name?: string;
    // Phase 39.1: Control Plane governance fields
    commercial_status?: 'ACTIVE' | 'GRACE_PERIOD' | 'SUSPENDED' | 'TRIAL' | 'UNKNOWN';
    access_level?: string | null;
    in_grace_period?: boolean;
    max_file_size_mb?: number | null;
    max_job_size_mb?: number | null;
    _governance_source?: 'CONTROL_PLANE' | 'LOCAL_FALLBACK';
}

interface AuthContextType {
    isAuthenticated: boolean;
    user: User | null;
    login: (token: string, userData: User, refreshToken?: string) => void;
    logout: () => void;
    refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [isAuthenticated, setIsAuthenticated] = useState<boolean>(!!getAuthToken());
    const [user, setUser] = useState<User | null>(null);

    const refreshSession = useCallback(async () => {
        const token = getAuthToken();
        if (!token) {
            setIsAuthenticated(false);
            setUser(null);
            return;
        }
        
        try {
            const res = await fetch('/api/auth/me', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const userData = await res.json();
                console.log('[AUTH][SESSION-RESTORED]', { email: userData.email, plan: userData.plan });
                setUser(userData);
                setIsAuthenticated(true);
            } else {
                clearAuthTokens();
                setIsAuthenticated(false);
                setUser(null);
            }
        } catch (e) {
            console.error('Session validation failed:', e);
            setIsAuthenticated(false);
            setUser(null);
        }
    }, []);

    useEffect(() => {
        if (!!getAuthToken()) {
            refreshSession();
        } else {
            setIsAuthenticated(false);
        }
    }, [refreshSession]);

    const login = useCallback((token: string, userData: User, refreshToken?: string) => {
        setAuthToken(token);
        if (refreshToken) {
            setRefreshToken(refreshToken);
        }
        setUser(userData);
        setIsAuthenticated(true);
    }, []);

    const logout = useCallback(() => {
        clearAuthTokens();
        setUser(null);
        setIsAuthenticated(false);
    }, []);

    return (
        <AuthContext.Provider value={{ isAuthenticated, user, login, logout, refreshSession }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
