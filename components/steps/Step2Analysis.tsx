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
            <div className="step__header">
                <h2 className="step__title">
                    {isRunning ? 'Analyzing Your PDF...' : 'Analysis Complete'}
                </h2>
                <p className="step__description">
                    {isRunning
                        ? 'Please wait while we check your document for print readiness'
                        : hasIssues
                            ? 'We found some items that need attention'
                            : 'Great! Your PDF looks good'}
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

            <div className="step__actions">
                <button className="btn btn--secondary" onClick={onBack}>
                    ← Back
                </button>
                {result && (
                    <>
                        {hasIssues ? (
                            <button className="btn btn--primary btn--large" onClick={onNext}>
                                Fix Issues →
                            </button>
                        ) : (
                            <button className="btn btn--primary btn--large" onClick={onSkipToReview}>
                                Continue to Review →
                            </button>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};
