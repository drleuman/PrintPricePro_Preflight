import React from 'react';
import {
    ClipboardDocumentCheckIcon,
    CheckCircleIcon,
    ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import type { PolicyProfileGovernance } from '../../types';
import { useTranslation } from '../../i18n';

interface PolicyProfilePanelProps {
    policyProfileGovernance: PolicyProfileGovernance;
    audience?: 'customer' | 'operator';
}

/**
 * APP-67 — Active standards profile / policy template (Phase 72). Renders the
 * profile this job was checked against and whether it passed. A failed
 * profile always carries review_required=true (enforced in
 * preflightNormalizer.js) and is reflected here as a review notice — never as
 * a production-ready claim.
 */
export const PolicyProfilePanel: React.FC<PolicyProfilePanelProps> = ({
    policyProfileGovernance,
    audience = 'customer',
}) => {
    const { t } = useTranslation();

    const passed = policyProfileGovernance.profile_passed !== false;
    const blockers = Array.isArray(policyProfileGovernance.blockers)
        ? policyProfileGovernance.blockers
        : [];

    const colorClass = passed ? 'text-emerald-500' : 'text-amber-500';
    const borderClass = passed ? 'border-emerald-500/30' : 'border-amber-500/30';
    const bgClass = passed ? 'bg-emerald-500/10' : 'bg-amber-500/10';

    const profileLabel = policyProfileGovernance.active_profile_label
        || policyProfileGovernance.active_profile;

    return (
        <div className={`p-4 border ${borderClass} ${bgClass} flex flex-col gap-3`}>
            <div className="flex items-center gap-2">
                <ClipboardDocumentCheckIcon className={`w-5 h-5 ${colorClass}`} />
                <span className={`text-[0.7rem] font-black uppercase tracking-widest ${colorClass}`}>
                    {t('policyProfile.panelTitle')}
                </span>
            </div>

            {profileLabel && (
                <p className="text-[0.8rem] font-bold text-[var(--text-primary)]">{profileLabel}</p>
            )}

            {policyProfileGovernance.required_standard && (
                <p className="text-[0.75rem] text-[var(--text-secondary)]">
                    {t('policyProfile.requiredStandard')}: {policyProfileGovernance.required_standard}
                </p>
            )}

            <div className="flex items-center gap-2">
                {passed
                    ? <CheckCircleIcon className="w-4 h-4 text-emerald-500 shrink-0" />
                    : <ExclamationTriangleIcon className="w-4 h-4 text-amber-500 shrink-0" />}
                <p className={`text-[0.8rem] font-bold ${colorClass}`}>
                    {passed ? t('policyProfile.passed') : t('policyProfile.failed')}
                </p>
            </div>

            {!passed && blockers.length > 0 && (
                <div className="border-t border-current/10 pt-3">
                    <div className="text-[0.65rem] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-1">
                        {t('policyProfile.blockers')}
                    </div>
                    <ul className="space-y-1">
                        {blockers.map((b, i) => (
                            <li key={i} className="text-[0.7rem] text-[var(--text-secondary)]">— {b}</li>
                        ))}
                    </ul>
                </div>
            )}

            {!passed && (
                <p className="text-[0.65rem] font-black uppercase tracking-widest text-amber-500 border-t border-current/10 pt-2">
                    {t('policyProfile.reviewRequiredNotice')}
                </p>
            )}

            {audience === 'operator' && Array.isArray(policyProfileGovernance.warnings) && policyProfileGovernance.warnings.length > 0 && (
                <div className="border-t border-current/10 pt-3">
                    <div className="text-[0.65rem] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-1">
                        {t('visualDiff.operatorWarnings')}
                    </div>
                    <ul className="space-y-1">
                        {policyProfileGovernance.warnings.map((w, i) => (
                            <li key={i} className="text-[0.7rem] text-[var(--text-secondary)] font-mono">— {w}</li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};
