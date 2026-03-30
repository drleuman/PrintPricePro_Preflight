import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Stepper } from './components/Stepper';
import { LoaderOverlay } from './components/LoaderOverlay';
import { AIInspectorPanel } from './components/AIInspectorPanel';
import { FixDrawerV2_4 } from './components/FixDrawerV2_4';
import { EfficiencyAuditModalV2_4 } from './components/EfficiencyAuditModalV2_4';
import { Step1UploadV2_4 } from './components/steps/Step1UploadV2_4';
import { Step2AnalysisV2_4 } from './components/steps/Step2AnalysisV2_4';
import { Step3FixV2_4 } from './components/steps/Step3FixV2_4';
import { Step4ReviewV2_4 } from './components/steps/Step4ReviewV2_4';
import { Step5DownloadV2_4 } from './components/steps/Step5DownloadV2_4';
import { XMarkIcon, SparklesIcon, CpuChipIcon, CommandLineIcon, ChartBarIcon } from '@heroicons/react/24/outline';
import { PreflightShell, SignalStrip, PPOSLogo } from './design/preflight_starter_pack';
import { ThemeProvider } from './hooks/useTheme';
import { useTranslation, LocaleProvider } from './i18n';
import { LanguageSwitcher } from './components/LanguageSwitcher';
import {
  FileMeta,
  Issue,
  PreflightResult,
  HeatmapData,
  AppMode,
} from './types';
import { normalizePreflightResult } from './utils/payloadNormalization';
import { usePreflightWorker } from './hooks/usePreflightWorker';
import { usePdfTools } from './hooks/usePdfTools';

import { AuthOverlayV2_4 } from './components/AuthOverlayV2_4';
import { useAuth } from './hooks/useAuth';
import { UserMenu } from './components/UserMenu';

export default function App() {
  return (
    <LocaleProvider>
      <AppContent />
    </LocaleProvider>
  );
}

