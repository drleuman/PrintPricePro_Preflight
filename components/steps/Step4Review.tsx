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
}) => {
    const [showBeforeAfter, setShowBeforeAfter] = useState<'before' | 'after'>('after');
    const issuesCount = result?.issues?.length || 0;
    const hasIssues = issuesCount > 0;
    const hasBeenProcessed = !!lastPdfUrl;

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
                            <div className="review-summary__tech mt-3 p-2 bg-blue-50 rounded text-xs text-blue-800 border border-blue-200">
                                <strong>Profile:</strong> ISO Coated v2 (FOGRA39) | <strong>Bleed:</strong> 3mm | <strong>Min DPI:</strong> 150 (300 recommended)
                            </div>
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
                                        className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                                            showBeforeAfter === 'before'
                                                ? 'bg-red-100 text-red-700 border border-red-200'
                                                : 'text-gray-500 hover:text-gray-700'
                                        }`}
                                    >
                                        📄 Before
                                    </button>
                                    <button
                                        onClick={() => setShowBeforeAfter('after')}
                                        className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                                            showBeforeAfter === 'after'
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
                            🛠️ Rebuild High-Res (150 DPI min / 300 best)
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
                        file={file}
                        numPages={numPages}
                        currentPage={currentPage}
                        onPageChange={onPageChange}
                        onNumPagesChange={onNumPagesChange}
                        selectedIssue={null}
                        heatmapData={null}
                        onRunHeatmap={() => { }}
                        isHeatmapLoading={false}
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
        </div>
    );
};
