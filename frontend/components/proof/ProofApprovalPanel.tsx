import React from 'react';
import {
    CheckCircleIcon,
    XCircleIcon,
    ClockIcon,
    EyeIcon,
} from '@heroicons/react/24/outline';
import type { ProofApprovalGovernance } from '../../types';
import { useTranslation } from '../../i18n';

interface ProofApprovalPanelProps {
    proofApprovalGovernance: ProofApprovalGovernance;
    audience?: 'customer' | 'operator';
}

type ProofStatus = NonNullable<ProofApprovalGovernance['proof_status']>;

interface ProofStatusConfig {
    icon: React.ReactNode;
    colorClass: string;
    borderClass: string;
    bgClass: string;
    defaultLabel: string;
    defaultMessage: string;
    blocksProgression: boolean;
}

export function getProofStatusConfig(status: ProofStatus, t: (k: string) => string): ProofStatusConfig {
    switch (status) {
        case 'PROOF_APPROVED':
            return {
                icon: <CheckCircleIcon className="w-5 h-5" />,
                colorClass: 'text-emerald-500',
                borderClass: 'border-emerald-500/30',
                bgClass: 'bg-emerald-500/10',
                defaultLabel: t('proof.approved'),
                defaultMessage: t('proof.approvedDesc'),
                blocksProgression: false,
            };
        case 'PROOF_REJECTED_REUPLOAD_REQUIRED':
            return {
                icon: <XCircleIcon className="w-5 h-5" />,
                colorClass: 'text-red-500',
                borderClass: 'border-red-500/30',
                bgClass: 'bg-red-500/10',
                defaultLabel: t('proof.rejected'),
                defaultMessage: t('proof.rejectedDesc'),
                blocksProgression: true,
            };
        case 'PROOF_PENDING_CUSTOMER':
            return {
                icon: <ClockIcon className="w-5 h-5" />,
                colorClass: 'text-amber-500',
                borderClass: 'border-amber-500/30',
                bgClass: 'bg-amber-500/10',
                defaultLabel: t('proof.pendingCustomer'),
                defaultMessage: t('proof.pendingCustomerDesc'),
                blocksProgression: true,
            };
        case 'PROOF_REQUIRED':
            return {
                icon: <EyeIcon className="w-5 h-5" />,
                colorClass: 'text-amber-500',
                borderClass: 'border-amber-500/30',
                bgClass: 'bg-amber-500/10',
                defaultLabel: t('proof.required'),
                defaultMessage: t('proof.requiredDesc'),
                blocksProgression: true,
            };
        case 'PROOF_NOT_REQUIRED':
        default:
            return {
                icon: <CheckCircleIcon className="w-5 h-5" />,
                colorClass: 'text-emerald-500',
                borderClass: 'border-emerald-500/30',
                bgClass: 'bg-emerald-500/10',
                defaultLabel: t('proof.notRequired'),
                defaultMessage: '',
                blocksProgression: false,
            };
    }
}

/**
 * APP-65 — Customer proof approval state (Phase 70). Renders nothing for
 * PROOF_NOT_REQUIRED — that state is not actionable and should not occupy UI
 * space. For all other states, surfaces the proof status, customer-facing
 * message, and (for operators) internal notes, plus a progression-blocked
 * notice when the proof has not yet been approved.
 */
export const ProofApprovalPanel: React.FC<ProofApprovalPanelProps> = ({
    proofApprovalGovernance,
    audience = 'customer',
}) => {
    const { t } = useTranslation();
    const status = proofApprovalGovernance.proof_status ?? 'PROOF_NOT_REQUIRED';

    if (status === 'PROOF_NOT_REQUIRED') return null;

    const config = getProofStatusConfig(status, t as any);
    const message = proofApprovalGovernance.customer_message || config.defaultMessage;
    const blocksProgression = config.blocksProgression || proofApprovalGovernance.review_required === true;

    return (
        <div className={`p-4 border ${config.borderClass} ${config.bgClass} flex flex-col gap-3`}>
            <div className="flex items-center gap-2">
                <span className={config.colorClass}>{config.icon}</span>
                <span className={`text-[0.7rem] font-black uppercase tracking-widest ${config.colorClass}`}>
                    {t('proof.panelTitle')}
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

            {audience === 'operator' && proofApprovalGovernance.operator_notes && proofApprovalGovernance.operator_notes.length > 0 && (
                <div className="border-t border-current/10 pt-3">
                    <div className="text-[0.65rem] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-1">
                        {t('proof.operatorNotes')}
                    </div>
                    <ul className="space-y-1">
                        {proofApprovalGovernance.operator_notes.map((note, i) => (
                            <li key={i} className="text-[0.7rem] text-[var(--text-secondary)] leading-relaxed">
                                — {note}
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {audience === 'operator' && proofApprovalGovernance.warnings && proofApprovalGovernance.warnings.length > 0 && (
                <div className="border-t border-current/10 pt-3">
                    <div className="text-[0.65rem] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-1">
                        {t('visualDiff.operatorWarnings')}
                    </div>
                    <ul className="space-y-1">
                        {proofApprovalGovernance.warnings.map((w, i) => (
                            <li key={i} className="text-[0.7rem] text-[var(--text-secondary)] font-mono">— {w}</li>
                        ))}
                    </ul>
                </div>
            )}

            {blocksProgression && (
                <div className="text-[0.65rem] font-black uppercase tracking-widest text-[var(--text-muted)] border-t border-current/10 pt-2">
                    {t('proof.progressionBlocked')}
                </div>
            )}
        </div>
    );
};
