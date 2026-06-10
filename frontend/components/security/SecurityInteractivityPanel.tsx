import React from 'react';
import {
    ShieldCheckIcon,
    ShieldExclamationIcon,
    ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import type { SecurityInteractivityGovernance } from '../../types';
import { useTranslation } from '../../i18n';

interface SecurityInteractivityPanelProps {
    governance: SecurityInteractivityGovernance;
    audience?: 'customer' | 'operator';
}

/**
 * APP-63 — Renders security_interactivity_governance (Phase 63 OS contract) as
 * safe customer/operator messaging. Active-content removal is informational only —
 * it never implies certification or print-readiness, and unresolved interactive
 * content (or skipped flattening) always surfaces as a review-required notice.
 */
export const SecurityInteractivityPanel: React.FC<SecurityInteractivityPanelProps> = ({
    governance,
    audience = 'customer',
}) => {
    const { t } = useTranslation();

    const reviewRequired = governance.review_required === true;
    const interactiveRemaining = governance.interactive_content_remaining === true;
    const flatteningSkipped = governance.flattening_skipped === true;

    const colorClass = reviewRequired ? 'text-amber-500' : 'text-emerald-500';
    const borderClass = reviewRequired ? 'border-amber-500/30' : 'border-emerald-500/30';
    const bgClass = reviewRequired ? 'bg-amber-500/10' : 'bg-emerald-500/10';

    // Customer-safe descriptions of what was applied. Active-content removal is
    // never framed as certification or print-readiness.
    const appliedItems: string[] = [];
    if (governance.javascript_removed) appliedItems.push(t('security.javascriptRemoved'));
    if (governance.launch_actions_removed) appliedItems.push(t('security.launchActionsRemoved'));
    if (governance.embedded_files_removed) appliedItems.push(t('security.embeddedFilesRemoved'));
    if (governance.forms_flattened) appliedItems.push(t('security.formsFlattened'));
    if (governance.annotations_flattened) appliedItems.push(t('security.annotationsFlattened'));

    const hasActiveContentRemoval = appliedItems.length > 0;

    return (
        <div className={`p-4 border ${borderClass} ${bgClass} flex flex-col gap-3`}>
            <div className="flex items-center gap-2">
                {reviewRequired ? (
                    <ShieldExclamationIcon className={`w-5 h-5 ${colorClass}`} />
                ) : (
                    <ShieldCheckIcon className={`w-5 h-5 ${colorClass}`} />
                )}
                <span className={`text-[0.7rem] font-black uppercase tracking-widest ${colorClass}`}>
                    {t('security.panelTitle')}
                </span>
            </div>

            {/* Applied actions */}
            {hasActiveContentRemoval && (
                <ul className="space-y-1">
                    {appliedItems.map((item, i) => (
                        <li key={i} className="text-[0.75rem] text-[var(--text-secondary)] leading-relaxed flex items-start gap-2">
                            <ShieldCheckIcon className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                            {item}
                        </li>
                    ))}
                </ul>
            )}

            {/* Active content removal never implies certification / print-readiness */}
            {hasActiveContentRemoval && (
                <p className="text-[0.7rem] text-[var(--text-muted)] leading-relaxed">
                    {t('security.activeContentRemovalDisclaimer')}
                </p>
            )}

            {/* Flattening skipped — safe automatic flattening was not possible */}
            {flatteningSkipped && (
                <div className="flex items-start gap-2">
                    <ExclamationTriangleIcon className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                    <p className="text-[0.75rem] text-amber-400 leading-relaxed">
                        {t('security.flatteningSkippedDesc')}
                    </p>
                </div>
            )}

            {/* Unresolved interactive content remains in the file */}
            {interactiveRemaining && (
                <div className="flex items-start gap-2">
                    <ExclamationTriangleIcon className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                    <p className="text-[0.75rem] text-amber-400 leading-relaxed">
                        {t('security.interactiveContentRemainingDesc')}
                    </p>
                </div>
            )}

            {/* Generic review-required notice */}
            {reviewRequired && (
                <p className="text-[0.65rem] font-black uppercase tracking-widest text-amber-500 border-t border-current/10 pt-2">
                    {t('security.reviewRequiredNotice')}
                </p>
            )}

            {/* Operator-only: sanitized warnings, no raw PDF object internals */}
            {audience === 'operator' && Array.isArray(governance.warnings) && governance.warnings.length > 0 && (
                <div className="border-t border-current/10 pt-3">
                    <div className="text-[0.65rem] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-1">
                        {t('security.operatorWarnings')}
                    </div>
                    <ul className="space-y-1">
                        {governance.warnings.map((w, i) => (
                            <li key={i} className="text-[0.7rem] text-[var(--text-secondary)] font-mono">— {w}</li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};
