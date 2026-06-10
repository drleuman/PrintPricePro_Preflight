import React from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon, DocumentCheckIcon, ShieldExclamationIcon, ClipboardDocumentIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { generateClientChangeReport } from '../../utils/clientChangeReport';
import { useTranslation } from '../../i18n';
import { HeavyPdfProbePanel } from './HeavyPdfProbePanel';
import { SecurityInteractivityPanel } from '../security/SecurityInteractivityPanel';
import {
  InkGovernancePanel,
  ImageGovernancePanel,
  FontGovernancePanel,
  TransparencyOverprintPanel,
  VisualDiffPanel,
} from '../visual/VisualGovernancePanels';
import { VisualProofPanel } from '../proof/VisualProofPanel';
import { ProofApprovalPanel } from '../proof/ProofApprovalPanel';
import type {
  HeavyPdfProbeGovernance,
  SecurityInteractivityGovernance,
  InkGovernance,
  SelectiveImageGovernance,
  FontGovernance,
  TransparencyOverprintPhysicalGovernance,
  VisualDiffGovernance,
  ProofApprovalGovernance,
} from '../../types';

interface ClientChangeReportDrawerProps {
  open: boolean;
  onClose: () => void;
  report: any;
  result: any;
}

export const ClientChangeReportDrawer: React.FC<ClientChangeReportDrawerProps> = ({ open, onClose, report, result }) => {
  const { t } = useTranslation();
  // Generate the report using the combined data (use result if report is minimal)
  const reportData = generateClientChangeReport(result || report || {});

  // APP-61: surface governance warnings from artifact_trust
  const artifactTrust = (result as any)?.artifact_trust ?? (report as any)?.artifact_trust ?? null;
  const governanceWarnings: string[] = Array.isArray(artifactTrust?.warnings) ? artifactTrust.warnings : [];
  const reviewRequired = artifactTrust?.review_required === true;
  const certifiedNotAllowed = artifactTrust?.certified_pdf_allowed === false;

  // APP-62F: heavy_pdf_probe_governance — explains heavy-PDF probe warnings.
  const heavyPdfProbeGovernance: HeavyPdfProbeGovernance | null =
    (result as any)?.heavy_pdf_probe_governance ?? (report as any)?.heavy_pdf_probe_governance ?? null;

  // APP-63: security_interactivity_governance — JS/launch actions/embedded files/forms/annotations.
  const securityInteractivityGovernance: SecurityInteractivityGovernance | null =
    (result as any)?.security_interactivity_governance ?? (report as any)?.security_interactivity_governance ?? null;

  // APP-64: ink/image/font/transparency-overprint/visual-diff governance (Phases 64-69).
  const inkGovernance: InkGovernance | null =
    (result as any)?.ink_governance ?? (report as any)?.ink_governance ?? null;
  const selectiveImageGovernance: SelectiveImageGovernance | null =
    (result as any)?.selective_image_governance ?? (report as any)?.selective_image_governance ?? null;
  const fontGovernance: FontGovernance | null =
    (result as any)?.font_governance ?? (report as any)?.font_governance ?? null;
  const transparencyOverprintGovernance: TransparencyOverprintPhysicalGovernance | null =
    (result as any)?.transparency_overprint_physical_governance ?? (report as any)?.transparency_overprint_physical_governance ?? null;
  const visualDiffGovernance: VisualDiffGovernance | null =
    (result as any)?.visual_diff_governance ?? (report as any)?.visual_diff_governance ?? null;

  // APP-65: proof_approval_governance — visual proof / customer approval (Phases 69-70).
  const proofApprovalGovernance: ProofApprovalGovernance | null =
    (result as any)?.proof_approval_governance ?? (report as any)?.proof_approval_governance ?? null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(reportData.customerMessage);
      alert(t('clientReport.copied' as any));
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const statusBg = reportData.statusTone === 'success' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500' :
                   reportData.statusTone === 'warning' ? 'bg-amber-500/10 border-amber-500/30 text-amber-500' :
                   'bg-[var(--bg-secondary)] border-[var(--border-color)] text-[var(--text-secondary)]';

  return (
    <Transition.Root show={open} as={React.Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={React.Fragment}
          enter="ease-in-out duration-500"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in-out duration-500"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-hidden">
          <div className="absolute inset-0 overflow-hidden">
            <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10 sm:pl-16">
              <Transition.Child
                as={React.Fragment}
                enter="transform transition ease-in-out duration-500 sm:duration-700"
                enterFrom="translate-x-full"
                enterTo="translate-x-0"
                leave="transform transition ease-in-out duration-500 sm:duration-700"
                leaveFrom="translate-x-0"
                leaveTo="translate-x-full"
              >
                <Dialog.Panel className="pointer-events-auto w-screen max-w-md">
                  <div className="flex h-full flex-col overflow-y-scroll bg-[var(--bg-primary)] border-l border-[var(--border-color)] shadow-xl">
                    
                    <div className="px-4 py-6 sm:px-6 bg-[var(--bg-secondary)] border-b border-[var(--border-color)] flex items-start justify-between">
                      <div>
                        <Dialog.Title className="text-base font-black uppercase tracking-[0.2em] text-[var(--text-primary)]">
                          {t('clientReport.drawerTitle' as any)}
                        </Dialog.Title>
                        <p className="mt-1 text-[0.75rem] text-[var(--text-muted)] tracking-wider">
                          {t('clientReport.drawerSubtitle' as any)}
                        </p>
                      </div>
                      <div className="ml-3 flex h-7 items-center">
                        <button
                          type="button"
                          className="rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] focus:outline-none"
                          onClick={onClose}
                        >
                          <span className="sr-only">{t('clientReport.close' as any)}</span>
                          <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                        </button>
                      </div>
                    </div>

                    <div className="relative flex-1 px-4 py-6 sm:px-6 space-y-8">
                      {/* 1. Status Section */}
                      <div className="space-y-4">
                        <div className={`p-4 border flex gap-3 ${statusBg}`}>
                          {reportData.statusTone === 'success' ? (
                            <DocumentCheckIcon className="h-6 w-6 shrink-0" />
                          ) : (
                            <ShieldExclamationIcon className="h-6 w-6 shrink-0" />
                          )}
                          <div>
                            <h3 className="text-[0.8rem] font-bold uppercase tracking-widest">{reportData.statusLabel}</h3>
                            <p className="mt-1 text-[0.75rem] leading-relaxed opacity-90">{reportData.headline}</p>
                          </div>
                        </div>
                        <p className="text-[0.8rem] text-[var(--text-secondary)] leading-relaxed">
                          {reportData.executiveSummary}
                        </p>
                      </div>

                      {/* 2. What we fixed */}
                      {reportData.changesApplied.length > 0 && (
                        <div>
                          <h4 className="text-[0.7rem] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)] border-b border-[var(--border-color)] pb-2 mb-4">
                            {t('clientReport.whatWeFixed' as any)}
                          </h4>
                          <ul className="space-y-4">
                            {reportData.changesApplied.map((item, idx) => (
                              <li key={idx} className="bg-[var(--bg-secondary)] p-3 border border-[var(--border-color)]">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-[0.75rem] font-bold text-[var(--text-primary)]">{item.title}</span>
                                  <span className="text-[0.55rem] font-mono bg-[var(--accent-color)]/10 text-[var(--accent-color)] px-2 py-0.5 uppercase tracking-widest">{t('clientReport.applied' as any)}</span>
                                </div>
                                <p className="text-[0.75rem] text-[var(--text-muted)] mb-1">{item.plainLanguage}</p>
                                {item.impact && <p className="text-[0.7rem] text-[var(--text-secondary)] italic">{t('clientReport.impact' as any)}{item.impact}</p>}
                                <details className="mt-2 text-[0.6rem] text-[var(--text-muted)] font-mono">
                                  <summary className="cursor-pointer opacity-70 hover:opacity-100">{t('clientReport.technicalCode' as any)}</summary>
                                  <div className="mt-1 p-2 bg-black/20">{item.technicalCode}</div>
                                </details>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* 3. What we did not change automatically */}
                      {reportData.itemsSkipped.length > 0 && (
                        <div>
                          <h4 className="text-[0.7rem] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)] border-b border-[var(--border-color)] pb-2 mb-4">
                            {t('clientReport.whatWasSkipped' as any)}
                          </h4>
                          <ul className="space-y-4">
                            {reportData.itemsSkipped.map((item, idx) => (
                              <li key={idx} className="bg-[var(--bg-secondary)] p-3 border border-[var(--border-color)]">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-[0.75rem] font-bold text-[var(--text-primary)]">{item.title}</span>
                                  <span className="text-[0.55rem] font-mono bg-neutral-500/10 text-neutral-400 px-2 py-0.5 uppercase tracking-widest">{t('clientReport.skipped' as any)}</span>
                                </div>
                                <p className="text-[0.75rem] text-[var(--text-muted)] mb-1">{item.plainLanguage}</p>
                                {item.impact && <p className="text-[0.7rem] text-[var(--text-secondary)] italic">{t('clientReport.impact' as any)}{item.impact}</p>}
                                <details className="mt-2 text-[0.6rem] text-[var(--text-muted)] font-mono">
                                  <summary className="cursor-pointer opacity-70 hover:opacity-100">{t('clientReport.technicalCode' as any)}</summary>
                                  <div className="mt-1 p-2 bg-black/20">{item.technicalCode}</div>
                                </details>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* 4. What still needs review */}
                      {reportData.stillNeedsReview.length > 0 && (
                        <div>
                          <h4 className="text-[0.7rem] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)] border-b border-[var(--border-color)] pb-2 mb-4">
                            {t('clientReport.whatNeedsReview' as any)}
                          </h4>
                          <ul className="space-y-3 border-l-2 border-amber-500 pl-3">
                            {reportData.stillNeedsReview.map((item, idx) => (
                              <li key={idx}>
                                <span className="block text-[0.75rem] font-bold text-[var(--text-primary)]">{item.title}</span>
                                <span className="block text-[0.7rem] text-[var(--text-muted)]">{item.plainLanguage}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* 5. Governance warnings (APP-61) */}
                      {(reviewRequired || certifiedNotAllowed || governanceWarnings.length > 0) && (
                        <div className="p-4 border border-amber-500/30 bg-amber-500/10 space-y-2">
                          <div className="flex items-center gap-2">
                            <ExclamationTriangleIcon className="h-4 w-4 text-amber-500 shrink-0" />
                            <h4 className="text-[0.7rem] font-black uppercase tracking-[0.2em] text-amber-500">
                              {t('artifact.reviewRequired')}
                            </h4>
                          </div>
                          {reviewRequired && (
                            <p className="text-[0.75rem] text-amber-400">{t('artifact.reviewRequiredDesc')}</p>
                          )}
                          {certifiedNotAllowed && (
                            <p className="text-[0.75rem] text-amber-400">{t('artifact.certifiedNotAllowed')}</p>
                          )}
                          {governanceWarnings.map((w, i) => (
                            <p key={i} className="text-[0.7rem] text-amber-300 font-mono">{w}</p>
                          ))}
                        </div>
                      )}

                      {/* 5b. Heavy PDF probe governance (APP-62F) */}
                      {heavyPdfProbeGovernance && (
                        <HeavyPdfProbePanel governance={heavyPdfProbeGovernance} audience="customer" />
                      )}

                      {/* 5c. Security / interactive PDF content (APP-63) */}
                      {securityInteractivityGovernance && (
                        <SecurityInteractivityPanel governance={securityInteractivityGovernance} audience="customer" />
                      )}

                      {/* 5d. Ink/color, image, font, transparency-overprint, and visual-diff governance (APP-64) */}
                      {inkGovernance && (
                        <InkGovernancePanel governance={inkGovernance} audience="customer" />
                      )}
                      {selectiveImageGovernance && (
                        <ImageGovernancePanel governance={selectiveImageGovernance} audience="customer" />
                      )}
                      {fontGovernance && (
                        <FontGovernancePanel governance={fontGovernance} audience="customer" />
                      )}
                      {transparencyOverprintGovernance && (
                        <TransparencyOverprintPanel governance={transparencyOverprintGovernance} audience="customer" />
                      )}
                      {visualDiffGovernance && (
                        <VisualDiffPanel governance={visualDiffGovernance} audience="customer" />
                      )}

                      {/* 5e. Visual proof / customer approval (APP-65) */}
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

                      {/* 6. Recommended next step */}
                      <div>
                        <h4 className="text-[0.7rem] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)] border-b border-[var(--border-color)] pb-2 mb-4">
                          {t('clientReport.recommendedNextStep' as any)}
                        </h4>
                        <p className="text-[0.8rem] text-[var(--text-primary)] font-bold">
                          {reportData.productionReadiness.explanation}
                        </p>
                      </div>
                    </div>

                    {/* 6. Footer / Copy button */}
                    <div className="flex shrink-0 px-4 py-4 border-t border-[var(--border-color)] bg-[var(--bg-secondary)] gap-4">
                      <button
                        type="button"
                        className="flex-1 flex items-center justify-center gap-2 rounded-md border border-[var(--border-color)] bg-[var(--bg-primary)] px-3 py-2 text-[0.7rem] font-black uppercase tracking-widest text-[var(--text-primary)] shadow-sm hover:bg-[var(--hover-bg)] focus:outline-none"
                        onClick={handleCopy}
                      >
                        <ClipboardDocumentIcon className="h-4 w-4" />
                        {t('clientReport.copySummary' as any)}
                      </button>
                      <button
                        type="button"
                        className="flex-1 rounded-md bg-[var(--accent-color)] px-3 py-2 text-[0.7rem] font-black uppercase tracking-widest text-white shadow-sm hover:bg-[var(--accent-hover)] focus:outline-none"
                        onClick={onClose}
                      >
                        {t('clientReport.close' as any)}
                      </button>
                    </div>

                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  );
};
