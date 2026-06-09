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
import type { ArtifactTrust, ArtifactUxContract } from '../../types';
import { getArtifactUxForArtifact, getArtifactFilename } from '../../utils/artifactUx';

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

    const ux = getArtifactUxForArtifact(
        artifactKey ? { key: artifactKey } : null,
        artifactUxContract,
        artifactTrust,
        'customer'
    );

    const reviewRequired = artifactTrust?.review_required === true;
    const certifiedAllowed = artifactTrust?.certified_pdf_allowed !== false;

    const baseName = lastPdfName || file?.name || 'document.pdf';
    const downloadFilename = getArtifactFilename(baseName, artifactKey, artifactTrust);

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
            {reviewRequired && (
                <div className="p-4 border border-amber-500/30 bg-amber-500/10 flex items-start gap-3">
                    <ExclamationTriangleIcon className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
                    <p className="text-[0.8rem] text-amber-500 font-bold uppercase tracking-widest">
                        {t('artifact.reviewRequired')} — {t('artifact.reviewFile').toLowerCase()}
                    </p>
                </div>
            )}

            <div className="grid md:grid-cols-2 gap-8 items-stretch">
                {/* Download Card */}
                <div className="border border-[var(--border-color)] bg-[var(--bg-secondary)] p-10 flex flex-col items-center text-center space-y-8 relative overflow-hidden group">
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
                           {certifiedAllowed && artifactTrust?.standard_certified
                               ? <span>{t('artifact.standardsValidatedFile').toUpperCase()}</span>
                               : <span>{t('step.review.certDocument').toUpperCase()}</span>
                           }
                        </div>
                    </div>
                </div>

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
