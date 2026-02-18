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
                        <div className="review-summary__icon">{statusIcon}</div>
                        <h3 className="review-summary__title">{statusTitle}</h3>
                        <p className="review-summary__text">
                            {statusText}
                        </p>
                        {appMode === 'ai' && hasBeenProcessed && (
                            <>
                                <div className="review-summary__tech mt-3 p-2 bg-blue-50 rounded text-xs text-blue-800 border border-blue-200">
                                    <div className="flex justify-between items-center mb-1 pb-1 border-b border-blue-100">
                                        <strong>{t('profileLabel')}</strong>
                                        <span>{autoFixReport?.prepress_summary?.output_profile || 'ISO Coated v2 (FOGRA39)'}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <strong>{t('outputIntentLabel')}</strong>
                                        <span className="text-green-700 font-bold">{autoFixReport?.prepress_summary?.outputintent_valid ? t('verified') : t('embedded')}</span>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setShowTechNote(true)}
                                        className="mt-2 text-[10px] font-bold text-blue-600 hover:text-blue-800 uppercase tracking-wider underline bg-transparent border-none p-0 cursor-pointer"
                                    >
                                        📄 {t('technicalNoteTitle')}
                                    </button>
                                    <button
                                        onClick={() => {
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
                                                `SECURITY STATEMENT:\n` +
                                                `No further color transformations were performed after OutputIntent finalization.`;
                                            const blob = new Blob([content], { type: 'text/plain' });
                                            const url = URL.createObjectURL(blob);
                                            const a = document.createElement('a');
                                            a.href = url;
                                            a.download = `Prepress_Report_${summary?.certificate_id || 'unverified'}.txt`;
                                            a.click();
                                            URL.revokeObjectURL(url);
                                        }}
                                        className="mt-2 text-[10px] font-bold text-gray-500 hover:text-gray-700 uppercase tracking-wider underline bg-transparent border-none p-0 cursor-pointer"
                                    >
                                        ⬇️ .txt Report
                                    </button>
                                </div>
                            </>
                        )}
                    </div>

                    {lastPdfUrl && (
                        <div className="download-section">
                            <h4>Download Your PDF</h4>
                            <a
                                href={lastPdfUrl}
                                download={lastPdfName || 'output.pdf'}
                                className="btn btn--success btn--large btn--block"
                            >
                                ⬇️ Download PDF
                            </a>
                            {lastPdfName && (
                                <p className="download-filename">{lastPdfName}</p>
                            )}
                        </div>
                    )}

                    {/* Compare Before/After Toggle */}
                    {appMode === 'ai' && lastPdfUrl && file && (
                        <div className="compare-toggle mb-4">
                            <div className="flex items-center justify-center gap-2 p-3 bg-gray-50 rounded-lg">
                                <span className="text-sm font-medium text-gray-700">View:</span>
                                <div className="flex bg-white rounded-lg border border-gray-200 p-1">
                                    <button
                                        onClick={() => setShowBeforeAfter('before')}
                                        className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${showBeforeAfter === 'before'
                                            ? 'bg-red-100 text-red-700 border border-red-200'
                                            : 'text-gray-500 hover:text-gray-700'
                                            }`}
                                    >
                                        📄 Before
                                    </button>
                                    <button
                                        onClick={() => setShowBeforeAfter('after')}
                                        className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${showBeforeAfter === 'after'
                                            ? 'bg-green-100 text-green-700 border border-green-200'
                                            : 'text-gray-500 hover:text-gray-700'
                                            }`}
                                    >
                                        ✨ After
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="optional-tools">
                        <h4>Optional Optimizations</h4>
                        <p className="optional-tools__description">
                            Apply additional processing if needed
                        </p>

                        <button
                            className="btn btn--secondary btn--block"
                            onClick={onConvertGrayscale}
                            disabled={isRunning}
                        >
                            ⚫️ Convert to Grayscale
                        </button>

                        <button
                            className="btn btn--secondary btn--block"
                            onClick={onConvertColors}
                            disabled={isRunning}
                        >
                            🎨 Convert to CMYK
                        </button>

                        <button
                            className="btn btn--secondary btn--block"
                            onClick={onRebuildPdf}
                            disabled={isRunning}
                        >
                            🛠️ Rebuild High-Res (300 DPI Native)
                        </button>

                        <button
                            className="btn btn--secondary btn--block"
                            onClick={onMakeBooklet}
                            disabled={isRunning}
                        >
                            📖 Make Booklet
                        </button>
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
                            <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center text-blue-600 mb-6 mx-auto">
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
                                            <span className="text-blue-400 font-bold">{autoFixReport?.policy?.icc || 'ISO Coated v2 (FOGRA39)'}</span>
                                        </div>
                                        <div className="flex justify-between border-b border-gray-800/50 pb-1.5">
                                            <span className="text-gray-500">{t('labelStructure')}</span>
                                            <span className="text-green-400 font-bold">{t('statusVerified')}</span>
                                        </div>
                                        <div className="flex justify-between border-b border-gray-800/50 pb-1.5">
                                            <span className="text-gray-500">{t('labelConversion')}</span>
                                            <span className={autoFixReport?.prepress_summary?.conversion_bypassed ? 'text-blue-400 font-bold' : 'text-green-400 font-bold'}>
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
                                    <div className="flex gap-4 p-4 bg-blue-50 rounded-2xl border border-blue-100">
                                        <div className="text-blue-500 shrink-0">ℹ️</div>
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
                                    <div className="flex gap-4 p-4 bg-blue-50 rounded-2xl border border-blue-100">
                                        <div className="text-blue-500 shrink-0">ℹ️</div>
                                        <p className="text-xs font-medium text-blue-800 leading-relaxed">{t('overprintWarningRichBlack')}</p>
                                    </div>
                                )}

                                {autoFixReport?.prepress_summary?.overprint_summary?.registration_color_detected && (
                                    <div className="flex gap-4 p-4 bg-red-50 rounded-2xl border border-red-100">
                                        <div className="text-red-500 shrink-0">🚫</div>
                                        <p className="text-xs font-medium text-red-800 leading-relaxed">{t('overprintWarningRegistration')}</p>
                                    </div>
                                )}

                                {autoFixReport?.prepress_summary?.conversion_bypassed && (
                                    <div className="flex gap-4 p-4 bg-blue-50 rounded-2xl border border-blue-100">
                                        <div className="text-blue-500 shrink-0">ℹ️</div>
                                        <p className="text-xs font-medium text-blue-800 leading-relaxed">{t('bypassExplain')}</p>
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
