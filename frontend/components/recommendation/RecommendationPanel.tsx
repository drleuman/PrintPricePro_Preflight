import React from 'react';
import {
    LightBulbIcon,
    ShieldExclamationIcon,
} from '@heroicons/react/24/outline';
import type { RecommendationGovernance } from '../../types';
import { useTranslation } from '../../i18n';

interface RecommendationPanelProps {
    recommendationGovernance: RecommendationGovernance;
    audience?: 'customer' | 'operator';
}

/**
 * APP-67 — Fix recommendation layer (Phase 75). Surfaces the OS's suggested
 * next action and the reason for it. Recommendations marked
 * `operator_only`/`destructive` (enforced together in preflightNormalizer.js)
 * never expose the underlying action or reason to the customer audience —
 * only a safe "an operator is reviewing this" notice (or an explicit
 * customer-safe `customer_message`, if provided). This panel never offers an
 * "apply" affordance; `auto_apply` is informational only and is forced to
 * false whenever `destructive=true`.
 */
export const RecommendationPanel: React.FC<RecommendationPanelProps> = ({
    recommendationGovernance,
    audience = 'customer',
}) => {
    const { t } = useTranslation();

    const action = recommendationGovernance.recommended_action;
    if (!action || action === 'NONE') return null;

    const operatorOnly = recommendationGovernance.operator_only === true
        || recommendationGovernance.destructive === true;

    if (audience === 'customer' && operatorOnly && !recommendationGovernance.customer_message) {
        return (
            <div className="p-4 border border-[var(--border-color)] bg-[var(--bg-secondary)] flex items-start gap-3">
                <LightBulbIcon className="w-5 h-5 text-[var(--text-muted)] mt-0.5 shrink-0" />
                <p className="text-[0.8rem] text-[var(--text-secondary)] leading-relaxed">
                    {t('recommendation.operatorPending')}
                </p>
            </div>
        );
    }

    const label = recommendationGovernance.recommendation_label
        || recommendationGovernance.recommended_action;
    const message = (audience === 'customer')
        ? recommendationGovernance.customer_message
        : (recommendationGovernance.reason || recommendationGovernance.customer_message);

    return (
        <div className="p-4 border border-blue-500/30 bg-blue-500/10 flex flex-col gap-3">
            <div className="flex items-center gap-2">
                <LightBulbIcon className="w-5 h-5 text-blue-400" />
                <span className="text-[0.7rem] font-black uppercase tracking-widest text-blue-400">
                    {t('recommendation.panelTitle')}
                </span>
            </div>

            <p className="text-[0.8rem] font-bold text-[var(--text-primary)]">{label}</p>

            {message && (
                <p className="text-[0.75rem] text-[var(--text-secondary)] leading-relaxed">{message}</p>
            )}

            {operatorOnly && (
                <div className="flex items-start gap-2 border-t border-current/10 pt-2">
                    <ShieldExclamationIcon className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                    <p className="text-[0.65rem] font-black uppercase tracking-widest text-amber-500">
                        {t('recommendation.operatorOnlyNotice')}
                    </p>
                </div>
            )}

            {audience === 'operator' && recommendationGovernance.reason && (
                <p className="text-[0.7rem] text-[var(--text-secondary)] leading-relaxed border-t border-current/10 pt-2">
                    {t('recommendation.why')}: {recommendationGovernance.reason}
                </p>
            )}

            {audience === 'operator' && Array.isArray(recommendationGovernance.warnings) && recommendationGovernance.warnings.length > 0 && (
                <div className="border-t border-current/10 pt-3">
                    <div className="text-[0.65rem] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-1">
                        {t('visualDiff.operatorWarnings')}
                    </div>
                    <ul className="space-y-1">
                        {recommendationGovernance.warnings.map((w, i) => (
                            <li key={i} className="text-[0.7rem] text-[var(--text-secondary)] font-mono">— {w}</li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};
