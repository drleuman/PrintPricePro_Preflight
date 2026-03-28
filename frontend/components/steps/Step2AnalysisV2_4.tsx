import React, { useEffect } from 'react';
import { PreflightResult, FileMeta } from '../../types';
import { StatusBadge, CertificationPanel, IssueRow, ActionBar } from '../../design/preflight_starter_pack';
import { formatLabel } from '../../utils/formatters';
import { RocketLaunchIcon, ArrowPathIcon, ChevronLeftIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import { t } from '../../i18n';

interface Step2AnalysisV2_4Props {
    file: File | null;
    fileMeta: FileMeta | null;
    result: PreflightResult | null;
    isRunning: boolean;
    onRunAnalysis: () => void;
    onRunV2Analysis: () => void;
    onNext: () => void;
    onSkipToReview: () => void;
    onBack: () => void;
}

export const Step2AnalysisV2_4: React.FC<Step2AnalysisV2_4Props> = ({
    file,
    fileMeta,
    result,
    isRunning,
    onRunAnalysis,
    onRunV2Analysis,
    onNext,
    onSkipToReview,
    onBack,
}) => {
    // Auto-run analysis when entering this step
    useEffect(() => {
        if (file && !result && !isRunning) {
            onRunAnalysis();
        }
    }, [file, result, isRunning, onRunAnalysis]);

    const issues = result?.issues || [];
    const hasErrors = issues.filter(i => i.severity === 'error').length > 0;
    const hasWarnings = issues.filter(i => i.severity === 'warning').length > 0;
    const hasIssues = issues.length > 0;

    return (
        <div className="space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-1000">
            {/* Header Signal */}
            <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-6">
                <div>
                    <div className="ppp-phase-tag text-[var(--accent-color)] mb-1">
                        PHASE 02 / {formatLabel('FORENSIC_VALIDATION')}
                    </div>
                    <h2 className="text-3xl font-extrabold tracking-tight">
                        {isRunning ? "VALIDATION IN PROGRESS" : "DIAGNOSTIC COMPLETE"}
                    </h2>
                </div>
                <StatusBadge 
                    label={isRunning ? "Engine Active" : hasIssues ? "Validation Failed" : "Certified Ready"} 
                    variant={isRunning ? "processing" : hasIssues ? "warning" : "certified"} 
                />
            </div>

            <div className="grid gap-8 lg:grid-cols-[1fr_0.7fr]">
                {/* Results Zone */}
                <div className="space-y-6 min-h-[400px]">
                    {isRunning ? (
                        <div className="flex flex-col items-center justify-center h-full border border-[var(--border-color)] bg-[var(--bg-secondary)] p-20 text-center">
                            <div className="h-20 w-20 mb-8 flex items-center justify-center border border-[var(--accent-color)]/30 relative">
                                <div className="absolute inset-0 animate-pulse border-2 border-[var(--accent-color)]/50" />
                                <div className="h-2 w-2 bg-[var(--accent-color)] animate-ping" />
                            </div>
                            <h3 className="text-xl font-bold mb-2 text-[var(--text-primary)]">Analyzing Signal Architecture</h3>
                            <p className="text-sm text-[var(--text-secondary)] max-w-[280px]">Deconstructing PDF layers and production rules...</p>
                        </div>
                    ) : result ? (
                        <div className="space-y-4">
                            {!hasIssues && (
                                <div className="border border-[var(--border-color)] bg-[var(--bg-panel)] p-10 flex flex-col items-center text-center">
                                    <div className="h-16 w-16 bg-[var(--accent-color)] mb-6 flex items-center justify-center">
                                        <CheckCircleIcon className="h-10 w-10 text-white" />
                            {issues.length === 0 ? (
                                <div className="flex flex-col items-center justify-center p-12 text-center opacity-40">
                                    <ShieldCheckIcon className="h-12 w-12 mb-4 text-[var(--accent-color)]" />
                                    <p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--text-primary)]">Clean Trace</p>
                                    <p className="text-[0.65rem] font-mono text-[var(--text-muted)] mt-2 uppercase tracking-widest">No structural issues detected</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {issues.map((issue, idx) => (
                                        <IssueRow 
                                            key={(issue as any).id || idx}
                                            title={issue.message}
                                            type={(issue.category || 'GENERAL').toString().toUpperCase()}
                                            fixAvailable={issue.severity !== 'error'}
                                            severity={issue.severity as any}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full border border-[var(--border-color)] p-20 text-center">
                            <ArrowPathIcon className="h-12 w-12 text-[var(--text-muted)] animate-spin mb-4" />
                            <p className="text-[var(--text-secondary)] text-sm">Initializing Validation Node...</p>
                        </div>
                    )}
                </div>

                {/* Summary / Stats Zone */}
                <div className="space-y-8">
                    {result && !isRunning ? (
                        <div className="border border-[var(--border-color)] bg-[var(--bg-secondary)] p-8">
                            <div className="mb-8 flex items-center justify-between">
                                <StatusBadge label={hasIssues ? "Invalid Carrier" : "Valid Carrier"} variant={hasIssues ? "warning" : "certified"} />
                                <span className="text-[0.88rem] font-mono text-[var(--text-secondary)] uppercase tracking-widest">{formatLabel(`TRACE_V2.4_${Math.floor(Math.random() * 9999)}`)}</span>
                            </div>

                            <div className="space-y-6">
                                <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-4">
                                    <span className="text-[var(--text-secondary)] text-sm font-bold uppercase tracking-widest text-[0.8rem]">Critical Errors</span>
                                    <span className={`text-xl font-black ${hasErrors ? 'text-[var(--accent-color)]' : 'text-[var(--text-primary)]'}`}>
                                        {issues.filter(i => i.severity === 'error').length}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-4">
                                    <span className="text-[var(--text-secondary)] text-sm font-bold uppercase tracking-widest text-[0.8rem]">Warnings Found</span>
                                    <span className="text-xl font-black text-[var(--text-primary)]">
                                        {issues.filter(i => i.severity === 'warning').length}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-4">
                                    <span className="text-[var(--text-secondary)] text-sm font-bold uppercase tracking-widest text-[0.8rem]">Page Density</span>
                                    <span className="text-xl font-black text-[var(--text-primary)]">{result.meta?.pageCount || result.pages?.length || '?'}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-[var(--text-secondary)] text-sm font-bold uppercase tracking-widest text-[0.8rem]">Final Signal</span>
                                    <StatusBadge label={hasIssues ? "Action Required" : "Ready"} variant={hasIssues ? "warning" : "certified"} />
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="border border-[var(--border-color)] bg-[var(--hover-bg)] p-8 min-h-[300px] flex items-center justify-center">
                            <div className="h-2 w-2 bg-[var(--accent-color)]/30 animate-ping" />
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        <button 
                            onClick={onBack}
                            className="bg-[var(--hover-bg)] text-[var(--text-secondary)] p-5 text-[0.85rem] font-black uppercase tracking-[0.2em] hover:text-[var(--text-primary)] transition-all border border-[var(--border-color)] flex items-center justify-center gap-2"
                        >
                            <ChevronLeftIcon className="h-4 w-4" /> Abort
                        </button>
                        
                        {result && (
                            <button 
                                onClick={hasIssues ? onNext : onSkipToReview}
                                disabled={isRunning}
                                className={`p-5 text-[0.85rem] font-black uppercase tracking-[0.25em] transition-all bg-[var(--accent-color)] text-white hover:bg-[var(--accent-hover)] shadow-[0_15px_30px_rgba(220,0,0,0.2)]`}
                            >
                                {hasIssues ? "Apply Correction" : "Finalize Trace"}
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Igniter Engine Bar */}
            {!isRunning && result && (
                <div className="pt-10 border-t border-[var(--border-color)] flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="flex items-center gap-4">
                        <div className="h-10 w-10 flex items-center justify-center bg-[var(--accent-color)]/10">
                            <RocketLaunchIcon className="h-5 w-5 text-[var(--accent-color)]" />
                        </div>
                        <div>
                            <div className="text-[0.82rem] font-black uppercase tracking-[0.2em] text-[var(--text-primary)]">Igniter engine v2.4 initialized</div>
                            <div className="text-[0.85rem] font-mono text-[var(--text-secondary)] uppercase tracking-[0.1em]">Bypass current results with deterministic forensic scan</div>
                        </div>
                    </div>
                    <button 
                        onClick={onRunV2Analysis}
                        className="border border-[var(--accent-color)]/30 px-6 py-3 text-[0.8rem] font-black uppercase tracking-[0.2em] text-[var(--accent-color)] hover:bg-[var(--accent-color)]/5 transition-all"
                    >
                        Ignite Forensic Engine
                    </button>
                </div>
            )}
        </div>
    );
};
