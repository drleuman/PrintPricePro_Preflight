import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Stepper } from './components/Stepper';
import { LoaderOverlay } from './components/LoaderOverlay';
import { AIInspectorPanel } from './components/AIInspectorPanel';
import { Step1UploadV2_4 } from './components/steps/Step1UploadV2_4';
import { Step2AnalysisV2_4 } from './components/steps/Step2AnalysisV2_4';
import { Step3FixV2_4 } from './components/steps/Step3FixV2_4';
import { Step4ReviewV2_4 } from './components/steps/Step4ReviewV2_4';
import { XMarkIcon, SparklesIcon, CpuChipIcon, CommandLineIcon, ChartBarIcon } from '@heroicons/react/24/outline';
import { PreflightShell, SignalStrip, PPOSLogo } from './design/preflight_starter_pack';
import { ThemeProvider } from './hooks/useTheme';
import { LocaleProvider } from './i18n';
import { LanguageSwitcher } from './components/LanguageSwitcher';

import { t } from './i18n';
import {
  FileMeta,
  Issue,
  PreflightResult,
  HeatmapData,
  AppMode,
} from './types';
import { usePreflightWorker } from './hooks/usePreflightWorker';
import { usePdfTools } from './hooks/usePdfTools';

import { AuthOverlayV2_4 } from './components/AuthOverlayV2_4';
import { useAuth } from './hooks/useAuth';
import { UserMenu } from './components/UserMenu';

export default function App() {
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
  const [selectedProfile, setSelectedProfile] = useState<string>('OFFSET_CMYK_STRICT');
  const [selectedPolicy, setSelectedPolicy] = useState<string>('OFFSET_CMYK_STRICT');

  const { isAuthenticated } = useAuth();

  // ---------- Helpers ----------

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

  const { isWorkerRunning, error: workerError, runAnalysis } = usePreflightWorker({
    onAnalysisResult: (res: PreflightResult) => {
      setResult(res);
      setCurrentStep(2); // Analysis
    },
    onError: (err: string) => { console.error('[WORKER-ERROR]', err); }
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
      setResult(res);
      setCurrentStep(2); // Analysis
      setLdmActive(false);
    }
  });

  const onFileSelect = (newFile: File | null) => {
    setFile(newFile);
    if (!newFile) {
      setFileMeta(null);
      setResult(null);
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
    if (!file) return;
    setLdmActive(true);
    setLdmStatus('Starting PrintPrice OS Engine...');
    try {
      const res = await startV2Preflight(file, selectedPolicy);
      if (res.job_id || res.jobId) {
        await handleV2JobComplete(res.job_id || res.jobId);
      }
    } catch (err: any) {
      alert('Engine Start Failed: ' + err.message);
      setLdmActive(false);
    }
  }, [file, selectedPolicy, startV2Preflight, handleV2JobComplete]);

  const handleAutoFix = useCallback(async (opts: any) => {
    if (!file) return;
    setLdmActive(true);
    setLdmStatus('Initializing AI Magic Fix on OS...');
    try {
      const { jobId } = await autoFixServer(file, opts);
      if (jobId) {
        setLdmProgress(10);
        const jobResult: any = await handleV2JobComplete(jobId);
        const downloadUrl = getDownloadUrl(jobId);
        setLastPdfUrl(downloadUrl);
        lastPdfUrlRef.current = downloadUrl;
        if (jobResult.report) setAutoFixReport(jobResult.report);
      }
      setLdmActive(false);
    } catch (err: any) {
      alert('AI Magic Failed: ' + err.message);
      setLdmActive(false);
    }
  }, [file, autoFixServer, handleV2JobComplete, getDownloadUrl]);

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

  const handleRunHeatmap = () => {
    if (heatmapData) {
      setHeatmapData(null);
      return;
    }
    setHeatmapLoading(true);
    setTimeout(() => {
      setHeatmapData({
        values: new Uint8Array(100),
        width: 10,
        height: 10,
        maxTac: 300
      });
      setHeatmapLoading(false);
    }, 1500);
  };

  return (
    <ThemeProvider>
      <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] selection:bg-[#dc0000] selection:text-white transition-colors duration-300">
        {isAuthenticated ? (
          <PreflightShell
            headerContent={
              <Stepper
                currentStep={currentStep}
                steps={[
                  { number: 1, title: 'Ingress', description: 'Carriers' },
                  { number: 2, title: 'Forensics', description: 'Scanners' },
                  { number: 3, title: 'Engine', description: 'Policy' },
                  { number: 4, title: 'Certify', description: 'Validated' }
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
                      setCurrentStep(2); // Ensure we go to Analysis (Step 2)
                      if (mode === 'ai' && file) {
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
                    isRunning={isWorkerRunning}
                    onRunAnalysis={() => file && fileMeta && runAnalysis(file, fileMeta)}
                    onRunV2Analysis={() => file && startV2Preflight(file, selectedPolicy)}
                    onNext={() => setCurrentStep(3)}
                    onSkipToReview={() => setCurrentStep(4)}
                    onBack={() => setCurrentStep(1)}
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
                    onRunAnalysis={() => file && fileMeta && runAnalysis(file, fileMeta)}
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
                    onStartOver={handleStartOver}
                    onBack={() => setCurrentStep(3)}
                    appMode={appMode}
                    heatmapData={heatmapData}
                    isHeatmapLoading={heatmapLoading}
                    onRunHeatmap={handleRunHeatmap}
                    originalFile={originalFile}
                    autoFixReport={autoFixReport}
                    previewPages={previewPages}
                    previewLoading={previewLoading}
                  />
                )}
              </div>
            </div>
          </PreflightShell>
        ) : (
          <AuthOverlayV2_4 />
        )}

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
