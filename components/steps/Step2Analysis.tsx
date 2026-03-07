import React, { useEffect } from 'react';
import { PreflightResult, FileMeta } from '../../types';
import { PreflightSummary } from '../PreflightSummary';
import { CheckCircleIcon, RocketLaunchIcon } from '@heroicons/react/24/outline';
import { t } from '../../i18n';

interface Step2AnalysisProps {
    file: File | null;
    fileMeta: FileMeta | null;
    result: PreflightResult | null;
    isRunning: boolean;
    onRunAnalysis: () => void;
    onRunV2Analysis: () => void;
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
    onRunV2Analysis,
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
        <div className="step step--analysis flex flex-col h-full">
            <div className="step__header mb-2 py-1 text-center shrink-0">
                <h2 className="text-xl font-black text-gray-900 tracking-tight">
                    {isRunning ? t('analyzingYourPdf') : t('analysisComplete')}
                </h2>
                <p className="text-[11px] text-gray-500 font-medium">
                    {isRunning
                        ? t('analysisWaitMessage')
                        : hasIssues
                            ? t('issuesFoundMessage')
                            : t('readyForPrinting')}
                </p>
            </div>

            <div className="step__content">
                {isRunning ? (
                    <div className="analysis-loading">
                        <div className="spinner"></div>
                        <p>{t('checkingDetails')}</p>
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
                            <div className="success-message focus-visible:outline-none">
                                <div className="success-message__icon mt-2"><CheckCircleIcon className="w-12 h-12 text-emerald-500 mx-auto" /></div>
                                <div className="success-message__text">
                                    <h3>{t('perfectNoIssues')}</h3>
                                    <p>{t('readyForPrinting')}</p>
                                </div>
                            </div>
                        )}
                    </>
                ) : null}
            </div>

            <div className="step__actions sticky bottom-0 bg-white/95 backdrop-blur-md px-3 py-2 border border-gray-100 mt-2 z-20 flex justify-between items-center rounded-2xl shadow-[0_-5px_20px_rgba(0,0,0,0.03)] mx-1 mb-1">
                <button className="btn btn--secondary btn--sm" onClick={onBack}>
                    {t('back')}
                </button>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                        className="btn btn--secondary btn--sm text-[11px] px-3 font-semibold"
                        onClick={onRunV2Analysis}
                        style={{ background: '#0b0c10', color: '#64ffda', border: '1px solid #64ffda', display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                        <RocketLaunchIcon className="w-3.5 h-3.5" /> {t('igniteEngine')}
                    </button>
                    {result && (
                        <div className="flex gap-3">
                            {hasIssues ? (
                                <button className="btn btn--primary btn--sm px-5 py-1.5 text-[11px] uppercase tracking-wider font-bold shadow-md shadow-red-900/10" onClick={onNext}>
                                    {t('fixIssues')}
                                </button>
                            ) : (
                                <button className="btn btn--primary btn--sm px-5 py-1.5 text-[11px] uppercase tracking-wider font-bold shadow-md shadow-red-900/10" onClick={onSkipToReview}>
                                    {t('continueToReview')}
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
