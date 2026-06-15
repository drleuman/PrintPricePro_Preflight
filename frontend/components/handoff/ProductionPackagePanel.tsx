import React from 'react';
import {
    TruckIcon,
    CheckCircleIcon,
    ExclamationTriangleIcon,
    DocumentDuplicateIcon,
} from '@heroicons/react/24/outline';
import type { ProductionPackageGovernance } from '../../types';
import { useTranslation } from '../../i18n';

interface ProductionPackagePanelProps {
    productionPackageGovernance: ProductionPackageGovernance;
    audience?: 'customer' | 'operator';
}

// APP-66: blocked_by_governance_domains entries are internal governance keys
// (e.g. "ink_governance", "payment"). Map each to a customer/operator-safe
// label — never surface raw domain keys directly.
const DOMAIN_LABEL_KEYS: Record<string, string> = {
    artifact_trust: 'productionPackage.domain.artifactTrust',
    review_decision_ux: 'productionPackage.domain.reviewDecision',
    remediation_ux: 'productionPackage.domain.remediation',
    proof_approval_governance: 'productionPackage.domain.proofApproval',
    visual_diff_governance: 'productionPackage.domain.visualDiff',
    security_interactivity_governance: 'productionPackage.domain.security',
    standards_certification_governance: 'productionPackage.domain.standards',
    structural_metadata_governance: 'productionPackage.domain.structuralMetadata',
    page_marks_governance: 'productionPackage.domain.pageMarks',
    ink_governance: 'productionPackage.domain.ink',
    selective_image_governance: 'productionPackage.domain.image',
    font_governance: 'productionPackage.domain.font',
    transparency_overprint_physical_governance: 'productionPackage.domain.transparency',
    heavy_pdf_probe_governance: 'productionPackage.domain.heavyPdfProbe',
    payment: 'productionPackage.domain.payment',
    // APP-67: policy profile / machine readiness blockers (Phases 72-73)
    policy_profile_governance: 'productionPackage.domain.policyProfile',
    machine_readiness_governance: 'productionPackage.domain.machineReadiness',
};

// APP-66: artifact type keys reuse existing safe labels from APP-61's
// artifact.* strings — never invent a new "Certified PDF" label here.
const ARTIFACT_TYPE_LABEL_KEYS: Record<string, string> = {
    final_fixed_pdf: 'artifact.productionApprovedFile',
    fixed_pdf: 'artifact.correctedFile',
    normalized_pdf: 'artifact.correctedFile',
    review_pdf: 'artifact.reviewFile',
    certified_pdf: 'artifact.standardsValidatedFile',
};

/**
 * APP-66 — Printhouse delivery / production handoff package status (Phase 71).
 * This is distinct from the customer's corrected/review file download: it
 * communicates whether the *production package* (approved artifact + reports)
 * is ready to be sent to a printhouse. Renders nothing if no governance object
 * is present. Internal governance domain keys and artifact hashes are never
 * shown to the customer audience.
 */
export const ProductionPackagePanel: React.FC<ProductionPackagePanelProps> = ({
    productionPackageGovernance,
    audience = 'customer',
}) => {
    const { t } = useTranslation();

    const ready = productionPackageGovernance.package_ready === true;
    const blockers = Array.isArray(productionPackageGovernance.blocked_by_governance_domains)
        ? productionPackageGovernance.blocked_by_governance_domains
        : [];
    const includedReports = Array.isArray(productionPackageGovernance.included_reports)
        ? productionPackageGovernance.included_reports
        : [];
    const paymentBlocked = productionPackageGovernance.payment_required === true
        && productionPackageGovernance.payment_satisfied !== true;

    const colorClass = ready ? 'text-emerald-500' : 'text-amber-500';
    const borderClass = ready ? 'border-emerald-500/30' : 'border-amber-500/30';
    const bgClass = ready ? 'bg-emerald-500/10' : 'bg-amber-500/10';

    const approvedArtifactLabelKey = productionPackageGovernance.approved_artifact_type
        ? ARTIFACT_TYPE_LABEL_KEYS[productionPackageGovernance.approved_artifact_type]
        : undefined;

    return (
        <div className={`p-4 border ${borderClass} ${bgClass} flex flex-col gap-3`}>
            <div className="flex items-center gap-2">
                <TruckIcon className={`w-5 h-5 ${colorClass}`} />
                <span className={`text-[0.7rem] font-black uppercase tracking-widest ${colorClass}`}>
                    {t('productionPackage.panelTitle')}
                </span>
            </div>

            <div className="flex items-center gap-2">
                {ready
                    ? <CheckCircleIcon className="w-4 h-4 text-emerald-500 shrink-0" />
                    : <ExclamationTriangleIcon className="w-4 h-4 text-amber-500 shrink-0" />}
                <p className={`text-[0.8rem] font-bold ${colorClass}`}>
                    {ready ? t('productionPackage.ready') : t('productionPackage.notReady')}
                </p>
            </div>

            {!ready && (
                <p className="text-[0.75rem] text-[var(--text-secondary)] leading-relaxed">
                    {t('productionPackage.notReadyDesc')}
                </p>
            )}

            {ready && approvedArtifactLabelKey && (
                <p className="text-[0.75rem] text-[var(--text-secondary)] leading-relaxed">
                    {t('productionPackage.approvedArtifact')}: {t(approvedArtifactLabelKey as any)}
                </p>
            )}

            {includedReports.length > 0 && (
                <div className="border-t border-current/10 pt-3">
                    <div className="text-[0.65rem] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-1">
                        {t('productionPackage.includedReports')}
                    </div>
                    <ul className="space-y-1">
                        {includedReports.map((report, i) => (
                            <li key={i} className="text-[0.7rem] text-[var(--text-secondary)] flex items-center gap-2">
                                <DocumentDuplicateIcon className="w-3.5 h-3.5 shrink-0 opacity-60" />
                                {report}
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {paymentBlocked && (
                <p className="text-[0.75rem] text-amber-400 leading-relaxed">
                    {t('productionPackage.paymentRequired')}
                </p>
            )}

            {!ready && blockers.length > 0 && (
                <div className="border-t border-current/10 pt-3">
                    <div className="text-[0.65rem] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-1">
                        {t('productionPackage.blockers')}
                    </div>
                    <ul className="space-y-1">
                        {blockers.map((domain, i) => (
                            <li key={i} className="text-[0.7rem] text-[var(--text-secondary)]">
                                — {t((DOMAIN_LABEL_KEYS[domain] || 'productionPackage.domain.generic') as any)}
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* APP-66: approved_artifact_hash is an internal evidence field — operator-only. */}
            {audience === 'operator' && productionPackageGovernance.approved_artifact_hash && (
                <div className="border-t border-current/10 pt-3">
                    <div className="text-[0.65rem] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-1">
                        {t('productionPackage.approvedArtifactHash')}
                    </div>
                    <p className="text-[0.7rem] text-[var(--text-secondary)] font-mono break-all">
                        {productionPackageGovernance.approved_artifact_hash}
                    </p>
                </div>
            )}

            {audience === 'operator' && Array.isArray(productionPackageGovernance.warnings) && productionPackageGovernance.warnings.length > 0 && (
                <div className="border-t border-current/10 pt-3">
                    <div className="text-[0.65rem] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-1">
                        {t('visualDiff.operatorWarnings')}
                    </div>
                    <ul className="space-y-1">
                        {productionPackageGovernance.warnings.map((w, i) => (
                            <li key={i} className="text-[0.7rem] text-[var(--text-secondary)] font-mono">— {w}</li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};
