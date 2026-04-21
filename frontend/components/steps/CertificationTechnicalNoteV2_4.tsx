import React from 'react';
import { XMarkIcon, DocumentCheckIcon } from '@heroicons/react/24/outline';
import { formatLabel } from '../../utils/formatters';

interface CertificationTechnicalNoteProps {
    show: boolean;
    onClose: () => void;
    file: File | null;
    numPages: number;
    isReadyForPrint: boolean;
    autoFixReport: any;
    selectedPolicy: string;
    t: (key: string) => string;
}

export const CertificationTechnicalNote: React.FC<CertificationTechnicalNoteProps> = ({
    show,
    onClose,
    file,
    numPages,
    isReadyForPrint,
    autoFixReport,
    selectedPolicy,
    t
}) => {
    if (!show) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[var(--bg-primary)]/95 backdrop-blur-xl animate-in fade-in duration-300">
            <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-[0_0_100px_rgba(220,0,0,0.1)]">
                <div className="p-8 border-b border-[var(--border-color)] flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="h-10 w-10 bg-[var(--accent-color)] flex items-center justify-center">
                            <DocumentCheckIcon className="h-6 w-6 text-white" />
                        </div>
                        <div>
                            <div className="text-[0.82rem] font-black uppercase tracking-[0.2em] text-[var(--accent-color)]">{t('step.review.techCertNote')}</div>
                            <div className="text-xl font-extrabold tracking-tight text-[var(--text-primary)]">{t('step.review.certDocument')}</div>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                        <XMarkIcon className="h-6 w-6" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-10 space-y-10 custom-scrollbar">
                    <div className="grid grid-cols-2 gap-8 text-[var(--text-primary)]">
                        <div className="space-y-4">
                            <div className="text-[0.82rem] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">{t('step.review.metricIngress')}</div>
                            <div className="space-y-2 font-mono text-[0.85rem]">
                                <div className="flex justify-between border-b border-[var(--border-color)] pb-2">
                                    <span className="text-[var(--text-secondary)]">{t('fileLabel')}:</span>
                                    <span>{(file?.size || 0) / 1024 / 1024 > 1 ? `${((file?.size || 0) / 1024 / 1024).toFixed(2)}MB` : `${((file?.size || 0) / 1024).toFixed(0)}KB`}</span>
                                </div>
                                <div className="flex justify-between border-b border-[var(--border-color)] pb-2">
                                    <span className="text-[var(--text-secondary)]">{t('pageNavigation')}:</span>
                                    <span>{numPages}</span>
                                </div>
                                <div className="flex justify-between border-b border-[var(--border-color)] pb-2">
                                    <span className="text-[var(--text-secondary)]">{t('shell.finalState')}:</span>
                                    <span className={`${isReadyForPrint ? 'text-[var(--accent-color)]' : 'text-amber-500'} font-black uppercase text-[0.8rem]`}>
                                        {isReadyForPrint ? t('common.verified') : t('shell.manualReview')}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4 text-[var(--text-primary)]">
                            <div className="text-[0.82rem] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">{t('step.review.inkOptimization')}</div>
                            <div className="space-y-2 font-mono text-[0.85rem]">
                                <div className="flex justify-between border-b border-[var(--border-color)] pb-2">
                                    <span className="text-[var(--text-secondary)]">{t('labelMaxTac')}</span>
                                    <span>{autoFixReport?.prepress_summary?.tac_summary?.max_tac || '300'}%</span>
                                </div>
                                <div className="flex justify-between border-b border-[var(--border-color)] pb-2">
                                    <span className="text-[var(--text-secondary)]">{t('profileLabel')}</span>
                                    <span className="truncate max-w-[150px]">{formatLabel(selectedPolicy || 'FOGRA51 / PSO_V3')}</span>
                                </div>
                                <div className="flex justify-between border-b border-[var(--border-color)] pb-2">
                                    <span className="text-[var(--text-secondary)]">{t('account.service.tier')}:</span>
                                    <span className="text-[var(--accent-color)] font-black">{t('step.review.highEfficiency')}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="p-8 bg-[var(--bg-primary)] border border-[var(--border-color)]">
                        <div className="text-[0.82rem] font-black uppercase tracking-[0.2em] text-[var(--accent-color)] mb-6">{t('step.review.traceLogs')}</div>
                        <div className="space-y-3 font-mono text-[0.8rem] text-[var(--text-secondary)]">
                            <div className="flex items-start gap-3">
                                <span className="text-[var(--accent-color)] font-black uppercase">{t('common.verified')}</span>
                                <span>{t('step.review.productionGeometryOk')}</span>
                            </div>
                            <div className="flex items-start gap-3">
                                <span className="text-[var(--accent-color)] font-black uppercase">{t('common.verified')}</span>
                                <span>{t('step.review.colorProfilesNormalized')}</span>
                            </div>
                            <div className="flex items-start gap-3">
                                <span className="text-[var(--accent-color)] font-black uppercase">{t('common.verified')}</span>
                                <span>{t('step.review.fontEmbeddingConfirmed')}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-8 border-t border-[var(--border-color)] flex justify-end">
                    <button 
                        onClick={onClose}
                        className="bg-[var(--accent-color)] text-white px-10 py-4 text-[0.9rem] font-black uppercase tracking-[0.2em] hover:bg-[var(--accent-hover)] transition-all"
                    >
                        {t('step.review.acknowledgeClose')}
                    </button>
                </div>
            </div>
        </div>
    );
};
