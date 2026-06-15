import React, { useState } from 'react';
import { useTranslation } from '../../i18n';
import {
    ArrowDownTrayIcon,
    ArrowPathIcon,
    ShieldCheckIcon,
    DocumentCheckIcon,
    SparklesIcon,
    ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import { PPOSLogo } from '../../design/preflight_starter_pack';
import { ClientChangeReportDrawer } from '../reports/ClientChangeReportDrawer';
import type { ArtifactTrust, ArtifactUxContract, ReviewDecisionUx, RemediationUx, HeavyPdfProbeGovernance, SecurityInteractivityGovernance, VisualDiffGovernance, ProofApprovalGovernance, ProductionPackageGovernance, PolicyProfileGovernance, MachineReadinessGovernance, AuditBundleGovernance, RecommendationGovernance } from '../../types';
import { getArtifactUxForArtifact, getArtifactFilename } from '../../utils/artifactUx';
import { ReviewDecisionPanel } from '../review/ReviewDecisionPanel';
import { CustomerRemediationPanel } from '../remediation/CustomerRemediationPanel';
import { HeavyPdfProbePanel } from '../reports/HeavyPdfProbePanel';
import { SecurityInteractivityPanel } from '../security/SecurityInteractivityPanel';
import { VisualProofPanel } from '../proof/VisualProofPanel';
import { ProofApprovalPanel } from '../proof/ProofApprovalPanel';
import { ProductionPackagePanel } from '../handoff/ProductionPackagePanel';
import { PolicyProfilePanel } from '../policy/PolicyProfilePanel';
import { MachineReadinessPanel } from '../machine/MachineReadinessPanel';
import { AuditBundlePanel } from '../audit/AuditBundlePanel';
import { RecommendationPanel } from '../recommendation/RecommendationPanel';

interface Step5DownloadV2_4Props {
    lastPdfUrl: string | null;
    lastPdfName: string | null;
    file: File | null;
    result: any;
    autoFixReport: any;
    onDownload: () => void;
    onDownloadReport: () => void;
    onStartOver: () => void;
}

export const Step5DownloadV2_4: React.FC<Step5DownloadV2_4Props> = ({
    lastPdfUrl,
    lastPdfName,
    file,
    result,
    autoFixReport,
    onDownload,
    onDownloadReport,
    onStartOver
}) => {
    const { t } = useTranslation();
    const [clientReportOpen, setClientReportOpen] = useState(false);

    // Extract artifact_trust and artifact_ux from result (BFF passthrough from OS)
    const artifactTrust: ArtifactTrust | null = (result as any)?.artifact_trust ?? null;
    const artifactUxContract: ArtifactUxContract | null = (result as any)?.artifact_ux ?? null;
    const artifactKey: string | null = (result as any)?.meta?.primary_artifact_type ?? null;

    // APP-65: proof_approval_governance — a required customer proof that has not
    // yet been approved must block the final production download and labeling.
    const visualDiffGovernance: VisualDiffGovernance | null = (result as any)?.visual_diff_governance ?? null;
    const proofApprovalGovernance: ProofApprovalGovernance | null = (result as any)?.proof_approval_governance ?? null;
    const proofRequiresApproval =
        proofApprovalGovernance?.proof_required === true && proofApprovalGovernance?.proof_status !== 'PROOF_APPROVED';

    // Mirrors the heavy-PDF-probe / security-interactivity pattern: rather than
    // mutating artifact_trust, derive an "effective" trust contract that also
    // reflects the pending-proof-approval state for UX/labeling purposes.
    const effectiveArtifactTrust: ArtifactTrust | null = artifactTrust && proofRequiresApproval
        ? { ...artifactTrust, review_required: true }
        : artifactTrust;

    const ux = getArtifactUxForArtifact(
        artifactKey ? { key: artifactKey } : null,
        artifactUxContract,
        effectiveArtifactTrust,
        'customer'
    );

    const reviewRequired = artifactTrust?.review_required === true;
    const certifiedAllowed = artifactTrust?.certified_pdf_allowed !== false;

    // APP-62: review_decision_ux and remediation_ux gate the production download.
    const reviewDecisionUx: ReviewDecisionUx | null = (result as any)?.review_decision_ux ?? null;
    const remediationUx: RemediationUx | null = (result as any)?.remediation_ux ?? null;

    // APP-62F: heavy_pdf_probe_governance — explains heavy-PDF probe warnings.
    const heavyPdfProbeGovernance: HeavyPdfProbeGovernance | null = (result as any)?.heavy_pdf_probe_governance ?? null;
    const heavyPdfFatal = heavyPdfProbeGovernance?.fatal_document_failure === true;
    const heavyPdfReviewRequired = heavyPdfProbeGovernance?.review_required === true;

    // APP-63: security_interactivity_governance — active content removal never implies
    // print-readiness, and unresolved interactive content requires review.
    const securityInteractivityGovernance: SecurityInteractivityGovernance | null = (result as any)?.security_interactivity_governance ?? null;
    const securityReviewRequired = securityInteractivityGovernance?.review_required === true;

    // APP-66: production_package_governance — printhouse handoff / production
    // package readiness. Distinct from the customer download above: this
    // describes whether the *production package* (approved artifact + reports)
    // is ready for delivery to a printhouse, not whether the customer can
    // retrieve their corrected/review file.
    const productionPackageGovernance: ProductionPackageGovernance | null = (result as any)?.production_package_governance ?? null;

    // APP-67: policy profile / machine matching / audit bundle / fix recommendations (Phases 72-75).
    const policyProfileGovernance: PolicyProfileGovernance | null = (result as any)?.policy_profile_governance ?? null;
    const machineReadinessGovernance: MachineReadinessGovernance | null = (result as any)?.machine_readiness_governance ?? null;
    const auditBundleGovernance: AuditBundleGovernance | null = (result as any)?.audit_bundle_governance ?? null;
    const recommendationGovernance: RecommendationGovernance | null = (result as any)?.recommendation_governance ?? null;

    const remediationRequiresReupload =
        remediationUx !== null &&
        (remediationUx.requires_reupload === true ||
            remediationUx.remediation_state === 'REUPLOAD_REQUIRED' ||
            remediationUx.remediation_state === 'WAITING_FOR_UPLOAD' ||
            remediationUx.remediation_state === 'PREFLIGHT_REQUIRED');

    const reviewDecisionBlocksDownload =
        reviewDecisionUx !== null &&
        (reviewDecisionUx.allows_progression === false ||
            reviewDecisionUx.decision === 'REJECTED_REQUIRES_REUPLOAD' ||
            reviewDecisionUx.decision === 'REQUEST_CUSTOMER_REUPLOAD');

    // APP-62F: a fatal heavy-PDF probe failure requires remediation/reupload — hide the
    // production download just like other fatal/reupload-required states.
    // APP-65: a required customer proof that has not been approved must also hide
    // the final production download — only the review/proof artifact is shown.
    const productionDownloadBlocked = remediationRequiresReupload || reviewDecisionBlocksDownload || heavyPdfFatal || proofRequiresApproval;

    const baseName = lastPdfName || file?.name || 'document.pdf';
    const downloadFilename = getArtifactFilename(baseName, artifactKey, effectiveArtifactTrust);

    return (
        <div className="max-w-4xl mx-auto space-y-12 animate-in fade-in zoom-in-95 duration-1000 py-12">
            <div className="flex flex-col items-center text-center space-y-6">
                <div className="relative">
                    <div className="absolute inset-0 bg-[var(--accent-color)] blur-3xl opacity-20 animate-pulse"></div>
                    <PPOSLogo className="w-24 h-24 border border-[var(--border-color)] p-5 bg-[var(--bg-secondary)] relative z-10" />
                </div>

                <div className="space-y-3">
                    <h2 className="text-4xl font-black tracking-tight text-[var(--text-primary)]">
                        {t('step.download.successTitle')}
                    </h2>
                    <p className="text-[var(--text-secondary)] text-lg max-w-lg mx-auto">
                        {t('step.download.successDesc')}
                    </p>
                </div>
            </div>

            {/* Governance warning: review required */}
            {reviewRequired && !reviewDecisionUx && (
                <div className="p-4 border border-amber-500/30 bg-amber-500/10 flex items-start gap-3">
                    <ExclamationTriangleIcon className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
                    <p className="text-[0.8rem] text-amber-500 font-bold uppercase tracking-widest">
                        {t('artifact.reviewRequired')} — {t('artifact.reviewFile').toLowerCase()}
                    </p>
                </div>
            )}

            {/* APP-62: review_decision_ux — shows operator decision state */}
            {reviewDecisionUx && (
                <ReviewDecisionPanel reviewDecisionUx={reviewDecisionUx} audience="customer" />
            )}

            {/* APP-62: remediation_ux — shows customer remediation instructions */}
            {remediationUx && (
                <CustomerRemediationPanel remediationUx={remediationUx} audience="customer" />
            )}

            {/* APP-62F: heavy_pdf_probe_governance — explains heavy-PDF probe warnings */}
            {heavyPdfProbeGovernance && (
                <HeavyPdfProbePanel governance={heavyPdfProbeGovernance} audience="customer" />
            )}

            {/* APP-63: security_interactivity_governance — security/interactive content cleanup */}
            {securityInteractivityGovernance && (
                <SecurityInteractivityPanel governance={securityInteractivityGovernance} audience="customer" />
            )}

            {/* APP-65: visual proof / customer approval (Phases 69-70) */}
            {(visualDiffGovernance || proofApprovalGovernance) && (
                <VisualProofPanel
                    visualDiffGovernance={visualDiffGovernance}
                    proofApprovalGovernance={proofApprovalGovernance}
                    audience="customer"
                />
            )}
            {proofApprovalGovernance && (
                <ProofApprovalPanel proofApprovalGovernance={proofApprovalGovernance} audience="customer" />
            )}

            {/* APP-66: printhouse handoff / production package readiness (Phase 71) */}
            {productionPackageGovernance && (
                <ProductionPackagePanel productionPackageGovernance={productionPackageGovernance} audience="customer" />
            )}

            {/* APP-67: policy profile / machine matching / audit bundle / fix recommendations (Phases 72-75) */}
            {policyProfileGovernance && (
                <PolicyProfilePanel policyProfileGovernance={policyProfileGovernance} audience="customer" />
            )}
            {machineReadinessGovernance && (
                <MachineReadinessPanel machineReadinessGovernance={machineReadinessGovernance} audience="customer" />
            )}
            {auditBundleGovernance && (
                <AuditBundlePanel auditBundleGovernance={auditBundleGovernance} audience="customer" />
            )}
            {recommendationGovernance && (
                <RecommendationPanel recommendationGovernance={recommendationGovernance} audience="customer" />
            )}

            {/* APP-62: reupload required — hide the production download card */}
            {productionDownloadBlocked && (
                <div className="p-4 border border-red-500/30 bg-red-500/10 flex items-start gap-3">
                    <ExclamationTriangleIcon className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
                    <p className="text-[0.8rem] text-red-500 font-bold uppercase tracking-widest">
                        {proofRequiresApproval && !remediationRequiresReupload && !reviewDecisionBlocksDownload && !heavyPdfFatal
                            ? t('proof.download.blocked')
                            : t('remediation.download.blocked')}
                    </p>
                </div>
            )}

            <div className="grid md:grid-cols-2 gap-8 items-stretch">
                {/* Download Card — hidden when remediation blocks production download */}
                {!productionDownloadBlocked && <div className="border border-[var(--border-color)] bg-[var(--bg-secondary)] p-10 flex flex-col items-center text-center space-y-8 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                        <ArrowDownTrayIcon className="w-32 h-32" />
                    </div>

                    <div className="h-16 w-16 bg-[var(--accent-color)]/10 flex items-center justify-center rounded-full border border-[var(--accent-color)]/20">
                        <ShieldCheckIcon className="h-8 w-8 text-[var(--accent-color)]" />
                    </div>

                    <div className="space-y-4 relative z-10 w-full">
                        <div className="text-[0.7rem] font-black uppercase tracking-[0.25em] text-[var(--accent-color)]">{t('step.download.readyForRetrival')}</div>
                        <h3 className="text-xl font-bold text-[var(--text-primary)] truncate px-4">
                            {downloadFilename}
                        </h3>
                        <div className="text-[0.8rem] font-mono text-[var(--text-muted)] uppercase tracking-widest">
                            {ux.status_badge}
                        </div>
                    </div>

                    <button
                        onClick={onDownload}
                        className="w-full h-16 bg-[var(--accent-color)] hover:bg-[var(--accent-hover)] text-white text-[0.9rem] font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-4 shadow-[0_15px_40px_rgba(220,0,0,0.25)] relative z-10 group"
                    >
                        <span>{ux.button_label}</span>
                        <ArrowDownTrayIcon className="h-5 w-5 group-hover:translate-y-1 transition-transform" />
                    </button>

                    <div className="pt-4 flex flex-col items-center gap-4 w-full">
                        <button
                            onClick={onDownloadReport}
                            className="text-[0.65rem] font-black uppercase tracking-[0.2em] text-[var(--accent-color)] hover:underline opacity-60 hover:opacity-100 transition-all"
                        >
                            {t('step.download.exportJson')}
                        </button>
                        <button
                            onClick={() => setClientReportOpen(true)}
                            className="text-[0.65rem] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:underline opacity-80 hover:opacity-100 transition-all"
                        >
                            {t('clientReport.button' as any)}
                        </button>
                        <div className="flex items-center gap-2 text-[var(--text-muted)] text-[0.7rem] font-medium uppercase tracking-widest">
                           <DocumentCheckIcon className="h-4 w-4" />
                           {/* APP-62F/APP-63/APP-65: never claim standards validation while heavy-PDF probe,
                               security/interactive content review, or customer proof approval is pending */}
                           {certifiedAllowed && artifactTrust?.standard_certified && !heavyPdfReviewRequired && !securityReviewRequired && !proofRequiresApproval
                               ? <span>{t('artifact.standardsValidatedFile').toUpperCase()}</span>
                               : <span>{t('step.review.certDocument').toUpperCase()}</span>
                           }
                        </div>
                    </div>
                </div>}

                {/* Feedback / Next Step Card */}
                <div className="border border-[var(--border-color)] bg-[var(--bg-primary)] p-10 flex flex-col items-center text-center justify-between space-y-8">
                    <div className="space-y-6">
                        <div className="h-16 w-16 bg-[var(--text-muted)]/10 flex items-center justify-center rounded-full border border-[var(--border-color)]">
                            <SparklesIcon className="h-8 w-8 text-[var(--text-secondary)]" />
                        </div>
                        <div className="space-y-2">
                           <h3 className="text-lg font-bold text-[var(--text-primary)]">{t('step.download.anyOtherTaskTitle')}</h3>
                           <p className="text-[0.85rem] text-[var(--text-secondary)] leading-relaxed">
                             {t('step.download.anyOtherTaskDesc')}
                           </p>
                        </div>
                    </div>

                    <button
                        onClick={onStartOver}
                        className="w-full h-16 border border-[var(--border-color)] hover:border-[var(--accent-color)]/40 hover:bg-[var(--accent-color)]/5 text-[var(--text-secondary)] text-[0.85rem] font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3"
                    >
                        <ArrowPathIcon className="h-4 w-4" />
                        {t('startOver')}
                    </button>
                </div>
            </div>

            {/* High Tech Indicator */}
            <div className="pt-12 flex flex-col items-center space-y-4">
                <div className="h-px w-32 bg-gradient-to-r from-transparent via-[var(--border-color)] to-transparent"></div>
                <div className="flex items-center gap-8 text-[var(--text-muted)] opacity-30">
                    <span className="text-[0.6rem] font-mono tracking-widest uppercase">{t('PPOS-VERIFIED-NODE-OK' as any)}</span>
                    <span className="text-[0.6rem] font-mono tracking-widest uppercase">{t('TRACE-SHA256-SIGN' as any)}</span>
                </div>
            </div>

            <ClientChangeReportDrawer
                open={clientReportOpen}
                onClose={() => setClientReportOpen(false)}
                report={autoFixReport}
                result={result}
            />
        </div>
    );
};
