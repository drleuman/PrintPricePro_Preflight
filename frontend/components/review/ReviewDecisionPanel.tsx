import React from 'react';
import {
    CheckCircleIcon,
    ExclamationTriangleIcon,
    XCircleIcon,
    ArrowUpTrayIcon,
    QuestionMarkCircleIcon,
    ClockIcon,
} from '@heroicons/react/24/outline';
import type { ReviewDecisionUx } from '../../types';
import { useTranslation } from '../../i18n';

interface ReviewDecisionPanelProps {
    reviewDecisionUx: ReviewDecisionUx;
    audience?: 'customer' | 'operator';
}

type Decision = ReviewDecisionUx['decision'];

interface DecisionConfig {
    icon: React.ReactNode;
    colorClass: string;
    borderClass: string;
    bgClass: string;
    defaultLabel: string;
    defaultMessage: string;
    blocksProgression: boolean;
}

function getDecisionConfig(decision: Decision, t: (k: string) => string): DecisionConfig {
    switch (decision) {
        case 'APPROVED_FOR_PRODUCTION':
            return {
                icon: <CheckCircleIcon className="w-5 h-5" />,
                colorClass: 'text-emerald-500',
                borderClass: 'border-emerald-500/30',
                bgClass: 'bg-emerald-500/10',
                defaultLabel: t('review.decision.approvedForProduction'),
                defaultMessage: t('review.decision.approvedForProductionDesc'),
                blocksProgression: false,
            };
        case 'APPROVED_WITH_WARNINGS':
            return {
                icon: <ExclamationTriangleIcon className="w-5 h-5" />,
                colorClass: 'text-amber-500',
                borderClass: 'border-amber-500/30',
                bgClass: 'bg-amber-500/10',
                defaultLabel: t('review.decision.approvedWithWarnings'),
                defaultMessage: t('review.decision.approvedWithWarningsDesc'),
                blocksProgression: false,
            };
        case 'REJECTED_REQUIRES_REUPLOAD':
            return {
                icon: <XCircleIcon className="w-5 h-5" />,
                colorClass: 'text-red-500',
                borderClass: 'border-red-500/30',
                bgClass: 'bg-red-500/10',
                defaultLabel: t('review.decision.rejectedRequiresReupload'),
                defaultMessage: t('review.decision.rejectedRequiresReuploadDesc'),
                blocksProgression: true,
            };
        case 'REQUEST_CUSTOMER_REUPLOAD':
            return {
                icon: <ArrowUpTrayIcon className="w-5 h-5" />,
                colorClass: 'text-orange-500',
                borderClass: 'border-orange-500/30',
                bgClass: 'bg-orange-500/10',
                defaultLabel: t('review.decision.requestCustomerReupload'),
                defaultMessage: t('review.decision.requestCustomerReuploadDesc'),
                blocksProgression: true,
            };
        case 'NEEDS_MORE_INFORMATION':
            return {
                icon: <QuestionMarkCircleIcon className="w-5 h-5" />,
                colorClass: 'text-blue-400',
                borderClass: 'border-blue-400/30',
                bgClass: 'bg-blue-400/10',
                defaultLabel: t('review.decision.needsMoreInformation'),
                defaultMessage: t('review.decision.needsMoreInformationDesc'),
                blocksProgression: true,
            };
        case 'NO_DECISION':
        default:
            return {
                icon: <ClockIcon className="w-5 h-5" />,
                colorClass: 'text-[var(--text-muted)]',
                borderClass: 'border-[var(--border-color)]',
                bgClass: 'bg-[var(--bg-secondary)]',
                defaultLabel: t('review.decision.noDecision'),
                defaultMessage: t('review.decision.noDecisionDesc'),
                blocksProgression: true,
            };
    }
}

export const ReviewDecisionPanel: React.FC<ReviewDecisionPanelProps> = ({
    reviewDecisionUx,
    audience = 'customer',
}) => {
    const { t } = useTranslation();
    const decision = reviewDecisionUx.decision ?? 'NO_DECISION';
    const config = getDecisionConfig(decision, t as any);

    const label = reviewDecisionUx.decision_label || config.defaultLabel;
    const message = reviewDecisionUx.customer_message || config.defaultMessage;
    const blocksProgression = reviewDecisionUx.allows_progression === false || config.blocksProgression;

    return (
        <div className={`p-4 border ${config.borderClass} ${config.bgClass} flex flex-col gap-3`}>
            <div className="flex items-center gap-2">
                <span className={config.colorClass}>{config.icon}</span>
                <span className={`text-[0.7rem] font-black uppercase tracking-widest ${config.colorClass}`}>
                    {t('review.decision.panelTitle')}
                </span>
            </div>

            <div>
                <div className={`text-[0.8rem] font-bold ${config.colorClass}`}>{label}</div>
                {message && (
                    <p className="text-[0.75rem] text-[var(--text-secondary)] mt-1 leading-relaxed">
                        {message}
                    </p>
                )}
            </div>

            {audience === 'operator' && reviewDecisionUx.operator_notes && reviewDecisionUx.operator_notes.length > 0 && (
                <div className="border-t border-current/10 pt-3">
                    <div className="text-[0.65rem] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-1">
                        {t('review.decision.operatorNotes')}
                    </div>
                    <ul className="space-y-1">
                        {reviewDecisionUx.operator_notes.map((note, i) => (
                            <li key={i} className="text-[0.7rem] text-[var(--text-secondary)] leading-relaxed">
                                — {note}
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {blocksProgression && (
                <div className="text-[0.65rem] font-black uppercase tracking-widest text-[var(--text-muted)] border-t border-current/10 pt-2">
                    {t('review.decision.progressionBlocked')}
                </div>
            )}
        </div>
    );
};
