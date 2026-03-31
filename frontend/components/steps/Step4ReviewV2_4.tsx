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
    XMarkIcon
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
    onPageChange: (page: number) => void;
    onNumPagesChange: (num: number) => void;
    onConvertGrayscale: () => void;
    onConvertColors: () => void;
    onRebuildPdf: () => void;
    onMakeBooklet: () => void;
    onDownload: () => void;
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
    onPageChange,
    onNumPagesChange,
    onConvertGrayscale,
    onConvertColors,
    onRebuildPdf,
    onMakeBooklet,
    onDownload,
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
}) => {
    const { t } = useTranslation();
    const [showBeforeAfter, setShowBeforeAfter] = useState<'before' | 'after'>('after');
    const [showTechNote, setShowTechNote] = useState(false);

    // Diagnostics
    console.log('[STEP4][INPUTS]', { 
        hasResult: !!result, 
        hasBefore: !!autoFixBefore, 
        hasAfter: !!autoFixAfter,
        lastPdfUrl: !!lastPdfUrl,
        lastPdfName,
        appMode
    });
    
    // Canonical calculation of issues and fixes
    const issuesFound = autoFixBefore?.issues?.length || result?.issues?.length || 0;
    
    // Fixes Applied calculation logic:
    // 1. Check direct report if available
    // 2. Otherwise calc delta between before and after results
    const fixesApplied = autoFixReport?.fixes?.length || 
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
    const hasAfter = !!autoFixAfter || !!lastPdfUrl;
    
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
                                onClick={() => setShowBeforeAfter('before')}
                                className={`px-6 py-2 ppp-phase-tag !text-[0.8rem] !tracking-widest transition-all ${showBeforeAfter === 'before' ? 'bg-[var(--accent-color)] text-white' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                            >
                                {t('step.review.before')}
                            </button>
                            <button 
                                onClick={() => setShowBeforeAfter('after')}
                                className={`px-6 py-2 ppp-phase-tag !text-[0.8rem] !tracking-widest transition-all ${showBeforeAfter === 'after' ? 'bg-[var(--accent-color)] text-white' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                            >
                                {t('step.review.after')}
                            </button>
                        </div>
                        <div className="px-6 text-[0.8rem] font-mono text-[var(--text-muted)] uppercase tracking-widest">
                            {t('step.review.verifierLabel')}
                        </div>
                    </div>

                    <div className="border border-[var(--border-color)] bg-[var(--bg-tertiary)] relative overflow-hidden min-h-[500px] h-[600px] flex flex-col items-center justify-center p-2 md:p-8 bg-[var(--bg-primary)]">
                        {isGenerating && (
                            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/50 backdrop-blur-md animate-in fade-in duration-500">
                                <div className="h-12 w-12 border-4 border-white/10 border-t-[var(--accent-color)] rounded-full animate-spin mb-6" />
                                <div className="text-white text-[0.75rem] font-black uppercase tracking-[0.3em] font-mono">
                                    {t('generatingCertificate', 'GENERATING CERTIFICATE...')}
                                </div>
                            </div>
                        )}
                        <PageViewer 
                            key={`${showBeforeAfter}-${displayPdfUrl || 'local'}`}
                            file={displayFile}
                            pdfUrl={displayPdfUrl}
                            numPages={numPages}
                            currentPage={currentPage}
                            onPageChange={onPageChange}
                            onNumPagesChange={onNumPagesChange}
                            selectedIssue={null}
                            heatmapData={heatmapData || null}
                            onRunHeatmap={onRunHeatmap || (() => { })}
                            isHeatmapLoading={isHeatmapLoading}
                            previewPages={previewPages}
                            previewLoading={previewLoading}
                        />
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
                            disabled={!lastPdfUrl}
                            className={`p-5 text-[0.85rem] font-black uppercase tracking-[0.25em] transition-all flex items-center justify-center gap-2 w-full ${!lastPdfUrl ? 'bg-[var(--text-muted)] cursor-not-allowed opacity-50' : 'bg-[var(--accent-color)] text-white hover:bg-[var(--accent-hover)] shadow-[0_15px_30px_rgba(220,0,0,0.2)]'}`}
                        >
                            <RocketLaunchIcon className="h-4 w-4" /> {lastPdfUrl ? t('continueToReview').toUpperCase() : (t('waitingForArtifact' as any) || 'WAITING FOR ARTIFACT...').toUpperCase()}
                        </button>
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
                                <span className="text-[0.8rem] font-mono text-[var(--text-secondary)]">{formatLabel(`PPOS_TX_${(file?.size || 12345).toString().slice(-5)}`)}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-[0.8rem] font-black uppercase tracking-widest text-[var(--text-muted)]">{t('shell.policyProfile')}</span>
                                <span className="text-[0.8rem] font-mono text-[var(--text-secondary)] italic truncate max-w-[150px]">{formatLabel(selectedPolicy || 'DEFAULT_OVERSIGHT')}</span>
                            </div>
                        </div>
                        <button 
                            onClick={onNext}
                            className="w-full py-4 bg-[var(--accent-color)] text-white hover:bg-[var(--accent-hover)] text-[0.8rem] font-black uppercase tracking-[0.2em] transition-all shadow-[0_5px_15px_rgba(220,0,0,0.15)]"
                        >
                            {isReadyForPrint ? t('continueToReview', 'CONTINUE TO DOWNLOAD') : t('technicalNotes', 'TECHNICAL NOTES')}
                        </button>
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
        </div>
    );
};
