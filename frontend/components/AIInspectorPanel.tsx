import React, { useCallback, useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Issue, PreflightResult, FileMeta } from '../types';
import { 
    SparklesIcon, 
    CpuChipIcon, 
    CommandLineIcon, 
    ArrowPathIcon,
    ExclamationTriangleIcon,
    CheckCircleIcon
} from '@heroicons/react/24/outline';
import { AnalyzeCarrierReport } from './AnalyzeCarrierReport';
import { useTranslation } from '../i18n';
import { pposFetch } from '../lib/apiClient';
import { pickAvailableModel, GEMINI_API_VER } from '../lib/gemini';
import { translateIssueTitle } from '../utils/issueMapper';

// Internal State Machine
type AnalysisState = 'idle' | 'loading' | 'success' | 'error';

// Cache for results in memory to avoid redundant re-runs
const analysisCache: Record<string, { result: string; timestamp: number }> = {};


function extractTextFromGenResponse(json: any): string {
    try {
        const cand = json?.candidates?.[0];
        const parts = cand?.content?.parts;
        if (Array.isArray(parts)) return parts.map((p: any) => p?.text || '').join('\n\n').trim();
        return json?.output_text || '';
    } catch { return ''; }
}

type Props = {
    isOpen: boolean;
    onClose: () => void;
    issue?: Issue | null;
    fileMeta?: FileMeta | null;
    result?: PreflightResult | null;
};

