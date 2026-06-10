import React from 'react';
import {
    SwatchIcon,
    PhotoIcon,
    DocumentTextIcon,
    Square3Stack3DIcon,
    EyeIcon,
    ExclamationTriangleIcon,
    CheckCircleIcon,
} from '@heroicons/react/24/outline';
import type {
    InkGovernance,
    SelectiveImageGovernance,
    FontGovernance,
    TransparencyOverprintPhysicalGovernance,
    VisualDiffGovernance,
} from '../../types';
import { useTranslation } from '../../i18n';

type Audience = 'customer' | 'operator';

interface PanelShellProps {
    icon: React.ReactNode;
    title: string;
    reviewRequired: boolean;
    children: React.ReactNode;
    audience: Audience;
    warnings?: string[];
    operatorWarningsLabel: string;
    reviewNoticeLabel: string;
}

/**
 * APP-64 — Shared shell for ink/image/font/transparency/visual-diff governance
 * panels. These panels are informational only: applied changes are described
 * in plain language but never imply certification or print-readiness, and any
 * unresolved/unverified condition surfaces a review-required notice.
 */
const GovernancePanelShell: React.FC<PanelShellProps> = ({
    icon,
    title,
    reviewRequired,
    children,
    audience,
    warnings,
    operatorWarningsLabel,
    reviewNoticeLabel,
}) => {
    const colorClass = reviewRequired ? 'text-amber-500' : 'text-emerald-500';
    const borderClass = reviewRequired ? 'border-amber-500/30' : 'border-emerald-500/30';
    const bgClass = reviewRequired ? 'bg-amber-500/10' : 'bg-emerald-500/10';

    return (
        <div className={`p-4 border ${borderClass} ${bgClass} flex flex-col gap-3`}>
            <div className="flex items-center gap-2">
                <span className={colorClass}>{icon}</span>
                <span className={`text-[0.7rem] font-black uppercase tracking-widest ${colorClass}`}>
                    {title}
                </span>
            </div>

            {children}

            {reviewRequired && (
                <p className="text-[0.65rem] font-black uppercase tracking-widest text-amber-500 border-t border-current/10 pt-2">
                    {reviewNoticeLabel}
                </p>
            )}

            {audience === 'operator' && Array.isArray(warnings) && warnings.length > 0 && (
                <div className="border-t border-current/10 pt-3">
                    <div className="text-[0.65rem] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-1">
                        {operatorWarningsLabel}
                    </div>
                    <ul className="space-y-1">
                        {warnings.map((w, i) => (
                            <li key={i} className="text-[0.7rem] text-[var(--text-secondary)] font-mono">— {w}</li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};

interface GovernancePanelProps<T> {
    governance: T;
    audience?: Audience;
}

/** Ink / color / TAC review (Phase 64). */
export const InkGovernancePanel: React.FC<GovernancePanelProps<InkGovernance>> = ({ governance, audience = 'customer' }) => {
    const { t } = useTranslation();
    const reviewRequired = governance.review_required === true;

    const items: string[] = [];
    if (governance.tac_limit_applied) {
        items.push(
            governance.tac_limit_value
                ? t('ink.tacLimitValue', { value: governance.tac_limit_value })
                : t('ink.tacLimitApplied')
        );
    }
    if (governance.black_generation_adjusted) items.push(t('ink.blackGenerationAdjusted'));
    if (governance.rich_black_normalized) items.push(t('ink.richBlackNormalized'));
    if (typeof governance.ink_density_violations_fixed === 'number' && governance.ink_density_violations_fixed > 0) {
        items.push(t('ink.densityViolationsFixed', { count: governance.ink_density_violations_fixed }));
    }

    return (
        <GovernancePanelShell
            icon={<SwatchIcon className="w-5 h-5" />}
            title={t('ink.panelTitle')}
            reviewRequired={reviewRequired}
            audience={audience}
            warnings={governance.warnings}
            operatorWarningsLabel={t('ink.operatorWarnings')}
            reviewNoticeLabel={t('ink.reviewRequiredNotice')}
        >
            {items.length > 0 && (
                <ul className="space-y-1">
                    {items.map((item, i) => (
                        <li key={i} className="text-[0.75rem] text-[var(--text-secondary)] leading-relaxed flex items-start gap-2">
                            <CheckCircleIcon className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                            {item}
                        </li>
                    ))}
                </ul>
            )}
            {governance.tac_violation_remaining && (
                <div className="flex items-start gap-2">
                    <ExclamationTriangleIcon className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                    <p className="text-[0.75rem] text-amber-400 leading-relaxed">{t('ink.tacViolationRemainingDesc')}</p>
                </div>
            )}
        </GovernancePanelShell>
    );
};

/** Selective image review (Phase 65). */
export const ImageGovernancePanel: React.FC<GovernancePanelProps<SelectiveImageGovernance>> = ({ governance, audience = 'customer' }) => {
    const { t } = useTranslation();
    const reviewRequired = governance.review_required === true;

    const items: string[] = [];
    if (typeof governance.images_resampled === 'number' && governance.images_resampled > 0) {
        items.push(t('image.imagesResampled', { count: governance.images_resampled }));
    }
    if (typeof governance.images_recompressed === 'number' && governance.images_recompressed > 0) {
        items.push(t('image.imagesRecompressed', { count: governance.images_recompressed }));
    }
    if (typeof governance.low_res_images_detected === 'number' && governance.low_res_images_detected > 0) {
        items.push(t('image.lowResDetected', { count: governance.low_res_images_detected }));
    }

    return (
        <GovernancePanelShell
            icon={<PhotoIcon className="w-5 h-5" />}
            title={t('image.panelTitle')}
            reviewRequired={reviewRequired}
            audience={audience}
            warnings={governance.warnings}
            operatorWarningsLabel={t('image.operatorWarnings')}
            reviewNoticeLabel={t('image.reviewRequiredNotice')}
        >
            {items.length > 0 && (
                <ul className="space-y-1">
                    {items.map((item, i) => (
                        <li key={i} className="text-[0.75rem] text-[var(--text-secondary)] leading-relaxed flex items-start gap-2">
                            <CheckCircleIcon className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                            {item}
                        </li>
                    ))}
                </ul>
            )}
            {governance.low_res_unfixable && (
                <div className="flex items-start gap-2">
                    <ExclamationTriangleIcon className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                    <p className="text-[0.75rem] text-amber-400 leading-relaxed">{t('image.lowResUnfixableDesc')}</p>
                </div>
            )}
        </GovernancePanelShell>
    );
};

/** Font review (Phase 66). */
export const FontGovernancePanel: React.FC<GovernancePanelProps<FontGovernance>> = ({ governance, audience = 'customer' }) => {
    const { t } = useTranslation();
    const reviewRequired = governance.review_required === true;

    const items: string[] = [];
    if (typeof governance.fonts_embedded === 'number' && governance.fonts_embedded > 0) {
        items.push(t('font.fontsEmbedded', { count: governance.fonts_embedded }));
    }
    if (typeof governance.fonts_subsetted === 'number' && governance.fonts_subsetted > 0) {
        items.push(t('font.fontsSubsetted', { count: governance.fonts_subsetted }));
    }

    const missingFonts = Array.isArray(governance.fonts_missing) ? governance.fonts_missing : [];

    return (
        <GovernancePanelShell
            icon={<DocumentTextIcon className="w-5 h-5" />}
            title={t('font.panelTitle')}
            reviewRequired={reviewRequired}
            audience={audience}
            warnings={governance.warnings}
            operatorWarningsLabel={t('font.operatorWarnings')}
            reviewNoticeLabel={t('font.reviewRequiredNotice')}
        >
            {items.length > 0 && (
                <ul className="space-y-1">
                    {items.map((item, i) => (
                        <li key={i} className="text-[0.75rem] text-[var(--text-secondary)] leading-relaxed flex items-start gap-2">
                            <CheckCircleIcon className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                            {item}
                        </li>
                    ))}
                </ul>
            )}
            {missingFonts.length > 0 && (
                <p className="text-[0.75rem] text-[var(--text-secondary)] leading-relaxed">
                    {t('font.fontsMissingDesc', { fonts: missingFonts.join(', ') })}
                </p>
            )}
            {governance.font_source_available === false && (
                <div className="flex items-start gap-2">
                    <ExclamationTriangleIcon className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                    <p className="text-[0.75rem] text-amber-400 leading-relaxed">{t('font.fontSourceUnavailableDesc')}</p>
                </div>
            )}
        </GovernancePanelShell>
    );
};

/** Transparency / overprint review (Phase 67). */
export const TransparencyOverprintPanel: React.FC<GovernancePanelProps<TransparencyOverprintPhysicalGovernance>> = ({ governance, audience = 'customer' }) => {
    const { t } = useTranslation();
    const reviewRequired = governance.review_required === true;

    const items: string[] = [];
    if (governance.transparency_flattened) items.push(t('transparency.flattenedDesc'));
    if (governance.overprint_modified) items.push(t('transparency.overprintModifiedDesc'));
    if (governance.spot_colors_converted) items.push(t('transparency.spotColorsConvertedDesc'));

    const isDestructive = governance.transparency_flattened === true || governance.overprint_modified === true;

    return (
        <GovernancePanelShell
            icon={<Square3Stack3DIcon className="w-5 h-5" />}
            title={t('transparency.panelTitle')}
            reviewRequired={reviewRequired}
            audience={audience}
            warnings={governance.warnings}
            operatorWarningsLabel={t('transparency.operatorWarnings')}
            reviewNoticeLabel={t('transparency.reviewRequiredNotice')}
        >
            {items.length > 0 && (
                <ul className="space-y-1">
                    {items.map((item, i) => (
                        <li key={i} className="text-[0.75rem] text-[var(--text-secondary)] leading-relaxed flex items-start gap-2">
                            <CheckCircleIcon className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                            {item}
                        </li>
                    ))}
                </ul>
            )}
            {isDestructive && (
                <div className="flex items-start gap-2">
                    <ExclamationTriangleIcon className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                    <p className="text-[0.75rem] text-amber-400 leading-relaxed">{t('transparency.reviewRequiredDesc')}</p>
                </div>
            )}
        </GovernancePanelShell>
    );
};

/** Visual proof / rendered comparison (Phase 69). */
export const VisualDiffPanel: React.FC<GovernancePanelProps<VisualDiffGovernance>> = ({ governance, audience = 'customer' }) => {
    const { t } = useTranslation();
    const reviewRequired = governance.review_required === true;
    const requiredNotPerformed = governance.visual_diff_required === true && governance.visual_diff_performed !== true;

    return (
        <GovernancePanelShell
            icon={<EyeIcon className="w-5 h-5" />}
            title={t('visualDiff.panelTitle')}
            reviewRequired={reviewRequired}
            audience={audience}
            warnings={governance.warnings}
            operatorWarningsLabel={t('visualDiff.operatorWarnings')}
            reviewNoticeLabel={t('visualDiff.reviewRequiredNotice')}
        >
            {requiredNotPerformed && (
                <div className="flex items-start gap-2">
                    <ExclamationTriangleIcon className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                    <p className="text-[0.75rem] text-amber-400 leading-relaxed">{t('visualDiff.requiredNotPerformedDesc')}</p>
                </div>
            )}
            {governance.visual_diff_performed === true && governance.visual_change_detected === true && (
                <p className="text-[0.75rem] text-[var(--text-secondary)] leading-relaxed">{t('visualDiff.changeDetectedDesc')}</p>
            )}
            {governance.visual_diff_performed === true && governance.visual_change_detected === false && (
                <p className="text-[0.75rem] text-[var(--text-secondary)] leading-relaxed">{t('visualDiff.noChangeDetectedDesc')}</p>
            )}
            {governance.visual_change_expected === true && (
                <div className="flex items-start gap-2">
                    <ExclamationTriangleIcon className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                    <p className="text-[0.75rem] text-amber-400 leading-relaxed">{t('visualDiff.changeExpectedDesc')}</p>
                </div>
            )}
        </GovernancePanelShell>
    );
};
