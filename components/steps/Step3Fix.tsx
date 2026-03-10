import React, { useState } from 'react';
import { PreflightResult, FileMeta, Issue } from '../../types';
import { IssuesPanel } from '../IssuesPanel';
import { PageViewer } from '../PageViewer';
import { FixDrawer } from '../FixDrawer';
import { AIAuditModal } from '../AIAuditModal';
import { EfficiencyAuditModal } from '../EfficiencyAuditModal';
import { AutoFixProPanel } from '../AutoFixProPanel';
import { t } from '../../i18n';

interface Step3FixProps {
    file: File | null;
    fileMeta: FileMeta | null;
    result: PreflightResult | null;
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
}

const Icon = {
    Refresh: (p: { className?: string }) => (
        <svg className={p.className} viewBox="0 0 24 24" fill="none">
            <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    ),
    Sparkles: (p: { className?: string }) => (
        <svg className={p.className} viewBox="0 0 24 24" fill="none">
            <path d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    ),
    ArrowLeft: (p: { className?: string }) => (
        <svg className={p.className} viewBox="0 0 24 24" fill="none">
            <path d="M19 12H5m7 7l-7-7 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    ),
    ArrowRight: (p: { className?: string }) => (
        <svg className={p.className} viewBox="0 0 24 24" fill="none">
            <path d="M5 12h14m-7 7l7-7-7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    ),
};

export const Step3Fix: React.FC<Step3FixProps> = ({
    file,
    fileMeta,
    result,
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
}) => {
    const [aiAuditOpen, setAiAuditOpen] = useState(false);
    const [efficiencyOpen, setEfficiencyOpen] = useState(false);
    const [issueForAudit, setIssueForAudit] = useState<Issue | null>(null);

    // AutoFix PRO Options state
    const [autoFixOptions, setAutoFixOptions] = useState({
        safeOnly: true,
        aggressive: false,
        forceRebuild: false,
        forceBleed: true,
        forceCmyk: true,
        flatten: false,
        allowRasterOutput: false
    });

    const toggleOption = (key: keyof typeof autoFixOptions) => {
        setAutoFixOptions(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const handleOpenAIAudit = (issue: Issue) => {
        setIssueForAudit(issue);
        setAiAuditOpen(true);
    };

    const handleOpenEfficiency = (issue: Issue) => {
        setIssueForAudit(issue);
        setEfficiencyOpen(true);
    };

    const issuesCount = result?.issues?.length || 0;

    return (
        <div className="step step--fix">
            <AutoFixProPanel
                before={autoFixBefore || null}
                after={autoFixAfter || null}
                report={autoFixReport || null}
                runId={autoFixRunId}
                options={autoFixOptions}
                onToggleOption={toggleOption}
                onRun={() => onAutoFix(autoFixOptions)}
                isRunning={isRunning}
                compareEnabled={compareEnabled}
                onToggleCompare={onToggleCompare}
            />

            {ldmActive && (
                <div className="mb-6 animate-in slide-in-from-top duration-500">
                    <div className="bg-gradient-to-r from-red-600 to-red-800 rounded-xl p-5 shadow-lg border border-red-400/30 text-white overflow-hidden relative">
                        <div className="absolute top-0 right-0 p-3 opacity-20 transform translate-x-1/4 -translate-y-1/4">
                            <Icon.Sparkles className="w-24 h-24" />
                        </div>
                        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-4">
                            <div className="flex items-center gap-4">
                                <div className="bg-white/20 p-3 rounded-lg backdrop-blur-md">
                                    <Icon.Refresh className="w-6 h-6 animate-spin" />
                                </div>
                                <div className="text-left">
                                    <h3 className="text-lg font-bold">AI Magic Fix Active</h3>
                                    <p className="text-red-100 text-sm">{ldmStatus || 'Processing sequential pages to optimize RAM...'}</p>
                                </div>
                            </div>
                            <div className="w-full md:w-1/3">
                                <div className="flex justify-between mb-1 text-xs font-semibold">
                                    <span>Progress</span>
                                    <span>{ldmProgress}%</span>
                                </div>
                                <div className="w-full bg-white/20 rounded-full h-2.5 overflow-hidden">
                                    <div
                                        className="bg-white h-full transition-all duration-500 rounded-full shadow-[0_0_10px_rgba(255,255,255,0.5)]"
                                        style={{ width: `${ldmProgress}%` }}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {/* Header omitted on desktop to save space (since Stepper already says it), but keep visually hidden or small */}
            <div className="step__header mb-2 py-1 flex items-center justify-between bg-white rounded-xl shadow-sm border border-gray-100 px-4">
                <div className="flex items-baseline gap-2">
                    <h2 className="text-sm font-black text-gray-900 tracking-tight">{t('fixIssuesTitle')}</h2>
                    <p className="text-[10px] text-gray-500 font-medium">
                        {t('fixIssuesRemaing', { count: issuesCount })}
                    </p>
                </div>
            </div>

            <div className="step__content step__content--split">
                <div className="step__sidebar">
                    <IssuesPanel
                        result={result}
                        onSelectIssue={onSelectIssue}
                        emptyHint="No issues found"
                        onRunPreflight={onRunAnalysis}
                        isRunning={isRunning}
                        compareEnabled={compareEnabled}
                        autoFixBefore={autoFixBefore}
                        autoFixAfter={autoFixAfter}
                    />

                    <button
                        className="btn btn--secondary btn--block flex items-center justify-center gap-2"
                        onClick={onRunAnalysis}
                        disabled={isRunning}
                    >
                        {t('reanalyzePdf')}
                    </button>
                </div>

                <div className="step__main">
                    <PageViewer
                        file={file}
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
                    />
                </div>
            </div>

            <div className="step__actions sticky bottom-0 bg-white/80 backdrop-blur-md p-4 border-t border-gray-100 mt-6 z-20 flex justify-between items-center rounded-t-2xl shadow-[0_-10px_30px_rgba(0,0,0,0.05)]">
                <div className="flex gap-3">
                    <button className="btn btn--secondary btn--sm flex items-center gap-2" onClick={onBack}>
                        {t('back')}
                    </button>
                </div>
                <div className="flex gap-4 items-center">
                    <button
                        className="btn btn--primary btn--large px-10 py-3 shadow-xl shadow-red-900/10 flex items-center gap-2"
                        onClick={onNext}
                    >
                        {t('continueToReview')}
                    </button>
                </div>
            </div>

            <FixDrawer
                issue={selectedIssue}
                onClose={() => onSelectIssue(null)}
                onOpenAIAudit={handleOpenAIAudit}
                onOpenEfficiencyTips={handleOpenEfficiency}
                onFixBleed={onFixBleed}
                onConvertGrayscale={onConvertGrayscale}
                onConvertCMYK={onConvertCMYK}
                onRebuildPdf={onRebuildPdf}
                selectedProfile={selectedProfile}
                onProfileChange={onProfileChange}
                isFixing={isRunning}
                serverAvailable={serverAvailable}
            />

            <AIAuditModal
                isOpen={aiAuditOpen}
                onClose={() => setAiAuditOpen(false)}
                issue={issueForAudit}
                fileMeta={fileMeta}
                result={result}
                visualImage={null}
                isVisualMode={false}
                cachedResponse={null}
                onSaveResponse={() => { }}
            />

            <EfficiencyAuditModal
                isOpen={efficiencyOpen}
                onClose={() => setEfficiencyOpen(false)}
                issue={issueForAudit}
                fileMeta={fileMeta}
                result={result}
            />
        </div>
    );
};
