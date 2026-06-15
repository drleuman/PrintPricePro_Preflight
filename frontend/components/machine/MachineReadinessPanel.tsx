import React from 'react';
import {
    CogIcon,
    CheckCircleIcon,
    ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import type { MachineReadinessGovernance } from '../../types';
import { useTranslation } from '../../i18n';

interface MachineReadinessPanelProps {
    machineReadinessGovernance: MachineReadinessGovernance;
    audience?: 'customer' | 'operator';
}

/**
 * APP-67 — Production machine assignment / capability matching (Phase 73).
 * Shows whether the file is compatible with available production machines.
 * An incompatible result always carries review_required=true (enforced in
 * preflightNormalizer.js) — "fixed" never implies "ready for this press".
 * Mismatch reasons and the full machine list are operator-only; the customer
 * view surfaces only a safe compatibility status.
 */
export const MachineReadinessPanel: React.FC<MachineReadinessPanelProps> = ({
    machineReadinessGovernance,
    audience = 'customer',
}) => {
    const { t } = useTranslation();

    const compatible = machineReadinessGovernance.compatible !== false;
    const incompatibleMachines = Array.isArray(machineReadinessGovernance.incompatible_machines)
        ? machineReadinessGovernance.incompatible_machines
        : [];
    const compatibleMachines = Array.isArray(machineReadinessGovernance.compatible_machines)
        ? machineReadinessGovernance.compatible_machines
        : [];
    const mismatchReasons = Array.isArray(machineReadinessGovernance.mismatch_reasons)
        ? machineReadinessGovernance.mismatch_reasons
        : [];

    const colorClass = compatible ? 'text-emerald-500' : 'text-amber-500';
    const borderClass = compatible ? 'border-emerald-500/30' : 'border-amber-500/30';
    const bgClass = compatible ? 'bg-emerald-500/10' : 'bg-amber-500/10';

    return (
        <div className={`p-4 border ${borderClass} ${bgClass} flex flex-col gap-3`}>
            <div className="flex items-center gap-2">
                <CogIcon className={`w-5 h-5 ${colorClass}`} />
                <span className={`text-[0.7rem] font-black uppercase tracking-widest ${colorClass}`}>
                    {t('machineReadiness.panelTitle')}
                </span>
            </div>

            <div className="flex items-center gap-2">
                {compatible
                    ? <CheckCircleIcon className="w-4 h-4 text-emerald-500 shrink-0" />
                    : <ExclamationTriangleIcon className="w-4 h-4 text-amber-500 shrink-0" />}
                <p className={`text-[0.8rem] font-bold ${colorClass}`}>
                    {compatible ? t('machineReadiness.compatible') : t('machineReadiness.incompatible')}
                </p>
            </div>

            {!compatible && (
                <p className="text-[0.75rem] text-[var(--text-secondary)] leading-relaxed">
                    {t('machineReadiness.incompatibleDesc')}
                </p>
            )}

            {audience === 'operator' && compatibleMachines.length > 0 && (
                <div className="border-t border-current/10 pt-3">
                    <div className="text-[0.65rem] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-1">
                        {t('machineReadiness.compatibleMachines')}
                    </div>
                    <ul className="space-y-1">
                        {compatibleMachines.map((m, i) => (
                            <li key={i} className="text-[0.7rem] text-[var(--text-secondary)]">— {m}</li>
                        ))}
                    </ul>
                </div>
            )}

            {audience === 'operator' && incompatibleMachines.length > 0 && (
                <div className="border-t border-current/10 pt-3">
                    <div className="text-[0.65rem] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-1">
                        {t('machineReadiness.incompatibleMachines')}
                    </div>
                    <ul className="space-y-1">
                        {incompatibleMachines.map((m, i) => (
                            <li key={i} className="text-[0.7rem] text-[var(--text-secondary)]">— {m}</li>
                        ))}
                    </ul>
                </div>
            )}

            {audience === 'operator' && mismatchReasons.length > 0 && (
                <div className="border-t border-current/10 pt-3">
                    <div className="text-[0.65rem] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-1">
                        {t('machineReadiness.mismatchReasons')}
                    </div>
                    <ul className="space-y-1">
                        {mismatchReasons.map((r, i) => (
                            <li key={i} className="text-[0.7rem] text-[var(--text-secondary)] font-mono">— {r}</li>
                        ))}
                    </ul>
                </div>
            )}

            {!compatible && (
                <p className="text-[0.65rem] font-black uppercase tracking-widest text-amber-500 border-t border-current/10 pt-2">
                    {t('machineReadiness.reviewRequiredNotice')}
                </p>
            )}

            {audience === 'operator' && Array.isArray(machineReadinessGovernance.warnings) && machineReadinessGovernance.warnings.length > 0 && (
                <div className="border-t border-current/10 pt-3">
                    <div className="text-[0.65rem] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-1">
                        {t('visualDiff.operatorWarnings')}
                    </div>
                    <ul className="space-y-1">
                        {machineReadinessGovernance.warnings.map((w, i) => (
                            <li key={i} className="text-[0.7rem] text-[var(--text-secondary)] font-mono">— {w}</li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};
