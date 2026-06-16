import React from 'react';
import {
    ArrowUpTrayIcon,
    ClockIcon,
    MagnifyingGlassIcon,
    ExclamationTriangleIcon,
    CheckCircleIcon,
    ShieldCheckIcon,
} from '@heroicons/react/24/outline';
import type { RemediationUx } from '../../types';
import { useTranslation } from '../../i18n';

interface CustomerRemediationPanelProps {
    remediationUx: RemediationUx;
    audience?: 'customer' | 'operator';
}

type RemediationState = RemediationUx['remediation_state'];

interface RemediationConfig {
    icon: React.ReactNode;
    colorClass: string;
    borderClass: string;
    bgClass: string;
    defaultLabel: string;
    defaultMessage: string;
    requiresAction: boolean;
    showUploadCta: boolean;
}

export function getRemediationConfig(state: RemediationState, t: (k: string) => string): RemediationConfig {
    switch (state) {
        case 'REUPLOAD_REQUIRED':
            return {
                icon: <ArrowUpTrayIcon className="w-5 h-5" />,
                colorClass: 'text-red-500',
                borderClass: 'border-red-500/30',
                bgClass: 'bg-red-500/10',
                defaultLabel: t('remediation.state.reuploadRequired'),
                defaultMessage: t('remediation.state.reuploadRequiredDesc'),
                requiresAction: true,
                showUploadCta: true,
            };
        case 'WAITING_FOR_UPLOAD':
            return {
                icon: <ClockIcon className="w-5 h-5" />,
                colorClass: 'text-amber-500',
                borderClass: 'border-amber-500/30',
                bgClass: 'bg-amber-500/10',
                defaultLabel: t('remediation.state.waitingForUpload'),
                defaultMessage: t('remediation.state.waitingForUploadDesc'),
                requiresAction: true,
                showUploadCta: false,
            };
        case 'PREFLIGHT_REQUIRED':
            return {
                icon: <MagnifyingGlassIcon className="w-5 h-5" />,
                colorClass: 'text-blue-400',
                borderClass: 'border-blue-400/30',
                bgClass: 'bg-blue-400/10',
                defaultLabel: t('remediation.state.preflightRequired'),
                defaultMessage: t('remediation.state.preflightRequiredDesc'),
                requiresAction: true,
                showUploadCta: false,
            };
        case 'REVIEW_REQUIRED':
            return {
                icon: <ExclamationTriangleIcon className="w-5 h-5" />,
                colorClass: 'text-amber-500',
                borderClass: 'border-amber-500/30',
                bgClass: 'bg-amber-500/10',
                defaultLabel: t('remediation.state.reviewRequired'),
                defaultMessage: t('remediation.state.reviewRequiredDesc'),
                requiresAction: true,
                showUploadCta: false,
            };
        case 'APPROVED_WITH_WARNINGS':
            return {
                icon: <CheckCircleIcon className="w-5 h-5" />,
                colorClass: 'text-amber-400',
                borderClass: 'border-amber-400/30',
                bgClass: 'bg-amber-400/10',
                defaultLabel: t('remediation.state.approvedWithWarnings'),
                defaultMessage: t('remediation.state.approvedWithWarningsDesc'),
                requiresAction: false,
                showUploadCta: false,
            };
        case 'RESOLVED':
            return {
                icon: <ShieldCheckIcon className="w-5 h-5" />,
                colorClass: 'text-emerald-500',
                borderClass: 'border-emerald-500/30',
                bgClass: 'bg-emerald-500/10',
                defaultLabel: t('remediation.state.resolved'),
                defaultMessage: t('remediation.state.resolvedDesc'),
                requiresAction: false,
                showUploadCta: false,
            };
        default:
            return {
                icon: <ClockIcon className="w-5 h-5" />,
                colorClass: 'text-[var(--text-muted)]',
                borderClass: 'border-[var(--border-color)]',
                bgClass: 'bg-[var(--bg-secondary)]',
                defaultLabel: t('remediation.state.unknown'),
                defaultMessage: '',
                requiresAction: false,
                showUploadCta: false,
            };
    }
}

export const CustomerRemediationPanel: React.FC<CustomerRemediationPanelProps> = ({
    remediationUx,
    audience = 'customer',
}) => {
    const { t } = useTranslation();
    const state = remediationUx.remediation_state;
    const config = getRemediationConfig(state, t as any);

    const message = remediationUx.customer_message || config.defaultMessage;
    const nextAction = remediationUx.next_action;

    return (
        <div className={`p-4 border ${config.borderClass} ${config.bgClass} flex flex-col gap-3`}>
            <div className="flex items-center gap-2">
                <span className={config.colorClass}>{config.icon}</span>
                <span className={`text-[0.7rem] font-black uppercase tracking-widest ${config.colorClass}`}>
                    {t('remediation.panel.title')}
                </span>
            </div>

            <div>
                <div className={`text-[0.8rem] font-bold ${config.colorClass}`}>{config.defaultLabel}</div>
                {message && (
                    <p className="text-[0.75rem] text-[var(--text-secondary)] mt-1 leading-relaxed">
                        {message}
                    </p>
                )}
            </div>

            {nextAction && (
                <div className="border-t border-current/10 pt-3">
                    <div className="text-[0.65rem] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-1">
                        {t('remediation.panel.nextAction')}
                    </div>
                    <p className="text-[0.7rem] text-[var(--text-secondary)] leading-relaxed">
                        {nextAction}
                    </p>
                </div>
            )}

            {audience === 'operator' && remediationUx.operator_notes && remediationUx.operator_notes.length > 0 && (
                <div className="border-t border-current/10 pt-3">
                    <div className="text-[0.65rem] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-1">
                        {t('review.decision.operatorNotes')}
                    </div>
                    <ul className="space-y-1">
                        {remediationUx.operator_notes.map((note, i) => (
                            <li key={i} className="text-[0.7rem] text-[var(--text-secondary)] leading-relaxed">
                                — {note}
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {config.requiresAction && (
                <div className="text-[0.65rem] font-black uppercase tracking-widest text-[var(--text-muted)] border-t border-current/10 pt-2">
                    {t('remediation.panel.actionRequired')}
                </div>
            )}
        </div>
    );
};
