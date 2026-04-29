import React from 'react';
import { ShieldCheckIcon, PaintBrushIcon, ArrowDownTrayIcon, XMarkIcon, DocumentCheckIcon } from '@heroicons/react/24/outline';
import { WorkflowAnalysis } from '../../types';

interface ReviewBannersProps {
    analysis: WorkflowAnalysis;
    onDownload: () => void;
    onDownloadReport: () => void;
    t: (key: string) => string;
}

export const ReviewBanners: React.FC<ReviewBannersProps> = ({
    analysis,
    onDownload,
    onDownloadReport,
    t
}) => {
    const { 
        isNoOpFix, 
        isRealFix, 
        isAutofix, 
        hasCertified, 
        hasIssues: hasViolations,
        hasEffectiveFix 
    } = analysis;

    return (
        <div className="space-y-6">
            {(isNoOpFix || analysis.certificationMode) && (
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
