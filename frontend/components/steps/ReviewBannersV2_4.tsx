import React from 'react';
import { ShieldCheckIcon, PaintBrushIcon, ArrowDownTrayIcon, XMarkIcon, DocumentCheckIcon } from '@heroicons/react/24/outline';
import { WorkflowAnalysis } from '../../types';

interface ReviewBannersProps {
    analysis: WorkflowAnalysis;
    onDownload: () => void;
    onDownloadReport: () => void;
    t: (key: string) => string;
    result?: any;
}

export const ReviewBanners: React.FC<ReviewBannersProps> = ({
    analysis,
    onDownload,
    onDownloadReport,
    t,
    result
}) => {
    const { 
        isNoOpFix, 
        isRealFix, 
        isAutofix, 
        hasCertified, 
        hasIssues: hasViolations,
        hasEffectiveFix 
    } = analysis;

    const isCompletedWithReview = result?.status === 'COMPLETED_WITH_REVIEW' || result?.requiresHumanReview === true;
    const reviewReasons = result?.reviewReasons || [];
    const isCmykHighRisk = reviewReasons.includes('CONVERT_CMYK') && result?.destructiveRiskSummary === 'HIGH';

    return (
        <div className="space-y-6">
            {isCompletedWithReview && (
                <div className="border-2 border-amber-500/20 bg-amber-500/5 p-8 space-y-4 animate-in zoom-in-95 duration-500">
                    <div className="flex items-center gap-3 text-amber-500">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-8 w-8 animate-pulse">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                        </svg>
                        <h2 className="text-xl font-black uppercase tracking-tight">Fixed — review required</h2>
                    </div>
                    <div className="space-y-2 text-[var(--text-secondary)] text-[0.85rem] leading-relaxed">
                        <p className="font-bold text-amber-500/90">
                            Some fixes may affect print output and require operator review before production.
                        </p>
                        {reviewReasons.length > 0 && (
                            <div className="pt-2 space-y-1.5">
                                <div className="text-[0.7rem] font-bold tracking-wider text-[var(--text-muted)] uppercase">Applied repairs requiring validation:</div>
                                <ul className="list-disc pl-5 font-mono text-[0.75rem] space-y-1">
                                    {reviewReasons.map((r: string) => (
                                        <li key={r} className="uppercase text-[var(--text-primary)]">
                                            {r}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                        {isCmykHighRisk && (
                            <p className="mt-2 text-red-500/80 font-bold border-l-2 border-red-500 pl-3">
                                CMYK conversion may shift colors. Review before approving production.
                            </p>
                        )}
                    </div>
                    {hasEffectiveFix && (
                        <button 
                            onClick={onDownload}
                            className="flex items-center gap-2 px-6 py-3 bg-amber-500 text-white text-[0.7rem] font-black uppercase tracking-widest hover:bg-amber-600 transition-all"
                        >
                            <ArrowDownTrayIcon className="h-4 w-4" /> Download technically repaired PDF
                        </button>
                    )}
                </div>
            )}

            {!isCompletedWithReview && (isNoOpFix || analysis.certificationMode) && (
                <div className="border-2 border-emerald-500/20 bg-emerald-500/5 p-8 space-y-4 animate-in zoom-in-95 duration-500">
                    <div className="flex items-center gap-3 text-emerald-500">
                        <ShieldCheckIcon className="h-8 w-8" />
                        <h2 className="text-xl font-black uppercase tracking-tight">
                            {analysis.certificationMode 
                                ? t('step.review.certification.withoutModification')
                                : t('step.review.banners.noStructuralChangesTitle')}
                        </h2>
                    </div>
                    <p className="text-[var(--text-secondary)] text-[0.85rem] leading-relaxed max-w-xl">
                        {analysis.certificationMode
                            ? t('step.review.banners.noIssues')
                            : t('step.review.banners.noStructuralChangesDesc')}
                    </p>
                    {hasCertified && (
                        <button 
                            onClick={onDownload}
                            className="flex items-center gap-2 px-6 py-3 bg-emerald-500 text-white text-[0.7rem] font-black uppercase tracking-widest hover:bg-emerald-600 transition-all"
                        >
                            <ArrowDownTrayIcon className="h-4 w-4" /> {t('step.review.downloadCertified')}
                        </button>
                    )}
                </div>
            )}

            {isRealFix && (
                <div className="border-2 border-[var(--accent-color)]/20 bg-[var(--accent-color)]/5 p-8 space-y-4 animate-in zoom-in-95 duration-500">
                    <div className="flex items-center gap-3 text-[var(--accent-color)]">
                        <PaintBrushIcon className="h-8 w-8" />
                        <h2 className="text-xl font-black uppercase tracking-tight">{t('step.review.banners.fixedTitle')}</h2>
                    </div>
                    <p className="text-[var(--text-secondary)] text-[0.85rem] leading-relaxed max-w-xl">
                        {t('step.review.banners.fixedDesc')}
                    </p>
                    {hasEffectiveFix && (
                        <button 
                            onClick={onDownload}
                            className="flex items-center gap-2 px-6 py-3 bg-[var(--accent-color)] text-white text-[0.7rem] font-black uppercase tracking-widest hover:bg-[var(--accent-hover)] transition-all"
                        >
                            <ArrowDownTrayIcon className="h-4 w-4" /> {t('step.review.downloadFixed')}
                        </button>
                    )}
                </div>
            )}

            {!isAutofix && (
                <div className="border-2 border-[var(--border-color)] bg-[var(--bg-secondary)] p-8 space-y-4 animate-in zoom-in-95 duration-500">
                    <div className="flex items-center gap-3 text-[var(--text-primary)]">
                        {hasViolations ? <XMarkIcon className="h-8 w-8 text-amber-500" /> : <DocumentCheckIcon className="h-8 w-8 text-emerald-500" />}
                        <h2 className="text-xl font-black uppercase tracking-tight">{t('step.review.banners.analysisComplete')}</h2>
                    </div>
                    <p className="text-[var(--text-secondary)] text-[0.85rem] leading-relaxed max-w-xl">
                        {hasViolations 
                            ? t('step.review.banners.criticalFindings')
                            : t('step.review.banners.noIssues')}
                    </p>
                    {hasCertified && (
                        <button 
                            onClick={onDownloadReport}
                            className="flex items-center gap-2 px-6 py-3 border border-[var(--border-color)] text-[var(--text-secondary)] text-[0.7rem] font-black uppercase tracking-widest hover:text-[var(--text-primary)] hover:border-[var(--text-primary)] transition-all"
                        >
                            <ArrowDownTrayIcon className="h-4 w-4" /> {t('step.review.downloadReport')}
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};
