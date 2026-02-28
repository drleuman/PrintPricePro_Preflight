import React, { useEffect } from 'react';
import { PreflightResult, FileMeta } from '../../types';
import { PreflightSummary } from '../PreflightSummary';

interface Step2AnalysisProps {
    file: File | null;
    fileMeta: FileMeta | null;
    result: PreflightResult | null;
    isRunning: boolean;
    onRunAnalysis: () => void;
    onNext: () => void;
    onSkipToReview: () => void;
    onBack: () => void;
    autoFixBefore?: PreflightResult | null;
    autoFixAfter?: PreflightResult | null;
    autoFixReport?: any | null;
    autoFixRunId?: number | null;
}

export const Step2Analysis: React.FC<Step2AnalysisProps> = ({
    file,
    fileMeta,
    result,
    isRunning,
    onRunAnalysis,
    onNext,
    onSkipToReview,
    onBack,
    autoFixBefore,
    autoFixAfter,
    autoFixReport,
    autoFixRunId,
}) => {
    // Auto-run analysis when entering this step
    useEffect(() => {
        if (file && !result && !isRunning) {
            onRunAnalysis();
        }
    }, [file, result, isRunning, onRunAnalysis]);

    const hasErrors = result?.issues && result.issues.filter(i => i.severity === 'error').length > 0;
    const hasWarnings = result?.issues && result.issues.filter(i => i.severity === 'warning').length > 0;
    const hasIssues = result?.issues && result.issues.length > 0;

    return (
        <div className="step step--analysis">
            <div className="step__header mb-4 py-2 text-center">
                <h2 className="text-xl font-black text-gray-900 tracking-tight">
                    {isRunning ? 'Analyzing Your PDF...' : 'Analysis Complete'}
                </h2>
                <p className="text-xs text-gray-500 font-medium">
                    {isRunning
                        ? 'Checking document for print readiness...'
                        : hasIssues
                            ? 'Review the items that need attention below'
                            : 'Your PDF is perfect for printing'}
                </p>
            </div>

            <div className="step__content">
                {isRunning ? (
                    <div className="analysis-loading">
                        <div className="spinner"></div>
                        <p>Checking fonts, colors, images, and more...</p>
                    </div>
                ) : result ? (
                    <>
                        <PreflightSummary
                            fileMeta={fileMeta}
                            result={result}
                            onRunPreflight={onRunAnalysis}
                            isRunning={isRunning}
                        />

                        {!hasIssues && (
                            <div className="success-message">
                                <div className="success-message__icon">✅</div>
                                <div className="success-message__text">
                                    <h3>Perfect! No issues found</h3>
                                    <p>Your PDF is ready for printing</p>
                                </div>
                            </div>
                        )}
                    </>
                ) : null}
            </div>

            <div className="step__actions sticky bottom-0 bg-white/80 backdrop-blur-md p-4 border-t border-gray-100 mt-6 z-20 flex justify-between items-center rounded-t-2xl shadow-[0_-10px_30px_rgba(0,0,0,0.05)]">
                <button className="btn btn--secondary btn--sm" onClick={onBack}>
                    ← Back
                </button>
                {result && (
                    <div className="flex gap-4">
                        {hasIssues ? (
                            <button className="btn btn--primary btn--large px-10 py-3 shadow-xl shadow-red-900/10" onClick={onNext}>
                                Fix Issues →
                            </button>
                        ) : (
                            <button className="btn btn--primary btn--large px-10 py-3 shadow-xl shadow-red-900/10" onClick={onSkipToReview}>
                                Continue to Review →
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
