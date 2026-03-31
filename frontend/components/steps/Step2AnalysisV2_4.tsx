import React, { useEffect } from 'react';
import { PreflightResult, FileMeta, AppMode, Issue } from '../../types';
import { StatusBadge, IssueRow } from '../../design/preflight_starter_pack';
import { formatLabel } from '../../utils/formatters';
import { RocketLaunchIcon, ArrowPathIcon, ChevronLeftIcon, ShieldCheckIcon, CommandLineIcon } from '@heroicons/react/24/outline';
import { useTranslation } from '../../i18n';

interface Step2AnalysisV2_4Props {
    file: File | null;
    fileMeta: FileMeta | null;
    result: PreflightResult | null;
    isRunning: boolean;
    appMode: AppMode;
    onRunAnalysis: () => void;
    onNext: () => void;
    onSkipToReview: () => void;
    onBack: () => void;
    onSelectIssue: (issue: Issue | null) => void;
}

export const Step2AnalysisV2_4: React.FC<Step2AnalysisV2_4Props> = ({
    file,
    fileMeta,
    result,
    isRunning,
    appMode,
    onRunAnalysis,
    onNext,
    onSkipToReview,
    onBack,
    onSelectIssue,
}) => {
    const { t } = useTranslation();

    const hasAutoRunRef = React.useRef<File | null>(null);

    // Trace auto-run decisions to catch leak regression
    useEffect(() => {
        // Universal auto-run: If we have a file but no result and aren't running yet.
        const canAutoRun = !!file && !result && !isRunning && hasAutoRunRef.current !== file;
        
        console.log('[STEP2][AUTORUN-CHECK]', {
            hasFile: !!file,
            hasResult: !!result,
            isRunning,
            appMode,
            canAutoRun,
            ingress: 'UNIFIED-OS-BACKED'
        });

        if (canAutoRun) {
            hasAutoRunRef.current = file;
            onRunAnalysis();
        }
    }, [file, result, isRunning, appMode, onRunAnalysis]);

    const issues = result?.issues || [];
    const hasErrors = issues.filter(i => i.severity === 'error').length > 0;
    const hasIssues = issues.length > 0;
    const dataMissing = (result as any)?._forensicDataMissing;

    console.log('[STEP2][RENDER]', {
        issues: issues.length,
        hasResult: !!result,
        dataMissing
    });

    return (
        <div className="space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-1000">
            {/* Header Signal */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between border-b border-[var(--border-color)] pb-6 gap-4">
                <div>
                    <div className="ppp-phase-tag text-[var(--accent-color)] mb-1">
                        {t('stepNumber', { number: 2 })} / {t('step.analysis.forensic')}
                    </div>
                    <h2 className="text-3xl font-extrabold tracking-tight">
                        {isRunning ? t('analyzingYourPdf').toUpperCase() : dataMissing ? t('analysisFailed').toUpperCase() : t('analysisComplete').toUpperCase()}
                    </h2>
                </div>
                <StatusBadge 
                    label={isRunning ? t('analyzingPDF') : dataMissing ? t('missingData').toUpperCase() : hasIssues ? t('analysis').toUpperCase() + " " + t('error').toUpperCase() : t('verified').toUpperCase()} 
                    variant={isRunning ? "processing" : dataMissing ? "warning" : hasIssues ? "warning" : "certified"} 
                />
            </div>

            <div className="flex flex-col lg:flex-row gap-8 items-start w-full">
                {/* Results Zone */}
                <div className="space-y-6 min-h-[400px] w-full lg:flex-[1.2]">
                    {isRunning ? (
                        <div className="flex flex-col items-center justify-center h-full border border-[var(--border-color)] bg-[var(--bg-secondary)] p-12 text-center">
                            <div className="h-20 w-20 mb-8 flex items-center justify-center border border-[var(--border-color)] relative">
                                <div className="absolute inset-0 animate-pulse border-2 border-[var(--accent-color)]/50" />
                                <div className="h-2 w-2 bg-[var(--accent-color)] animate-ping" />
                            </div>
                            <h3 className="text-xl font-bold mb-2 text-[var(--text-primary)]">{t('analysis.loading')}</h3>
                            <p className="text-sm text-[var(--text-secondary)] max-w-[280px]">{t('analysis.loading.desc')}</p>
                        </div>
                    ) : dataMissing ? (
                        <div className="flex flex-col items-center justify-center h-full border border-[var(--border-color)] bg-[var(--hover-bg)] p-12 text-center opacity-60">
                            <CommandLineIcon className="h-12 w-12 mb-4 text-[var(--text-muted)]" />
                            <h3 className="text-lg font-bold mb-2">{t('forensics.dataUnavailable')}</h3>
                            <p className="text-xs text-[var(--text-secondary)] max-w-[320px]">{t('forensics.dataUnavailableDesc')}</p>
                        </div>
                    ) : result ? (
                        <div className="space-y-4">
                            {issues.length === 0 ? (
                                <div className="flex flex-col items-center justify-center p-12 text-center opacity-40">
                                    <ShieldCheckIcon className="h-12 w-12 mb-4 text-[var(--accent-color)]" />
                                    <p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--text-primary)]">{t('step.analysis.cleanTrace')}</p>
                                    <p className="text-[0.65rem] font-mono text-[var(--text-muted)] mt-2 uppercase tracking-widest">{t('step.analysis.noIssuesDesc')}</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {issues.map((issue, idx) => (
                                        <IssueRow 
                                            key={issue.id || idx}
                                            title={issue.title || issue.message}
                                            type={(issue.category || 'GENERAL').toString().toUpperCase()}
                                            fixAvailable={issue.fixable}
                                            severity={issue.severity as any}
                                            onClick={() => onSelectIssue(issue)}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full border border-[var(--border-color)] p-12 text-center">
                            <ArrowPathIcon className="h-12 w-12 text-[var(--text-muted)] animate-spin mb-4" />
                            <p className="text-[var(--text-secondary)] text-sm">{t('analysis.initializing')}</p>
                        </div>
                    )}
                </div>

                {/* Summary / Stats Zone */}
                <div className="space-y-8 w-full lg:flex-[0.8]">
                    {result && !isRunning ? (
                        <div className="border border-[var(--border-color)] bg-[var(--bg-secondary)] p-8">
                            <div className="mb-8 flex items-center justify-between">
                                <StatusBadge label={dataMissing ? t('missingData') : hasIssues ? t('step.analysis.invalidCarrier') : t('step.analysis.validCarrier')} variant={dataMissing || hasIssues ? "warning" : "certified"} />
                                <span className="text-[0.88rem] font-mono text-[var(--text-secondary)] uppercase tracking-widest">{formatLabel(`TRACE_V2.4_${result.score || 'ERR'}`)}</span>
                            </div>

                            <div className="space-y-6">
                                <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-4">
                                    <span className="text-[var(--text-secondary)] text-sm font-bold uppercase tracking-widest text-[0.8rem]">{t('step.analysis.criticalErrors')}</span>
                                    <span className={`text-xl font-black ${hasErrors ? 'text-[var(--accent-color)]' : 'text-[var(--text-primary)]'}`}>
                                        {dataMissing ? '?' : issues.filter(i => i.severity === 'error').length}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-4">
                                    <span className="text-[var(--text-secondary)] text-sm font-bold uppercase tracking-widest text-[0.8rem]">{t('step.analysis.warningsFound')}</span>
                                    <span className="text-xl font-black text-[var(--text-primary)]">
                                        {dataMissing ? '?' : issues.filter(i => i.severity === 'warning').length}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-4">
                                    <span className="text-[var(--text-secondary)] text-sm font-bold uppercase tracking-widest text-[0.8rem]">{t('step.analysis.pageDensity')}</span>
                                    <span className="text-xl font-black text-[var(--text-primary)]">{result.meta?.pageCount || '?'}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-[var(--text-secondary)] text-sm font-bold uppercase tracking-widest text-[0.8rem]">{t('step.analysis.finalSignal')}</span>
                                    <StatusBadge label={dataMissing ? t('missingData') : hasIssues ? t('step.analysis.actionRequired') : t('step.analysis.ready')} variant={dataMissing || hasIssues ? "warning" : "certified"} />
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="border border-[var(--border-color)] bg-[var(--hover-bg)] p-8 min-h-[300px] flex items-center justify-center">
                            <div className="h-2 w-2 bg-[var(--accent-color)]/30 animate-ping" />
                        </div>
                    )}

                    <div className="flex flex-col gap-4">
                        <button 
                            onClick={onBack}
                            className="bg-[var(--hover-bg)] text-[var(--text-secondary)] p-5 text-[0.85rem] font-black uppercase tracking-[0.2em] hover:text-[var(--text-primary)] transition-all border border-[var(--border-color)] flex items-center justify-center gap-2"
                        >
                            <ChevronLeftIcon className="h-4 w-4" /> {t('back').replace('← ', '').toUpperCase()}
                        </button>
                        
                        {result && (
                            <button 
                                onClick={hasIssues ? onNext : onSkipToReview}
                                disabled={isRunning}
                                className={`p-5 text-[0.85rem] font-black uppercase tracking-[0.25em] transition-all bg-[var(--accent-color)] text-white hover:bg-[var(--accent-hover)] shadow-[0_15px_30px_rgba(220,0,0,0.2)]`}
                            >
                                {hasIssues ? t('step.analysis.applyCorrection') : t('step.analysis.finalizeTrace')}
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Igniter Engine Bar */}
            {!isRunning && result && (
                <div className="pt-10 border-t border-[var(--border-color)] flex flex-col items-center justify-center text-center md:flex-row md:items-center md:justify-between md:text-left gap-6">
                    <div className="flex flex-col md:flex-row items-center gap-4">
                        <div className="h-10 w-10 flex items-center justify-center bg-[var(--accent-color)]/10">
                            <RocketLaunchIcon className="h-5 w-5 text-[var(--accent-color)]" />
                        </div>
                        <div>
                            <div className="text-[0.82rem] font-black uppercase tracking-[0.2em] text-[var(--text-primary)]">{t('step.analysis.igniter')}</div>
                            <div className="text-[0.85rem] font-mono text-[var(--text-secondary)] uppercase tracking-[0.1em]">{t('step.analysis.igniterDesc')}</div>
                        </div>
                    </div>
                    <button 
                        onClick={onRunAnalysis}
                        disabled={isRunning}
                        className="border border-[var(--accent-color)]/30 px-6 py-3 text-[0.8rem] font-black uppercase tracking-[0.2em] text-[var(--accent-color)] hover:bg-[var(--accent-color)]/5 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                        {isRunning ? t('common.processing').toUpperCase() : t('step.analysis.ignite').toUpperCase()}
                    </button>
                </div>
            )}
        </div>
    );
};
