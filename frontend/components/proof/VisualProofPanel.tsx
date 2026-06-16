import React from 'react';
import { EyeIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import type { VisualDiffGovernance, ProofApprovalGovernance } from '../../types';
import { useTranslation } from '../../i18n';
import { PdfComparisonViewer } from '../PdfComparisonViewer';

interface VisualProofPanelProps {
    visualDiffGovernance?: VisualDiffGovernance | null;
    proofApprovalGovernance?: ProofApprovalGovernance | null;
    originalUrl?: string | null;
    fixedUrl?: string | null;
    audience?: 'customer' | 'operator';
}

// Diff metric values that look like file paths, filenames, or temp artifacts must
// never be surfaced to the UI — only plain numbers/booleans/short safe strings.
const PATH_LIKE_PATTERN = /[\\/]|\.(pdf|png|jpe?g|tiff?|json|tmp)$/i;

export function safeMetricEntries(metrics: unknown): Array<[string, string | number | boolean]> {
    if (!metrics || typeof metrics !== 'object') return [];
    return Object.entries(metrics as Record<string, unknown>).filter(([, v]) => {
        if (typeof v === 'number' || typeof v === 'boolean') return true;
        if (typeof v === 'string') return !PATH_LIKE_PATTERN.test(v);
        return false;
    }) as Array<[string, string | number | boolean]>;
}

/**
 * APP-65 — Visual proof / rendered comparison (Phase 69). Shows the rendered
 * before/after comparison when both URLs are available, plus sanitized diff
 * metrics and visual-change status. Never exposes raw file paths and never
 * implies certification or proof approval — that is handled separately by
 * ProofApprovalPanel.
 */
export const VisualProofPanel: React.FC<VisualProofPanelProps> = ({
    visualDiffGovernance,
    proofApprovalGovernance,
    originalUrl,
    fixedUrl,
    audience = 'customer',
}) => {
    const { t } = useTranslation();

    const hasRenderedComparison = !!(originalUrl && fixedUrl);
    if (!visualDiffGovernance && !proofApprovalGovernance && !hasRenderedComparison) return null;

    const reviewRequired = visualDiffGovernance?.review_required === true || proofApprovalGovernance?.review_required === true;
    const requiredNotPerformed = visualDiffGovernance?.visual_diff_required === true && visualDiffGovernance?.visual_diff_performed !== true;
    const changeExpected = visualDiffGovernance?.visual_change_expected === true;
    const changeDetected = visualDiffGovernance?.visual_diff_performed === true && visualDiffGovernance?.visual_change_detected === true;
    const noChangeDetected = visualDiffGovernance?.visual_diff_performed === true && visualDiffGovernance?.visual_change_detected === false;

    const metrics = safeMetricEntries(visualDiffGovernance?.diff_metrics);

    const colorClass = reviewRequired ? 'text-amber-500' : 'text-emerald-500';
    const borderClass = reviewRequired ? 'border-amber-500/30' : 'border-emerald-500/30';
    const bgClass = reviewRequired ? 'bg-amber-500/10' : 'bg-emerald-500/10';

    return (
        <div className={`p-4 border ${borderClass} ${bgClass} flex flex-col gap-3`}>
            <div className="flex items-center gap-2">
                <EyeIcon className={`w-5 h-5 ${colorClass}`} />
                <span className={`text-[0.7rem] font-black uppercase tracking-widest ${colorClass}`}>
                    {t('visualProof.panelTitle')}
                </span>
            </div>

            {hasRenderedComparison && (
                <PdfComparisonViewer
                    originalUrl={originalUrl as string}
                    fixedUrl={fixedUrl as string}
                    visualDiffGovernance={visualDiffGovernance}
                />
            )}

            {/* Avoid duplicating banners already shown inside PdfComparisonViewer. */}
            {!hasRenderedComparison && requiredNotPerformed && (
                <div className="flex items-start gap-2">
                    <ExclamationTriangleIcon className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                    <p className="text-[0.75rem] text-amber-400 leading-relaxed">{t('visualDiff.requiredNotPerformedDesc')}</p>
                </div>
            )}
            {!hasRenderedComparison && changeExpected && (
                <div className="flex items-start gap-2">
                    <ExclamationTriangleIcon className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                    <p className="text-[0.75rem] text-amber-400 leading-relaxed">{t('visualDiff.changeExpectedDesc')}</p>
                </div>
            )}

            {changeDetected && (
                <p className="text-[0.75rem] text-[var(--text-secondary)] leading-relaxed">{t('visualDiff.changeDetectedDesc')}</p>
            )}
            {noChangeDetected && (
                <p className="text-[0.75rem] text-[var(--text-secondary)] leading-relaxed">{t('visualDiff.noChangeDetectedDesc')}</p>
            )}

            {metrics.length > 0 && (
                <div className="border-t border-current/10 pt-3">
                    <div className="text-[0.65rem] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-1">
                        {t('visualProof.metricsLabel')}
                    </div>
                    <ul className="space-y-1">
                        {metrics.map(([key, value]) => (
                            <li key={key} className="text-[0.7rem] text-[var(--text-secondary)] font-mono flex justify-between gap-4">
                                <span className="opacity-70">{key}</span>
                                <span>{String(value)}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {reviewRequired && (
                <p className="text-[0.65rem] font-black uppercase tracking-widest text-amber-500 border-t border-current/10 pt-2">
                    {t('visualDiff.reviewRequiredNotice')}
                </p>
            )}

            {audience === 'operator' && Array.isArray(visualDiffGovernance?.warnings) && visualDiffGovernance!.warnings!.length > 0 && (
                <div className="border-t border-current/10 pt-3">
                    <div className="text-[0.65rem] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-1">
                        {t('visualDiff.operatorWarnings')}
                    </div>
                    <ul className="space-y-1">
                        {visualDiffGovernance!.warnings!.map((w, i) => (
                            <li key={i} className="text-[0.7rem] text-[var(--text-secondary)] font-mono">— {w}</li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};