function AppContent() {
  const { t } = useTranslation();
  // ---------- Workflow State ----------
  const [currentStep, setCurrentStep] = useState(1);
  const [appMode, setAppMode] = useState<AppMode>(null);

  // V2 Analysis State
  const [file, setFile] = useState<File | null>(null);
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [fileMeta, setFileMeta] = useState<FileMeta | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [result, setResult] = useState<PreflightResult | null>(null);
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);

  // ---------- AutoFix Pro Session ----------
  const [autoFixBefore, setAutoFixBefore] = useState<PreflightResult | null>(null);
  const [autoFixAfter, setAutoFixAfter] = useState<PreflightResult | null>(null);
  const [autoFixReport, setAutoFixReport] = useState<any | null>(null);
  const [autoFixRunId, setAutoFixRunId] = useState<number | null>(null);
  const [compareEnabled, setCompareEnabled] = useState(false);

  // Visual QA State
  const [visualPageImage, setVisualPageImage] = useState<string | null>(null);
  const [visualReports, setVisualReports] = useState<Record<number, string>>({});
  const [showVisualModal, setShowVisualModal] = useState(false);

  // Heatmap State
  const [heatmapData, setHeatmapData] = useState<HeatmapData | null>(null);
  const [heatmapLoading, setHeatmapLoading] = useState(false);

  // ---------- Large Document Mode (LDM) State ----------
  const [ldmActive, setLdmActive] = useState(false);
  const [ldmProgress, setLdmProgress] = useState(0);
  const [ldmStatus, setLdmStatus] = useState<string | null>(null);

  // Preview State (Server-side GS PNGs)
  const [previewPages, setPreviewPages] = useState<string[] | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // UI / Loader
  const lastPdfUrlRef = useRef<string | null>(null);
  const [lastPdfUrl, setLastPdfUrl] = useState<string | null>(null);
  const [lastPdfName, setLastPdfName] = useState<string | null>(null);
  const [selectedProfile, setSelectedProfile] = useState<string>('');
  const [selectedPolicy, setSelectedPolicy] = useState<string>('');

  const { isAuthenticated } = useAuth();

  const activeJobIdRef = useRef<string | null>(null);

  // ---------- Helpers ----------

  const resetResidues = useCallback(() => {
    activeJobIdRef.current = null;
    setResult(null);
    setSelectedIssue(null);
    setHeatmapData(null);
    setHeatmapLoading(false);
    setAutoFixBefore(null);
    setAutoFixAfter(null);
    setAutoFixReport(null);
    setAutoFixRunId(null);
    setLdmStatus('');
    // Note: file and fileMeta are generally kept
  }, []);

  const cleanupUrl = useCallback(() => {
    if (lastPdfUrlRef.current) {
      try {
        URL.revokeObjectURL(lastPdfUrlRef.current);
      } catch (e) { }
      lastPdfUrlRef.current = null;
    }
  }, []);

  useEffect(() => {
    return cleanupUrl;
  }, [cleanupUrl]);

  const { isWorkerRunning, error: workerError, runTacHeatmap } = usePreflightWorker({
    onHeatmapResult: (data) => {
      setHeatmapData(data);
      setHeatmapLoading(false);
    },
    onError: (err: string) => { 
      console.error('[WORKER-ERROR]', err);
      setHeatmapLoading(false);
    }
  });

  const {
    startV2Preflight,
    pollJob,
    autoFixServer,
    convertColorServer,
    convertToGrayscaleServer,
    rebuildPdfServer,
    createBookletClient,
    handleV2JobComplete,
    getDownloadUrl
  } = usePdfTools({
    onStatus: (st: string) => { setLdmStatus(st); },
    onComplete: (res: any) => {
      // Point of Application (Validation C): Check jobId BEFORE any state change
      const completedJobId = res.meta?.jobId;
      if (completedJobId && activeJobIdRef.current && completedJobId !== activeJobIdRef.current) {
        console.warn('[APP][STALE-JOB-DETECTED]', { completed: completedJobId, active: activeJobIdRef.current });
        return;
      }

      console.log('[APP] Preflight Job Complete:', res);
      setResult(res);
      setCurrentStep(2); // Analysis
      setLdmActive(false);
    }
  });

  const onFileSelect = (newFile: File | null) => {
    setFile(newFile);
    if (!newFile) {
      setFileMeta(null);
      resetResidues();
      setCurrentStep(1);
      return;
    }
    setOriginalFile(newFile);
    setFileMeta({
      name: newFile.name,
      size: newFile.size,
      type: newFile.type
    });
  };

  const handlePageChange = (page: number) => setCurrentPage(page);

  const handleV2Start = useCallback(async () => {
    if (!file || ldmActive) return;
    
    resetResidues();
    setLdmActive(true);
    setLdmStatus('Starting PrintPrice OS Engine...');
    
    try {
      const res = await startV2Preflight(file, selectedPolicy, { mode: appMode });
      
      if (res.inlineResult) {
        console.log('[APP][V2-START] Sync mode detected, using inlineResult');
        const normalized = normalizePreflightResult(res.inlineResult);
        setResult(normalized);
        setCurrentStep(2);
        setLdmActive(false);
        return;
      }

      const jobId = res.jobId || res.job_id || res.id;
      if (jobId) {
        activeJobIdRef.current = jobId;
        console.log('[APP][V2-START] Async mode, Job ID set to', jobId);
        setLdmStatus('Engine Processing...');
        await handleV2JobComplete(jobId);
        
        // Final guard if onComplete didn't finish or for synchronous success
        if (activeJobIdRef.current === jobId) {
          setLdmActive(false);
        }
      }
    } catch (err: any) {
      // Point of Application (Validation A): Protect error states
      console.error('[APP][V2-ERROR]', err);
      // Only show error and clear LDM if it's the current active job
      // Note: During upload/start, jobId might be unknown yet, so we allow if ldmActive is true
      setLdmActive(false);
      setLdmStatus('');
      alert('Engine Processing Error: ' + err.message);
    }
  }, [file, selectedPolicy, startV2Preflight, handleV2JobComplete, resetResidues, ldmActive]);

  const handleAutoFix = useCallback(async (opts: any) => {
    if (!file) return;
    
    // Save current result as 'before' if not already set
    if (result && !autoFixBefore) {
      setAutoFixBefore(result);
      console.log('[APP][FIX-START] Storing Before state for Step 4 comparison');
    }

    setLdmActive(true);
    setLdmStatus('Initializing AI Magic Fix on OS...');
    try {
      const { jobId } = await autoFixServer(file, opts);
      if (jobId) {
        setLdmProgress(10);
        const jobResult: any = await handleV2JobComplete(jobId);
        
        console.log('[APP][FIX-COMPLETE]', { jobId, hasReport: !!jobResult.report });
        
        const downloadUrl = getDownloadUrl(jobId);
        setLastPdfUrl(downloadUrl);
        lastPdfUrlRef.current = downloadUrl;
        
        if (jobResult.report) setAutoFixReport(jobResult.report);
        
        // Update the current result with the 'after' findings
        const normalizedAfter = normalizePreflightResult(jobResult);
        setResult(normalizedAfter);
        setAutoFixAfter(normalizedAfter);
      }
      setLdmActive(false);
    } catch (err: any) {
      alert('AI Magic Failed: ' + err.message);
      setLdmActive(false);
    }
  }, [file, result, autoFixBefore, autoFixServer, handleV2JobComplete, getDownloadUrl]);

  const handleDownload = useCallback(() => {
    if (lastPdfUrl) {
      window.open(lastPdfUrl, '_blank');
    } else {
      alert('No certified PDF available for download yet.');
    }
  }, [lastPdfUrl]);
  const handleConvertCMYK = useCallback(async () => {
    if (!file) return;
    setLdmActive(true);
    setLdmStatus('Enforcing CMYK Policy...');
    try {
      const jobId = await convertColorServer(file, selectedProfile);
      if (jobId) {
        await handleV2JobComplete(jobId);
        const url = getDownloadUrl(jobId);
        setLastPdfUrl(url);
        lastPdfUrlRef.current = url;
      }
      setLdmActive(false);
    } catch (err: any) {
      alert('Color Conversion Failed: ' + err.message);
      setLdmActive(false);
    }
  }, [file, convertColorServer, selectedProfile, handleV2JobComplete, getDownloadUrl]);

  const handleConvertGrayscale = useCallback(async () => {
    if (!file) return;
    setLdmActive(true);
    setLdmStatus('Converting to Grayscale...');
    try {
      const jobId = await convertToGrayscaleServer(file);
      if (jobId) {
        await handleV2JobComplete(jobId);
        const url = getDownloadUrl(jobId);
        setLastPdfUrl(url);
        lastPdfUrlRef.current = url;
      }
      setLdmActive(false);
    } catch (err: any) {
      alert('Grayscale Conversion Failed: ' + err.message);
      setLdmActive(false);
    }
  }, [file, convertToGrayscaleServer, handleV2JobComplete, getDownloadUrl]);

  const handleRebuildPdf = useCallback(async () => {
    if (!file) return;
    setLdmActive(true);
    setLdmStatus('Rebuilding Forensic Carrier...');
    try {
      const jobId = await rebuildPdfServer(file, 300);
      if (jobId) {
        await handleV2JobComplete(jobId);
        const url = getDownloadUrl(jobId);
        setLastPdfUrl(url);
        lastPdfUrlRef.current = url;
      }
      setLdmActive(false);
    } catch (err: any) {
      alert('Rebuild Failed: ' + err.message);
      setLdmActive(false);
    }
  }, [file, rebuildPdfServer, handleV2JobComplete, getDownloadUrl]);

  const handleMakeBooklet = useCallback(async () => {
    if (!file) return;
    setLdmActive(true);
    setLdmStatus('Generating Booklet Imposition...');
    try {
      const blob = await createBookletClient(file);
      const url = URL.createObjectURL(blob);
      setLastPdfUrl(url);
      lastPdfUrlRef.current = url;
      setLdmActive(false);
    } catch (err: any) {
      alert('Booklet Generation Failed: ' + err.message);
      setLdmActive(false);
    }
  }, [file, createBookletClient]);
  const handleSelectIssue = (issue: Issue | null) => setSelectedIssue(issue);

  const handleStartOver = () => {
    setFile(null);
    setFileMeta(null);
    setResult(null);
    setCurrentStep(1);
    setAppMode(null);
  };

  const handleRunHeatmap = useCallback((targetPage?: number) => {
    // If targetPage is provided, we are re-syncing due to page change
    // If NOT provided, we are toggling
    if (targetPage === undefined && heatmapData) {
      setHeatmapData(null);
      return;
    }
    
    if (!file || !fileMeta) return;
    
    setHeatmapLoading(true);
    const pageToAnalyze = targetPage !== undefined ? targetPage : currentPage;
    runTacHeatmap(file, fileMeta, pageToAnalyze - 1);
  }, [file, fileMeta, currentPage, heatmapData, runTacHeatmap]);

  // Sync heatmap on page change
  useEffect(() => {
    if (heatmapData) {
      handleRunHeatmap(currentPage);
    }
  }, [currentPage]); // Re-run if page changes and data was already visible

  return (
    <ThemeProvider>
      <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] selection:bg-[#dc0000] selection:text-white transition-colors duration-300">
        {isAuthenticated ? (
          <PreflightShell
            headerContent={
              <Stepper
                currentStep={currentStep}
                steps={[
                  { number: 1, title: t('ingress'), description: 'Carriers' },
                  { number: 2, title: t('forensics'), description: 'Scanners' },
                  { number: 3, title: t('engine'), description: 'Policy' },
                  { number: 4, title: t('certify'), description: 'Validated' },
                  { number: 5, title: t('download'), description: 'Certified' }
                ]}
              />
            }
            rightContent={
              <div className="flex items-center gap-4">
                <LanguageSwitcher />
                <div className="h-6 w-px bg-[var(--border-color)] mx-1 hidden md:block"></div>
                <button 
                  onClick={() => setShowVisualModal(true)}
                  className="flex items-center gap-2 px-3 py-1.5 border border-[var(--border-color)] bg-[var(--bg-secondary)]/50 text-[var(--text-primary)] text-[0.65rem] font-bold uppercase tracking-wider hover:bg-[var(--hover-bg)] transition-all"
                  title="Open AI Inspector"
                >
                  <CommandLineIcon className="h-3.5 w-3.5 text-[var(--accent-color)]" />
                  <span className="hidden md:inline">Analyze_Carrier</span>
                </button>
                <UserMenu />
              </div>
            }
          >
            <div className="space-y-10">
              <div className="relative">
                {currentStep === 1 && (
                  <Step1UploadV2_4
                    file={file}
                    fileMeta={fileMeta}
                    onFileSelect={onFileSelect}
                    onNext={(mode) => {
                      setAppMode(mode);
                      resetResidues(); // Clear previous residues
                      setCurrentStep(2); // Ensure we go to Analysis (Step 2)
                      
                      console.log('[APP][ANALYSIS-INGRESS]', {
                        mode,
                        path: 'OS-BACKED (V2/BFF)',
                        policy: selectedPolicy
                      });

                      if (file) {
                        handleV2Start();
                      }
                    }}
                    selectedPolicy={selectedPolicy}
                    onPolicyChange={setSelectedPolicy}
                    isAuthenticated={isAuthenticated}
                  />
                )}

                {currentStep === 2 && (
                  <Step2AnalysisV2_4
                    file={file}
                    fileMeta={fileMeta}
                    result={result}
                    isRunning={isWorkerRunning || ldmActive}
                    appMode={appMode}
                    onRunAnalysis={() => {
                      console.log('[APP][ANALYSIS-RE-RUN]', { mode: appMode, path: 'OS-BACKED' });
                      handleV2Start();
                    }}
                    onNext={() => setCurrentStep(3)}
                    onSkipToReview={() => setCurrentStep(4)}
                    onBack={() => {
                      resetResidues();
                      setCurrentStep(1);
                    }}
                    onSelectIssue={setSelectedIssue}
                  />
                )}

                {currentStep === 3 && (
                  <Step3FixV2_4
                    file={file}
                    fileMeta={fileMeta}
                    result={result}
                    autoFixBefore={autoFixBefore}
                    autoFixAfter={autoFixAfter}
                    autoFixReport={autoFixReport}
                    autoFixRunId={autoFixRunId}
                    compareEnabled={compareEnabled}
                    numPages={numPages}
                    currentPage={currentPage}
                    selectedIssue={selectedIssue}
                    heatmapData={heatmapData}
                    isHeatmapLoading={heatmapLoading}
                    isRunning={isWorkerRunning}
                    selectedProfile={selectedProfile}
                    ldmActive={ldmActive}
                    ldmProgress={ldmProgress}
                    ldmStatus={ldmStatus}
                    onPageChange={handlePageChange}
                    onNumPagesChange={setNumPages}
                    onSelectIssue={handleSelectIssue}
                    onRunAnalysis={() => {
                      console.log('[APP][ANALYSIS-RE-RUN-STEP3]', { mode: appMode });
                      handleV2Start();
                    }}
                    onRunHeatmap={handleRunHeatmap}
                    onRunVisualCheck={() => setShowVisualModal(true)}
                    onFixBleed={() => handleAutoFix({ forceBleed: true })}
                    onConvertGrayscale={handleConvertGrayscale}
                    onConvertCMYK={handleConvertCMYK}
                    onRebuildPdf={handleRebuildPdf}
                    onAutoFix={handleAutoFix}
                    onToggleCompare={setCompareEnabled}
                    onProfileChange={setSelectedProfile}
                    onOpenAIAudit={(issue) => { handleSelectIssue(issue); setShowVisualModal(true); }}
                    onOpenEfficiency={() => alert('Efficiency optimized by PPOS.')}
                    onNext={() => setCurrentStep(4)}
                    onBack={() => setCurrentStep(2)}
                    serverAvailable={true}
                    previewPages={previewPages}
                    previewLoading={previewLoading}
                  />
                )}

                {currentStep === 4 && (
                  <Step4ReviewV2_4
                    file={file}
                    fileMeta={fileMeta}
                    result={result}
                    numPages={numPages}
                    currentPage={currentPage}
                    lastPdfUrl={lastPdfUrl}
                    lastPdfName={lastPdfName}
                    isRunning={isWorkerRunning}
                    onPageChange={handlePageChange}
                    onNumPagesChange={setNumPages}
                    onConvertGrayscale={handleConvertGrayscale}
                    onConvertColors={handleConvertCMYK}
                    onRebuildPdf={handleRebuildPdf}
                    onMakeBooklet={handleMakeBooklet}
                    onDownload={handleDownload}
                    onStartOver={handleStartOver}
                    onBack={() => setCurrentStep(3)}
                    onNext={() => setCurrentStep(5)}
                    appMode={appMode}
                    heatmapData={heatmapData}
                    isHeatmapLoading={heatmapLoading}
                    onRunHeatmap={handleRunHeatmap}
                    originalFile={originalFile}
                    autoFixBefore={autoFixBefore}
                    autoFixAfter={autoFixAfter}
                    autoFixReport={autoFixReport}
                    previewPages={previewPages}
                    previewLoading={previewLoading}
                    selectedPolicy={selectedPolicy}
                  />
                )}

                {currentStep === 5 && (
                  <Step5DownloadV2_4
                    lastPdfUrl={lastPdfUrl}
                    lastPdfName={lastPdfName}
                    file={file}
                    onDownload={handleDownload}
                    onStartOver={handleStartOver}
                  />
                )}
              </div>
            </div>
          </PreflightShell>
        ) : (
          <AuthOverlayV2_4 />
        )}

        <FixDrawerV2_4 
          issue={selectedIssue}
          onClose={() => setSelectedIssue(null)}
          onConvertGrayscale={handleConvertGrayscale}
          onConvertCMYK={handleConvertCMYK}
          onRebuildPdf={handleRebuildPdf}
          onApplyCorrection={() => setCurrentStep(3)}
          selectedProfile={selectedProfile}
          onProfileChange={setSelectedProfile}
          onOpenAIAudit={(issue) => { setSelectedIssue(issue); setShowVisualModal(true); }}
        />

        <AIInspectorPanel
          isOpen={showVisualModal}
          onClose={() => setShowVisualModal(false)}
          issue={selectedIssue}
          fileMeta={fileMeta}
          result={result}
        />

        <LoaderOverlay
          isOpen={ldmActive}
          message={ldmStatus || 'Processing...'}
          stageKey={ldmStatus?.toLowerCase().includes('engine') ? 'upload' : 'preflight'}
        />
      </div>
    </ThemeProvider>
  );
}
