import React from 'react';
import {
    ArchiveBoxIcon,
    CheckCircleIcon,
    ClockIcon,
    DocumentDuplicateIcon,
} from '@heroicons/react/24/outline';
import type { AuditBundleGovernance } from '../../types';
import { useTranslation } from '../../i18n';

interface AuditBundlePanelProps {
    auditBundleGovernance: AuditBundleGovernance;
    audience?: 'customer' | 'operator';
}

/**
 * APP-67 — Compliance / audit export bundle (Phase 74). Shows whether an
 * audit bundle is available and which artifacts/reports it includes.
 * `internal_only_evidence` (raw tool output, internal IDs) is only rendered
 * for the operator audience. When `customer_visible=false`, the panel renders
 * nothing for the customer audience — the audit bundle is an operator/back-office
 * artifact for that job.
 */
export const AuditBundlePanel: React.FC<AuditBundlePanelProps> = ({
    auditBundleGovernance,
    audience = 'customer',
}) => {
    const { t } = useTranslation();

    if (audience === 'customer' && auditBundleGovernance.customer_visible === false) {
        return null;
    }

    const available = auditBundleGovernance.bundle_available === true;
    const includedArtifacts = Array.isArray(auditBundleGovernance.included_artifacts)
        ? auditBundleGovernance.included_artifacts
        : [];
    const includedReports = Array.isArray(auditBundleGovernance.included_reports)
        ? auditBundleGovernance.included_reports
        : [];

    const colorClass = available ? 'text-emerald-500' : 'text-[var(--text-muted)]';
    const borderClass = available ? 'border-emerald-500/30' : 'border-[var(--border-color)]';
    const bgClass = available ? 'bg-emerald-500/10' : 'bg-[var(--bg-secondary)]';

    return (
        <div className={`p-4 border ${borderClass} ${bgClass} flex flex-col gap-3`}>
            <div className="flex items-center gap-2">
                <ArchiveBoxIcon className={`w-5 h-5 ${colorClass}`} />
                <span className={`text-[0.7rem] font-black uppercase tracking-widest ${colorClass}`}>
                    {t('auditBundle.panelTitle')}
                </span>
            </div>

            <div className="flex items-center gap-2">
                {available
                    ? <CheckCircleIcon className="w-4 h-4 text-emerald-500 shrink-0" />
                    : <ClockIcon className="w-4 h-4 text-[var(--text-muted)] shrink-0" />}
                <p className={`text-[0.8rem] font-bold ${colorClass}`}>
                    {available ? t('auditBundle.available') : t('auditBundle.notAvailable')}
                </p>
            </div>

            {includedArtifacts.length > 0 && (
                <div className="border-t border-current/10 pt-3">
                    <div className="text-[0.65rem] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-1">
                        {t('auditBundle.includedArtifacts')}
                    </div>
                    <ul className="space-y-1">
                        {includedArtifacts.map((a, i) => (
                            <li key={i} className="text-[0.7rem] text-[var(--text-secondary)] flex items-center gap-2">
                                <DocumentDuplicateIcon className="w-3.5 h-3.5 shrink-0 opacity-60" />
                                {a}
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {includedReports.length > 0 && (
                <div className="border-t border-current/10 pt-3">
                    <div className="text-[0.65rem] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-1">
                        {t('auditBundle.includedReports')}
                    </div>
                    <ul className="space-y-1">
                        {includedReports.map((r, i) => (
                            <li key={i} className="text-[0.7rem] text-[var(--text-secondary)] flex items-center gap-2">
                                <DocumentDuplicateIcon className="w-3.5 h-3.5 shrink-0 opacity-60" />
                                {r}
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* APP-67: internal-only evidence (raw tool output, internal IDs) is operator-only. */}
            {audience === 'operator' && auditBundleGovernance.internal_only_evidence && (
                <div className="border-t border-current/10 pt-3">
                    <div className="text-[0.65rem] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-1">
                        {t('auditBundle.internalEvidence')}
                    </div>
                    <pre className="text-[0.65rem] text-[var(--text-secondary)] font-mono whitespace-pre-wrap break-all">
                        {JSON.stringify(auditBundleGovernance.internal_only_evidence, null, 2)}
                    </pre>
                </div>
            )}

            {audience === 'operator' && Array.isArray(auditBundleGovernance.warnings) && auditBundleGovernance.warnings.length > 0 && (
                <div className="border-t border-current/10 pt-3">
                    <div className="text-[0.65rem] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-1">
                        {t('visualDiff.operatorWarnings')}
                    </div>
                    <ul className="space-y-1">
                        {auditBundleGovernance.warnings.map((w, i) => (
                            <li key={i} className="text-[0.7rem] text-[var(--text-secondary)] font-mono">— {w}</li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};
