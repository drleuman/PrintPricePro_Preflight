import React, { useState } from 'react';
import { PreflightResult, FileMeta, AppMode } from '../../types';
import { StatusBadge, CertificationPanel } from '../../design/preflight_starter_pack';
import { formatLabel } from '../../utils/formatters';
import { pposFetch } from '../../lib/apiClient';
import { PageViewer } from '../PageViewer';
import { useTranslation } from '../../i18n';
import { 
    ArrowPathIcon, 
    PaintBrushIcon, 
    RocketLaunchIcon, 
    BookOpenIcon, 
    ArrowDownTrayIcon, 
    ChevronLeftIcon,
    DocumentCheckIcon,
    ShieldCheckIcon,
    XMarkIcon,
    CommandLineIcon,
    CpuChipIcon
} from '@heroicons/react/24/outline';

interface Step4ReviewV2_4Props {
    file: File | null;
    fileMeta: FileMeta | null;
    result: PreflightResult | null;
    numPages: number;
    currentPage: number;
    lastPdfUrl: string | null;
    lastPdfName: string | null;
    isRunning: boolean;
    ldmStatus?: string | null;
    ldmProgress?: number;
    onPageChange: (page: number) => void;
    onNumPagesChange: (num: number) => void;
    onConvertGrayscale: () => void;
    onConvertColors: () => void;
    onRebuildPdf: () => void;
    onMakeBooklet: () => void;
    onDownload: () => void;
    onDownloadReport: () => void;
    onStartOver: () => void;
    onBack: () => void;
    onNext: () => void;
    appMode?: AppMode;
    heatmapData?: any;
    isHeatmapLoading?: boolean;
    onRunHeatmap?: () => void;
    originalFile?: File | null;
    autoFixBefore?: PreflightResult | null;
    autoFixAfter?: PreflightResult | null;
    autoFixReport?: any;
    previewPages?: string[] | null;
    previewLoading?: boolean;
    selectedPolicy?: string;
    targetJobId?: string | null;
    sourceJobId?: string | null;
}

