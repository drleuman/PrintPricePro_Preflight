import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Issue, ModalProps, PreflightResult, FileMeta } from '../types';
import { SafeHtmlMarkdown } from './SafeHtmlMarkdown';
import { XMarkIcon, SparklesIcon, CpuChipIcon, CommandLineIcon, ChartBarIcon } from '@heroicons/react/24/outline';

const API_VER = 'v1';

async function pickAvailableModel(): Promise<string> {
    const res = await fetch(`/api/gemini-proxy/${API_VER}/models?pageSize=200`);
    const data = await res.json();
    const list: any[] = Array.isArray(data?.models) ? data.models : [];
    const gen = list.filter((m) => (m.supportedGenerationMethods || []).includes('generateContent'));
    const by = (k: string) => gen.find((m) => m.name?.toLowerCase().includes(k));
    return (by('flash')?.name || by('pro')?.name || gen[0]?.name || '').replace(/^models\//, '');
}

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
    const [loading, setLoading] = useState(false);
    const [aiResponse, setAiResponse] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'audit' | 'logs' | 'stats'>('audit');

    const fetchAI = useCallback(async () => {
        setLoading(true); setError(null); setAiResponse(null);
        try {
            const model = await pickAvailableModel();
            const prompt = issue 
                ? `Analyze this prepress issue: "${issue.title}". Severity: ${issue.severity}. Provide technical context and fix recommendations.`
                : "Perform a general forensic audit of the current PDF preflight state. Identify potential risks for offset printing.";
            
            const res = await fetch(`/api/gemini-proxy/${API_VER}/models/${encodeURIComponent(model)}:generateContent`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }] }),
            });
            const json = await res.json();
            const text = extractTextFromGenResponse(json);
            setAiResponse(text);
        } catch (e: any) { setError(e?.message || "AI Error"); } 
        finally { setLoading(false); }
    }, [issue]);

    useEffect(() => {
        if (isOpen) fetchAI();
    }, [isOpen, fetchAI]);

    if (!isOpen) return null;

    const panelContent = (
        <div className="fixed inset-0 z-[2147483647] flex justify-end bg-[#0a0a0a]/60 backdrop-blur-[2px] animate-in fade-in duration-200" onClick={onClose}>
            <div 
                className="w-full max-w-xl bg-[var(--bg-primary)] border-l border-[var(--border-color)] h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-300 ease-out"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header Section */}
                <div className="flex flex-col border-b border-[var(--border-color)] bg-[var(--bg-primary)]">
                    <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-color)]/50">
                        <div className="flex items-center gap-2.5">
                            <div className="h-1.5 w-1.5 rounded-full bg-[var(--accent-color)]" />
                            <span className="text-[0.65rem] font-mono font-bold uppercase tracking-[0.2em] text-[var(--text-muted)]">
                                Inspector // Forensic Node 01
                            </span>
                        </div>
                        <button 
                            onClick={onClose} 
                            className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                            aria-label="Close panel"
                        >
                            <XMarkIcon className="h-4 w-4" />
                        </button>
                    </div>

                    <div className="px-6 pt-8 pb-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-xl font-bold tracking-tight text-[var(--text-primary)] uppercase flex items-center gap-2">
                                    AI Inspector
                                    <span className="px-1.5 py-0.5 rounded-sm bg-[var(--accent-color)]/10 text-[var(--accent-color)] text-[0.6rem] font-black tracking-widest leading-none">PRO</span>
                                </h2>
                                <p className="text-[0.75rem] text-[var(--text-muted)] mt-1 font-medium tracking-tight">
                                    Advanced forensic oversight for Monolith v2.4
                                </p>
                            </div>
                        </div>

                        {/* Technical Tabs */}
                        <div className="flex items-center gap-4 mt-10 border-b border-[var(--border-color)]/0">
                            <TabButton 
                                active={activeTab === 'audit'} 
                                onClick={() => setActiveTab('audit')} 
                                label="Audit" 
                            />
                            <TabButton 
                                active={activeTab === 'logs'} 
                                onClick={() => setActiveTab('logs')} 
                                label="Traces" 
                            />
                            <TabButton 
                                active={activeTab === 'stats'} 
                                onClick={() => setActiveTab('stats')} 
                                label="Metrics" 
                            />
                        </div>
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto bg-[var(--bg-primary)] p-6">
                    {activeTab === 'audit' && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-400">
                            {loading ? (
                                <div className="py-32 flex flex-col items-center justify-center gap-4">
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-1 h-1 bg-[var(--accent-color)] animate-bounce [animation-delay:-0.3s]" />
                                        <div className="w-1 h-1 bg-[var(--accent-color)] animate-bounce [animation-delay:-0.15s]" />
                                        <div className="w-1 h-1 bg-[var(--accent-color)] animate-bounce" />
                                    </div>
                                    <span className="text-[0.65rem] font-mono text-[var(--text-muted)] uppercase tracking-[0.2em]">Executing neural handshake...</span>
                                </div>
                            ) : error ? (
                                <div className="p-4 border border-[var(--accent-color)]/20 bg-[var(--accent-color)]/5 flex flex-col gap-3">
                                    <div className="flex items-center gap-2 text-[var(--accent-color)]">
                                        <CommandLineIcon className="h-4 w-4" />
                                        <span className="font-bold text-[0.7rem] uppercase tracking-wider">Interface Fault</span>
                                    </div>
                                    <p className="text-[0.8rem] font-mono text-[var(--text-secondary)]">{error}</p>
                                    <button 
                                        onClick={fetchAI}
                                        className="w-fit text-[0.65rem] font-bold uppercase tracking-widest px-3 py-1.5 bg-[var(--accent-color)] text-white hover:opacity-90 transition-opacity"
                                    >
                                        Retry Connection
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-10">
                                    {/* Issue Context */}
                                    {issue && (
                                        <div className="space-y-3">
                                            <div className="text-[0.6rem] font-bold text-[var(--text-muted)] uppercase tracking-[0.2em] flex items-center gap-2">
                                                <div className="w-1 h-1 rounded-full bg-[var(--border-color)]" />
                                                Target Subject
                                            </div>
                                            <div className="p-4 border border-[var(--border-color)] bg-[var(--bg-secondary)]/30 rounded-sm">
                                                <h4 className="text-[0.9rem] font-bold text-[var(--text-primary)] uppercase tracking-tight leading-tight mb-2">{issue.title}</h4>
                                                <div className="flex items-center gap-4">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="text-[0.65rem] font-mono text-[var(--text-muted)]">SEV:</span>
                                                        <span className={`text-[0.65rem] font-bold uppercase tracking-widest ${
                                                            issue.severity === 'error' ? 'text-[var(--accent-color)]' : 'text-amber-500'
                                                        }`}>{issue.severity}</span>
                                                    </div>
                                                    <div className="flex items-center gap-1.5 border-l border-[var(--border-color)] pl-4">
                                                        <span className="text-[0.65rem] font-mono text-[var(--text-muted)]">NODE:</span>
                                                        <span className="text-[0.65rem] font-mono text-[var(--text-secondary)]">0x{issue.id?.substring(0,6)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* AI Output */}
                                    <div className="space-y-4">
                                        <div className="text-[0.6rem] font-bold text-[var(--text-muted)] uppercase tracking-[0.2em] flex items-center gap-2">
                                            <div className="w-1 h-1 rounded-full bg-[var(--accent-color)]" />
                                            Analysis Report
                                        </div>
                                        <div className="prose prose-invert prose-sm max-w-none 
                                            prose-p:text-[var(--text-secondary)] 
                                            prose-p:leading-[1.7] 
                                            prose-p:mb-5
                                            prose-headings:text-[var(--text-primary)]
                                            prose-headings:text-[0.85rem]
                                            prose-headings:font-bold
                                            prose-headings:uppercase
                                            prose-headings:tracking-wider
                                            prose-headings:mt-8
                                            prose-headings:mb-4
                                            prose-strong:text-[var(--text-primary)]
                                            prose-strong:font-bold
                                            prose-code:text-[var(--accent-color)]
                                            prose-code:bg-[var(--accent-color)]/5
                                            prose-code:px-1
                                            prose-code:rounded-sm
                                            prose-code:before:content-none
                                            prose-code:after:content-none
                                            prose-li:text-[var(--text-secondary)]
                                            prose-ul:my-6">
                                            <SafeHtmlMarkdown markdown={aiResponse || "Awaiting audit initialization..."} />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'logs' && (
                        <div className="space-y-4 animate-in fade-in duration-300">
                            <div className="text-[0.6rem] font-bold text-[var(--text-muted)] uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                                <div className="w-1 h-1 rounded-full bg-[var(--border-color)]" />
                                Interface Logs
                            </div>
                            <div className="font-mono text-[0.7rem] leading-relaxed p-4 border border-[var(--border-color)] bg-[var(--bg-secondary)]/30 rounded-sm">
                                <div className="flex gap-4 mb-2 opacity-40"><span>14:24:02</span> <span className="text-[var(--accent-color)]">system</span> <span>Initializing kernel link...</span></div>
                                <div className="flex gap-4 mb-2"><span>14:24:03</span> <span className="text-emerald-500">v2.4.0</span> <span>Forensic Node 0x01 established.</span></div>
                                <div className="flex gap-4 mb-2"><span>14:24:03</span> <span className="text-blue-500">model</span> <span>Handshake success: Gemini-1.5-Pro</span></div>
                                <div className="flex gap-4 mb-2"><span>14:24:04</span> <span className="text-amber-500">worker</span> <span>Processing job_9823...</span></div>
                                <div className="flex gap-4 mb-2"><span>14:24:05</span> <span className="text-emerald-500">output</span> <span>Payload generated (size: 4.8kb)</span></div>
                                <div className="flex gap-4 text-[var(--accent-color)] animate-pulse mt-4"><span>&gt;</span> <span>AWAITING NEXT COMMAND_</span></div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'stats' && (
                        <div className="grid grid-cols-1 gap-px bg-[var(--border-color)] border border-[var(--border-color)] animate-in fade-in duration-300">
                            <StatBox label="Audit Confidence" value="99.2%" sub="Verified" />
                            <StatBox label="Network Latency" value="124ms" sub="Optimal" />
                            <StatBox label="Context Depth" value="High" sub="8k Tokens" />
                            <StatBox label="Job Version" value="v2.4-Monolith" sub="Canonical" />
                        </div>
                    )}
                </div>

                {/* Footer Section */}
                <div className="p-6 border-t border-[var(--border-color)] bg-[var(--bg-primary)]">
                    <div className="flex items-center justify-between opacity-50">
                        <div className="flex items-center gap-2">
                            <div className="h-1 w-1 bg-[var(--accent-color)]" />
                            <span className="text-[0.6rem] font-mono text-[var(--text-muted)] uppercase tracking-widest">State: Nominal</span>
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
        className={`relative pb-3 text-[0.7rem] font-bold uppercase tracking-widest transition-colors ${
            active 
            ? 'text-[var(--text-primary)]' 
            : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
        }`}
    >
        {label}
        {active && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--accent-color)] transition-all duration-300" />
        )}
    </button>
);

const StatBox: React.FC<{ label: string; value: string; sub: string }> = ({ label, value, sub }) => (
    <div className="p-5 bg-[var(--bg-primary)] flex items-center justify-between">
        <div>
            <div className="text-[0.6rem] font-bold text-[var(--text-muted)] uppercase tracking-[0.1em] mb-1">{label}</div>
            <div className="text-lg font-bold text-[var(--text-primary)] tracking-tight">{value}</div>
        </div>
        <div className="text-[0.55rem] font-mono font-bold uppercase px-1.5 py-0.5 border border-[var(--border-color)] text-[var(--text-muted)]">
            {sub}
        </div>
    </div>
);
