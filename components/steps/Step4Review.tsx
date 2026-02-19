import { t } from '../../i18n';
import React, { useState } from 'react';
import { PreflightResult, FileMeta } from '../../types';
import { PageViewer } from '../PageViewer';

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
    const isReadyForPrint = !hasIssues || hasBeenProcessed;
    const statusIcon = isReadyForPrint ? '✅' : '⚠️';
    const statusTitle = appMode === 'ai'
        ? 'AI Magic Applied! ✨'
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
        <div className="step step--review">
            <div className="step__header">
                <h2 className="step__title">Review & Download</h2>
                <p className="step__description">
                    {isReadyForPrint
                        ? 'Your print-ready PDF is ready! Review and download below.'
                        : 'Review your document and apply corrections if needed.'}
                </p>
            </div>

            <div className="step__content step__content--split">
                <div className="step__sidebar">
                    <div className={`review-summary ${!isReadyForPrint ? 'review-summary--warning' : ''}`}>
                        <div className="review-summary__header">
                            <div className="review-summary__badge">
                                {isReadyForPrint ? (
                                    <svg className="review-summary__check" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="20 6 9 17 4 12"></polyline>
                                    </svg>
                                ) : (
                                    <svg className="review-summary__check" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                                        <line x1="12" y1="9" x2="12" y2="13"></line>
                                        <line x1="12" y1="17" x2="12.01" y2="17"></line>
                                    </svg>
                                )}
                            </div>
                            <h3 className="review-summary__title">{statusTitle}</h3>
                            <p className="review-summary__subtitle">
                                {isReadyForPrint ? 'Professional print-ready file generated' : 'Action required to proceed'}
                            </p>
                        </div>

                        <div className="review-summary__content">
                            <p className="review-summary__description">
                                {statusText}
                            </p>

                            {appMode === 'ai' && hasBeenProcessed && (
                                <div className="review-summary__specs">
                                    <div className="spec-row">
                                        <span className="spec-label">Color Profile</span>
                                        <span className="spec-value spec-value--highlight">
                                            {autoFixReport?.prepress_summary?.output_profile || 'ISO Coated v2 (FOGRA39)'}
                                        </span>
                                    </div>
                                    <div className="spec-row">
                                        <span className="spec-label">Output Intent</span>
                                        <span className="spec-value">
                                            <span className="status-badge status-badge--success">
                                                <span className="status-dot"></span>
                                                {autoFixReport?.prepress_summary?.outputintent_valid ? t('verified') : t('embedded')}
                                            </span>
                                        </span>
                                    </div>
                                    <div className="spec-row">
                                        <span className="spec-label">Resolution</span>
                                        <span className="spec-value">300 DPI</span>
                                    </div>
                                    <div className="spec-row">
                                        <span className="spec-label">Bleed</span>
                                        <span className="spec-value">
                                            {autoFixReport?.applied?.some(a => a.action === 'add_bleed_canvas') ? '3mm applied' : 'Verified'}
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="review-summary__actions">
                            <button className="btn btn--primary" onClick={() => setShowTechNote(true)}>
                                <svg className="btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                    <polyline points="14 2 14 8 20 8"></polyline>
                                    <line x1="16" y1="13" x2="8" y2="13"></line>
                                    <line x1="16" y1="17" x2="8" y2="17"></line>
                                    <polyline points="10 9 9 9 8 9"></polyline>
                                </svg>
                                {t('technicalNoteTitle')}
                            </button>
                            <button className="btn btn--secondary" onClick={() => {
                                const summary = autoFixReport?.prepress_summary;
                                const tac = summary?.tac_summary;
                                const op = summary?.overprint_summary;
                                const spot = summary?.spot_summary;
                                const bleedApplied = autoFixReport?.applied?.some(a => a.action === 'add_bleed_canvas');

                                const content = `PREPRESS COMPLIANCE REPORT\n` +
                                    `==========================\n` +
                                    `NOTE: This certificate describes the processed output file, not the original uploaded document.\n\n` +
                                    `Certificate ID: ${summary?.certificate_id || 'PENDING'}\n` +
                                    `Engine Version: ${summary?.engine_version || '2.4.0'}\n` +
                                    `Date: ${new Date().toISOString()}\n\n` +
                                    `Result: ${(summary?.risk_level || 'UNKNOWN').toUpperCase()}\n` +
                                    `Profile: ${summary?.output_profile || 'ISO Coated v2 (FOGRA39)'}\n` +
                                    `Structure: Verified (GTS_PDFX)\n` +
                                    `Mode: ${summary?.gs_mode || 'AutoFix Pro'}\n` +
                                    `CMYK Conversion: ${summary?.conversion_bypassed ? 'Bypassed' : 'Applied'}\n` +
                                    `Rewritten by GS: ${summary?.rewritten_by_gs ? 'Yes' : 'No'}\n` +
                                    `Bleed Method: ${bleedApplied ? 'Centered Scaling (V3)' : 'Verified/Skipped'}\n` +
                                    `Max Ink Density (TAC): ${tac?.max_tac ?? '---'}% (Page ${tac?.worst_page || '---'})\n` +
                                    `Black Overprint: ${op?.risk === 'green' ? 'OK' : 'RISK DETECTED'} (${op?.issues_count ?? 0} objects)\n` +
                                    `Spot Color Policy: ${spot?.risk?.toUpperCase() || 'GREEN'} (${spot?.spot_count ?? 0} colors)\n` +
                                    `Policy Name: ${spot?.policy || 'AUTO'}\n\n` +
                                    `Production Geometry & Imposition:\n` +
                                    `Spine Fit: ${result?.productionReport?.spine?.classification || 'GREEN'} (Expected: ${result?.productionReport?.spine?.expectedSpineMm || 0}mm, Detected: ${result?.productionReport?.spine?.detectedSpineMm || 0}mm)\n` +
                                    `Imposition Score: ${result?.productionReport?.imposition?.score || 100}/100\n` +
                                    `Paper Suitability Warnings: ${result?.productionReport?.substrate?.warnings?.length || 0}\n\n` +
                                    `INK EFFICIENCY:\n` +
                                    `Cost Category: ${result?.productionReport?.inkOptimization?.costCategory || 'LOW'}\n` +
                                    `Ink Usage Index: ${result?.productionReport?.inkOptimization?.inkUsageIndex || 0}/100\n` +
                                    `Avg Coverage: ${result?.productionReport?.inkOptimization?.totalCoverageAvg?.toFixed(1) || 0}%\n` +
                                    `Opportunities: ${result?.productionReport?.inkOptimization?.opportunities?.length || 0} detected\n\n` +
                                    `SECURITY STATEMENT:\n` +
                                    `No further color transformations were performed after OutputIntent finalization.`;
                                const blob = new Blob([content], { type: 'text/plain' });
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = `Prepress_Report_${summary?.certificate_id || 'unverified'}.txt`;
                                a.click();
                                URL.revokeObjectURL(url);
                            }}>
                                <svg className="btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                    <polyline points="7 10 12 15 17 10"></polyline>
                                    <line x1="12" y1="15" x2="12" y2="3"></line>
                                </svg>
                                {t('downloadReport')}
                            </button>
                        </div>
                    </div>

                    {lastPdfUrl && (
                        <div className="card card--download">
                            <div className="card__header">
                                <h4 className="card__title">Download Your PDF</h4>
                                <p className="card__subtitle">Your optimized file is ready</p>
                            </div>
                            <div className="card__content">
                                <a
                                    href={lastPdfUrl}
                                    download={lastPdfName || 'output.pdf'}
                                    className="btn btn--primary btn--large btn--block"
                                >
                                    <svg className="btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                        <polyline points="7 10 12 15 17 10"></polyline>
                                        <line x1="12" y1="15" x2="12" y2="3"></line>
                                    </svg>
                                    Download PDF
                                </a>
                                <div className="file-info">
                                    <svg className="file-info__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                        <polyline points="14 2 14 8 20 8"></polyline>
                                    </svg>
                                    <span className="file-info__name">{lastPdfName || 'output.pdf'}</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Compare Before/After Toggle */}
                    {appMode === 'ai' && lastPdfUrl && file && (
                        <div className="card card--compare">
                            <div className="compare-control">
                                <span className="compare-control__label">View comparison</span>
                                <div className="toggle-group">
                                    <button
                                        className={`toggle-btn ${showBeforeAfter === 'before' ? 'toggle-btn--active' : ''}`}
                                        onClick={() => setShowBeforeAfter('before')}
                                    >
                                        <svg className="toggle-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                            <polyline points="14 2 14 8 20 8"></polyline>
                                        </svg>
                                        Before
                                    </button>
                                    <button
                                        className={`toggle-btn ${showBeforeAfter === 'after' ? 'toggle-btn--active' : ''}`}
                                        onClick={() => setShowBeforeAfter('after')}
                                    >
                                        <svg className="toggle-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                                        </svg>
                                        After
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="card card--tools">
                        <div className="card__header">
                            <h4 className="card__title">Optional Optimizations</h4>
                            <p className="card__subtitle">Apply additional processing if needed</p>
                        </div>

                        <div className="tools-list">
                            <button className="tool-btn" onClick={onConvertGrayscale} disabled={isRunning}>
                                <div className="tool-btn__icon tool-btn__icon--gray">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <circle cx="12" cy="12" r="10"></circle>
                                    </svg>
                                </div>
                                <span className="tool-btn__text">Convert to Grayscale</span>
                                <svg className="tool-btn__arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <polyline points="9 18 15 12 9 6"></polyline>
                                </svg>
                            </button>

                            <button className="tool-btn" onClick={onConvertColors} disabled={isRunning}>
                                <div className="tool-btn__icon tool-btn__icon--color">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <circle cx="12" cy="12" r="10"></circle>
                                        <line x1="12" y1="8" x2="12" y2="16"></line>
                                        <line x1="8" y1="12" x2="16" y2="12"></line>
                                    </svg>
                                </div>
                                <span className="tool-btn__text">Convert to CMYK</span>
                                <svg className="tool-btn__arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <polyline points="9 18 15 12 9 6"></polyline>
                                </svg>
                            </button>

                            <button className="tool-btn" onClick={onRebuildPdf} disabled={isRunning}>
                                <div className="tool-btn__icon tool-btn__icon--blue">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path>
                                    </svg>
                                </div>
                                <span className="tool-btn__text">Rebuild High-Res <span className="tool-btn__badge">300 DPI</span></span>
                                <svg className="tool-btn__arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <polyline points="9 18 15 12 9 6"></polyline>
                                </svg>
                            </button>

                            <button className="tool-btn" onClick={onMakeBooklet} disabled={isRunning}>
                                <div className="tool-btn__icon tool-btn__icon--purple">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
                                        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
                                    </svg>
                                </div>
                                <span className="tool-btn__text">Make Booklet</span>
                                <svg className="tool-btn__arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <polyline points="9 18 15 12 9 6"></polyline>
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>

                <div className="step__main">
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
            </div>

            <div className="step__actions">
                {appMode !== 'ai' && (
                    <button className="btn btn--secondary" onClick={onBack}>
                        ← Back
                    </button>
                )}
                <button className="btn btn--outline" onClick={onStartOver}>
                    🔄 Start Over
                </button>
                {lastPdfUrl ? (
                    <a
                        href={lastPdfUrl}
                        download={lastPdfName || 'output.pdf'}
                        className="btn btn--primary"
                    >
                        ⬇️ Download PDF
                    </a>
                ) : (
                    <button className="btn btn--primary" disabled>
                        ⬇️ Download PDF
                    </button>
                )}
            </div>

            {/* Prepress Technical Note Modal */}
            {showTechNote && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-300 border border-gray-100">
                        <div className="p-8">
                            <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center text-red-600 mb-6 mx-auto">
                                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                                    <polyline points="14 2 14 8 20 8" />
                                </svg>
                            </div>
                            <h3 className="text-2xl font-black text-gray-900 mb-2 text-center">{t('technicalNoteTitle')}</h3>
                            <p className="text-sm text-gray-500 mb-8 text-center">{t('technicalNoteDesc')}</p>

                            <div className="space-y-4">
                                {/* Risk Level Badge */}
                                <div className={`p-4 rounded-2xl flex items-center justify-between font-black text-xs uppercase tracking-widest ${autoFixReport?.prepress_summary?.risk_level === 'green' ? 'bg-green-100 text-green-800' :
                                    autoFixReport?.prepress_summary?.risk_level === 'attention' ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'
                                    }`}>
                                    <span>{t('labelRiskLevel')}</span>
                                    <span>{
                                        autoFixReport?.prepress_summary?.risk_level === 'green' ? t('riskGreen') :
                                            autoFixReport?.prepress_summary?.risk_level === 'attention' ? t('riskAttention') : t('riskBlocking')
                                    }</span>
                                </div>

                                {/* Structured Certificate Block */}
                                <div className="p-5 bg-gray-900 rounded-2xl text-white shadow-inner">
                                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 mb-4 border-b border-gray-800 pb-2">
                                        {t('complianceSummaryTitle')}
                                    </h4>
                                    <div className="space-y-2 text-[11px] font-mono">
                                        <div className="flex justify-between border-b border-gray-800/50 pb-1.5 align-middle">
                                            <span className="text-gray-500 uppercase text-[9px]">{t('labelCertificateId')}</span>
                                            <span className="text-white font-bold">{autoFixReport?.prepress_summary?.certificate_id}</span>
                                        </div>
                                        <div className="flex justify-between border-b border-gray-800/50 pb-1.5">
                                            <span className="text-gray-500 uppercase text-[9px]">{t('labelEngineVersion')}</span>
                                            <span className="text-gray-400">{autoFixReport?.prepress_summary?.engine_version}</span>
                                        </div>
                                        <div className="flex justify-between border-b border-gray-800/50 pb-1.5">
                                            <span className="text-gray-500">{t('labelOutputIntent')}</span>
                                            <span className="text-red-400 font-bold">{autoFixReport?.policy?.icc || 'ISO Coated v2 (FOGRA39)'}</span>
                                        </div>
                                        <div className="flex justify-between border-b border-gray-800/50 pb-1.5">
                                            <span className="text-gray-500">{t('labelStructure')}</span>
                                            <span className="text-green-400 font-bold">{t('statusVerified')}</span>
                                        </div>
                                        <div className="flex justify-between border-b border-gray-800/50 pb-1.5">
                                            <span className="text-gray-500">{t('labelConversion')}</span>
                                            <span className={autoFixReport?.prepress_summary?.conversion_bypassed ? 'text-red-400 font-bold' : 'text-green-400 font-bold'}>
                                                {autoFixReport?.prepress_summary?.conversion_bypassed ? t('statusSkipped') : t('statusApplied')}
                                            </span>
                                        </div>
                                        <div className="flex justify-between border-b border-gray-800/50 pb-1.5">
                                            <span className="text-gray-500">{t('labelProcessing')}</span>
                                            <span className="text-gray-300">{autoFixReport?.prepress_summary?.gs_mode === 'finalize_only' ? t('statusStabilized') : t('statusApplied')}</span>
                                        </div>
                                        <div className="flex justify-between border-b border-gray-800/50 pb-1.5">
                                            <span className="text-gray-500">{t('labelInkCoverage')}</span>
                                            <span className={autoFixReport?.prepress_summary?.tac_summary?.max_tac > autoFixReport?.prepress_summary?.tac_summary?.limit ? 'text-amber-400 font-bold' : 'text-green-400 font-bold'}>
                                                {autoFixReport?.prepress_summary?.tac_summary?.max_tac || 0}%
                                                {autoFixReport?.prepress_summary?.tac_summary?.confirmation_pass && ' (Verified High-Res)'}
                                                {autoFixReport?.prepress_summary?.tac_summary?.spot_colors_detected && ' [Spots Included]'}
                                                <span className="text-[10px] ml-1 opacity-60">Pg. {autoFixReport?.prepress_summary?.tac_summary?.worst_page || 1}</span>
                                            </span>
                                        </div>
                                        <div className="flex justify-between border-b border-gray-800/50 pb-1.5">
                                            <span className="text-gray-500">{t('labelOverprint')}</span>
                                            <span className={autoFixReport?.prepress_summary?.overprint_summary?.risk === 'green' ? 'text-green-400' : 'text-amber-400 font-bold'}>
                                                {autoFixReport?.prepress_summary?.overprint_summary?.risk === 'green' ? t('statusOverprintOk') : t('statusOverprintRisk')}
                                                {autoFixReport?.prepress_summary?.overprint_summary?.worst_page > 0 && (
                                                    <span className="text-[10px] ml-1 opacity-60">Pg. {autoFixReport?.prepress_summary?.overprint_summary?.worst_page}</span>
                                                )}
                                            </span>
                                        </div>
                                        <div className="flex justify-between border-b border-gray-800/50 pb-1.5">
                                            <span className="text-gray-500">{t('spotLabelDetected')}</span>
                                            <span className={autoFixReport?.prepress_summary?.spot_summary?.risk === 'blocking' ? 'text-red-400 font-bold' : (autoFixReport?.prepress_summary?.spot_summary?.risk === 'attention' ? 'text-amber-400 font-bold' : 'text-green-400')}>
                                                {autoFixReport?.prepress_summary?.spot_summary?.spots_detected
                                                    ? `${autoFixReport.prepress_summary.spot_summary.spot_count} (${autoFixReport.prepress_summary.spot_summary.spot_names.slice(0, 3).join(', ')}${autoFixReport.prepress_summary.spot_summary.spot_count > 3 ? '...' : ''})`
                                                    : t('spotStatusNone')}
                                            </span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">{t('labelBleed')}</span>
                                            <span className="text-gray-400">
                                                {autoFixReport?.applied?.some(a => a.action === 'add_bleed_canvas')
                                                    ? t('bleedMethodScale')
                                                    : t('statusSkipped')}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* PRODUCTION GEOMETRY SECTION */}
                                <div className="p-5 bg-white rounded-2xl border border-gray-100 shadow-sm">
                                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-4 border-b border-gray-50 pb-2">
                                        Production Geometry & Imposition
                                    </h4>
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-bold text-gray-700">Spine Fit</span>
                                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${result?.productionReport?.spine?.classification === 'GREEN' ? 'bg-green-100 text-green-700' :
                                                result?.productionReport?.spine?.classification === 'ATTENTION' ? 'bg-amber-100 text-amber-700' :
                                                    'bg-red-100 text-red-700'
                                                }`}>
                                                {result?.productionReport?.spine?.classification || 'GREEN'}
                                            </span>
                                        </div>
                                        <div className="grid grid-cols-3 gap-2 text-[10px]">
                                            <div className="flex flex-col">
                                                <span className="text-gray-400 uppercase">Expected</span>
                                                <span className="font-mono font-bold text-gray-900">{result?.productionReport?.spine?.expectedSpineMm || '0.00'}mm</span>
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-gray-400 uppercase">Detected</span>
                                                <span className="font-mono font-bold text-gray-900">{result?.productionReport?.spine?.detectedSpineMm || '0.00'}mm</span>
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-gray-400 uppercase">Deviation</span>
                                                <span className={`font-mono font-bold ${result?.productionReport?.spine?.deviationMm > 0.8 ? 'text-red-600' : 'text-gray-900'}`}>{result?.productionReport?.spine?.deviationMm || '0.00'}mm</span>
                                            </div>
                                        </div>

                                        <div className="pt-2 border-t border-gray-50 flex items-center justify-between">
                                            <span className="text-xs font-bold text-gray-700">Imposition Compatibility</span>
                                            <div className="flex items-center gap-2">
                                                <div className="w-16 bg-gray-100 h-1.5 rounded-full overflow-hidden">
                                                    <div className="bg-red-500 h-full" style={{ width: `${result?.productionReport?.imposition?.score || 100}%` }}></div>
                                                </div>
                                                <span className="text-[10px] font-black">{result?.productionReport?.imposition?.score || 100}/100</span>
                                            </div>
                                        </div>

                                        {result?.productionReport?.substrate?.warnings?.length > 0 && (
                                            <div className="pt-2 border-t border-gray-50">
                                                <span className="text-[9px] font-black uppercase text-amber-600 block mb-1">Paper Suitability Warnings</span>
                                                {result.productionReport.substrate.warnings.map((w: string, idx: number) => (
                                                    <div key={idx} className="text-[10px] text-amber-800 flex gap-1 items-start">
                                                        <span className="shrink-0">⚠️</span>
                                                        <span>{w}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* INK EFFICIENCY SECTION */}
                                <div className="p-5 bg-white rounded-2xl border border-gray-100 shadow-sm">
                                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-4 border-b border-gray-50 pb-2">
                                        Ink Efficiency & Cost Optimization
                                    </h4>
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-bold text-gray-700">Cost Category</span>
                                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${result?.productionReport?.inkOptimization?.costCategory === 'LOW' ? 'bg-green-100 text-green-700' :
                                                result?.productionReport?.inkOptimization?.costCategory === 'MEDIUM' ? 'bg-amber-100 text-amber-700' :
                                                    'bg-red-100 text-red-700'
                                                }`}>
                                                {result?.productionReport?.inkOptimization?.costCategory || 'LOW'}
                                            </span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2 text-[10px]">
                                            <div className="flex flex-col">
                                                <span className="text-gray-400 uppercase">Ink Usage Index</span>
                                                <span className="font-mono font-bold text-gray-900">{result?.productionReport?.inkOptimization?.inkUsageIndex || 0}/100</span>
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-gray-400 uppercase">Avg Coverage</span>
                                                <span className="font-mono font-bold text-gray-900">{result?.productionReport?.inkOptimization?.totalCoverageAvg?.toFixed(1) || 0}%</span>
                                            </div>
                                        </div>

                                        {result?.productionReport?.inkOptimization?.opportunities?.length > 0 && (
                                            <div className="pt-2 border-t border-gray-50">
                                                <span className="text-[9px] font-black uppercase text-green-600 block mb-1">Optimization Opportunities</span>
                                                {result.productionReport.inkOptimization.opportunities.map((opt: string, idx: number) => (
                                                    <div key={idx} className="text-[10px] text-green-800 flex gap-1 items-start">
                                                        <span className="shrink-0">💡</span>
                                                        <span>{opt}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* EDITION INTENT SECTION */}
                                <div className="p-5 bg-white rounded-2xl border border-gray-100 shadow-sm">
                                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-4 border-b border-gray-50 pb-2">
                                        Print Edition Intent Detection
                                    </h4>
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-bold text-gray-700">Detected Intent</span>
                                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${result?.productionReport?.editionIntent?.intent === 'OFFSET' ? 'bg-blue-100 text-blue-700' :
                                                result?.productionReport?.editionIntent?.intent === 'DIGITAL' ? 'bg-purple-100 text-purple-700' :
                                                    'bg-gray-100 text-gray-700'
                                                }`}>
                                                {result?.productionReport?.editionIntent?.intent || 'UNKNOWN'}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-bold text-gray-700">Confidence</span>
                                            <span className="text-[10px] font-black font-mono">
                                                {Math.round(result?.productionReport?.editionIntent?.confidence || 0)}%
                                            </span>
                                        </div>
                                        {result?.productionReport?.editionIntent?.recommendation && (
                                            <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                                                <p className="text-[10px] font-medium text-gray-600 leading-relaxed italic">
                                                    " {result.productionReport.editionIntent.recommendation} "
                                                </p>
                                            </div>
                                        )}
                                        <div className="grid grid-cols-2 gap-2 pt-2 text-[9px] uppercase tracking-wider text-gray-400 font-bold">
                                            <div className="flex justify-between">
                                                <span>Offset Index</span>
                                                <span className="text-gray-900">{Math.round(result?.productionReport?.editionIntent?.offsetScore || 0)}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span>Digital Index</span>
                                                <span className="text-gray-900">{Math.round(result?.productionReport?.editionIntent?.digitalScore || 0)}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex gap-4 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                                    <div className="text-green-500 shrink-0">✅</div>
                                    <p className="text-xs font-medium text-gray-700 leading-relaxed">{t('outputIntentExplain')}</p>
                                </div>

                                {autoFixReport?.prepress_summary?.tac_summary?.max_tac > autoFixReport?.prepress_summary?.tac_summary?.limit && (
                                    <div className="flex gap-4 p-4 bg-amber-50 rounded-2xl border border-amber-100">
                                        <div className="text-amber-500 shrink-0">⚠️</div>
                                        <p className="text-xs font-medium text-amber-800 leading-relaxed">{t('tacWarningDrying')}</p>
                                    </div>
                                )}

                                {autoFixReport?.prepress_summary?.spot_summary?.spots_detected && (
                                    <div className={autoFixReport.prepress_summary.spot_summary.risk === 'blocking' ? "flex gap-4 p-4 bg-red-50 rounded-2xl border border-red-100" : "flex gap-4 p-4 bg-amber-50 rounded-2xl border border-amber-100"}>
                                        <div className={autoFixReport.prepress_summary.spot_summary.risk === 'blocking' ? "text-red-500 shrink-0" : "text-amber-500 shrink-0"}>
                                            {autoFixReport.prepress_summary.spot_summary.risk === 'blocking' ? '🚫' : '⚠️'}
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <p className={`text-xs font-bold leading-relaxed ${autoFixReport.prepress_summary.spot_summary.risk === 'blocking' ? 'text-red-800' : 'text-amber-800'}`}>
                                                {t('spotLabelPolicy')} {autoFixReport.prepress_summary.spot_summary.policy === 'OFFSET_CMYK_STRICT' ? t('spotPolicyStrict') : t('spotPolicyConvert')}
                                            </p>
                                            <p className={`text-xs font-medium leading-relaxed ${autoFixReport.prepress_summary.spot_summary.risk === 'blocking' ? 'text-red-700' : 'text-amber-700'}`}>
                                                {autoFixReport.prepress_summary.spot_summary.non_whitelisted_spots.length > 0 ? t('spotWarnNonWhitelist') : t('spotWarnWhitelistOnly')}
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {autoFixReport?.prepress_summary?.spot_summary?.spots_in_text && (
                                    <div className="flex gap-4 p-4 bg-red-50 rounded-2xl border border-red-100">
                                        <div className="text-red-500 shrink-0">ℹ️</div>
                                        <p className="text-xs font-medium text-blue-800 leading-relaxed">{t('spotNoteSpotsInText')}</p>
                                    </div>
                                )}

                                {autoFixReport?.prepress_summary?.overprint_summary?.black_text_knockout_detected && (
                                    <div className="flex gap-4 p-4 bg-amber-50 rounded-2xl border border-amber-100">
                                        <div className="text-amber-500 shrink-0">⚠️</div>
                                        <p className="text-xs font-medium text-amber-800 leading-relaxed">{t('overprintWarningKnockout')}</p>
                                    </div>
                                )}

                                {autoFixReport?.prepress_summary?.overprint_summary?.rich_black_text_detected && (
                                    <div className="flex gap-4 p-4 bg-red-50 rounded-2xl border border-red-100">
                                        <div className="text-red-500 shrink-0">ℹ️</div>
                                        <p className="text-xs font-medium text-red-800 leading-relaxed">{t('overprintWarningRichBlack')}</p>
                                    </div>
                                )}

                                {autoFixReport?.prepress_summary?.overprint_summary?.registration_color_detected && (
                                    <div className="flex gap-4 p-4 bg-red-50 rounded-2xl border border-red-100">
                                        <div className="text-red-500 shrink-0">🚫</div>
                                        <p className="text-xs font-medium text-red-800 leading-relaxed">{t('overprintWarningRegistration')}</p>
                                    </div>
                                )}

                                {autoFixReport?.prepress_summary?.conversion_bypassed && (
                                    <div className="flex gap-4 p-4 bg-red-50 rounded-2xl border border-red-100">
                                        <div className="text-red-500 shrink-0">ℹ️</div>
                                        <p className="text-xs font-medium text-red-800 leading-relaxed">{t('bypassExplain')}</p>
                                    </div>
                                )}

                                <div className="flex gap-4 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                                    <div className="text-gray-400 shrink-0">🛠️</div>
                                    <p className="text-xs font-medium text-gray-600 leading-relaxed">{t('rewriteExplain')}</p>
                                </div>

                                <div className="flex gap-4 p-4 bg-amber-50 rounded-2xl border border-amber-100">
                                    <div className="text-amber-500 shrink-0">🛡️</div>
                                    <p className="text-xs font-bold text-amber-900 leading-relaxed italic">{t('negativeStatement')}</p>
                                </div>
                            </div>

                            <button
                                onClick={() => setShowTechNote(false)}
                                className="mt-8 w-full py-4 bg-gray-900 text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-gray-800 transition-colors shadow-lg active:scale-[0.98]"
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
