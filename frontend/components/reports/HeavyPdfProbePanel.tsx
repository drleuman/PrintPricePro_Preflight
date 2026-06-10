import React from 'react';
import {
    DocumentMagnifyingGlassIcon,
    ExclamationTriangleIcon,
    ShieldExclamationIcon,
} from '@heroicons/react/24/outline';
import type { HeavyPdfProbeGovernance } from '../../types';
import { useTranslation } from '../../i18n';

interface HeavyPdfProbePanelProps {
    governance: HeavyPdfProbeGovernance;
    audience?: 'customer' | 'operator';
}

function formatFileSize(governance: HeavyPdfProbeGovernance): string | null {
    if (typeof governance.file_size_mb === 'number') {
        return `${governance.file_size_mb.toFixed(1)} MB`;
    }
    if (typeof governance.file_size_bytes === 'number') {
        return `${(governance.file_size_bytes / (1024 * 1024)).toFixed(1)} MB`;
    }
    return null;
}

export const HeavyPdfProbePanel: React.FC<HeavyPdfProbePanelProps> = ({
    governance,
    audience = 'customer',
}) => {
    const { t } = useTranslation();

    const fatal = governance.fatal_document_failure === true;
    const degradedButUsable = governance.degraded_but_usable === true;
    const reviewRequired = governance.review_required === true;

    const colorClass = fatal ? 'text-red-500' : 'text-amber-500';
    const borderClass = fatal ? 'border-red-500/30' : 'border-amber-500/30';
    const bgClass = fatal ? 'bg-red-500/10' : 'bg-amber-500/10';

    const fileSize = formatFileSize(governance);

    // Customer-safe wording — never raw transcripts, paths, object IDs, or
    // production/standards/print-ready overclaims.
    const customerMessages: string[] = [t('heavyPdfProbe.customerSummary')];
    if (!governance.production_certified) {
        customerMessages.push(t('heavyPdfProbe.customerNotApproved'));
    }
    if (reviewRequired) {
        customerMessages.push(t('heavyPdfProbe.customerReviewRequired'));
    }
    if (fatal) {
        customerMessages.push(t('heavyPdfProbe.customerFatal'));
    } else {
        customerMessages.push(t('heavyPdfProbe.customerReExport'));
    }

    const tools = governance.tools && typeof governance.tools === 'object' ? governance.tools : {};
    const toolEntries = Object.entries(tools);

    return (
        <div className={`p-4 border ${borderClass} ${bgClass} flex flex-col gap-3`}>
            <div className="flex items-center gap-2">
                {fatal ? (
                    <ShieldExclamationIcon className={`w-5 h-5 ${colorClass}`} />
                ) : (
                    <DocumentMagnifyingGlassIcon className={`w-5 h-5 ${colorClass}`} />
                )}
                <span className={`text-[0.7rem] font-black uppercase tracking-widest ${colorClass}`}>
                    {t('heavyPdfProbe.panelTitle')}
                </span>
            </div>

            {/* Badges */}
            <div className="flex flex-wrap gap-2">
                {governance.heavy_pdf_detected && (
                    <span className="text-[0.55rem] font-mono uppercase tracking-widest px-2 py-0.5 border border-current/30 text-[var(--text-secondary)]">
                        {t('heavyPdfProbe.badge.heavyPdf')}
                    </span>
                )}
                {(governance.analysis_degraded || degradedButUsable) && !fatal && (
                    <span className="text-[0.55rem] font-mono uppercase tracking-widest px-2 py-0.5 border border-amber-500/30 text-amber-500">
                        {t('heavyPdfProbe.badge.analysisWarnings')}
                    </span>
                )}
                {reviewRequired && (
                    <span className="text-[0.55rem] font-mono uppercase tracking-widest px-2 py-0.5 border border-amber-500/30 text-amber-500">
                        {t('heavyPdfProbe.badge.reviewRequired')}
                    </span>
                )}
                {fatal && (
                    <span className="text-[0.55rem] font-mono uppercase tracking-widest px-2 py-0.5 border border-red-500/30 text-red-500">
                        {t('heavyPdfProbe.badge.technicalReviewRequired')}
                    </span>
                )}
            </div>

            {/* File facts */}
            {(fileSize || governance.page_count) && (
                <div className="flex gap-6 text-[0.7rem] text-[var(--text-secondary)]">
                    {fileSize && (
                        <div>
                            <span className="font-bold uppercase tracking-widest text-[var(--text-muted)]">{t('heavyPdfProbe.fileSize')}: </span>
                            {fileSize}
                        </div>
                    )}
                    {typeof governance.page_count === 'number' && (
                        <div>
                            <span className="font-bold uppercase tracking-widest text-[var(--text-muted)]">{t('heavyPdfProbe.pageCount')}: </span>
                            {governance.page_count}
                        </div>
                    )}
                </div>
            )}

            {/* Customer-safe messaging */}
            <div className="space-y-1">
                {customerMessages.map((msg, i) => (
                    <p key={i} className="text-[0.75rem] text-[var(--text-secondary)] leading-relaxed">
                        {msg}
                    </p>
                ))}
            </div>

            {/* Operator detail: per-tool semantic statuses and warning classes */}
            {audience === 'operator' && (
                <div className="border-t border-current/10 pt-3 space-y-3">
                    {(degradedButUsable || fatal) && (
                        <div className="flex items-start gap-2">
                            <ExclamationTriangleIcon className={`w-4 h-4 mt-0.5 shrink-0 ${colorClass}`} />
                            <p className="text-[0.7rem] text-[var(--text-secondary)] leading-relaxed">
                                {fatal
                                    ? t('heavyPdfProbe.operator.fatalDocumentFailure')
                                    : t('heavyPdfProbe.operator.degradedButUsable')}
                            </p>
                        </div>
                    )}
                    {toolEntries.length > 0 && (
                        <div>
                            <div className="text-[0.65rem] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-2">
                                {t('heavyPdfProbe.operator.toolStatus')}
                            </div>
                            <ul className="space-y-2">
                                {toolEntries.map(([tool, status]) => (
                                    <li key={tool} className="text-[0.7rem] text-[var(--text-secondary)]">
                                        <div className="font-mono font-bold">{tool}</div>
                                        <div className="ml-2 space-y-0.5">
                                            <div>
                                                {t('heavyPdfProbe.operator.semanticStatus')}: <span className="font-mono">{status?.semantic_status || 'UNKNOWN'}</span>
                                            </div>
                                            <div>
                                                {t('heavyPdfProbe.operator.usableOutput')}: <span className="font-mono">{String(status?.usable_output ?? 'unknown')}</span>
                                            </div>
                                            {Array.isArray(status?.warning_classes) && status.warning_classes.length > 0 && (
                                                <div>
                                                    {t('heavyPdfProbe.operator.warningClasses')}: <span className="font-mono">{status.warning_classes.join(', ')}</span>
                                                </div>
                                            )}
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                    {Array.isArray(governance.warnings) && governance.warnings.length > 0 && (
                        <ul className="space-y-1">
                            {governance.warnings.map((w, i) => (
                                <li key={i} className="text-[0.7rem] text-[var(--text-secondary)] font-mono">— {w}</li>
                            ))}
                        </ul>
                    )}
                </div>
            )}
        </div>
    );
};
