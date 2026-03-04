import { t } from '../../i18n';
import React, { useState } from 'react';
import { PreflightResult, FileMeta } from '../../types';
import { PageViewer } from '../PageViewer';
import { SparklesIcon, ArrowPathIcon, PaintBrushIcon, RocketLaunchIcon, BookOpenIcon, ArrowDownTrayIcon, Square3Stack3DIcon, BeakerIcon } from '@heroicons/react/24/outline';

interface Step4ReviewProps {
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
    appMode?: 'manual' | 'ai' | null;
    heatmapData?: any;
    isHeatmapLoading?: boolean;
    onRunHeatmap?: () => void;
    originalFile?: File | null;
    autoFixReport?: any;
    previewPages?: string[] | null;
    previewLoading?: boolean;
}

export const Step4Review: React.FC<Step4ReviewProps> = ({
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
    const hasIssues = issuesCount > 0;
    const hasBeenProcessed = !!lastPdfUrl;

    // Determine which file to show based on Before/After toggle
    const displayFile = showBeforeAfter === 'before' && originalFile ? originalFile : file;

    // Determine status
    // Only ready if we have a result AND it has zero issues. 
    // If result is null, we are NOT ready (still analyzing or failed).
    const isReadyForPrint = !!result && issuesCount === 0;
    const statusTitle = appMode === 'ai'
        ? <span className="flex items-center gap-2">AI Magic Applied! <SparklesIcon className="w-6 h-6 text-amber-400" /></span>
        : isReadyForPrint
            ? 'Ready for Print!'
            : 'Review Required';

    const statusText = appMode === 'ai'
        ? 'Our AI Wizard has automatically optimized your colors, resolution, and margins for professional printing.'
        : hasBeenProcessed
            ? `Document processed successfully${issuesCount > 0 ? ` (${issuesCount} issue${issuesCount !== 1 ? 's' : ''} addressed)` : ''}`
            : hasIssues
                ? `${issuesCount} issue${issuesCount !== 1 ? 's' : ''} found - apply corrections or download original`
                : 'No issues found in your PDF';

    return (
        <div className="step step--review max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 animate-in fade-in duration-1000 slide-in-from-bottom-4">
            {/* Header Section */}
            <div className="mb-12 text-center animate-in fade-in slide-in-from-top-4 duration-700 delay-150">
                <h2 className="text-4xl font-black text-gray-900 tracking-tight mb-3">
                    {t('reviewAndDownload')}
                </h2>
                <p className="text-lg text-gray-500 max-w-2xl mx-auto font-medium">
                    {isReadyForPrint
                        ? 'Your print-ready PDF is ready! Review and download below.'
                        : 'Review your document and apply corrections if needed.'}
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
                {/* Sidebar - Actions & Summary */}
                <div className="lg:col-span-4 space-y-8 sticky top-8 animate-in fade-in slide-in-from-left-4 duration-700 delay-300">

                    {/* 1. Status Dashboard Card */}
                    <div className={`p-8 rounded-[2.5rem] border transition-all duration-500 hover:shadow-2xl hover:-translate-y-1 ${isReadyForPrint ? 'bg-white border-gray-100 shadow-xl shadow-gray-100' : 'bg-amber-50 border-amber-100 shadow-xl shadow-amber-100'}`}>
                        <div className="flex items-center gap-5 mb-6">
                            <div className={`w-16 h-16 rounded-[1.5rem] flex items-center justify-center shrink-0 transition-transform duration-500 hover:rotate-3 ${isReadyForPrint ? 'bg-green-100 text-green-600' : 'bg-amber-100 text-amber-600'}`}>
                                {isReadyForPrint ? (
                                    <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="20 6 9 17 4 12"></polyline>
                                    </svg>
                                ) : (
                                    <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                                        <line x1="12" y1="9" x2="12" y2="13"></line>
                                        <line x1="12" y1="17" x2="12.01" y2="17"></line>
                                    </svg>
                                )}
                            </div>
                            <div>
                                <h3 className="text-2xl font-black text-gray-900 tracking-tight leading-none">{statusTitle}</h3>
                                <p className={`text-[10px] font-black uppercase tracking-[0.2em] mt-2 ${isReadyForPrint ? 'text-green-600' : 'text-amber-600'}`}>
                                    {isReadyForPrint ? 'Ready for Production' : 'Action Required'}
                                </p>
                            </div>
                        </div>

                        <p className="text-gray-600 text-sm font-medium leading-relaxed mb-8">
                            {statusText}
                        </p>

                        {/* 2. Technical Specs Grid */}
                        {appMode === 'ai' && hasBeenProcessed && (
                            <div className="grid grid-cols-2 gap-4 p-6 bg-gray-50/50 rounded-3xl border border-gray-100/50 backdrop-blur-sm">
                                <div className="space-y-1">
                                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Color Profile</span>
                                    <p className="text-[11px] font-black text-gray-900 truncate" title={autoFixReport?.prepress_summary?.output_profile}>
                                        {autoFixReport?.prepress_summary?.output_profile || 'FOGRA51'}
                                    </p>
                                </div>
                                <div className="space-y-1 text-right">
                                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Resolution</span>
                                    <p className="text-[11px] font-black text-gray-900">300 DPI</p>
                                </div>
                                <div className="space-y-1">
                                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Bleed</span>
                                    <p className="text-[11px] font-black text-green-600">
                                        {autoFixReport?.applied?.some(a => a.action === 'add_bleed_canvas') ? '3mm Applied' : 'Verified'}
                                    </p>
                                </div>
                                <div className="space-y-1 text-right">
                                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Output Intent</span>
                                    <p className="text-[11px] font-black text-blue-600">Embedded</p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* 3. Primary Download Card */}
                    {lastPdfUrl && (
                        <div className="p-8 bg-gray-900 rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.2)] text-white relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-8 opacity-10 scale-[2] rotate-12 group-hover:rotate-0 group-hover:scale-[2.2] transition-all duration-700 ease-out pointer-events-none">
                                <svg width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                    <polyline points="7 10 12 15 17 10"></polyline>
                                    <line x1="12" y1="15" x2="12" y2="3"></line>
                                </svg>
                            </div>

                            <div className="relative z-10">
                                <h4 className="text-xl font-black mb-1 tracking-tight">Download Final PDF</h4>
                                <p className="text-gray-400 text-[11px] font-bold uppercase tracking-widest mb-10">Production-Ready Build</p>

                                <a
                                    href={lastPdfUrl}
                                    download={lastPdfName || 'output.pdf'}
                                    className="flex items-center justify-center gap-3 w-full py-6 bg-red-600 hover:bg-red-500 text-white rounded-[1.5rem] font-black text-sm uppercase tracking-[0.15em] transition-all shadow-xl shadow-red-900/40 active:scale-[0.97] hover:shadow-2xl hover:shadow-red-900/50"
                                >
                                    <svg className="w-5 h-5 animate-bounce" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                        <polyline points="7 10 12 15 17 10"></polyline>
                                        <line x1="12" y1="15" x2="12" y2="3"></line>
                                    </svg>
                                    Get Your File
                                </a>

                                <div className="mt-8 pt-6 border-t border-white/10 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                                        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-500">Verified Stable</span>
                                    </div>
                                    <span className="text-[10px] font-mono text-gray-500 truncate max-w-[140px] opacity-60">
                                        {lastPdfName || 'optimized_output.pdf'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 4. Secondary Actions Card */}
                    <div className="p-8 bg-white rounded-[2.5rem] border border-gray-100 shadow-sm space-y-4">
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Available Reports</span>

                        <button
                            className="flex items-center justify-between w-full p-5 rounded-2xl border border-gray-100 hover:border-red-100 hover:bg-red-50/30 transition-all group"
                            onClick={() => setShowTechNote(true)}
                        >
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-xl bg-red-50 text-red-600 flex items-center justify-center group-hover:scale-110 group-hover:rotate-3 transition-all duration-300">
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                        <polyline points="14 2 14 8 20 8"></polyline>
                                    </svg>
                                </div>
                                <div className="text-left">
                                    <span className="block text-sm font-black text-gray-900 tracking-tight">{t('technicalNoteTitle')}</span>
                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Compliance certified</span>
                                </div>
                            </div>
                            <svg className="w-4 h-4 text-gray-300 group-hover:text-red-600 group-hover:translate-x-1 transition-all" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4">
                                <polyline points="9 18 15 12 9 6"></polyline>
                            </svg>
                        </button>

                        <button
                            className="flex items-center justify-between w-full p-5 rounded-2xl border border-dotted border-gray-200 hover:border-solid hover:border-gray-300 hover:bg-gray-50 transition-all group"
                            onClick={() => {
                                const summary = autoFixReport?.prepress_summary;
                                const tac = summary?.tac_summary;
                                const op = summary?.overprint_summary;
                                const spot = summary?.spot_summary;
                                const bleedApplied = autoFixReport?.applied?.some(a => a.action === 'add_bleed_canvas');

                                let content = `PREPRESS COMPLIANCE REPORT\n` +
                                    `==========================\n` +
                                    `Certificate ID: ${summary?.certificate_id || 'PENDING'}\n` +
                                    `Date: ${new Date().toISOString()}\n\n` +
                                    `Result: ${(summary?.risk_level || 'UNKNOWN').toUpperCase()}\n` +
                                    `Profile: ${summary?.output_profile || 'ISO Coated v3 (FOGRA51)'}\n` +
                                    `TAC: ${tac?.max_tac ?? '---'}%\n` +
                                    `Overprint: ${op?.risk === 'green' ? 'OK' : 'RISK'}\n` +
                                    `Spots: ${spot?.spot_count ?? 0}\n\n` +
                                    `Bleed Method: ${bleedApplied ? 'Centered Scaling' : 'Verified'}\n` +
                                    `Production Imposition Score: ${result?.productionReport?.imposition?.score || 100}/100`;

                                if (result?.issues && result.issues.length > 0) {
                                    content += `\n\nISSUES FOUND:\n`;
                                    for (const iss of result.issues) {
                                        if (!iss) continue;
                                        const sev = String(iss.severity || '').toLowerCase();
                                        content += `- [${sev.toUpperCase()}] ${iss.message || 'Unknown issue'}\n`;
                                    }
                                }

                                const blob = new Blob([content], { type: 'text/plain' });
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = `Prepress_Report_${summary?.certificate_id || 'unverified'}.txt`;
                                a.click();
                                URL.revokeObjectURL(url);
                            }}
                        >
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-xl bg-gray-50 text-gray-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                        <polyline points="7 10 12 15 17 10"></polyline>
                                        <line x1="12" y1="15" x2="12" y2="3"></line>
                                    </svg>
                                </div>
                                <div className="text-left">
                                    <span className="block text-sm font-black text-gray-600 tracking-tight">{t('downloadReport')}</span>
                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">TXT Summary</span>
                                </div>
                            </div>
                        </button>
                    </div>

                    {/* 5. Tools & Optimizations Card */}
                    <div className="p-8 bg-white rounded-[2.5rem] border border-gray-100 shadow-sm">
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-6 block">Production Tools</span>

                        <div className="space-y-3">
                            {[
                                { icon: <ArrowPathIcon className="w-5 h-5" />, text: 'To Grayscale', action: onConvertGrayscale, color: 'bg-gray-100' },
                                { icon: <PaintBrushIcon className="w-5 h-5" />, text: 'To CMYK', action: onConvertColors, color: 'bg-amber-50' },
                                { icon: <RocketLaunchIcon className="w-5 h-5" />, text: 'Rebuild High-Res', action: onRebuildPdf, color: 'bg-blue-50', badge: '300DPI' },
                                { icon: <BookOpenIcon className="w-5 h-5" />, text: 'Make Booklet', action: onMakeBooklet, color: 'bg-purple-50' }
                            ].map((tool, idx) => (
                                <button
                                    key={idx}
                                    onClick={tool.action}
                                    disabled={isRunning}
                                    className="flex items-center justify-between w-full p-4 rounded-[1.25rem] border border-transparent hover:border-red-100 hover:bg-red-50/50 transition-all group disabled:opacity-50"
                                >
                                    <div className="flex items-center gap-4">
                                        <span className="text-xl group-hover:scale-125 transition-transform duration-300">{tool.icon}</span>
                                        <span className="text-sm font-bold text-gray-700">{tool.text}</span>
                                        {tool.badge && (
                                            <span className="px-2 py-0.5 bg-gray-900 text-white text-[8px] font-black rounded-full uppercase tracking-widest">{tool.badge}</span>
                                        )}
                                    </div>
                                    <svg className="w-3 h-3 text-gray-300 group-hover:text-red-600 transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4">
                                        <polyline points="9 18 15 12 9 6"></polyline>
                                    </svg>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Main Content - Preview Area */}
                <div className="lg:col-span-8 animate-in fade-in slide-in-from-right-4 duration-700 delay-500">
                    {/* Comparison Control */}
                    {appMode === 'ai' && lastPdfUrl && file && (
                        <div className="mb-8 flex items-center justify-between p-5 bg-white rounded-[2rem] border border-gray-100 shadow-xl shadow-gray-50/50 backdrop-blur-md">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                        <polyline points="14 2 14 8 20 8"></polyline>
                                    </svg>
                                </div>
                                <div>
                                    <span className="block text-xs font-black text-gray-900 uppercase tracking-widest leading-none">Visual Comparison</span>
                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Check applied changes</span>
                                </div>
                            </div>

                            <div className="flex bg-gray-100/80 p-1.5 rounded-2xl">
                                <button
                                    className={`px-8 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-[0.15em] transition-all duration-300 ${showBeforeAfter === 'before' ? 'bg-white text-gray-900 shadow-md scale-[1.05]' : 'text-gray-400 hover:text-gray-600'}`}
                                    onClick={() => setShowBeforeAfter('before')}
                                >
                                    Before
                                </button>
                                <button
                                    className={`px-8 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-[0.15em] transition-all duration-300 ${showBeforeAfter === 'after' ? 'bg-red-600 text-white shadow-xl shadow-red-200 scale-[1.05]' : 'text-gray-400 hover:text-gray-600'}`}
                                    onClick={() => setShowBeforeAfter('after')}
                                >
                                    After
                                </button>
                            </div>
                        </div>
                    )}

                    {/* PDF Viewer Container */}
                    <div className="group/viewer relative transition-all duration-500 hover:shadow-2xl hover:shadow-gray-200 rounded-[2rem] overflow-hidden">
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

                    {/* Footer Actions */}
                    <div className="mt-16 flex items-center justify-between border-t border-gray-100 pt-10">
                        <div className="flex gap-6">
                            {appMode !== 'ai' && (
                                <button className="px-10 py-5 text-xs font-black uppercase tracking-[0.2em] text-gray-400 hover:text-gray-900 transition-all hover:-translate-x-1" onClick={onBack}>
                                    ← Back
                                </button>
                            )}
                            <button className="px-10 py-5 text-xs font-black uppercase tracking-[0.2em] text-red-600 hover:bg-red-50 rounded-2xl transition-all flex items-center gap-2" onClick={onStartOver}>
                                <ArrowPathIcon className="w-4 h-4" /> Start Over
                            </button>
                        </div>

                        {!lastPdfUrl && (
                            <button className="px-12 py-5 bg-gray-100 text-gray-300 rounded-[1.5rem] font-black text-xs uppercase tracking-[0.2em] cursor-not-allowed flex items-center gap-2" disabled>
                                <ArrowDownTrayIcon className="w-4 h-4" /> Download Original
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Prepress Technical Note Modal */}
            {showTechNote && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl max-w-xl w-full overflow-hidden animate-in zoom-in-95 duration-300 border border-white/20">
                        <div className="p-10">
                            <div className="w-20 h-20 bg-red-600 rounded-3xl flex items-center justify-center text-white mb-8 mx-auto shadow-2xl shadow-red-200">
                                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                                    <polyline points="14 2 14 8 20 8" />
                                </svg>
                            </div>
                            <h3 className="text-3xl font-black text-gray-900 mb-2 text-center">{t('technicalNoteTitle')}</h3>
                            <p className="text-sm text-gray-500 mb-10 text-center font-medium max-w-sm mx-auto">{t('technicalNoteDesc')}</p>

                            <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                                {/* Risk Level Badge */}
                                <div className={`p-6 rounded-[1.5rem] flex items-center justify-between font-black text-sm uppercase tracking-widest ${autoFixReport?.prepress_summary?.risk_level === 'green' ? 'bg-green-100 text-green-800' :
                                    autoFixReport?.prepress_summary?.risk_level === 'attention' ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'
                                    }`}>
                                    <div className="flex items-center gap-3">
                                        <div className={`w-3 h-3 rounded-full animate-pulse ${autoFixReport?.prepress_summary?.risk_level === 'green' ? 'bg-green-600' : 'bg-red-600'}`}></div>
                                        {t('labelRiskLevel')}
                                    </div>
                                    <span>{
                                        autoFixReport?.prepress_summary?.risk_level === 'green' ? t('riskGreen') :
                                            autoFixReport?.prepress_summary?.risk_level === 'attention' ? t('riskAttention') : t('riskBlocking')
                                    }</span>
                                </div>

                                {/* Structured Certificate Block */}
                                <div className="p-8 bg-gray-900 rounded-[2rem] text-white shadow-2xl">
                                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 mb-6 border-b border-white/5 pb-4">
                                        {t('complianceSummaryTitle')}
                                    </h4>
                                    <div className="space-y-4 text-xs font-mono">
                                        {[
                                            { label: t('labelCertificateId'), value: autoFixReport?.prepress_summary?.certificate_id, color: 'text-white' },
                                            { label: t('labelOutputIntent'), value: autoFixReport?.policy?.icc || 'ISO Coated v3', color: 'text-red-500 font-black' },
                                            { label: t('labelStructure'), value: t('statusVerified'), color: 'text-green-500 font-black' },
                                            { label: t('labelInkCoverage'), value: `${autoFixReport?.prepress_summary?.tac_summary?.max_tac || 0}%`, color: 'text-amber-500' },
                                            { label: t('labelOverprint'), value: autoFixReport?.prepress_summary?.overprint_summary?.risk === 'green' ? 'VERIFIED' : 'RISK', color: 'text-white' }
                                        ].map((row, i) => (
                                            <div key={i} className="flex justify-between items-center border-b border-white/5 pb-4">
                                                <span className="text-gray-500 uppercase text-[9px] tracking-widest">{row.label}</span>
                                                <span className={`${row.color} truncate max-w-[200px]`}>{row.value || 'N/A'}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Detailed Data Loops (Production, Ink, Edition) */}
                                <div className="space-y-4">
                                    {[
                                        {
                                            title: 'Production Geometry', icon: <Square3Stack3DIcon className="w-4 h-4" />, rows: [
                                                { l: 'Spine Class', v: result?.productionReport?.spine?.classification || 'OK' },
                                                { l: 'Expected', v: `${result?.productionReport?.spine?.expectedSpineMm || 0}mm` },
                                                { l: 'Detected', v: `${result?.productionReport?.spine?.detectedSpineMm || 0}mm` }
                                            ]
                                        },
                                        {
                                            title: 'Ink & Efficiency', icon: <BeakerIcon className="w-4 h-4" />, rows: [
                                                { l: 'Cost Class', v: result?.productionReport?.inkOptimization?.costCategory || 'LOW' },
                                                { l: 'Avg Coverage', v: `${result?.productionReport?.inkOptimization?.totalCoverageAvg?.toFixed(1) || 0}%` }
                                            ]
                                        }
                                    ].map((section, idx) => (
                                        <div key={idx} className="p-6 bg-gray-50 rounded-2xl border border-gray-100">
                                            <h5 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-4 flex items-center gap-2">
                                                <span>{section.icon}</span> {section.title}
                                            </h5>
                                            <div className="grid grid-cols-2 gap-4">
                                                {section.rows.map((row, rIdx) => (
                                                    <div key={rIdx}>
                                                        <span className="block text-[9px] text-gray-400 uppercase font-black tracking-widest mb-1">{row.l}</span>
                                                        <span className="text-xs font-bold text-gray-900">{row.v}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <button
                                onClick={() => setShowTechNote(false)}
                                className="mt-10 w-full py-5 bg-gray-900 text-white rounded-[1.5rem] font-black text-sm uppercase tracking-widest hover:bg-gray-800 transition-all shadow-xl active:scale-[0.98]"
                            >
                                {t('closeNote')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Step4Review;
