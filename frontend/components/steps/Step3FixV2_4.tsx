import React, { useState } from 'react';
import { PreflightResult, FileMeta, Issue, WorkflowAnalysis, AppMode } from '../../types';
import { StatusBadge, IssueRow } from '../../design/preflight_starter_pack';
import { PageViewer } from '../PageViewer';
import { FixDrawerV2_4 } from '../FixDrawerV2_4';
import { AIInspectorPanel } from '../AIInspectorPanel';
import { EfficiencyAuditModalV2_4 } from '../EfficiencyAuditModalV2_4';
import { useTranslation } from '../../i18n';
import { 
    ChevronLeftIcon, 
    ChevronRightIcon, 
    SparklesIcon, 
    ArrowPathIcon,
    ShieldCheckIcon,
    FireIcon,
    EyeIcon
} from '@heroicons/react/24/outline';
import { translateIssueTitle } from '../../utils/issueMapper';

interface Step3FixV2_4Props {
    file: File | null;
    fileMeta: FileMeta | null;
    result: PreflightResult | null;
    analysis: WorkflowAnalysis;
    autoFixBefore?: PreflightResult | null;
    autoFixAfter?: PreflightResult | null;
    autoFixReport?: any | null;
    autoFixRunId?: number | null;
    compareEnabled?: boolean;
    numPages: number;
    currentPage: number;
    selectedIssue: Issue | null;
    heatmapData: any;
    isHeatmapLoading: boolean;
    isRunning: boolean;
    selectedProfile: string;
    lastPdfUrl?: string | null;
    onPageChange: (page: number) => void;
    onNumPagesChange: (num: number) => void;
    onSelectIssue: (issue: Issue | null) => void;
    onRunAnalysis: () => void;
    onRunHeatmap: () => void;
    onRunVisualCheck: () => void;
    onFixBleed: (mode: 'safe' | 'aggressive') => void;
    onConvertGrayscale: () => void;
    onConvertCMYK: () => void;
    onRebuildPdf: () => void;
    onAutoFix: (options: any) => void;
    onToggleCompare?: (enabled: boolean) => void;
    onProfileChange: (profile: string) => void;
    onOpenAIAudit: (issue: Issue) => void;
    onOpenEfficiency: (issue: Issue) => void;
    onNext: () => void;
    onBack: () => void;
    serverAvailable?: boolean;
    previewPages?: string[] | null;
    previewLoading?: boolean;
    ldmActive?: boolean;
    ldmProgress?: number;
    ldmStatus?: string | null;
    ldmMode?: boolean;
    ldmJobId?: string | null;
    error?: any | null;
    appMode?: AppMode;
}

