import React, { useState } from 'react';
import { PreflightResult, FileMeta, Issue } from '../../types';
import { IssuesPanel } from '../IssuesPanel';
import { PageViewer } from '../PageViewer';
import { FixDrawer } from '../FixDrawer';
import { AIAuditModal } from '../AIAuditModal';
import { EfficiencyAuditModal } from '../EfficiencyAuditModal';

interface Step3FixProps {
    file: File | null;
    fileMeta: FileMeta | null;
    result: PreflightResult | null;
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
    onProfileChange: (profile: string) => void;
    onOpenAIAudit: (issue: Issue) => void;
    onOpenEfficiency: (issue: Issue) => void;
    onNext: () => void;
    onBack: () => void;
}

export const Step3Fix: React.FC<Step3FixProps> = ({
    file,
    fileMeta,
    result,
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
    onProfileChange,
    onOpenAIAudit,
    onOpenEfficiency,
    onNext,
    onBack,
}) => {
    const [aiAuditOpen, setAiAuditOpen] = useState(false);
    const [efficiencyOpen, setEfficiencyOpen] = useState(false);
    const [issueForAudit, setIssueForAudit] = useState<Issue | null>(null);

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
                    />

                    <button
                        className="btn btn--secondary btn--block"
                        onClick={onRunAnalysis}
                        disabled={isRunning}
                    >
                        🔄 Re-analyze PDF
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
                <button className="btn btn--secondary" onClick={onBack}>
                    ← Back to Analysis
                </button>
                <button className="btn btn--primary btn--large" onClick={onNext}>
                    Continue to Review →
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
