import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
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
import { pposFetch } from './lib/apiClient';

// Use CDN for worker to ensure stability in production across different server configs
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

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
  const [showEfficiencyModal, setShowEfficiencyModal] = useState(false);

  // ---------- Large Document Mode (LDM) State ----------
  const [ldmActive, setLdmActive] = useState(false);
  const [ldmProgress, setLdmProgress] = useState(0);
  const [ldmStatus, setLdmStatus] = useState<string | null>(null);

  // Preview State (Server-side GS PNGs)
  const [previewPages, setPreviewPages] = useState<string[] | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Engine Error State (Explicit Traceability)
  const [engineError, setEngineError] = useState<{
    code: string;
    message: string;
    traceId?: string;
    details?: string;
    v2?: boolean;
  } | null>(null);

  // UI / Loader
  const lastPdfUrlRef = useRef<string | null>(null);
  const [lastPdfUrl, setLastPdfUrl] = useState<string | null>(null);
  const [lastPdfName, setLastPdfName] = useState<string | null>(null);
  const [selectedProfile, setSelectedProfile] = useState<string>('');
  const [selectedPolicy, setSelectedPolicy] = useState<string>('');

  const { isAuthenticated } = useAuth();

  const activeJobIdRef = useRef<string | null>(null);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // Guard if anything is in progress or if we have a file and are beyond step 1 (upload)
      // This prevents losing the current session (jobId, normalized results, etc) on refresh.
      if (ldmActive || (file && currentStep > 1)) {
        e.preventDefault();
        e.returnValue = 'Work in progress. Are you sure you want to leave?';
        return e.returnValue;
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [ldmActive, file, currentStep]);

  useEffect(() => {
    console.log('[APP][STATE-SYNC] lastPdfUrl changed:', lastPdfUrl);
  }, [lastPdfUrl]);

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
    setEngineError(null);
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
    onComplete: (normalized: any) => {
      // Point of Application (Validation C): Check jobId BEFORE any state change
      const completedJobId = normalized.meta?.jobId || normalized.id;
      if (completedJobId && activeJobIdRef.current && completedJobId !== activeJobIdRef.current) {
        console.warn('[APP][STALE-JOB-DETECTED]', { completed: completedJobId, active: activeJobIdRef.current });
        return;
      }

      console.log('[APP] Preflight Job Complete:', normalized);
      setResult(normalized);
      
      // v2.4.112: Resilient Artifact Selection (Analysis-Only Support)
      if (completedJobId) {
        const artifacts = normalized.artifacts || normalized.result?.artifacts || {};
        const bestArtifactKey = artifacts.final_fixed_pdf ? 'final_fixed_pdf' : 'source_pdf';
        
        const url = `${window.location.origin}/api/v2/jobs/${completedJobId}/artifacts/${bestArtifactKey}`;
        console.log('[APP][SET-DOWNLOAD-URL]', { key: bestArtifactKey, jobId: completedJobId, url });
        
        setLastPdfUrl(url);
        lastPdfUrlRef.current = url;
        
        const fileName = normalized.meta?.fileName || normalized.filename || normalized.meta?.filename || 'certified_document.pdf';
        setLastPdfName(fileName);
      } else {
        console.warn('[APP][SKIP-ARTIFACT-URL] No jobId found for artifact registration');
        setLastPdfUrl(null);
        lastPdfUrlRef.current = null;
      }

      // If we are in step 1 (upload), move to step 2 (results)
      if (currentStep === 1) {
        setAutoFixBefore(normalized);
        setCurrentStep(2);
      }
      
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
        
        // v2.4.113: Synchronous Resilient Artifact Resolution
        const jobId = normalized.meta?.jobId || res.jobId || res.job_id || res.id;
        
        if (jobId) {
          const artifacts = normalized.artifacts || {};
          const bestArtifactKey = artifacts.final_fixed_pdf ? 'final_fixed_pdf' : 'source_pdf';
          
          const url = `${window.location.origin}/api/v2/jobs/${jobId}/artifacts/${bestArtifactKey}`;
          console.log('[APP][SET-DOWNLOAD-URL][SYNC]', { key: bestArtifactKey, jobId, url });
          
          setLastPdfUrl(url);
          lastPdfUrlRef.current = url;
          setLastPdfName(normalized.meta?.fileName || 'certified_document.pdf');
        } else {
          console.warn('[APP][SKIP-ARTIFACT-URL][SYNC] No jobId found');
          setLastPdfUrl(null);
          lastPdfUrlRef.current = null;
        }

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
      console.error('[APP][V2-ERROR]', err);
      setLdmActive(false);
      setLdmStatus('');
      setEngineError({
        code: err.code || 'ENGINE_V2_START_FAILURE',
        message: err.message || 'The PPOS engine failed to initialize the analysis.',
        traceId: err.traceId || 'N/A',
        details: err.status ? `HTTP ${err.status}` : undefined
      });
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
      const res = await autoFixServer(file, opts);
      // Backend Contract: jobId might be in root, jobId, job_id, or nested in result
      let jobId = res.jobId || res.job_id || res.id || res.result?.meta?.jobId || res.inlineResult?.meta?.jobId;
      let jobResult: any = res.inlineResult || res.result || res.job || null;

      console.log('[APP][FIX-START-RES]', { jobId, isInline: !!jobResult });

      if (jobId && !jobResult) {
        activeJobIdRef.current = jobId;
        setLdmProgress(10);
        jobResult = await handleV2JobComplete(jobId);
      } else if (jobResult) {
        // Ensure jobId is synced from the inline result metadata
        if (!jobId) jobId = jobResult.meta?.jobId || jobResult.job_id || jobResult.id;
        activeJobIdRef.current = jobId;
      }
      
      if (jobResult) {
        const finalJobId = jobId || jobResult.meta?.jobId;
        console.log('[APP][FIX-COMPLETE-HAF]', { finalJobId, hasReport: !!jobResult.report });
        if (jobResult.report) setAutoFixReport(jobResult.report);
        
        const normalizedAfter = normalizePreflightResult(jobResult);
        setAutoFixAfter(normalizedAfter);
        setResult(normalizedAfter);
        
        // Final guards for artifact propagation
        if (finalJobId) {
          // v2.4.98: Intelligent Artifact Resolution
          // Check the artifacts registry from the core engine result to avoid 'Waiting for Artifact' hangs
          const availableArtifacts = jobResult.artifacts || {};
          const bestArtifactKey = availableArtifacts.final_fixed_pdf ? 'final_fixed_pdf' : 'source_pdf';
          
          const url = `${window.location.origin}/api/v2/jobs/${finalJobId}/artifacts/${bestArtifactKey}`;
          console.log('[APP][ARTIFACT-URL]', { key: bestArtifactKey, url });
          
          setLastPdfUrl(url);
          lastPdfUrlRef.current = url;
          setLastPdfName(jobResult?.meta?.filename || 'certified_pdf.pdf');
        }

        setCurrentPage(1);
        setCurrentStep(4);
      } else {
        console.error('[APP][FIX-FAILED] No jobResult found in res:', res);
        throw new Error('Engine returned no result data.');
      }
      setLdmActive(false);
    } catch (err: any) {
      console.error('[APP][FIX-ERROR]', err);
      setLdmActive(false);
      setEngineError({
        code: err.code || 'ENGINE_AUTOFIX_FAILURE',
        message: err.message || 'AI Magic Fix encountered a terminal error.',
        traceId: err.traceId || 'N/A'
      });
    }
  }, [file, result, autoFixBefore, autoFixServer, handleV2JobComplete, getDownloadUrl]);

  const handleDownload = useCallback(async () => {
    if (!lastPdfUrl) {
      setEngineError({
        code: 'ARTIFACT_UNAVAILABLE',
        message: 'No certified PDF available for download yet. Ensure analysis is complete.',
        traceId: 'UI_STATE_GUARD'
      });
      return;
    }

    if (lastPdfUrl.startsWith('blob:')) {
      const a = document.createElement('a');
      a.href = lastPdfUrl;
      a.download = lastPdfName || 'certified_document.pdf';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return;
    }

    try {
      setLdmActive(true);
      setLdmStatus('Downloading secure artifact...');
      
      const blob = await pposFetch<Blob>(lastPdfUrl);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = lastPdfName || 'certified_document.pdf';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      setTimeout(() => URL.revokeObjectURL(url), 100);
      setLdmActive(false);
    } catch (err: any) {
      console.error('[DOWNLOAD_ERROR]', err);
      setLdmActive(false);
      setEngineError({
        code: err.code || 'DOWNLOAD_FAILURE',
        message: err.message || 'Secure artifact retrieval failed.',
        traceId: err.traceId || 'N/A'
      });
    }
  }, [lastPdfUrl, lastPdfName]);
  const handleConvertCMYK = useCallback(async () => {
    if (!file) return;
    setLdmActive(true);
    setLdmStatus('Enforcing CMYK Policy...');
    try {
      const jobId = await convertColorServer(file, selectedProfile);
      if (jobId) {
        activeJobIdRef.current = jobId;
        await handleV2JobComplete(jobId);
        const url = getDownloadUrl(jobId);
        setLastPdfUrl(url);
        lastPdfUrlRef.current = url;
      }
      setLdmActive(false);
    } catch (err: any) {
      setLdmActive(false);
      setEngineError({
        code: err.code || 'COLOR_CONVERSION_FAILURE',
        message: err.message || 'Color policy enforcement failed.',
        traceId: err.traceId || 'N/A'
      });
    }
  }, [file, convertColorServer, selectedProfile, handleV2JobComplete, getDownloadUrl]);

  const handleConvertGrayscale = useCallback(async () => {
    if (!file) return;
    setLdmActive(true);
    setLdmStatus('Converting to Grayscale...');
    try {
      const jobId = await convertToGrayscaleServer(file);
      if (jobId) {
        activeJobIdRef.current = jobId;
        await handleV2JobComplete(jobId);
        const url = getDownloadUrl(jobId);
        setLastPdfUrl(url);
        lastPdfUrlRef.current = url;
      }
      setLdmActive(false);
      setLdmActive(false);
    } catch (err: any) {
      setLdmActive(false);
      setEngineError({
        code: err.code || 'GRAYSCALE_CONVERSION_FAILURE',
        message: err.message || 'Grayscale conversion failed.',
        traceId: err.traceId || 'N/A'
      });
    }
  }, [file, convertToGrayscaleServer, handleV2JobComplete, getDownloadUrl]);

  const handleRebuildPdf = useCallback(async () => {
    if (!file) return;
    setLdmActive(true);
    setLdmStatus('Rebuilding Forensic Carrier...');
    try {
      const jobId = await rebuildPdfServer(file, 300);
      if (jobId) {
        activeJobIdRef.current = jobId;
        await handleV2JobComplete(jobId);
        const url = getDownloadUrl(jobId);
        setLastPdfUrl(url);
        lastPdfUrlRef.current = url;
      }
      setLdmActive(false);
      setLdmActive(false);
    } catch (err: any) {
      setLdmActive(false);
      setEngineError({
        code: err.code || 'REBUILD_FAILURE',
        message: err.message || 'Forensic carrier rebuild failed.',
        traceId: err.traceId || 'N/A'
      });
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
      setLdmActive(false);
    } catch (err: any) {
      setLdmActive(false);
      setEngineError({
        code: 'BOOKLET_GENERATION_FAILURE',
        message: err.message || 'Booklet imposition failed.',
        traceId: 'CLIENT_SIDE'
      });
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
                    onError={setEngineError}
                  />
                )}

                {currentStep === 2 && (
                  <Step2AnalysisV2_4
                    file={file}
                    fileMeta={fileMeta}
                    result={result}
                    isRunning={isWorkerRunning || ldmActive}
                    ldmStatus={ldmStatus}
                    ldmProgress={ldmProgress}
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
                    onOpenEfficiency={() => setShowEfficiencyModal(true)}
                    onNext={() => setCurrentStep(4)}
                    onBack={() => setCurrentStep(2)}
                    lastPdfUrl={lastPdfUrl}
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
                    isRunning={isWorkerRunning || ldmActive}
                    ldmStatus={ldmStatus}
                    ldmProgress={ldmProgress}
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
        
        {engineError && (
          <EngineErrorOverlay 
            error={engineError} 
            onClose={() => setEngineError(null)} 
          />
        )}

        <FixDrawerV2_4 
          issue={selectedIssue}
          onClose={() => setSelectedIssue(null)}
          onConvertGrayscale={handleConvertGrayscale}
          onConvertCMYK={handleConvertCMYK}
          onRebuildPdf={handleRebuildPdf}
          onApplyCorrection={() => {
            handleAutoFix({});
            setCurrentStep(3);
          }}
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

        <EfficiencyAuditModalV2_4 
          isOpen={showEfficiencyModal}
          onClose={() => setShowEfficiencyModal(false)}
          result={result}
          issue={selectedIssue}
          fileMeta={fileMeta}
        />
      </div>
    </ThemeProvider>
  );
}

function EngineErrorOverlay({ error, onClose }: { error: any, onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="w-full max-w-lg bg-[var(--bg-secondary)] border-2 border-[#dc0000]/30 shadow-[0_30px_60px_rgba(0,0,0,0.5)] overflow-hidden">
        <div className="bg-[#dc0000] p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
             <div className="h-2 w-2 bg-white animate-pulse" />
             <span className="text-[0.65rem] font-black text-white uppercase tracking-[0.3em]">System_Terminal_Error</span>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white transition-colors">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>
        
        <div className="p-8 space-y-6">
          <div className="space-y-2">
            <h3 className="text-2xl font-black text-[var(--text-primary)] tracking-tight">ENGINE TERMINATED</h3>
            <p className="text-[var(--text-secondary)] text-sm font-medium leading-relaxed">
              {error.message}
            </p>
          </div>
          
          <div className="bg-[var(--bg-tertiary)] p-5 border border-[var(--border-color)] space-y-4">
             <div className="flex justify-between items-center text-[0.65rem] font-black uppercase tracking-widest text-[var(--text-muted)]">
                <span>Error Code</span>
                <span className="text-[var(--accent-color)]">{error.code}</span>
             </div>
             <div className="h-px bg-[var(--border-color)]/50" />
             <div className="flex justify-between items-center text-[0.65rem] font-black uppercase tracking-widest text-[var(--text-muted)]">
                <span>Trace ID</span>
                <span className="font-mono text-[var(--text-secondary)]">{error.traceId}</span>
             </div>
          </div>
          
          <div className="flex flex-col gap-3">
            <button 
              onClick={onClose}
              className="w-full py-4 border border-[var(--accent-color)]/30 text-[0.75rem] font-bold uppercase tracking-widest text-[var(--accent-color)] hover:bg-[var(--accent-color)] hover:text-white transition-all"
            >
              Acknowledge & Close
            </button>
            <p className="text-[0.6rem] text-center text-[var(--text-muted)] font-mono uppercase tracking-[0.2em]">
               Report this trace to PPOS Operations if the problem persists.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
