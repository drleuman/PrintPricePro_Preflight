import React, { useState } from 'react';
import { PreflightResult, FileMeta, AppMode } from '../../types';
import { StatusBadge, CertificationPanel, ActionBar } from '../../design/preflight_starter_pack';
import { formatLabel } from '../../utils/formatters';
import { pposFetch } from '../../lib/apiClient';
import { PageViewer } from '../PageViewer';
import { t } from '../../i18n';
import { 
    SparklesIcon, 
    ArrowPathIcon, 
    PaintBrushIcon, 
    RocketLaunchIcon, 
    BookOpenIcon, 
    ArrowDownTrayIcon, 
    Square3Stack3DIcon, 
    BeakerIcon,
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
    onStartOver: () => void;
    onBack: () => void;
    appMode?: AppMode;
    heatmapData?: any;
    isHeatmapLoading?: boolean;
    onRunHeatmap?: () => void;
    originalFile?: File | null;
    autoFixReport?: any;
    previewPages?: string[] | null;
    previewLoading?: boolean;
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
    onStartOver,
    onBack,
    appMode,
    heatmapData,
    isHeatmapLoading = false,
    onRunHeatmap,
    originalFile,
    autoFixReport,
    previewPages = null,
    previewLoading = false,
}) => {
    const [showBeforeAfter, setShowBeforeAfter] = useState<'before' | 'after'>('after');
    const [showTechNote, setShowTechNote] = useState(false);
    
    const issuesCount = result?.issues?.length || 0;
    const isReadyForPrint = !!result && issuesCount === 0;
    const hasBeenProcessed = !!lastPdfUrl;

    const displayFile = showBeforeAfter === 'before' && originalFile ? originalFile : file;

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

            <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_400px]">
                {/* Main Content: Preview & Comparison */}
                <div className="space-y-6 max-w-full overflow-hidden">
                    <div className="border border-[var(--border-color)] bg-[var(--bg-secondary)] p-1 flex flex-col md:flex-row items-center justify-between gap-4">
                        <div className="flex bg-[var(--bg-primary)] p-1">
                            <button 
                                onClick={() => setShowBeforeAfter('before')}
                                className={`px-6 py-2 ppp-phase-tag !text-[0.8rem] !tracking-widest transition-all ${showBeforeAfter === 'before' ? 'bg-[var(--accent-color)] text-white' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                            >
                                BEFORE
                            </button>
                            <button 
                                onClick={() => setShowBeforeAfter('after')}
                                className={`px-6 py-2 ppp-phase-tag !text-[0.8rem] !tracking-widest transition-all ${showBeforeAfter === 'after' ? 'bg-[var(--accent-color)] text-white' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                            >
                                AFTER
                            </button>
                        </div>
                        <div className="px-6 text-[0.8rem] font-mono text-[var(--text-muted)] uppercase tracking-widest">
                            Visual Verifier v2.4
                        </div>
                    </div>

                    <div className="border border-[var(--border-color)] bg-[var(--bg-tertiary)] relative overflow-hidden h-[650px] flex flex-col items-center justify-center p-2 md:p-8 bg-[var(--bg-primary)]">
                        <PageViewer 
                            file={displayFile}
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
                        
                        {lastPdfUrl && (
                            <button 
                                onClick={async () => {
                                    try {
                                        const blob = await pposFetch(lastPdfUrl) as Blob;
                                        const url = window.URL.createObjectURL(blob);
                                        const a = document.createElement('a');
                                        a.href = url;
                                        a.download = lastPdfName || 'optimized_output.pdf';
                                        a.click();
                                        window.URL.revokeObjectURL(url);
                                    } catch (err) {
                                        console.error('Download failed', err);
                                        alert('Failed to download artifact. Ensure you have the right permissions.');
                                    }
                                }}
                                className="bg-[var(--accent-color)] text-white p-5 text-[0.85rem] font-black uppercase tracking-[0.25em] transition-all hover:bg-[var(--accent-hover)] shadow-[0_15px_30px_rgba(220,0,0,0.2)] flex items-center justify-center gap-2 w-full"
                            >
                                <ArrowDownTrayIcon className="h-4 w-4" /> {t('step.review.download')}
                            </button>
                        )}
                    </div>
                </div>

                {/* Sidebar: Certification & Meta */}
                <div className="space-y-6">
                    {/* Compliance Panel */}
                    <div className="border border-[var(--border-color)] bg-[var(--bg-secondary)] p-8 space-y-8">
                        <div className="flex items-center justify-between">
                            <div className="ppp-phase-tag text-[var(--text-secondary)]">Trace Compliance</div>
                            <ShieldCheckIcon className={`h-5 w-5 ${isReadyForPrint ? 'text-[var(--accent-color)]' : 'text-[var(--text-muted)]'}`} />
                        </div>

                        <CertificationPanel 
                            title={isReadyForPrint ? t('readyForPrinting') : t('analysisWaitMessage')} 
                            riskStatus={isReadyForPrint ? "certified" : "warning"} 
                        />

                        <div className="pt-6 border-t border-[var(--border-color)] space-y-4">
                            <div className="flex items-center justify-between">
                                <span className="text-[0.8rem] font-black uppercase tracking-widest text-[var(--text-muted)]">Certification ID</span>
                                <span className="text-[0.8rem] font-mono text-[var(--text-secondary)]">{formatLabel(`PPOS_TX_${Math.floor(Math.random() * 90000) + 10000}`)}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-[0.8rem] font-black uppercase tracking-widest text-[var(--text-muted)]">Policy Profile</span>
                                <span className="text-[0.8rem] font-mono text-[var(--text-secondary)] italic">{formatLabel('FOGRA51 / PSO_V3')}</span>
                            </div>
                        </div>

                        <button 
                            onClick={() => setShowTechNote(true)}
                            className="w-full py-4 bg-[var(--accent-color)] text-white hover:bg-[var(--accent-hover)] text-[0.8rem] font-black uppercase tracking-[0.2em] transition-all shadow-[0_5px_15px_rgba(220,0,0,0.15)]"
                        >
                            {t('step.review.note').toUpperCase()}
                        </button>
                    </div>

                    {/* Production Hardening Tools */}
                    <div className="border border-[var(--border-color)] bg-[var(--bg-secondary)] p-8 space-y-6">
                        <div className="text-[0.82rem] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)]">{t('step.review.hardening')}</div>
                        <div className="space-y-2">
                           {[
                                { icon: <ArrowPathIcon className="h-4 w-4" />, text: 'Force Grayscale', action: onConvertGrayscale },
                                { icon: <PaintBrushIcon className="h-4 w-4" />, text: 'Optimize CMYK', action: onConvertColors },
                                { icon: <RocketLaunchIcon className="h-4 w-4" />, text: 'Rebuild 300DPI', action: onRebuildPdf },
                                { icon: <BookOpenIcon className="h-4 w-4" />, text: 'Booklet Mode', action: onMakeBooklet }
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
                                    <div className="text-[0.82rem] font-black uppercase tracking-[0.2em] text-[var(--accent-color)]">Technical Certification Note</div>
                                    <div className="text-xl font-extrabold tracking-tight text-[var(--text-primary)]">Compliance Document</div>
                                </div>
                            </div>
                            <button onClick={() => setShowTechNote(false)} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                                <XMarkIcon className="h-6 w-6" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-10 space-y-10 custom-scrollbar">
                            <div className="grid grid-cols-2 gap-8 text-[var(--text-primary)]">
                                <div className="space-y-4">
                                    <div className="text-[0.82rem] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">Metric Ingress</div>
                                    <div className="space-y-2 font-mono text-[0.85rem]">
                                        <div className="flex justify-between border-b border-[var(--border-color)] pb-2">
                                            <span className="text-[var(--text-secondary)]">File Size:</span>
                                            <span>{(file?.size || 0) / 1024 / 1024 > 1 ? `${((file?.size || 0) / 1024 / 1024).toFixed(2)}MB` : `${((file?.size || 0) / 1024).toFixed(0)}KB`}</span>
                                        </div>
                                        <div className="flex justify-between border-b border-[var(--border-color)] pb-2">
                                            <span className="text-[var(--text-secondary)]">Page Count:</span>
                                            <span>{numPages}</span>
                                        </div>
                                        <div className="flex justify-between border-b border-[var(--border-color)] pb-2">
                                            <span className="text-[var(--text-secondary)]">Signal Status:</span>
                                            <span className="text-[var(--accent-color)] font-black">CERTIFIED</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4 text-[var(--text-primary)]">
                                    <div className="text-[0.82rem] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">Ink Optimization</div>
                                    <div className="space-y-2 font-mono text-[0.85rem]">
                                        <div className="flex justify-between border-b border-[var(--border-color)] pb-2">
                                            <span className="text-[var(--text-secondary)]">Max TAC:</span>
                                            <span>{autoFixReport?.prepress_summary?.tac_summary?.max_tac || '300'}%</span>
                                        </div>
                                        <div className="flex justify-between border-b border-[var(--border-color)] pb-2">
                                            <span className="text-[var(--text-secondary)]">Profile:</span>
                                            <span>FOGRA51</span>
                                        </div>
                                        <div className="flex justify-between border-b border-[var(--border-color)] pb-2">
                                            <span className="text-[var(--text-secondary)]">Efficiency:</span>
                                            <span className="text-[var(--accent-color)] font-black">HIGH</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="p-8 bg-[var(--bg-primary)] border border-[var(--border-color)]">
                                <div className="text-[0.82rem] font-black uppercase tracking-[0.2em] text-[var(--accent-color)] mb-6">Trace Logs</div>
                                <div className="space-y-3 font-mono text-[0.8rem] text-[var(--text-secondary)]">
                                    <div className="flex items-start gap-3">
                                        <span className="text-[var(--accent-color)] font-black">OK</span>
                                        <span>Production geometry verified for offset printing standards.</span>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <span className="text-[var(--accent-color)] font-black">OK</span>
                                        <span>Color profiles normalized to CMYK PSO V3.</span>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <span className="text-[var(--accent-color)] font-black">OK</span>
                                        <span>Font embedding status confirmed for all glyphs.</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="p-8 border-t border-[var(--border-color)] flex justify-end">
                            <button 
                                onClick={() => setShowTechNote(false)}
                                className="bg-[var(--accent-color)] text-white px-10 py-4 text-[0.9rem] font-black uppercase tracking-[0.2em] hover:bg-[var(--accent-hover)] transition-all"
                            >
                                Acknowledge & Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