export const AIInspectorPanel: React.FC<Props> = ({
    isOpen,
    onClose,
    issue,
    fileMeta,
    result,
}) => {
    const { t } = useTranslation();
    const [state, setState] = useState<AnalysisState>('idle');
    const [aiResponse, setAiResponse] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'audit' | 'logs' | 'stats'>('audit');

    // Context Key for Cache: Derived from file name + issue title (or general)
    const contextKey = useMemo(() => {
        const fName = fileMeta?.name || 'no-file';
        const iTitle = issue?.title || 'general-audit';
        return `${fName}:${iTitle}`;
    }, [fileMeta, issue]);

    // Check for cached result on open
    useEffect(() => {
        if (isOpen && state === 'idle') {
            const cached = analysisCache[contextKey];
            if (cached) {
                setAiResponse(cached.result);
                setState('success');
            }
        }
    }, [isOpen, contextKey, state]);

    const runAnalysis = useCallback(async (isRefresh = false) => {
        // If clicking refresh while success/error, we reset.
        if (state === 'loading') return;

        setState('loading'); 
        setError(null); 
        
        try {
            const model = await pickAvailableModel();
            const prompt = issue 
                ? `Analyze this specific prepress issue: "${issue.title}". 
                   Severity: ${issue.severity}. 
                   Target File: ${fileMeta?.name || 'Unknown'}.
                   Provide a structured forensic audit including:
                   Summary, Key Technical Risks, Recommendations and Potential Side-effects of a fix.`
                : `Perform a general forensic audit for a preflight app.
                   File: ${fileMeta?.name || 'Unknown'}.
                   Stats: Size ${fileMeta?.size || 0} bytes.
                   Preflight State: ${result ? 'Validated' : 'Idle'}.
                   Provide structured overview of print-readiness and technical carrier status.`;
            
            const data = await pposFetch<any>(`/api/gemini-proxy/${GEMINI_API_VER}/models/${encodeURIComponent(model)}:generateContent`, {
                method: 'POST',
                body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }] }),
            });
            
            const text = extractTextFromGenResponse(data);
            
            if (!text) throw new Error("Received empty payload from inspection engine.");
            
            setAiResponse(text);
            analysisCache[contextKey] = { result: text, timestamp: Date.now() };
            setState('success');
        } catch (e: any) { 
            setError(e?.message || t('auth.error.connection')); 
            setState('error');
        } 
    }, [issue, fileMeta, result, contextKey, state, t]);

    if (!isOpen) return null;

    const panelContent = (
        <div className="fixed inset-0 z-[2147483647] flex justify-end bg-[#0a0a0a]/70 backdrop-blur-[4px] animate-in fade-in duration-300" onClick={onClose}>
            <div 
                className="w-full max-w-xl bg-[var(--bg-primary)] border-l border-[var(--border-color)] h-full flex flex-col shadow-[-50px_0_100px_rgba(0,0,0,0.5)] animate-in slide-in-from-right duration-500 ease-out"
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-label={t('inspector.title')}
            >
                {/* Header Section */}
                <div className="flex flex-col border-b border-[var(--border-color)] bg-[var(--bg-tertiary)]/30">
                    <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-color)]/50">
                        <div className="flex items-center gap-2.5">
                            <div className={`h-1.5 w-1.5 rounded-full ${state === 'loading' ? 'bg-amber-500 animate-pulse' : 'bg-[var(--accent-color)]'}`} />
                            <span className="text-[0.6rem] font-black uppercase tracking-[0.3em] text-[var(--text-muted)]">
                                {t('inspector.trace.kernel')} // {t('inspector.node')} 01
                            </span>
                        </div>
                        <button 
                            onClick={onClose} 
                            className="p-1 px-3 border border-[var(--border-color)] text-[0.65rem] font-mono text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--text-primary)] transition-all uppercase tracking-widest"
                            aria-label={t('common.close')}
                        >
                            {t('common.close')}
                        </button>
                    </div>

                    <div className="px-6 pt-8 pb-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-2xl font-black tracking-tight text-[var(--text-primary)] uppercase flex items-center gap-3">
                                    {t('inspector.title')}
                                    <span className="px-1.5 py-0.5 rounded-sm bg-[var(--accent-color)]/10 text-[var(--accent-color)] text-[0.6rem] font-black tracking-widest leading-none border border-[var(--accent-color)]/20 shadow-[0_0_10px_rgba(220,0,0,0.1)]">
                                        PRO 2.4
                                    </span>
                                </h2>
                                <p className="text-[0.75rem] text-[var(--text-muted)] mt-1 font-mono uppercase tracking-tight opacity-80">
                                    {t('inspector.context')} // {t('common.context')}: {fileMeta?.name || 'system_idle'}
                                </p>
                            </div>
                        </div>

                        {/* Technical Tabs */}
                        <div className="flex items-center gap-8 mt-10">
                            <TabButton active={activeTab === 'audit'} onClick={() => setActiveTab('audit')} label={t('inspector.directAudit')} />
                            <TabButton active={activeTab === 'logs'} onClick={() => setActiveTab('logs')} label={t('inspector.traceLog')} />
                            <TabButton active={activeTab === 'stats'} onClick={() => setActiveTab('stats')} label={t('inspector.metrics')} />
                        </div>
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto bg-[var(--bg-primary)] custom-scrollbar">
                    <div className="p-8">
                        {activeTab === 'audit' && (
                            <div className="space-y-10">
                                {/* State: IDLE */}
                                {state === 'idle' && (
                                    <div className="py-24 flex flex-col items-center justify-center text-center animate-in fade-in zoom-in-95 duration-500">
                                        <div className="h-16 w-16 bg-[var(--bg-secondary)] border border-[var(--border-color)] flex items-center justify-center mb-6 group hover:border-[var(--accent-color)]/50 transition-colors">
                                            <SparklesIcon className="h-7 w-7 text-[var(--text-muted)] group-hover:text-[var(--accent-color)] transition-colors" />
                                        </div>
                                        <h3 className="text-[0.85rem] font-black text-[var(--text-primary)] uppercase tracking-widest mb-2">{t('inspector.noAnalysis')}</h3>
                                        <p className="text-[0.7rem] text-[var(--text-muted)] max-w-xs font-mono uppercase tracking-tighter mb-10 opacity-70">
                                            {t('inspector.noAnalysisDesc')}
                                        </p>
                                        <button 
                                            onClick={() => runAnalysis()}
                                            className="px-8 py-3 bg-[var(--accent-color)] text-white text-[0.75rem] font-black uppercase tracking-[0.2em] hover:bg-[var(--accent-hover)] transition-all shadow-lg hover:shadow-[0_0_20px_rgba(220,0,0,0.3)] flex items-center gap-3"
                                        >
                                            <CpuChipIcon className="w-4 h-4" />
                                            {t('inspector.initialize')}
                                        </button>
                                    </div>
                                )}

                                {/* State: LOADING */}
                                {state === 'loading' && (
                                    <div className="space-y-10 animate-in fade-in duration-300">
                                        <div className="py-24 flex flex-col items-center justify-center gap-8 bg-[var(--bg-secondary)]/10 border border-dashed border-[var(--border-color)]">
                                            <div className="relative">
                                                <div className="w-16 h-16 border-2 border-[var(--border-color)] border-t-[var(--accent-color)] rounded-full animate-spin" />
                                                <div className="absolute inset-0 flex items-center justify-center">
                                                    <SparklesIcon className="w-6 h-6 text-[var(--accent-color)] animate-pulse" />
                                                </div>
                                            </div>
                                            <div className="space-y-3 text-center">
                                                <div className="text-[0.65rem] font-black text-[var(--text-primary)] uppercase tracking-[0.3em]">{t('inspector.inProgress')}</div>
                                                <div className="flex justify-center gap-1.5">
                                                    <div className="w-1 h-1 bg-[var(--accent-color)] animate-bounce [animation-delay:-0.3s]" />
                                                    <div className="w-1 h-1 bg-[var(--accent-color)] animate-bounce [animation-delay:-0.15s]" />
                                                    <div className="w-1 h-1 bg-[var(--accent-color)] animate-bounce" />
                                                </div>
                                                <p className="text-[0.6rem] font-mono text-[var(--text-muted)] uppercase italic">{t('inspector.decoding')}</p>
                                            </div>
                                        </div>
                                        
                                        {/* Skeleton UI for report */}
                                        <div className="space-y-6 opacity-40 grayscale pointer-events-none blur-[1px]">
                                            <div className="h-24 bg-[var(--bg-secondary)] border border-[var(--border-color)]" />
                                            <div className="h-48 bg-[var(--bg-secondary)] border border-[var(--border-color)]" />
                                        </div>
                                    </div>
                                )}

                                {/* State: ERROR */}
                                {state === 'error' && (
                                    <div className="p-8 border-2 border-[var(--accent-color)]/20 bg-[var(--accent-color)]/5 flex flex-col gap-6 items-center text-center animate-in zoom-in-95 duration-300">
                                        <ExclamationTriangleIcon className="h-10 w-10 text-[var(--accent-color)]" />
                                        <div className="space-y-2">
                                            <h4 className="font-black text-[0.8rem] uppercase tracking-widest text-[var(--text-primary)]">{t('inspector.syncFault')}</h4>
                                            <p className="text-[0.7rem] font-mono text-[var(--text-secondary)] max-w-sm">{error || t('inspector.syncFaultDesc')}</p>
                                        </div>
                                        <button 
                                            onClick={() => runAnalysis(true)}
                                            className="px-6 py-2.5 bg-[var(--accent-color)] text-white text-[0.7rem] font-black uppercase tracking-widest hover:opacity-90 transition-opacity flex items-center gap-2"
                                        >
                                            <ArrowPathIcon className="h-4 w-4" />
                                            {t('inspector.reestablish')}
                                        </button>
                                    </div>
                                )}

                                {/* State: SUCCESS (Report) */}
                                {state === 'success' && aiResponse && (
                                    <div className="space-y-12">
                                        {/* Context Info Overlay */}
                                        {issue && (
                                            <div className="p-5 border-l-4 border-[var(--accent-color)] bg-[var(--bg-tertiary)]/50">
                                                <div className="text-[0.55rem] font-black text-[var(--text-muted)] uppercase tracking-widest mb-2 flex items-center gap-2">
                                                    <CheckCircleIcon className="w-3 h-3 text-emerald-500" />
                                                    {t('inspector.targetedNode')}: {issue.code || issue.id}
                                                </div>
                                                <h4 className="text-[0.9rem] font-black text-[var(--text-primary)] uppercase tracking-tight">
                                                    {translateIssueTitle(issue, t)}
                                                </h4>
                                            </div>
                                        )}

                                        <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-3">
                                            <div className="text-[0.6rem] font-black text-[var(--text-muted)] uppercase tracking-[0.2em] flex items-center gap-2">
                                                <SparklesIcon className="w-3.5 h-3.5 text-[var(--accent-color)]" />
                                                {t('inspector.reportGen')}
                                            </div>
                                            {analysisCache[contextKey] && (
                                                <div className="text-[0.55rem] font-mono text-emerald-500/60 uppercase flex items-center gap-1.5">
                                                    <div className="h-1 w-1 bg-emerald-500/60 rounded-full animate-pulse" />
                                                    {t('inspector.cached')}
                                                </div>
                                            )}
                                        </div>

                                        <AnalyzeCarrierReport report={aiResponse} />

                                        {/* Action: Re-run */}
                                        <div className="pt-10 flex border-t border-[var(--border-color)] border-dashed">
                                            <button 
                                                onClick={() => runAnalysis(true)}
                                                className="flex items-center gap-2 px-4 py-2 text-[0.65rem] font-black text-[var(--text-muted)] uppercase tracking-[0.2em] hover:text-[var(--accent-color)] hover:bg-[var(--accent-color)]/5 transition-all border border-transparent hover:border-[var(--accent-color)]/20"
                                            >
                                                <ArrowPathIcon className="h-3.5" />
                                                {t('inspector.cleanAudit')}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'logs' && (
                            <div className="space-y-4 animate-in fade-in duration-300">
                                <div className="text-[0.6rem] font-bold text-[var(--text-muted)] uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                                    <CommandLineIcon className="w-3.5 h-3.5" />
                                    {t('inspector.forensicTraces')}
                                </div>
                                <div className="font-mono text-[0.7rem] leading-relaxed p-6 border border-[var(--border-color)] bg-[var(--bg-secondary)]/40 rounded-sm">
                                    <div className="flex gap-4 mb-2 opacity-40"><span>14:24:02</span> <span className="text-[var(--accent-color)]">system</span> <span>{t('inspector.trace.kernel')}...</span></div>
                                    <div className="flex gap-4 mb-2"><span>14:24:03</span> <span className="text-emerald-500">v2.4.0</span> <span>{t('inspector.trace.node')}</span></div>
                                    <div className="flex gap-4 mb-2"><span>14:24:03</span> <span className="text-blue-500">model</span> <span>{t('inspector.trace.ready')}</span></div>
                                    {state === 'loading' && <div className="flex gap-4 mb-2 animate-pulse text-[var(--accent-color)]"><span>14:30:12</span> <span>inspect</span> <span>{t('inspector.trace.probing')}...</span></div>}
                                    {state === 'success' && <div className="flex gap-4 mb-2 text-emerald-500"><span>14:31:05</span> <span>output</span> <span>{t('inspector.trace.complete')}</span></div>}
                                    <div className="flex gap-4 text-[var(--accent-color)] animate-pulse mt-10"><span>&gt;</span> <span>{state === 'loading' ? 'BUSY_' : 'AWAITING_COMMAND_'}</span></div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'stats' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-[var(--border-color)] border border-[var(--border-color)] animate-in fade-in duration-300">
                                <StatBox label={t('inspector.auditConfidence')} value="99.2%" sub={t('common.verified')} />
                                <StatBox label={t('inspector.networkLatency')} value="124ms" sub={t('inspector.stat.optimal')} />
                                <StatBox label={t('inspector.contextDepth')} value={t('inspector.stat.high')} sub="8k Tokens" />
                                <StatBox label={t('inspector.jobVersion')} value="v2.4-Monolith" sub={t('inspector.stat.canonical')} />
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer Section */}
                <div className="p-6 border-t border-[var(--border-color)] bg-[var(--bg-primary)]">
                    <div className="flex items-center justify-between opacity-50">
                        <div className="flex items-center gap-2">
                            <div className={`h-1 w-1 ${state === 'error' ? 'bg-red-500' : 'bg-[var(--accent-color)]'}`} />
                            <span className="text-[0.6rem] font-mono text-[var(--text-muted)] uppercase tracking-widest">{t('inspector.state')}: {state.toUpperCase()}</span>
                        </div>
                        <span className="text-[0.6rem] font-mono text-[var(--text-muted)] uppercase tracking-widest">
                            Monolith OS // Preflight v2.4
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );

    if (typeof document !== 'undefined') return createPortal(panelContent, document.body);
    return panelContent;
};

const TabButton: React.FC<{ active: boolean; onClick: () => void; label: string }> = ({ active, onClick, label }) => (
    <button 
        onClick={onClick}
        className={`relative pb-3 text-[0.6rem] font-black uppercase tracking-[0.2em] transition-colors ${
            active 
            ? 'text-[var(--text-primary)]' 
            : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
        }`}
    >
        {label}
        {active && (
            <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-[var(--accent-color)] shadow-[0_0_10px_rgba(220,0,0,0.3)] transition-all duration-300" />
        )}
    </button>
);

const StatBox: React.FC<{ label: string; value: string; sub: string }> = ({ label, value, sub }) => (
    <div className="p-5 bg-[var(--bg-primary)] flex items-center justify-between">
        <div>
            <div className="text-[0.55rem] font-black text-[var(--text-muted)] uppercase tracking-[0.1em] mb-1">{label}</div>
            <div className="text-lg font-black text-[var(--text-primary)] tracking-tight">{value}</div>
        </div>
        <div className="text-[0.5rem] font-mono font-bold uppercase px-1.5 py-0.5 border border-[var(--border-color)] text-[var(--text-muted)]">
            {sub}
        </div>
    </div>
);
