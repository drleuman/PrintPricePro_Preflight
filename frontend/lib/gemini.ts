import { pposFetch } from './apiClient';

/**
 * Gemini Model Configuration
 * Centralized here to avoid hardcoded models across components.
 * Deprecated models (1.5-flash, 2.0-flash, 2.0-flash-lite) are avoided.
 * Models available through the current proxy: 2.5-flash, 2.5-pro, 2.5-flash-lite.
 */

export const GEMINI_API_VER = 'v1';
export const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';

export async function pickAvailableModel(): Promise<string> {
    try {
        const response = await pposFetch<any>(`/api/gemini-proxy/${GEMINI_API_VER}/models?pageSize=200`);
        const list: any[] = Array.isArray(response?.models) ? response.models : [];
        
        const genPossible = list.filter((m) => 
            (m.supportedGenerationMethods || []).includes('generateContent') &&
            !m.name.includes('1.5-flash') && // Avoid 1.5-flash (NOT_FOUND)
            !m.name.includes('2.0-flash')    // Avoid 2.0-flash (Deprecated)
        );

        if (genPossible.length === 0) {
            return DEFAULT_GEMINI_MODEL;
        }

        // Priority Logic: 2.5-flash -> 2.5-pro -> 2.5-flash-lite -> any 2.5 -> any other
        const has = (k: string) => genPossible.find((m) => m.name?.toLowerCase().includes(k));
        
        const candidate = has('2.5-flash') || 
                          has('2.5-pro') || 
                          has('2.5-flash-lite') ||
                          has('2.5') || 
                          genPossible[0];

        return (candidate?.name || `models/${DEFAULT_GEMINI_MODEL}`).replace(/^models\//, '');
    } catch (err) {
        console.warn('[GEMINI-RESOLVER] Failed to list models, using hard default:', DEFAULT_GEMINI_MODEL);
        return DEFAULT_GEMINI_MODEL;
    }
}
