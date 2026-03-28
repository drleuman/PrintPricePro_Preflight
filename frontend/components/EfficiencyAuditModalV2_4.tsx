import React, { useCallback, useEffect, useState } from 'react';
import { PreflightResult, FileMeta, Issue, ModalProps } from '../types';
import { SafeHtmlMarkdown } from './SafeHtmlMarkdown';
import { XMarkIcon, BeakerIcon } from '@heroicons/react/24/outline';
import { t } from '../i18n';

type ModelInfo = { name: string; supportedGenerationMethods?: string[] };
const API_VER = 'v1';

async function pickAvailableModel(): Promise<string> {
    const res = await fetch(`/api/gemini-proxy/${API_VER}/models?pageSize=200`);
    const data = await res.json();
    const list: ModelInfo[] = Array.isArray(data?.models) ? data.models : [];
    const gen = list.filter(m => (m.supportedGenerationMethods || []).includes('generateContent'));
    const by = (k: string) => gen.find(m => m.name?.toLowerCase().includes(k));
    return (by('flash')?.name || by('pro')?.name || gen[0]?.name || '').replace(/^models\//, '');
}

function extractText(json: any): string {
    try {
        const cand = json?.candidates?.[0];
        const parts = cand?.content?.parts;
        if (Array.isArray(parts)) return parts.map((p: any) => p?.text || '').join('\n\n').trim();
        return json?.output_text || '';
    } catch { return ''; }
}

interface EfficiencyAuditModalProps extends ModalProps {
    issue: Issue | null;
    fileMeta: FileMeta | null;
    result: PreflightResult | null;
}

export const EfficiencyAuditModalV2_4: React.FC<EfficiencyAuditModalProps> = ({
    isOpen,
    onClose,
    issue,
    fileMeta,
    result
}) => {
    const [loading, setLoading] = useState(false);
    const [aiResponse, setAiResponse] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const fetchAI = useCallback(async () => {
        setLoading(true); setError(null); setAiResponse(null);
        try {
            const model = await pickAvailableModel();
            const res = await fetch(`/api/gemini-proxy/${API_VER}/models/${encodeURIComponent(model)}:generateContent`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: "Efficiency checklist for " + (issue?.category || "General") }] }] }),
            });
            const json = await res.json();
            setAiResponse(extractText(json));
        } catch (e: any) { setError(e?.message || t('aiError')); } 
        finally { setLoading(false); }
    }, [issue]);

    useEffect(() => {
        if (isOpen) fetchAI();
        else { setAiResponse(null); setError(null); setLoading(false); }
    }, [isOpen, fetchAI]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[2147483647] flex items-center justify-center p-4 bg-[var(--bg-tertiary)]/95 backdrop-blur-xl animate-in fade-in duration-300">
            <div className="bg-[var(--bg-primary)] border border-[var(--border-color)] w-full max-w-xl flex flex-col shadow-[0_50px_100px_rgba(0,0,0,0.5)] overflow-hidden">
                
                {/* Header Signal */}
                <div className="p-6 border-b border-[var(--border-color)] flex items-center justify-between bg-[var(--bg-primary)]/40">
                    <div className="flex items-center gap-4">
                        <div className="h-10 w-10 border border-[var(--accent-color)]/30 bg-[var(--accent-color)]/10 flex items-center justify-center text-[var(--accent-color)]">
                            <BeakerIcon className="h-6 w-6" />
                        </div>
                        <div>
                            <div className="text-[0.82rem] font-black uppercase tracking-[0.25em] text-[var(--accent-color)]">EFFICIENCY_LAB v2.4</div>
                            <h2 className="text-xl font-extrabold tracking-tight text-[var(--text-primary)] uppercase">Optimization Protocol</h2>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
                        <XMarkIcon className="h-6 w-6" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar space-y-6">
                    {loading ? (
                        <div className="h-32 flex flex-col items-center justify-center gap-4">
                            <div className="h-6 w-6 border-2 border-[var(--accent-color)]/30 border-t-[var(--accent-color)] animate-spin rounded-full"></div>
                            <span className="text-[0.8rem] font-black uppercase tracking-widest text-[var(--text-muted)] animate-pulse">Running Simulation...</span>
                        </div>
                    ) : error ? (
                        <div className="p-4 border border-[var(--accent-color)]/30 bg-[var(--accent-color)]/5 text-[var(--accent-color)] text-[0.85rem] font-mono whitespace-pre-wrap">{error}</div>
                    ) : (
                        <div className="prose dark:prose-invert prose-sm max-w-none prose-headings:text-[var(--accent-color)] prose-headings:uppercase prose-headings:tracking-widest prose-headings:text-[0.85rem] prose-headings:font-black text-[var(--text-primary)]">
                            <SafeHtmlMarkdown markdown={aiResponse || ""} />
                        </div>
                    )}
                </div>

                <div className="p-6 border-t border-[var(--border-color)] flex justify-end bg-[var(--bg-primary)]/40">
                    <button 
                        onClick={onClose}
                        className="bg-[var(--hover-bg)] hover:bg-[var(--accent-color)]/5 text-[var(--text-primary)] px-8 py-3 text-[0.85rem] font-black uppercase tracking-[0.2em] transition-all border border-[var(--border-color)]"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};