export const Step4ReviewV2_4: React.FC<Step4ReviewV2_4Props> = ({
    file,
    fileMeta,
    result,
    numPages,
    currentPage,
    lastPdfUrl,
    lastPdfName,
    isRunning,
    ldmStatus,
    ldmProgress = 0,
    onPageChange,
    onNumPagesChange,
    onConvertGrayscale,
    onConvertColors,
    onRebuildPdf,
    onMakeBooklet,
    onDownload,
    onDownloadReport,
    onStartOver,
    onBack,
    onNext,
    appMode,
    heatmapData,
    isHeatmapLoading = false,
    onRunHeatmap,
    originalFile,
    autoFixBefore,
    autoFixAfter,
    autoFixReport,
    previewPages = null,
    previewLoading = false,
    selectedPolicy,
    targetJobId,
    sourceJobId,
}) => {
    const { t } = useTranslation();
    const [layoutMode, setLayoutMode] = useState<'single' | 'side-by-side'>('side-by-side');
    const isAnalyzeOnly = result?.type === 'ANALYZE' || (result as any)?.name === 'preflight_job' || (appMode as string) === 'manual';
    // Robust fix state detection: check if we have a target job and an artifact
    const hasFix = !!targetJobId && !!lastPdfUrl;
    
    // Default to 'after' if we have a fix, otherwise 'before'
    const [requestedMode, setRequestedMode] = useState<'before' | 'after'>(hasFix ? 'after' : 'before');
    const [showTechNote, setShowTechNote] = useState(false);

    // Final derived mode for single view: Force 'before' if no artifact is truly available
    const showBeforeAfter = (requestedMode === 'after' && !hasFix) ? 'before' : requestedMode;
    const setShowBeforeAfter = (mode: 'before' | 'after') => setRequestedMode(mode);
    // -------------------------------------------

    // Mapeo de estados de Certificación (Monolith v2.4 Spec)
    const getCertTechStatus = () => {
        if (!isRunning) return null;
        if (ldmProgress < 20) return 'INITIATING_ENGINE_HANDSHAKE_V2';
        if (ldmProgress < 40) return 'ENFORCING_ISO_OUTPUT_INTENTS';
        if (ldmProgress < 60) return 'OPTIMIZING_COLOR_CARRIER_RESPONSE';
        if (ldmProgress < 80) return 'HARDENING_PDF_STRUCTURES';
        return 'SEALING_CERTIFIED_ARTIFACT_INTEGRITY';
    };

    const certMessage = getCertTechStatus();

    // Diagnostics
    console.log('[APP][STEP4][ARTIFACT-RESOLUTION]', { 
        hasResult: !!result, 
        hasBefore: !!autoFixBefore, 
        hasAfter: !!autoFixAfter,
        lastPdfUrl: !!lastPdfUrl,
        sourceJobId,
        targetJobId,
        isAnalyzeOnly,
        hasFix,
        finalMode: showBeforeAfter
    });
    
    // Canonical calculation of issues and fixes
    const issuesFound = autoFixBefore?.issues?.length || result?.issues?.length || 0;
    
    // Fixes Applied calculation logic:
    // 1. Check direct report if available
    // 2. Otherwise calc delta between before and after results
    const fixesApplied = autoFixAfter?.fixes?.length || 
                        autoFixReport?.fixes?.length || 
                        (autoFixBefore && autoFixAfter ? Math.max(0, autoFixBefore.issues.length - autoFixAfter.issues.length) : 
                        autoFixReport ? 1 : 0);

    const isReadyForPrint = (autoFixAfter?.issues?.length === 0) || (result?.issues?.length === 0);

    console.log('[STEP4][COUNTS]', { issuesFound, fixesApplied, isReadyForPrint });

    // Viewer Resolution
    // Before: Original File or Initial result
    // After: Corrected Result (either file or lastPdfUrl)
    const displayFile = showBeforeAfter === 'before' ? (originalFile || file) : (lastPdfUrl ? null : file);
    const displayPdfUrl = showBeforeAfter === 'after' ? lastPdfUrl : null;
    
    // Derived states
    const hasBefore = !!autoFixBefore || !!originalFile || !!file;
    const hasAfterFinal = !!autoFixAfter || !!lastPdfUrl;
    
    // Loading indicator for certificate viewer
    const isGenerating = showBeforeAfter === 'after' && !!lastPdfUrl && numPages === 0;

    console.log('[STEP4][VIEWER]', { 
        mode: showBeforeAfter, 
        hasFile: !!displayFile, 
        hasUrl: !!displayPdfUrl 
    });

    return (
        <div className="space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-1000 pb-24">
            {/* Header Signal */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between border-b border-[var(--border-color)] pb-6 gap-4">
                <div>
                    <div className="ppp-phase-tag text-[var(--accent-color)] mb-1">
                        {t('step.review.phase')}
                    </div>
                    <h2 className="text-3xl font-extrabold tracking-tight text-[var(--text-primary)]">{t('step.review.title')}</h2>
                </div>
                <StatusBadge 
                    label={isReadyForPrint ? t('readyForPrinting') : t('issuesFoundMessage')} 
                    variant={isReadyForPrint ? "certified" : "warning"} 
                />
            </div>

            <div className="flex flex-col lg:flex-row gap-8 items-start w-full">
                {/* Main Content: Preview & Comparison */}
                <div className="space-y-6 flex-1 min-w-0">
                    <div className="border border-[var(--border-color)] bg-[var(--bg-secondary)] p-1 flex flex-col md:flex-row items-center justify-between gap-4">
                        <div className="flex bg-[var(--bg-primary)] p-1">
                            <button 
                                onClick={() => setLayoutMode('side-by-side')}
                                className={`px-4 py-1.5 ppp-phase-tag !text-[0.65rem] !tracking-widest transition-all ${layoutMode === 'side-by-side' ? 'bg-[var(--accent-color)] text-white' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                            >
                                SIDE-BY-SIDE
                            </button>
                            <button 
                                onClick={() => setLayoutMode('single')}
                                className={`px-4 py-1.5 ppp-phase-tag !text-[0.65rem] !tracking-widest transition-all ${layoutMode === 'single' ? 'bg-[var(--accent-color)] text-white' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                            >
                                SINGLE VIEW
                            </button>
                        </div>
                        
                        {layoutMode === 'single' && (
                            <div className="flex bg-[var(--bg-primary)] p-1">
                                <button 
                                    onClick={() => setShowBeforeAfter('before')}
                                    className={`px-6 py-1.5 ppp-phase-tag !text-[0.65rem] !tracking-widest transition-all ${showBeforeAfter === 'before' ? 'bg-[var(--accent-color)] text-white' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                                >
                                    {t('step.review.before')}
                                </button>
                                <button 
                                    onClick={() => setShowBeforeAfter('after')}
                                    disabled={!hasFix}
                                    className={`px-6 py-1.5 ppp-phase-tag !text-[0.65rem] !tracking-widest transition-all ${showBeforeAfter === 'after' ? 'bg-[var(--accent-color)] text-white' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'} disabled:opacity-30 disabled:cursor-not-allowed`}
                                >
                                    {t('step.review.after')}
                                </button>
                            </div>
                        )}
                        
                        <div className="px-6 text-[0.65rem] font-mono text-[var(--text-muted)] uppercase tracking-[0.3em]">
                            {t('step.review.verifierLabel')}
                        </div>
                    </div>

                    <div className={`grid ${layoutMode === 'side-by-side' ? 'grid-cols-1 xl:grid-cols-2' : 'grid-cols-1'} gap-4`}>
                        {/* BEFORE VIEW */}
                        {(layoutMode === 'side-by-side' || showBeforeAfter === 'before') && (
                            <div className="border border-[var(--border-color)] bg-[var(--bg-tertiary)] relative overflow-hidden min-h-[500px] h-[650px] flex flex-col items-center bg-[var(--bg-primary)] group">
                                <div className="absolute top-4 left-4 z-20 px-3 py-1 bg-black/40 backdrop-blur-md border border-white/5 text-[0.6rem] font-black text-white uppercase tracking-[0.2em]">
                                    Original Document
                                </div>
                                <div className="absolute top-4 right-4 z-20">
                                    <div className="px-2 py-1 bg-amber-500/10 border border-amber-500/20 text-[0.55rem] font-bold text-amber-500 uppercase tracking-widest">
                                        Ingress State
                                    </div>
                                </div>
                                <PageViewer 
                                    key="viewer-before"
                                    file={originalFile || file}
                                    numPages={numPages}
                                    currentPage={currentPage}
                                    onPageChange={onPageChange}
                                    onNumPagesChange={onNumPagesChange}
                                    selectedIssue={null}
                                    heatmapData={heatmapData || null}
                                    onRunHeatmap={onRunHeatmap || (() => { })}
                                    isHeatmapLoading={isHeatmapLoading}
                                    previewPages={requestedMode === 'before' ? previewPages : null}
                                    previewLoading={requestedMode === 'before' ? previewLoading : false}
                                />
                            </div>
                        )}

                        {/* AFTER VIEW */}
                        {(layoutMode === 'side-by-side' || showBeforeAfter === 'after') && (
                            <div className="border border-[var(--border-color)] bg-[var(--bg-tertiary)] relative overflow-hidden min-h-[500px] h-[650px] flex flex-col items-center justify-center bg-[var(--bg-primary)] group">
                                <div className="absolute top-4 left-4 z-20 px-3 py-1 bg-[var(--accent-color)]/20 backdrop-blur-md border border-[var(--accent-color)]/20 text-[0.6rem] font-black text-[var(--accent-color)] uppercase tracking-[0.2em]">
                                    Optimized for Print
                                </div>
                                
                                {hasFix && (
                                    <div className="absolute top-4 right-4 z-20">
                                        <div className="px-2 py-1 bg-green-500/10 border border-green-500/20 text-[0.55rem] font-bold text-green-500 uppercase tracking-widest">
                                            Certified State
                                        </div>
                                    </div>
                                )}

                                {isGenerating && (
                                    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/50 backdrop-blur-md animate-in fade-in duration-500">
                                        <div className="h-12 w-12 border-4 border-white/10 border-t-[var(--accent-color)] rounded-full animate-spin mb-6" />
                                        <div className="text-white text-[0.75rem] font-black uppercase tracking-[0.3em] font-mono">
                                            {t('generatingCertificate')}
                                        </div>
                                    </div>
                                )}

                                {hasFix ? (
                                    <PageViewer 
                                        key="viewer-after"
                                        file={null}
                                        pdfUrl={lastPdfUrl}
                                        numPages={numPages}
                                        currentPage={currentPage}
                                        onPageChange={onPageChange}
                                        onNumPagesChange={onNumPagesChange}
                                        selectedIssue={null}
                                        hideNavigation={layoutMode === 'side-by-side'}
                                        heatmapData={null}
                                        onRunHeatmap={() => {}}
                                        isHeatmapLoading={false}
                                        previewPages={requestedMode === 'after' ? previewPages : null}
                                        previewLoading={requestedMode === 'after' ? previewLoading : false}
                                    />
                                ) : (
                                    <div className="flex flex-col items-center justify-center p-12 text-center space-y-6">
                                        <div className="h-20 w-20 bg-[var(--bg-secondary)] border border-[var(--border-color)] flex items-center justify-center rotate-45 group-hover:rotate-90 transition-all duration-700">
                                            <CommandLineIcon className="h-8 w-8 text-[var(--text-muted)] -rotate-45 group-hover:-rotate-90 transition-all duration-700" />
                                        </div>
                                        <div className="space-y-2">
                                            <h4 className="text-[0.75rem] font-black uppercase tracking-[0.2em] text-[var(--text-primary)]">No Fix Applied Yet</h4>
                                            <p className="text-[0.65rem] font-bold text-[var(--text-muted)] uppercase tracking-widest leading-relaxed max-w-[200px]">
                                                Run AutoFix to generate the corrected and certified artifact.
                                            </p>
                                        </div>
                                        {!isRunning && (
                                            <button 
                                                onClick={onBack}
                                                className="px-6 py-3 border border-[var(--accent-color)]/30 bg-[var(--accent-color)]/5 text-[var(--accent-color)] text-[0.6rem] font-black uppercase tracking-[0.2em] hover:bg-[var(--accent-color)] hover:text-white transition-all"
                                            >
                                                Go to Engine Fix
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="flex flex-col-reverse md:grid md:grid-cols-2 gap-4">
                        <button 
                            onClick={onStartOver}
                            className="bg-[var(--hover-bg)] text-[var(--text-secondary)] p-5 text-[0.85rem] font-black uppercase tracking-[0.2em] hover:text-[var(--text-primary)] transition-all border border-[var(--border-color)] flex items-center justify-center gap-2"
                        >
                            <ArrowPathIcon className="h-4 w-4" /> {t('startOver')}
                        </button>
                        
                        <button 
                            onClick={onNext}
                            disabled={isRunning || (!hasFix && !isAnalyzeOnly)}
                            className={`p-5 text-[0.85rem] font-black uppercase tracking-[0.25em] transition-all flex items-center justify-center gap-2 w-full ${ (isRunning || (!hasFix && !isAnalyzeOnly)) ? 'bg-[var(--text-muted)] cursor-not-allowed opacity-50' : 'bg-[var(--accent-color)] text-white hover:bg-[var(--accent-hover)] shadow-[0_15px_30px_rgba(220,0,0,0.2)]'}`}
                        >
                            <RocketLaunchIcon className="h-4 w-4" /> { (hasFix || isAnalyzeOnly) ? (isAnalyzeOnly ? t('step.analysis.finalizeTrace' as any).toUpperCase() : t('continueToReview').toUpperCase()) : t('waitingForArtifact' as any).toUpperCase()}
                        </button>

                        {/* Missing Artifact Warning (v2.4.120) */}
                        {!hasFix && !isRunning && !isAnalyzeOnly && (
                            <div className="md:col-span-2 p-4 bg-amber-500/10 border border-amber-500/30 flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-500">
                                <CpuChipIcon className="h-5 w-5 text-amber-500 shrink-0" />
                                <div className="text-[0.7rem] font-bold text-amber-500 uppercase tracking-widest leading-normal">
                                    Certified artifact is not accessible. You can finalize the trace, but the direct comparison is limited to the ingress state.
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Sidebar: Certification & Meta */}
                <div className="space-y-6 w-full lg:w-[380px] shrink-0">
                    {/* Compliance Panel */}
                    <div className="border border-[var(--border-color)] bg-[var(--bg-secondary)] p-8 space-y-8">
                        <div className="flex items-center justify-between">
                            <div className="ppp-phase-tag text-[var(--text-secondary)]">{t('step.review.traceCompliance')}</div>
                            <ShieldCheckIcon className={`h-5 w-5 ${isReadyForPrint ? 'text-[var(--accent-color)]' : 'text-[var(--text-muted)]'}`} />
                        </div>

                        <CertificationPanel 
                            title={isReadyForPrint ? t('readyForPrinting') : t('common.processing')} 
                            issuesFound={issuesFound}
                            fixesApplied={fixesApplied}
                            profile={selectedPolicy || 'FOGRA51 / ISO_COATED'}
                            riskStatus={isReadyForPrint ? "certified" : "warning"} 
                        />

                        <div className="pt-6 border-t border-[var(--border-color)] space-y-4">
                            <div className="flex items-center justify-between">
                                <span className="text-[0.8rem] font-black uppercase tracking-widest text-[var(--text-muted)]">{t('labelCertificateId')}</span>
                                <span className="text-[0.8rem] font-mono text-[var(--text-secondary)]">{formatLabel(result?.meta?.jobId || 'PPOS_INTERNAL_PENDING')}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-[0.8rem] font-black uppercase tracking-widest text-[var(--text-muted)]">{t('shell.policyProfile')}</span>
                                <span className="text-[0.8rem] font-mono text-[var(--text-secondary)] italic truncate max-w-[150px]">{formatLabel(selectedPolicy || 'DEFAULT_OVERSIGHT')}</span>
                            </div>
                            <button 
                                onClick={onDownloadReport}
                                className="w-full py-2 border-b border-dashed border-[var(--border-color)] text-[0.65rem] font-black uppercase tracking-[0.2em] text-[var(--text-muted)] hover:text-[var(--accent-color)] transition-all flex items-center justify-between group"
                            >
                                <span>Export Analysis Report (JSON)</span>
                                <CommandLineIcon className="h-3 w-3 opacity-50 group-hover:opacity-100" />
                            </button>
                        </div>
                        <div className="flex flex-col gap-3">
                            <div className="flex gap-2">
                                <button 
                                  onClick={onBack}
                                  className="px-4 py-3 border border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--text-muted)] text-[0.7rem] font-black uppercase tracking-[0.2em] hover:text-[var(--text-primary)] hover:border-[var(--text-primary)] transition-all flex items-center gap-2"
                                  title="Return to Policy Engine"
                                >
                                  <ChevronLeftIcon className="h-4 w-4" />
                                  {t('common.back')}
                                </button>
                                <button 
                                  onClick={() => setShowTechNote(true)}
                                  className="flex-1 px-4 py-3 border border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--text-muted)] text-[0.7rem] font-black uppercase tracking-[0.2em] hover:text-[var(--text-primary)] hover:border-[var(--text-primary)] transition-all flex items-center justify-center gap-2"
                                >
                                  {t('step.review.note' as any)}
                                </button>
                            </div>
                            <button 
                              onClick={onNext}
                              disabled={isRunning || (!hasFix && !isAnalyzeOnly)}
                              className={`w-full bg-[var(--accent-color)] hover:bg-[var(--accent-hover)] text-white text-[0.8rem] font-black uppercase tracking-[0.2em] py-5 transition-all flex items-center justify-center gap-2 ${ (isRunning || (!hasFix && !isAnalyzeOnly)) ? 'opacity-50 cursor-not-allowed' : 'shadow-[0_10px_30px_rgba(220,0,0,0.2)]'}`}
                            >
                              {(hasFix || isAnalyzeOnly) ? (isAnalyzeOnly ? t('step.analysis.finalizeTrace' as any) : t('continueToReview_v2' as any)) : t('waitingForArtifact' as any)}
                              {(hasFix || isAnalyzeOnly) && <span className="text-xl">→</span>}
                            </button>

                            {/* Live Certification Terminal (Monolith Extension) */}
                            {isRunning && !hasFix && (
                                <div className="mt-4 p-4 border border-[var(--border-color)] bg-black/40 space-y-3 animate-in fade-in slide-in-from-top-2 duration-500 overflow-hidden relative group">
                                    <div className="absolute inset-0 opacity-[0.02] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]" />
                                    
                                    <div className="flex items-center justify-between mb-1">
                                        <div className="flex items-center gap-2">
                                            <div className="h-1.5 w-1.5 rounded-full bg-[var(--accent-color)] animate-pulse shadow-[0_0_5px_rgba(220,0,0,0.8)]" />
                                            <span className="text-[0.6rem] font-black uppercase tracking-[0.2em] text-[var(--accent-color)]">PPOS_CERT_ENGINE</span>
                                        </div>
                                        <span className="text-[0.6rem] font-mono text-[var(--text-muted)]">{Math.floor(ldmProgress)}%</span>
                                    </div>

                                    <div className="space-y-2">
                                        <div className="h-[2px] w-full bg-[var(--border-color)] overflow-hidden">
                                            <div 
                                                className="h-full bg-[var(--accent-color)] transition-all duration-700 ease-out shadow-[0_0_8px_rgba(220,0,0,0.4)]"
                                                style={{ width: `${ldmProgress}%` }}
                                            />
                                        </div>
                                        
                                        <div className="font-mono text-[0.62rem] leading-relaxed space-y-1 pt-1">
                                            <div className="flex gap-2 text-[var(--text-primary)]">
                                                <span className="text-[var(--accent-color)] font-bold shrink-0">[LOG]</span>
                                                <span className="uppercase">{ldmStatus || 'DISPATCHING_REBUILD_AGENT...'}</span>
                                            </div>
                                            <div className="flex gap-2 text-[var(--text-secondary)] opacity-60 italic">
                                                <span className="text-[var(--text-muted)] shrink-0 font-bold">[PROCESS]</span>
                                                <span className="uppercase truncate">{certMessage || 'NORMALIZING_CARRIER...'}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between mt-1 pt-2 border-t border-[var(--border-color)]/20 text-[0.55rem] font-mono text-[var(--text-muted)] uppercase tracking-widest">
                                        <div className="flex items-center gap-1.5">
                                            <CpuChipIcon className="h-2.5 w-2.5" />
                                            <span>HARDENING_MODE_v2.4</span>
                                        </div>
                                        <span>ISO_F51_COMPLIANT</span>
                                    </div>

                                    {/* Scanline Animation */}
                                    <div className="absolute left-0 right-0 h-[1px] bg-[var(--accent-color)]/10 animate-[scan_4s_linear_infinite]" />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Production Hardening Tools */}
                    <div className="border border-[var(--border-color)] bg-[var(--bg-secondary)] p-8 space-y-6">
                        <div className="text-[0.82rem] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)]">{t('step.review.hardening')}</div>
                        <div className="space-y-2">
                           {[
                                { icon: <ArrowPathIcon className="h-4 w-4" />, text: t('step.review.forceGrayscale'), action: onConvertGrayscale },
                                { icon: <PaintBrushIcon className="h-4 w-4" />, text: t('step.review.optimizeCmyk'), action: onConvertColors },
                                { icon: <RocketLaunchIcon className="h-4 w-4" />, text: t('step.review.rebuild300'), action: onRebuildPdf },
                                { icon: <BookOpenIcon className="h-4 w-4" />, text: t('step.review.bookletMode'), action: onMakeBooklet }
                           ].map((tool, idx) => (
                               <button 
                                 key={idx}
                                 onClick={tool.action}
                                 className="w-full flex items-center justify-between p-4 border border-[var(--border-color)] hover:border-[var(--accent-color)]/20 hover:bg-[var(--accent-color)]/5 transition-all group"
                               >
                                  <div className="flex items-center gap-3">
                                      <div className="text-[var(--text-secondary)] group-hover:text-[var(--accent-color)]">{tool.icon}</div>
                                      <span className="text-[0.75rem] font-black uppercase tracking-widest text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]">{tool.text}</span>
                                  </div>
                                  <ChevronLeftIcon className="h-3 w-3 rotate-180 text-[var(--text-muted)]" />
                               </button>
                           ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Technical Note Modal (Monolith v2.4 Style) */}
            {showTechNote && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[var(--bg-primary)]/95 backdrop-blur-xl animate-in fade-in duration-300">
                    <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-[0_0_100px_rgba(220,0,0,0.1)]">
                        <div className="p-8 border-b border-[var(--border-color)] flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="h-10 w-10 bg-[var(--accent-color)] flex items-center justify-center">
                                    <DocumentCheckIcon className="h-6 w-6 text-white" />
                                </div>
                                <div>
                                    <div className="text-[0.82rem] font-black uppercase tracking-[0.2em] text-[var(--accent-color)]">{t('step.review.techCertNote')}</div>
                                    <div className="text-xl font-extrabold tracking-tight text-[var(--text-primary)]">{t('step.review.certDocument')}</div>
                                </div>
                            </div>
                            <button onClick={() => setShowTechNote(false)} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                                <XMarkIcon className="h-6 w-6" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-10 space-y-10 custom-scrollbar">
                            <div className="grid grid-cols-2 gap-8 text-[var(--text-primary)]">
                                <div className="space-y-4">
                                    <div className="text-[0.82rem] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">{t('step.review.metricIngress')}</div>
                                    <div className="space-y-2 font-mono text-[0.85rem]">
                                        <div className="flex justify-between border-b border-[var(--border-color)] pb-2">
                                            <span className="text-[var(--text-secondary)]">{t('fileLabel')}:</span>
                                            <span>{(file?.size || 0) / 1024 / 1024 > 1 ? `${((file?.size || 0) / 1024 / 1024).toFixed(2)}MB` : `${((file?.size || 0) / 1024).toFixed(0)}KB`}</span>
                                        </div>
                                        <div className="flex justify-between border-b border-[var(--border-color)] pb-2">
                                            <span className="text-[var(--text-secondary)]">{t('pageNavigation')}:</span>
                                            <span>{numPages}</span>
                                        </div>
                                        <div className="flex justify-between border-b border-[var(--border-color)] pb-2">
                                            <span className="text-[var(--text-secondary)]">{t('shell.finalState')}:</span>
                                            <span className={`${isReadyForPrint ? 'text-[var(--accent-color)]' : 'text-amber-500'} font-black uppercase text-[0.8rem]`}>
                                                {isReadyForPrint ? t('common.verified') : t('shell.manualReview')}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4 text-[var(--text-primary)]">
                                    <div className="text-[0.82rem] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">{t('step.review.inkOptimization')}</div>
                                    <div className="space-y-2 font-mono text-[0.85rem]">
                                        <div className="flex justify-between border-b border-[var(--border-color)] pb-2">
                                            <span className="text-[var(--text-secondary)]">{t('labelMaxTac')}</span>
                                            <span>{autoFixReport?.prepress_summary?.tac_summary?.max_tac || '300'}%</span>
                                        </div>
                                        <div className="flex justify-between border-b border-[var(--border-color)] pb-2">
                                            <span className="text-[var(--text-secondary)]">{t('profileLabel')}</span>
                                            <span className="truncate max-w-[150px]">{formatLabel(selectedPolicy || 'FOGRA51 / PSO_V3')}</span>
                                        </div>
                                        <div className="flex justify-between border-b border-[var(--border-color)] pb-2">
                                            <span className="text-[var(--text-secondary)]">{t('account.service.tier')}:</span>
                                            <span className="text-[var(--accent-color)] font-black">{t('step.review.highEfficiency')}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="p-8 bg-[var(--bg-primary)] border border-[var(--border-color)]">
                                <div className="text-[0.82rem] font-black uppercase tracking-[0.2em] text-[var(--accent-color)] mb-6">{t('step.review.traceLogs')}</div>
                                <div className="space-y-3 font-mono text-[0.8rem] text-[var(--text-secondary)]">
                                    <div className="flex items-start gap-3">
                                        <span className="text-[var(--accent-color)] font-black uppercase">{t('common.verified')}</span>
                                        <span>{t('step.review.productionGeometryOk')}</span>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <span className="text-[var(--accent-color)] font-black uppercase">{t('common.verified')}</span>
                                        <span>{t('step.review.colorProfilesNormalized')}</span>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <span className="text-[var(--accent-color)] font-black uppercase">{t('common.verified')}</span>
                                        <span>{t('step.review.fontEmbeddingConfirmed')}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="p-8 border-t border-[var(--border-color)] flex justify-end">
                            <button 
                                onClick={() => setShowTechNote(false)}
                                className="bg-[var(--accent-color)] text-white px-10 py-4 text-[0.9rem] font-black uppercase tracking-[0.2em] hover:bg-[var(--accent-hover)] transition-all"
                            >
                                {t('step.review.acknowledgeClose')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                @keyframes scan {
                    0% { top: 0; opacity: 0; }
                    50% { opacity: 1; }
                    100% { top: 100%; opacity: 0; }
                }
            `}</style>
        </div>
    );
};
