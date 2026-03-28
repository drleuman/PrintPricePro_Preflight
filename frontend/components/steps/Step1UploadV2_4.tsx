import React, { useState, useRef } from 'react';
import { pposFetch } from '../../lib/apiClient';
import { FileMeta, AppMode } from '../../types';
import { StatusBadge, DiagnosticCard } from '../../design/preflight_starter_pack';
import { formatLabel } from '../../utils/formatters';
import { CloudArrowUpIcon, DocumentCheckIcon, AdjustmentsHorizontalIcon, SparklesIcon } from '@heroicons/react/24/outline';

interface Step1UploadV2_4Props {
    file: File | null;
    fileMeta: FileMeta | null;
    onFileSelect: (file: File | null) => void;
    onNext: (mode: AppMode) => void;
    selectedPolicy: string;
    onPolicyChange: (p: string) => void;
    isAuthenticated?: boolean;
}

import { useAuth } from '../../hooks/useAuth';

export const Step1UploadV2_4: React.FC<Step1UploadV2_4Props> = ({
    file,
    fileMeta,
    onFileSelect,
    onNext,
    selectedPolicy,
    onPolicyChange,
}) => {
    const { user } = useAuth();
    const [selectedMode, setSelectedMode] = useState<'magic' | 'manual'>('magic');
    const [policies, setPolicies] = useState<{ slug: string, name: string }[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Limit enforcement from user license
    const dailyLimit = user?.daily_jobs_limit || 5;
    const usedToday = 0; // In a real app we'd fetch this or get it from user object
    const maxMb = user?.plan === 'PRO' ? 500 : 50;
    const isAiFixAllowed = user?.plan !== 'FREE';

    React.useEffect(() => {
        if (!user) return;
        
        pposFetch<{ ok: boolean, policies: any[] }>('/api/v2/jobs/policies')
            .then(res => {
                if (res.ok && res.policies) setPolicies(res.policies);
            })
            .catch(err => {
                console.error('[POLICIES-FETCH-ERROR]', err);
            });
    }, [user]);

    const handleFile = (f: File | null) => {
        if (f && f.type === 'application/pdf') {
            const sizeMb = f.size / (1024 * 1024);
            if (sizeMb > maxMb) {
                alert(`LICENSE LIMIT: Plan ${user?.plan || 'GUEST'} supports up to ${maxMb}MB. This file is ${sizeMb.toFixed(1)}MB.`);
                return;
            }
            onFileSelect(f);
        } else if (f) {
            alert('Please upload a PDF file.');
        }
    };

    const onDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const droppedFile = e.dataTransfer.files[0];
        handleFile(droppedFile);
    };

    const handleContinue = () => {
        if (!file) return;
        if (selectedMode === 'magic' && !isAiFixAllowed) {
            alert('AI Magic Fix is restricted to PRO nodes.');
            return;
        }
        const appMode: AppMode = selectedMode === 'magic' ? 'ai' : 'manual';
        onNext(appMode);
    };

    return (
        <div className="space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-1000">
            {/* Header Signal */}
            <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-6">
                <div>
                    <div className="ppp-phase-tag text-[var(--accent-color)] mb-1">
                        PHASE 01 / INPUT UPLOAD
                    </div>
                    <h2 className="text-3xl font-extrabold tracking-tight underline decoration-[var(--accent-color)]/30 decoration-4 underline-offset-8">SYSTEM INGRESS</h2>
                </div>
                <div className="flex items-center gap-4">
                    <div className="h-10 w-px bg-[var(--border-color)] mx-2"></div>
                    <StatusBadge 
                        label={!file ? "Awaiting File" : selectedMode === 'magic' ? "Staged / AI Magic" : "Staged / Manual"} 
                        variant={file ? "certified" : "processing"} 
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1.1fr_0.9fr] items-start">
                {/* Upload Zone */}
                <div 
                    onDragOver={(e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={onDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`group relative flex flex-col items-center justify-center border-2 border-dashed transition-all duration-700 cursor-pointer min-h-[440px] ${
                        isDragging ? 'border-[var(--accent-color)] bg-[var(--accent-color)]/5 shadow-[0_0_40px_rgba(220,0,0,0.1)] scale-[1.01]' : 
                        file ? 'border-[var(--border-color)] bg-[var(--hover-bg)]' : 'border-[var(--border-color)] hover:border-[var(--accent-color)]/30 hover:bg-[var(--hover-bg)]'
                    }`}
                >
                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        className="hidden" 
                        accept=".pdf" 
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleFile(e.target.files?.[0] || null)}
                    />

                    {/* Subtle Pulse Overlay when empty */}
                    {!file && !isDragging && (
                        <div className="absolute inset-0 bg-[var(--accent-color)]/[0.02] animate-pulse pointer-events-none" />
                    )}

                    {file ? (
                        <div className="flex flex-col items-center text-center p-10 animate-in zoom-in-95 duration-500">
                            <div className="h-24 w-20 bg-[var(--accent-color)] mb-8 flex items-center justify-center relative shadow-[0_0_40px_rgba(220,0,0,0.4)]">
                                <DocumentCheckIcon className="h-12 w-12 text-white" />
                                <div className="absolute -bottom-3 -right-3 h-8 w-8 bg-[var(--bg-primary)] flex items-center justify-center border-4 border-[var(--bg-primary)]">
                                    <div className="h-2 w-2 bg-[var(--accent-color)]" />
                                </div>
                            </div>
                            <div className="mb-2 text-[0.8rem] font-black text-[var(--accent-color)] uppercase tracking-[0.3em]">Carrier Staged</div>
                            <h3 className="text-2xl font-black mb-2 max-w-full truncate px-4">{fileMeta?.name || file.name}</h3>
                            <div className="text-[0.85rem] font-mono text-[var(--text-muted)] uppercase tracking-widest flex flex-wrap justify-center items-center gap-3">
                                <span>{(file.size / (1024 * 1024)).toFixed(2)} MB</span>
                                <span className="h-1 w-1 bg-[var(--border-color)] rounded-full" />
                                <span>Technical PDF Carrier</span>
                            </div>
                            <button 
                                onClick={(e) => { e.stopPropagation(); onFileSelect(null); }}
                                className="mt-10 px-6 py-3 border border-[var(--border-color)] bg-[var(--hover-bg)] text-[0.8rem] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--accent-color)]/20 transition-all font-bold"
                            >
                                Change Production File
                            </button>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center text-center p-10 scale-110">
                            <div className="h-20 w-20 mb-8 flex items-center justify-center border border-[var(--border-color)] bg-[var(--hover-bg)] group-hover:border-[var(--accent-color)] group-hover:bg-[var(--accent-color)]/5 transition-all duration-500 shadow-inner">
                                <CloudArrowUpIcon className="h-10 w-10 text-[var(--text-muted)] group-hover:text-[var(--accent-color)] transition-colors" />
                            </div>
                            <p className="text-xl font-black mb-3 tracking-tight text-[var(--text-primary)]">Upload Production PDF</p>
                            <p className="text-[var(--text-secondary)] text-sm uppercase tracking-[0.15em] font-bold mb-8">Start validation and correction</p>
                            
                            <div className="px-6 py-2 border border-[var(--border-color)] bg-[var(--hover-bg)] text-[0.8rem] text-center font-mono text-[var(--text-muted)] uppercase tracking-[0.2em] w-full max-w-full overflow-hidden text-clip whitespace-normal break-words">
                                Drag & Drop or Click to Browse / Max: 500MB
                            </div>
                        </div>
                    )}
                </div>

                {/* Configuration Zone */}
                <div className="flex flex-col justify-between space-y-8">
                    <div className="border border-[var(--border-color)] bg-[var(--bg-secondary)] p-10">
                        <div className="flex items-center justify-between mb-8">
                            <div className="ppp-phase-tag text-[var(--accent-color)] mb-1">
                                Configuration
                            </div>
                            <h3 className="text-xl font-extrabold tracking-tight">Select validation mode</h3>
                        </div>

                        <div className="space-y-4">
                            <button 
                                onClick={() => setSelectedMode('magic')}
                                className={`w-full flex items-center gap-5 p-6 border transition-all duration-500 relative group ${
                                    selectedMode === 'magic' ? 'border-[var(--accent-color)] bg-[var(--accent-color)]/5' : 'border-[var(--border-color)] hover:border-[var(--text-muted)] bg-[var(--bg-primary)]/50'
                                }`}
                            >
                                <div className={`p-4 transition-all duration-500 ${selectedMode === 'magic' ? 'bg-[var(--accent-color)] text-white shadow-[0_0_20px_rgba(220,0,0,0.2)]' : 'bg-[var(--hover-bg)] text-[var(--text-muted)] group-hover:text-[var(--text-secondary)]'}`}>
                                    <SparklesIcon className="h-6 w-6" />
                                </div>
                                <div className="text-left flex-1">
                                    <div className="text-[0.85rem] font-black uppercase tracking-wider mb-1 text-[var(--text-primary)]">AI Magic Fix</div>
                                    <div className="text-[0.88rem] text-[var(--text-secondary)] font-medium leading-normal">
                                        Automatic correction. No manual steps.
                                    </div>
                                </div>
                                {selectedMode === 'magic' && (
                                    <div className="h-2 w-2 bg-[var(--accent-color)] shadow-[0_0_10px_#dc0000]" />
                                )}
                            </button>

                            <button 
                                onClick={() => setSelectedMode('manual')}
                                className={`w-full flex items-center gap-5 p-6 border transition-all duration-500 relative group ${
                                    selectedMode === 'manual' ? 'border-[var(--accent-color)] bg-[var(--accent-color)]/5' : 'border-[var(--border-color)] hover:border-[var(--text-muted)] bg-[var(--bg-primary)]/50'
                                }`}
                            >
                                <div className={`p-4 transition-all duration-500 ${selectedMode === 'manual' ? 'bg-[var(--accent-color)] text-white shadow-[0_0_20px_rgba(220,0,0,0.2)]' : 'bg-[var(--hover-bg)] text-[var(--text-muted)] group-hover:text-[var(--text-secondary)]'}`}>
                                    <AdjustmentsHorizontalIcon className="h-6 w-6" />
                                </div>
                                <div className="text-left flex-1">
                                    <div className="text-[0.85rem] font-black uppercase tracking-wider mb-1 text-[var(--text-primary)]">Diagnostic Mode</div>
                                    <div className="text-[0.88rem] text-[var(--text-secondary)] font-medium leading-normal">
                                        Manual inspection and control.
                                    </div>
                                </div>
                                {selectedMode === 'manual' && (
                                    <div className="h-2 w-2 bg-[var(--accent-color)] shadow-[0_0_10px_#dc0000]" />
                                )}
                            </button>
                        </div>

                        {selectedMode === 'magic' && policies.length > 0 && (
                            <div className="mt-10 space-y-4 animate-in fade-in slide-in-from-top-2 duration-500">
                                <div className="flex items-center justify-between">
                                    <div className="text-[0.82rem] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">
                                        Policy Enforcement
                                    </div>
                                    <span className="text-[0.85rem] font-mono text-[var(--accent-color)] opacity-50">{formatLabel('STRICT_OVERSIGHT')}</span>
                                </div>
                                <select 
                                    className="w-full bg-[var(--bg-tertiary)] border border-[var(--border-color)] p-4 text-[0.85rem] font-bold text-[var(--text-primary)] focus:border-[var(--accent-color)] outline-none appearance-none cursor-pointer hover:border-[var(--text-muted)] transition-all font-mono uppercase"
                                    value={selectedPolicy}
                                    onChange={(e) => onPolicyChange(e.target.value)}
                                >
                                    {policies.map(p => (
                                        <option key={p.slug} value={p.slug}>{p.name.toUpperCase()}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>

                    <div className="space-y-4">
                        <button 
                            onClick={handleContinue}
                            disabled={!file}
                            className={`w-full py-7 text-[0.85rem] font-black uppercase tracking-[0.4em] transition-all duration-700 relative overflow-hidden group ${
                                file ? 'bg-[var(--accent-color)] text-white hover:bg-[var(--accent-hover)] shadow-[0_20px_50px_rgba(220,0,0,0.3)]' : 
                                'bg-[var(--bg-tertiary)] text-[var(--text-dim)] cursor-not-allowed opacity-40'
                            }`}
                        >
                            {/* Industrial scanning effect on hover if ready */}
                            {file && (
                                <div className="absolute inset-0 bg-white/5 -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                            )}
                            <span className="relative z-10">Initialize Engine</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
