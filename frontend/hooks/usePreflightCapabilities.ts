import { useEffect, useRef, useState } from 'react';
import { pposFetch } from '../lib/apiClient';
import { PreflightCapability } from '../utils/fixCapabilityGate';

/**
 * Phase APP-40.1 — Capability Contract Alignment.
 *
 * Reads the live capability contract from `GET /api/v2/preflight/capabilities`
 * (BFF-normalized, proxying PrintPrice OS or serving a clearly-marked temporary
 * fallback). The frontend must use this — not hardcoded assumptions — to decide
 * which fixes are implemented, autofixable, review-required, or diagnostic-only.
 */

interface CapabilitiesResponse {
    ok: boolean;
    version?: string;
    source?: string;
    fallbackMode?: boolean;
    capabilities?: PreflightCapability[];
}

export interface UsePreflightCapabilitiesReturn {
    capabilities: PreflightCapability[];
    version: string | null;
    source: string | null;
    fallbackMode: boolean;
    loading: boolean;
    error: any | null;
    refresh: () => void;
}

export function usePreflightCapabilities(enabled: boolean = true): UsePreflightCapabilitiesReturn {
    const [capabilities, setCapabilities] = useState<PreflightCapability[]>([]);
    const [version, setVersion] = useState<string | null>(null);
    const [source, setSource] = useState<string | null>(null);
    const [fallbackMode, setFallbackMode] = useState<boolean>(false);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<any | null>(null);
    const fetchedRef = useRef(false);

    const load = () => {
        if (!enabled) return;
        setLoading(true);
        setError(null);

        pposFetch<CapabilitiesResponse>('/api/v2/preflight/capabilities', { method: 'GET' })
            .then((data) => {
                const list = Array.isArray(data?.capabilities) ? data.capabilities : [];
                setCapabilities(list);
                setVersion(data?.version || null);
                setSource(data?.source || null);
                setFallbackMode(!!data?.fallbackMode);
                console.log('[APP][CAPABILITIES][LOADED]', {
                    count: list.length,
                    version: data?.version,
                    source: data?.source,
                    fallbackMode: data?.fallbackMode,
                });
            })
            .catch((err) => {
                console.warn('[APP][CAPABILITIES][LOAD-FAILED]', err?.message || err);
                setError(err);
                setCapabilities([]);
            })
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        if (!enabled || fetchedRef.current) return;
        fetchedRef.current = true;
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enabled]);

    return { capabilities, version, source, fallbackMode, loading, error, refresh: load };
}