export const Step3FixV2_4: React.FC<Step3FixV2_4Props> = ({
    file,
    fileMeta,
    result,
    analysis,
    autoFixBefore,
    autoFixAfter,
    autoFixReport,
    autoFixRunId,
    compareEnabled,
    numPages,
    currentPage,
    selectedIssue,
    heatmapData,
    isHeatmapLoading,
    isRunning,
    selectedProfile,
    lastPdfUrl,
    onPageChange,
    onNumPagesChange,
    onSelectIssue,
    onRunAnalysis,
    onRunHeatmap,
    onRunVisualCheck,
    onFixBleed,
    onConvertGrayscale,
    onConvertCMYK,
    onRebuildPdf,
    onAutoFix,
    onToggleCompare,
    onProfileChange,
    onOpenAIAudit,
    onOpenEfficiency,
    onNext,
    onBack,
    serverAvailable = true,
    previewPages = null,
    previewLoading = false,
    ldmActive = false,
    ldmProgress = 0,
    ldmStatus = null,
    ldmMode = false,
    ldmJobId = null,
    error = null,
    appMode = null,
}) => {
    const { t } = useTranslation();
    const [aiAuditOpen, setAiAuditOpen] = useState(false);
    const [efficiencyOpen, setEfficiencyOpen] = useState(false);
    const [issueForAudit, setIssueForAudit] = useState<Issue | null>(null);

    // Mapeo dinámico para Fix Phase (similar a Step 2 y 4)
    const getFixTechStatus = () => {
        if (!ldmActive) return null;
        if (ldmProgress < 20) return t('step.fix.terminal.enqueuing');
        if (ldmProgress < 50) return t('step.fix.terminal.radiological');
        if (ldmProgress < 80) return t('step.fix.terminal.heuristic');
        return t('step.fix.terminal.rebuilding');
    };

    const fixMessage = getFixTechStatus();

    const { errorCount, warningCount } = analysis;
    const issues = result?.issues || [];
    
    // Diagnostics for failure state visibility
    if (error) {
        console.log('[APP][AUTOFIX][FAILED-STATE]', { error });
    }

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-1000 pb-24">
            {/* Header Signal */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between border-b border-[var(--border-color)] pb-6 gap-4">
                <div>
                    <div className="ppp-phase-tag text-[var(--accent-color)] mb-1">
                        {t('step.fix.phase')}
                    </div>
                    <h2 className="text-3xl font-extrabold tracking-tight text-[var(--text-primary)]">{t('step.fix.title')}</h2>
                </div>
                <div className="flex flex-wrap gap-4">
                    <StatusBadge label={`${errorCount} ${t('errors').toUpperCase()}`} variant={errorCount > 0 ? "warning" : "certified"} />
                    <StatusBadge label={`${warningCount} ${t('warnings').toUpperCase()}`} variant="processing" />
                </div>
            </div>

            {/* AI Magic Fix Progress (LDM) */}
            {ldmActive && (
                <div className="border border-[var(--accent-color)]/30 bg-[rgba(220,0,0,0.03)] p-6 animate-border-glow">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <SparklesIcon className="h-5 w-5 text-[var(--accent-color)] animate-pulse" />
                             <span className="ppp-phase-tag text-[var(--accent-color)] !tracking-[0.4em] !text-[0.65rem]">{t('step.fix.magic')}</span>
                        </div>
                        <span className="font-mono text-xs text-[var(--text-primary)] font-bold">{ldmProgress}%</span>
                    </div>
                    <div className="h-1 bg-[var(--bg-tertiary)] w-full overflow-hidden relative">
                        <div 
                            className="h-full bg-[var(--accent-color)] transition-all duration-1000 ease-out shadow-[0_0_15px_rgba(220,0,0,0.5)]" 
                            style={{ width: `${ldmProgress}%` }} 
                        />
                        {/* Industrial Scanline */}
                        <div className="absolute top-0 bottom-0 w-32 bg-gradient-to-r from-transparent via-[var(--accent-color)]/20 to-transparent animate-scanline" />
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                        <div className="text-[0.6rem] font-mono text-[var(--text-secondary)] uppercase tracking-[0.2em]">
                           {ldmStatus || fixMessage || t('step.fix.analyzingLayers')}
                        </div>
                        <div className="text-[0.55rem] font-mono text-[var(--accent-color)] uppercase animate-pulse">
                            {t('step.fix.hwAccel')}
                        </div>
                    </div>
                </div>
            )}
            
            {/* AI Magic Fix Failure state (v2.4.125) */}
            {error && !ldmActive && (
                <div 
                    className="border border-amber-500/50 bg-amber-500/5 p-6 space-y-4 animate-in fade-in slide-in-from-top-4 duration-500"
                    id="autofix-failure-banner"
                >
                    <div className="flex items-center gap-4">
                        <div className="h-10 w-10 bg-amber-500 flex items-center justify-center shrink-0">
                            <SparklesIcon className="h-6 w-6 text-white" />
                        </div>
                        <div className="flex-1">
                            <div className="text-[0.7rem] font-black uppercase tracking-[0.2em] text-amber-500 mb-1">
                                {t('step.fix.failed')}
                            </div>
                            <h3 className="text-xl font-extrabold tracking-tight text-[var(--text-primary)]">
                                {t('step.fix.engineTerminal')}
                            </h3>
                        </div>
                        <StatusBadge label={error.code || 'ABORTED'} variant="warning" />
                    </div>
                    
                    <div className="p-4 bg-[var(--bg-primary)] border border-amber-500/20 font-mono text-[0.75rem] text-[var(--text-secondary)] leading-relaxed">
                        <div className="flex items-start gap-3">
                            <span className="text-amber-500 font-bold shrink-0">[ERR]</span>
                            <span>{error.message || t('step.fix.failureNotice')}</span>
                        </div>
                        {error.detail && (
                            <div className="mt-3 p-3 bg-black/20 border-l-2 border-amber-500/50 overflow-x-auto custom-scrollbar">
                                <div className="text-[0.65rem] opacity-70 mb-1 uppercase tracking-tighter font-bold">Technical Detail:</div>
                                <div className="whitespace-pre-wrap break-all">{error.detail}</div>
                            </div>
                        )}
                        <div className="flex items-start gap-3 mt-4 opacity-50">
                            <span className="shrink-0 font-bold">[TRACE]</span>
                            <span>{error.traceId || t('common.na')}</span>
                        </div>
                    </div>
                    
                    <p className="text-[0.65rem] font-bold text-[var(--text-muted)] uppercase tracking-widest leading-normal">
                        {t('step.fix.failureNotice')}
                    </p>
                </div>
            )}

            <div className="flex flex-col lg:flex-row gap-6 w-full">
                {/* Vertical Sidebar: Issues List */}
                <div className="flex flex-col gap-6 w-full lg:w-[380px] shrink-0">
                    <div className="border border-[var(--border-color)] bg-[var(--bg-secondary)] flex flex-col h-[550px]">
                        <div className="p-4 border-b border-[var(--border-color)] flex items-center justify-between bg-[var(--hover-bg)]">
                            <span className="text-[0.62rem] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)]">{t('step.fix.inventory')}</span>
                            <span className="text-[0.62rem] font-mono text-[var(--text-muted)]">{issues.length} {t('issues').toUpperCase()}</span>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-3 custom-scrollbar break-words">
                            {issues.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center p-10 text-center opacity-30">
                                    <ShieldCheckIcon className="h-12 w-12 mb-4 text-[var(--border-color)]" />
                                    <p className="text-xs font-bold uppercase tracking-widest text-[var(--text-primary)]">{t('step.analysis.cleanTrace')}</p>
                                </div>
                            ) : (
                                issues.map((issue: Issue, idx: number) => (
                                    <IssueRow 
                                        key={issue.id || idx}
                                        title={translateIssueTitle(issue, t)}
                                        type={(issue.category || 'GENERAL').toString().toUpperCase()}
                                        fixAvailable={issue.fixable}
                                        severity={issue.severity as any}
                                        active={selectedIssue?.id === issue.id}
                                        onClick={() => onSelectIssue(issue)}
                                    />
                                ))
                            )}
                        </div>

                        <div className="p-4 border-t border-[var(--border-color)]">
                            <button 
                                onClick={onRunAnalysis}
                                disabled={isRunning}
                                className="w-full py-3 border border-[var(--border-color)] hover:border-[var(--accent-color)]/20 transition-all text-[0.6rem] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center justify-center gap-2"
                            >
                                <ArrowPathIcon className={`h-3.5 w-3.5 ${isRunning ? 'animate-spin' : ''}`} />
                                {t('step.fix.rescan')}
                            </button>
                        </div>
                    </div>

                    {/* Quick Correction Panel */}
                    <div className="border border-[var(--border-color)] bg-[var(--bg-secondary)] p-4 space-y-4">
                        <div className="text-[0.62rem] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)]">{t('step.fix.quickFix')}</div>
                        <div className="grid grid-cols-2 gap-2">
                            <button 
                                onClick={() => {
                                    const trimBoxIssue = issues.find(i => i.repairStrategy === 'REBUILD_TRIMBOX' || i.fix_method === 'REBUILD_TRIMBOX');
                                    onAutoFix({
                                        fixIntent: appMode === 'ai' ? 'full_magic' : 'manual_with_cmyk',
                                        options: {
                                            selectedIssueCode: selectedIssue?.id,
                                            repairStrategy: selectedIssue?.repairStrategy || selectedIssue?.fix_method || null,
                                            issueCodes: issues.map(i => i.id),
                                            requestedFixes: issues
                                                .filter(i => i.fixable)
                                                .map(i => ({
                                                    id: i.id,
                                                    repairStrategy: i.repairStrategy || i.fix_method || null
                                                })),
                                            ...(trimBoxIssue ? { type: "geometry", strategy: "REBUILD_TRIMBOX" } : {})
                                        }
                                    });
                                }}
                                disabled={isRunning}
                                className={`p-3 border transition-all text-[0.55rem] font-black uppercase tracking-widest flex flex-col items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                                    appMode === 'ai' 
                                    ? 'border-[var(--accent-color)] bg-[var(--accent-color)]/10 shadow-[0_0_15px_rgba(220,0,0,0.1)]' 
                                    : 'border-[var(--border-color)] hover:border-[var(--accent-color)]/50 hover:bg-[var(--accent-color)]/5 text-[var(--text-primary)]'
                                }`}
                            >
                                <SparklesIcon className={`h-4 w-4 ${appMode === 'ai' ? 'text-[var(--accent-color)] animate-pulse' : 'text-[var(--accent-color)]'}`} />
                                {t('step.fix.aiMagicBtn')}
                            </button>
                            <button onClick={onConvertCMYK} disabled={isRunning} className="p-3 border border-[var(--border-color)] hover:border-[var(--accent-color)]/30 transition-all text-[0.55rem] font-black uppercase tracking-widest flex flex-col items-center gap-2 text-[var(--text-primary)] disabled:opacity-50 disabled:cursor-not-allowed">
                                <ShieldCheckIcon className="h-4 w-4 text-[var(--text-secondary)]" />
                                {t('step.fix.forceCmykBtn')}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Main Zone: Page Viewer */}
                <div className="flex flex-col gap-6 flex-1 min-w-0">
                    <div className="border border-[var(--border-color)] bg-[var(--bg-tertiary)] relative overflow-hidden h-[600px] flex flex-col">
                        <div className="absolute top-0 left-0 right-0 p-4 z-10 flex flex-wrap md:flex-nowrap items-center justify-between gap-4 bg-[var(--bg-primary)]/90 backdrop-blur-xl border-b border-[var(--border-color)] overflow-hidden">
                            {/* Pagination Cluster */}
                            <div className="flex items-center gap-4 bg-[var(--bg-secondary)] border border-[var(--border-color)] px-4 py-1.5 rounded-xl">
                                <button 
                                    onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                                    disabled={currentPage <= 1 || isRunning}
                                    className="p-1 text-[var(--text-secondary)] hover:text-[var(--accent-color)] disabled:opacity-20 transition-all"
                                >
                                    <ChevronLeftIcon className="h-4 w-4" />
                                </button>
                                <div className="flex flex-col items-center min-w-[60px]">
                                    <span className="text-[0.5rem] font-black uppercase tracking-widest text-[var(--text-muted)] leading-none mb-0.5">{t('pageNavigation')}</span>
                                    <span className="text-xs font-mono font-black text-[var(--text-primary)]">
                                        {currentPage} <span className="text-[var(--text-muted)] mx-0.5">/</span> {numPages}
                                    </span>
                                </div>
                                <button 
                                    onClick={() => onPageChange(Math.min(numPages, currentPage + 1))}
                                    disabled={currentPage >= numPages || isRunning}
                                    className="p-1 text-[var(--text-secondary)] hover:text-[var(--accent-color)] disabled:opacity-20 transition-all"
                                >
                                    <ChevronRightIcon className="h-4 w-4" />
                                </button>
                            </div>
                            {/* Analysis Tools Cluster */}
                            <div className="flex flex-wrap items-center gap-2">
                                <button 
                                    onClick={onRunHeatmap} 
                                    className={`flex items-center gap-3 px-5 py-2 text-[0.6rem] font-black uppercase tracking-[0.2em] transition-all border ${
                                        heatmapData ? 'bg-[var(--accent-color)] text-white border-[var(--accent-color)] shadow-[0_0_20px_rgba(220,0,0,0.2)]' : 'bg-[var(--hover-bg)] text-[var(--text-secondary)] border-[var(--border-color)] hover:border-[var(--accent-color)]/30 hover:bg-[var(--accent-color)]/5'
                                    }`}
                                >
                                    <FireIcon className={`h-3.5 w-3.5 ${heatmapData ? 'text-white' : 'text-[var(--accent-color)]'}`} />
                                    {heatmapData ? t('step.fix.disableHeatmap') : t('step.fix.inkHeatmap')}
                                </button>

                                <button 
                                    onClick={onRunVisualCheck} 
                                    className="flex items-center gap-3 px-5 py-2 bg-[var(--hover-bg)] border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--accent-color)]/5 hover:border-[var(--accent-color)]/30 transition-all text-[0.6rem] font-black uppercase tracking-[0.2em]"
                                >
                                    <EyeIcon className="h-3.5 w-3.5 text-[var(--accent-color)]" />
                                    {t('step.fix.aiVisualCheck')}
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 p-8 pt-16 overflow-auto custom-scrollbar flex items-center justify-center bg-[var(--bg-primary)] relative">
                            {isHeatmapLoading && (
                                <div className="absolute inset-0 z-[15] flex flex-col items-center justify-center bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
                                    <div className="h-10 w-10 border-2 border-[var(--accent-color)] border-t-transparent rounded-full animate-spin mb-4" />
                                    <div className="text-[0.6rem] font-black uppercase tracking-[0.3em] text-[var(--accent-color)] font-mono">
                                        {t('step.fix.calculatingInk')}
                                    </div>
                                </div>
                            )}
                            <PageViewer 
                                key={`step3-viewer-${lastPdfUrl ? 'artifact' : 'local'}`}
                                file={file}
                                pdfUrl={lastPdfUrl}
                                numPages={numPages}
                                currentPage={currentPage}
                                onPageChange={onPageChange}
                                onNumPagesChange={onNumPagesChange}
                                selectedIssue={selectedIssue}
                                heatmapData={heatmapData}
                                onRunHeatmap={onRunHeatmap}
                                isHeatmapLoading={isHeatmapLoading}
                                onRunVisualCheck={onRunVisualCheck}
                                previewPages={previewPages}
                                previewLoading={previewLoading}
                                ldmMode={ldmMode}
                                ldmJobId={ldmJobId}
                                hideNavigation={true}
                            />
                        </div>
                    </div>

                    {/* Bottom Action Bar */}
                    <div className="flex flex-col-reverse md:flex-row items-center justify-between gap-4 mt-4 ppp-mobile-sticky-footer">
                        <button 
                            onClick={onBack}
                            className="w-full md:w-auto text-[0.6rem] font-black uppercase tracking-[0.2em] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors p-4 md:p-0 text-center"
                        >
                            {t('back')}
                        </button>
                        <button 
                            onClick={onNext}
                            className="w-full md:w-auto bg-[var(--accent-color)] text-white px-12 py-5 text-[0.7rem] font-black uppercase tracking-[0.3em] hover:bg-[var(--accent-hover)] transition-all shadow-[0_15px_30px_rgba(220,0,0,0.2)] text-center"
                        >
                            {t('step.fix.completeProtocol')}
                        </button>
                    </div>

                    <div className="ppp-mobile-spacer" />
                </div>
            </div>

            {/* Floatables */}
            <FixDrawerV2_4
                issue={selectedIssue}
                onClose={() => onSelectIssue(null)}
                onOpenAIAudit={(issue: Issue) => { setIssueForAudit(issue); setAiAuditOpen(true); }}
                onOpenEfficiencyTips={(issue: Issue) => { setIssueForAudit(issue); setEfficiencyOpen(true); }}
                onFixBleed={onFixBleed}
                onConvertGrayscale={onConvertGrayscale}
                onConvertCMYK={onConvertCMYK}
                onRebuildPdf={onRebuildPdf}
                selectedProfile={selectedProfile}
                onProfileChange={onProfileChange}
                isFixing={isRunning}
                serverAvailable={serverAvailable}
                visualGovernance={{
                    ink: (result as any)?.ink_governance ?? null,
                    selectiveImage: (result as any)?.selective_image_governance ?? null,
                    font: (result as any)?.font_governance ?? null,
                    transparencyOverprint: (result as any)?.transparency_overprint_physical_governance ?? null,
                }}
            />

            <AIInspectorPanel
                isOpen={aiAuditOpen}
                onClose={() => setAiAuditOpen(false)}
                issue={issueForAudit}
                fileMeta={fileMeta}
                result={result}
            />

            <EfficiencyAuditModalV2_4
                isOpen={efficiencyOpen}
                onClose={() => setEfficiencyOpen(false)}
                issue={issueForAudit}
                fileMeta={fileMeta}
                result={result}
            />
        </div>
    );
};
