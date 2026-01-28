import React, { useState } from 'react';
import { PreflightResult, FileMeta, Issue } from '../../types';
import { IssuesPanel } from '../IssuesPanel';
import { PageViewer } from '../PageViewer';
import { FixDrawer } from '../FixDrawer';
import { AIAuditModal } from '../AIAuditModal';
import { EfficiencyAuditModal } from '../EfficiencyAuditModal';
import { AutoFixProPanel } from '../AutoFixProPanel';

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
    onFixBleed: () => void;
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
            <div className="step__header">
                <h2 className="step__title">Fix Issues</h2>
                <p className="step__description">
                    Review and fix the {issuesCount} issue{issuesCount !== 1 ? 's' : ''} found in your PDF
                </p>
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
                        <Icon.Refresh className="h-4 w-4" /> Re-analyze PDF
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
                    />
                </div>
            </div>

            <div className="step__actions">
                <button
                    className="btn btn--primary flex items-center gap-2"
                    onClick={() => onAutoFix(autoFixOptions)}
                    disabled={!file || isRunning}
                >
                    <Icon.Sparkles className="h-4 w-4" />
                    {isRunning ? 'Running AutoFix...' : 'Run AutoFix Agent (PRO)'}
                </button>
                <button className="btn btn--secondary flex items-center gap-2" onClick={onBack}>
                    <Icon.ArrowLeft className="h-4 w-4" /> Back to Analysis
                </button>
                <button className="btn btn--primary btn--large flex items-center gap-2" onClick={onNext}>
                    Continue to Review <Icon.ArrowRight className="h-4 w-4" />
                </button>
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
