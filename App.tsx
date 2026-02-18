import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Stepper } from './components/Stepper';
import { Step1Upload } from './components/steps/Step1Upload';
import { Step2Analysis } from './components/steps/Step2Analysis';
import { Step3Fix } from './components/steps/Step3Fix';
import { Step4Review } from './components/steps/Step4Review';
import { LoaderOverlay } from './components/LoaderOverlay';
import { AIAuditModal } from './components/AIAuditModal';
import { useLocale, Locale } from './i18n';

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

const WORKFLOW_STEPS = [
  { number: 1, title: 'Upload PDF', icon: '📄' },
  { number: 2, title: 'Analysis', icon: '🔍' },
  { number: 3, title: 'Fix Issues', icon: '🛠️' },
  { number: 4, title: 'Review', icon: '✅' },
];

export default function App() {
  // ---------- Workflow State ----------
  const [currentStep, setCurrentStep] = useState(1);
  const [appMode, setAppMode] = useState<AppMode>(null);

  // ---------- Main state ----------
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
  const autoFixPendingAfterRef = useRef(false);
  const magicFixStepRef = useRef<{ active: boolean; options: any } | null>(null);

  // Visual QA State
  const [visualPageImage, setVisualPageImage] = useState<string | null>(null);
  const [visualReports, setVisualReports] = useState<Record<number, string>>({});
  const [isVisualAudit, setIsVisualAudit] = useState(false);
  const [showVisualModal, setShowVisualModal] = useState(false);

  // Heatmap State
  const [heatmapData, setHeatmapData] = useState<HeatmapData | null>(null);
  const [heatmapLoading, setHeatmapLoading] = useState(false);

  // ---------- Large Document Mode (LDM) State ----------
  const [ldmActive, setLdmActive] = useState(false);
  const [ldmJobId, setLdmJobId] = useState<string | null>(null);
  const [ldmProgress, setLdmProgress] = useState(0);
  const [ldmStatus, setLdmStatus] = useState<string | null>(null);
  const [ldmMode, setLdmMode] = useState(false);

  // Preview State (Server-side GS PNGs)
  const [previewPages, setPreviewPages] = useState<string[] | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // UI / Loader
  const [processMessage, setProcessMessage] = useState<string | null>(null);
  const [processStage, setProcessStage] = useState<string | undefined>(undefined);

  // UI flags
  const [lastPdfUrl, setLastPdfUrl] = useState<string | null>(null);
  const [lastPdfName, setLastPdfName] = useState<string | null>(null);
  const lastPdfUrlRef = useRef<string | null>(null);
  const [selectedProfile, setSelectedProfile] = useState<string>('iso_coated_v3');
  const [serverAvailable, setServerAvailable] = useState(true);

  const { currentLocale, setLocale } = useLocale(); // Usa el hook useLocale

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

  const downloadAndRemember = useCallback((blob: Blob, filename: string, autoDownload = true) => {
    cleanupUrl();

    const url = URL.createObjectURL(blob);
    lastPdfUrlRef.current = url;
    setLastPdfUrl(url);
    setLastPdfName(filename);

    if (autoDownload) {
      const a = document.createElement('a');
      a.href = url;
      a.download = filename || 'output.pdf';
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
  }, [cleanupUrl]);

  const updateFileState = useCallback((newFile: File, newMeta: FileMeta) => {
    setFile(newFile);
    setFileMeta(newMeta);
    setResult(null);
    setSelectedIssue(null);
    setNumPages(0);
    setCurrentPage(1);
    setVisualPageImage(null);
    setAutoFixBefore(null);
    setAutoFixAfter(null);
    setCompareEnabled(false);
    setPreviewPages(null);
  }, []);

  // ---------- Hooks ----------
  const {
    isServerRunning,
    convertToGrayscaleServer,
    convertColorServer,
    rebuildPdfServer,
    autoFixServer,
    createBookletClient,
    generatePreviewServer,
    pollJob,
    getLdmPagePreviewUrl
  } = usePdfTools();

  const runAnalysisRef = useRef<any>(null);

  const onAnalysisResult = useCallback((res: PreflightResult) => {
    setResult(res || null);
    if (autoFixPendingAfterRef.current) {
      setAutoFixAfter(res || null);
      autoFixPendingAfterRef.current = false;
    }
    setProcessMessage(null);
    setProcessStage(undefined);
  }, []);

  const onRenderPageResult = useCallback((base64: string) => {
    setVisualPageImage(base64);
    setProcessMessage(null);
  }, []);

  const onTransformResult = useCallback((blob: Blob, meta: FileMeta, operation: string) => {
    setProcessMessage(null);

    let opLabel = 'Processed';
    if (operation === 'grayscale') opLabel = 'B&W / Grayscale';
    else if (operation === 'upscaleImages') opLabel = 'Rebuild ≥150 dpi';
    else if (operation === 'fixBleed') opLabel = 'Bleed Fixed';

    updateFileState(new File([blob], meta.name, { type: 'application/pdf' }), meta);
    downloadAndRemember(blob, meta.name, false); // No auto-download here

    // --- MAGIC FIX ORCHESTRATION ---
    if (magicFixStepRef.current?.active && operation === 'fixBleed') {
      const options = magicFixStepRef.current.options;
      const nextFile = new File([blob], meta.name, { type: 'application/pdf' });

      // Stage 2: Server-side CMYK + Profile + OutputIntent
      setProcessMessage('AI Wizard: Stage 2/2 - Applying professional color profiles & ICC...');
      setProcessStage('fix');

      autoFixServer(nextFile, {
        target: 'cmyk',
        profile: options.profile || 'iso_coated_v2',
        bleedMm: 0, // Already handled by worker
        forceCmyk: true,
        forceBleed: false, // SKIP server bleed
        strictVector: true, // Re-enable for final stage
        dpiPreferred: 300
      }).then(({ blob: finalBlob, report }) => {
        const originalName = file?.name.replace(/\.pdf$/i, '') || 'document';
        const newName = `${originalName}_Magic_Fix.pdf`;
        const finalFile = new File([finalBlob], newName, { type: 'application/pdf' });

        setAutoFixReport(report || null);
        updateFileState(finalFile, { name: nextFile.name, size: finalFile.size, type: 'application/pdf' });
        downloadAndRemember(finalBlob, newName, false);

        setProcessMessage('AI Wizard: Performing final quality check...');
        setProcessStage('verify');
        if (runAnalysisRef.current) {
          runAnalysisRef.current(finalFile, { name: nextFile.name, size: finalFile.size, type: 'application/pdf' });
        }

        setProcessMessage(null);
        setProcessStage(undefined);
        setCurrentStep(4);
        magicFixStepRef.current = null;
      }).catch((e) => {
        // Handle error in Stage 2
        console.error('Magic Fix Stage 2 failed', e);
        setProcessMessage(null);
        setProcessStage(undefined);
        magicFixStepRef.current = null;
        alert(`Magic Fix Stage 2 failed: ${e.message}\nSwitching to manual mode.`);
        setAppMode('manual');
        setCurrentStep(2);
      });
    }
  }, [file, updateFileState, downloadAndRemember, autoFixServer]);

  const onWorkerError = useCallback((msg: string) => {
    console.error('Worker error:', msg);
    setHeatmapLoading(false);
    setProcessMessage(null);
    window.alert('Operation failed: ' + msg);
  }, []);

  const onHeatmapResult = useCallback((data: { values: Uint8Array; width: number; height: number; maxTac: number }) => {
    setHeatmapData(data);
    setHeatmapLoading(false);
    setProcessMessage(null);
  }, []);

  const {
    isWorkerRunning,
    runAnalysis,
    runClientGrayscale,
    runClientUpscale,
    runFixBleed,
    runTacHeatmap,
    runRenderPageAsImage,
  } = usePreflightWorker({
    onAnalysisResult,
    onTransformResult,
    onError: onWorkerError,
    onHeatmapResult,
    onRenderPageResult,
  });

  // Connect the ref
  runAnalysisRef.current = runAnalysis;

  const isRunning = isWorkerRunning || isServerRunning;

  useEffect(() => {
    if (!file) {
      setHeatmapData(null);
      setPreviewPages(null);
      setLdmActive(false);
      setLdmMode(false);
      setLdmJobId(null);
      setLdmProgress(0);
    } else {
      // Trigger server preview generation for reliable CMYK visualization
      const generatePreview = async () => {
        setPreviewLoading(true);
        try {
          const res = await generatePreviewServer(file);
          if (res.ok) setPreviewPages(res.pages);
        } catch (e) {
          console.warn('Server preview failed, falling back to PDF.js', e);
        } finally {
          setPreviewLoading(false);
        }
      };
      generatePreview();
    }
  }, [file, generatePreviewServer]);

  const handleRunHeatmap = useCallback((f: File, meta: FileMeta, page: number) => {
    setHeatmapLoading(true);
    setHeatmapData(null);
    setProcessMessage('Generating Ink Coverage Heatmap...');
    runTacHeatmap(f, meta, page);
  }, [runTacHeatmap]);

  const handleRunVisualCheck = useCallback(() => {
    if (!file || !fileMeta) return;
    setProcessMessage('Rendering page for AI Visual Check...');
    runRenderPageAsImage(file, fileMeta, currentPage);
    setShowVisualModal(true);
  }, [file, fileMeta, currentPage, runRenderPageAsImage]);

  // ---------- Workflow Handlers ----------

  const onFileSelect = useCallback((f: File | null) => {
    setFile(f);
    setOriginalFile(f); // Store original for Before/After comparison
    setResult(null);
    setSelectedIssue(null);
    setNumPages(0);
    setCurrentPage(1);
    setVisualPageImage(null);
    setAppMode(null);

    if (f) {
      setFileMeta({ name: f.name, size: f.size, type: f.type });
    } else {
      setFileMeta(null);
    }
  }, []);

  const runPreflight = useCallback(() => {
    if (!file || !fileMeta) return;
    setResult(null);
    setSelectedIssue(null);
    setHeatmapData(null);

    setProcessMessage('Analyzing PDF Structure & Content...');
    setProcessStage('analyze');
    runAnalysis(file, fileMeta);
  }, [file, fileMeta, runAnalysis]);

  const convertToGrayscale = useCallback(async () => {
    if (!file || !fileMeta) return;
    setResult(null);
    setSelectedIssue(null);

    setProcessMessage('Converting to Grayscale (Server)...');
    setProcessStage('fix');
    try {
      const blob = await convertToGrayscaleServer(file);
      const newName = file.name.replace(/\.pdf$/i, '') + '_bw.pdf';
      const newFile = new File([blob], newName, { type: 'application/pdf' });

      downloadAndRemember(blob, newName, false); // No auto-download
      updateFileState(newFile, { name: newName, size: blob.size, type: 'application/pdf' });

      // Auto-reanalyze the processed file
      setTimeout(() => {
        setProcessMessage('Re-analyzing grayscale PDF...');
        runAnalysis(newFile, { name: newName, size: blob.size, type: 'application/pdf' });
      }, 500);

      setProcessMessage(null);
      setProcessStage(undefined);
    } catch (e: any) {
      console.warn('Server grayscale failed:', e);
      setProcessMessage(null);
      setProcessStage(undefined);

      if (e.message?.includes('500') || e.message?.includes('Failed to fetch')) {
        setServerAvailable(false);
      }

      if (window.confirm(
        'Server method unavailable. Do you want to use the local fallback?\n\n' +
        'WARNING: This will rasterize text (convert to image), making it unselectable and potentially lower quality.'
      )) {
        setProcessMessage('Converting to Grayscale (Local Fallback)...');
        runClientGrayscale(file, fileMeta);
      }
    }
  }, [file, fileMeta, convertToGrayscaleServer, downloadAndRemember, updateFileState, runClientGrayscale, runAnalysis]);

  const upscaleLowResImages = useCallback(async () => {
    if (!file || !fileMeta) return;
    setResult(null);
    setSelectedIssue(null);

    setProcessMessage('Rebuilding PDF (300 DPI High-Res)...');
    try {
      const blob = await rebuildPdfServer(file, 300);
      const newName = file.name.replace(/\.pdf$/i, '') + '_rebuild_300dpi.pdf';
      const newFile = new File([blob], newName, { type: 'application/pdf' });

      downloadAndRemember(blob, newName, false); // No auto-download
      updateFileState(newFile, { name: newName, size: blob.size, type: 'application/pdf' });

      // Auto-reanalyze the processed file
      setTimeout(() => {
        setProcessMessage('Re-analyzing rebuilt PDF...');
        runAnalysis(newFile, { name: newName, size: blob.size, type: 'application/pdf' });
      }, 500);

      setProcessMessage(null);
    } catch (e: any) {
      console.warn('Server rebuild failed:', e);
      setProcessMessage(null);

      if (e.message?.includes('500') || e.message?.includes('Failed to fetch')) {
        setServerAvailable(false);
      }

      if (window.confirm(
        'Server method unavailable. Do you want to use the local fallback?\n\n' +
        '⚠️ WARNING: This will rasterize the entire PDF (convert to images).\n' +
        '• Text will NOT be selectable\n' +
        '• Fonts may appear as boxes/symbols\n' +
        '• File size will increase significantly\n\n' +
        'For best results, use the server method (ensure backend is running).\n\n' +
        'Continue with client-side processing?'
      )) {
        setProcessMessage('Rebuilding PDF (Local Fallback)...');
        runClientUpscale(file, fileMeta);
      }
    }
  }, [file, fileMeta, rebuildPdfServer, downloadAndRemember, updateFileState, runClientUpscale, runAnalysis]);
  const autoFixPdf = useCallback(async (options?: any) => {
    if (!file || !fileMeta) return;

    // Snapshot BEFORE state for Pro reporting
    const before = result;
    setAutoFixBefore(before || null);
    setAutoFixAfter(null);
    setAutoFixReport(null);
    setAutoFixRunId(Date.now());
    autoFixPendingAfterRef.current = true;

    setResult(null);
    setSelectedIssue(null);

    setProcessMessage('AutoFix Agent (PRO): Orchestrating PDF transformations...');
    setProcessStage('preflight');
    try {
      const { blob, report, jobId, ldm } = await autoFixServer(file, {
        target: options?.forceCmyk ? 'cmyk' : 'none',
        profile: 'iso_coated_v2',
        bleedMm: options?.forceBleed ? (options?.bleedMm || 3) : 0,
        dpiPreferred: 300,
        dpiMin: 150,
        issues: before || undefined,
        ...options
      });

      if (ldm && jobId) {
        setLdmActive(true);
        setLdmJobId(jobId);
        setLdmStatus('Large document processing active');
        setProcessMessage('Large Document Mode: Processing pages sequentially (background job)...');

        // Start polling
        try {
          const finishedJob = await pollJob(jobId, (p) => setLdmProgress(p));

          // Job finished, fetch final file
          const finalRes = await fetch(`/api/convert/job/status/${jobId}`);
          const jobData = await finalRes.json();

          // In a real app we'd fetch the file from /jobs/{id}/final_fixed.pdf
          // For now let's assume certified status means we can proceed
          // We'll need a way to get the final blob
          const fileRes = await fetch(`/api/convert/download-job/${jobId}`);
          const finalBlob = await fileRes.blob();

          const suffix = '_autofix_ldm.pdf';
          const newName = file.name.replace(/\.pdf$/i, '') + suffix;
          const newFile = new File([finalBlob], newName, { type: 'application/pdf' });

          setAutoFixReport(jobData.report || null);
          downloadAndRemember(finalBlob, newName, false);
          updateFileState(newFile, { name: newName, size: finalBlob.size, type: 'application/pdf' });

          setLdmActive(false);
          setLdmMode(true);
          setProcessMessage(null);

          setTimeout(() => {
            runAnalysis(newFile, { name: newName, size: finalBlob.size, type: 'application/pdf' });
          }, 500);

        } catch (pollErr: any) {
          setProcessMessage(null);
          setLdmActive(false);
          alert(`LDM Job failed: ${pollErr.message}`);
        }
        return;
      }

      const suffix = '_autofix_isoCoatedv2_bleed3mm.pdf';
      const newName = file.name.replace(/\.pdf$/i, '') + suffix;
      const newFile = new File([blob], newName, { type: 'application/pdf' });

      setAutoFixReport(report || null);
      if (report) console.info('AutoFix report:', report);

      downloadAndRemember(blob, newName, false);
      updateFileState(newFile, { name: newName, size: blob.size, type: 'application/pdf' });

      setTimeout(() => {
        setProcessMessage('Re-analyzing AutoFixed PDF...');
        setProcessStage('verify');
        runAnalysis(newFile, { name: newName, size: blob.size, type: 'application/pdf' });
      }, 500);

      setProcessMessage(null);
    } catch (e: any) {
      console.warn('AutoFix failed:', e);
      setProcessMessage(null);
      setProcessStage(undefined);

      const isServerDown = e.message?.includes('Failed to fetch') || e.message?.includes('unreachable');
      const isProcessingError = e.status >= 500 || e.message?.includes('GS Error');

      if (isServerDown) {
        setServerAvailable(false);
      }

      // Handle Blocked/Reported Errors
      if (e.report) {
        setAutoFixReport(e.report);
      }

      if (e.message === 'OUTPUT_RASTERIZED_BLOCKED') {
        alert('AutoFix Blocked: The result was rasterized (images only), which violates the "Strict Vector" policy. See the report specific details.');
      } else {
        const errorMsg = isServerDown
          ? 'SERVER UNREACHABLE: Please ensure the backend service is running locally.'
          : (isProcessingError ? `PROCESSING FAILED (500): The server encountered an error (timeout, memory, or Ghostscript crash). Try a smaller file or manual mode.` : (e.message || e));
        alert(`AutoFix Error: ${errorMsg}`);
      }
    }
  }, [file, fileMeta, result, autoFixServer, downloadAndRemember, updateFileState, runAnalysis]);


  const convertColors = useCallback(async () => {
    if (!file) return;
    setResult(null);
    setSelectedIssue(null);

    setProcessMessage(`Converting colors to ${selectedProfile.toUpperCase()}...`);
    try {
      const blob = await convertColorServer(file, selectedProfile);
      const newName = file.name.replace(/\.pdf$/i, '') + `_${selectedProfile}.pdf`;
      const newFile = new File([blob], newName, { type: 'application/pdf' });

      downloadAndRemember(blob, newName, false);
      updateFileState(newFile, { name: newName, size: blob.size, type: 'application/pdf' });

      // Auto-reanalyze the processed file
      setTimeout(() => {
        setProcessMessage('Re-analyzing converted PDF...');
        runAnalysis(newFile, { name: newName, size: blob.size, type: 'application/pdf' });
      }, 500);

    } catch (e: any) {
      console.error('convertColors failed', e);
      const isServerDown = e.message?.includes('Failed to fetch');
      const isProcessingError = e.status >= 500 || e.message?.includes('GS Error');
      if (isServerDown) setServerAvailable(false);

      window.alert(isServerDown
        ? 'Server is unreachable. Please ensure the backend is running.'
        : (isProcessingError ? 'Server error (500) during conversion. The file might be too complex for a single pass.' : `Conversion failed: ${e.message}`));
    } finally {
      setProcessMessage(null);
    }
  }, [file, selectedProfile, convertColorServer, downloadAndRemember, updateFileState, runAnalysis]);

  const makeBooklet = useCallback(async () => {
    if (!file) return;
    setProcessMessage('Creating 2-up Booklet...');
    try {
      const blob = await createBookletClient(file);
      const newName = file.name.replace(/\.pdf$/i, '') + '_booklet.pdf';
      const newFile = new File([blob], newName, { type: 'application/pdf' });

      downloadAndRemember(blob, newName, false);
      updateFileState(newFile, { name: newName, size: blob.size, type: 'application/pdf' });
      window.alert('Booklet created successfully (2-up saddle stitch implementation).');
    } catch (e) {
      console.error('Booklet creation failed', e);
      window.alert('Booklet creation failed: ' + (e as Error).message);
    } finally {
      setProcessMessage(null);
    }
  }, [file, createBookletClient, downloadAndRemember, updateFileState]);

  const handleFixBleed = useCallback(async (mode: 'safe' | 'aggressive' = 'safe') => {
    if (!file || !fileMeta) return;
    setProcessMessage('Applying Bleed Fix...');
    try {
      await runFixBleed(file, fileMeta, mode);
    } catch (e) {
      console.error('Fix bleed failed', e);
      window.alert('Fix bleed failed: ' + (e as Error).message);
      setProcessMessage(null);
    }
  }, [file, fileMeta, runFixBleed]);

  const runMagicAiFix = useCallback(async () => {
    if (!file || !fileMeta) return;

    // Store original file for Before/After comparison
    setOriginalFile(file);
    setAppMode('ai');

    // Stage 1: Client-side Bleed Fix (Safe/Aggressive logic in worker)
    setProcessMessage('AI Wizard: Stage 1/2 - Applying localized Bleed Fix (Bleed Engine v2)...');
    setProcessStage('upload');

    try {
      // Set up orchestration state
      magicFixStepRef.current = {
        active: true,
        options: { profile: 'iso_coated_v2' }
      };

      // Trigger worker first
      runFixBleed(file, fileMeta, 'safe');
      // Logic continues in onTransformResult when 'fixBleed' finishes

    } catch (e: any) {
      console.error('Magic Fix initiation failed', e);
      setProcessMessage(null);
      setProcessStage(undefined);
      magicFixStepRef.current = null;
      alert(`Magic Fix failed to start: ${e.message}`);
      setAppMode('manual');
      setCurrentStep(2);
    }
  }, [file, fileMeta, autoFixServer, updateFileState, downloadAndRemember, runAnalysis]);

  const onPageChange = useCallback((p: number) => setCurrentPage(p), []);

  const openIssue = useCallback((issue: Issue) => {
    setSelectedIssue(issue);
    if (typeof issue.page === 'number' && issue.page > 0) {
      setCurrentPage(issue.page);
    }
  }, []);

  const handleOpenAIAudit = useCallback((issue: Issue) => {
    // Handled in Step3Fix component
  }, []);

  const handleOpenEfficiencyTips = useCallback((issue: Issue) => {
    // Handled in Step3Fix component
  }, []);

  const handleStartOver = useCallback(() => {
    setCurrentStep(1);
    setFile(null);
    setFileMeta(null);
    setResult(null);
    setSelectedIssue(null);
    setNumPages(0);
    setCurrentPage(1);
    setAppMode(null);
    setLastPdfUrl(null);
    setLastPdfName(null);
  }, []);

  // ---------- Render ----------
  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#fcfdfe',
      position: 'relative',
      overflowX: 'hidden',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      {/* Background Aesthetic Blobs */}
      <div style={{
        position: 'absolute', top: 0, right: 0, width: '50vw', height: '50vw',
        background: 'rgba(59, 130, 246, 0.05)', filter: 'blur(120px)', borderRadius: '50%',
        zIndex: 0, transform: 'translate(30%, -30%)'
      }} />
      <div style={{
        position: 'absolute', bottom: 0, left: 0, width: '40vw', height: '40vw',
        background: 'rgba(239, 68, 68, 0.05)', filter: 'blur(100px)', borderRadius: '50%',
        zIndex: 0, transform: 'translate(-30%, 30%)'
      }} />

      <div style={{ position: 'absolute', top: '24px', right: '32px', zIndex: 50 }}>
        <select
          value={currentLocale}
          onChange={(e) => setLocale(e.target.value as Locale)}
          style={{
            background: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(10px)',
            border: '1px solid #e5e7eb', borderRadius: '16px', fontSize: '11px',
            fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1px',
            color: '#374151', padding: '10px 16px', cursor: 'pointer', outline: 'none'
          }}
        >
          <option value="en">English</option>
          <option value="es">Español</option>
        </select>
      </div>

      <LoaderOverlay isOpen={!!processMessage || isWorkerRunning} message={processMessage || 'Processing...'} stageKey={processStage} />

      <main style={{
        width: '100%',
        maxWidth: '1440px',
        padding: '60px 24px',
        margin: '0 auto',
        position: 'relative',
        zIndex: 10
      }}>
        <Stepper currentStep={currentStep} steps={WORKFLOW_STEPS} />

        <div style={{ marginTop: '32px' }}>
          {currentStep === 1 && (
            <Step1Upload
              file={file}
              fileMeta={fileMeta}
              onFileSelect={onFileSelect}
              onNext={(mode) => {
                setAppMode(mode);
                if (mode === 'ai') {
                  runMagicAiFix();
                } else {
                  setCurrentStep(2);
                }
              }}
            />
          )}

          {currentStep === 2 && (
            <Step2Analysis
              file={file}
              fileMeta={fileMeta}
              result={result}
              autoFixBefore={autoFixBefore}
              autoFixAfter={autoFixAfter}
              autoFixReport={autoFixReport}
              autoFixRunId={autoFixRunId}
              isRunning={isRunning}
              onRunAnalysis={runPreflight}
              onNext={() => setCurrentStep(3)}
              onSkipToReview={() => setCurrentStep(4)}
              onBack={() => setCurrentStep(1)}
            />
          )}

          {currentStep === 3 && (
            <Step3Fix
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
              isRunning={isRunning}
              selectedProfile={selectedProfile}
              onPageChange={onPageChange}
              onNumPagesChange={setNumPages}
              onSelectIssue={openIssue}
              onRunAnalysis={runPreflight}
              onRunHeatmap={() => file && fileMeta && handleRunHeatmap(file, fileMeta, currentPage)}
              onRunVisualCheck={handleRunVisualCheck}
              onFixBleed={handleFixBleed}
              onConvertGrayscale={convertToGrayscale}
              onConvertCMYK={convertColors}
              onRebuildPdf={upscaleLowResImages}
              onAutoFix={autoFixPdf}
              onToggleCompare={setCompareEnabled}
              onProfileChange={setSelectedProfile}
              onOpenAIAudit={handleOpenAIAudit}
              onOpenEfficiency={handleOpenEfficiencyTips}
              onNext={() => setCurrentStep(4)}
              onBack={() => setCurrentStep(2)}
              serverAvailable={serverAvailable}
              previewPages={previewPages}
              previewLoading={previewLoading}
              ldmActive={ldmActive}
              ldmProgress={ldmProgress}
              ldmStatus={ldmStatus}
              ldmMode={ldmMode}
              ldmJobId={ldmJobId}
            />
          )}

          {currentStep === 4 && (
            <Step4Review
              file={file}
              fileMeta={fileMeta}
              result={result}
              numPages={numPages}
              currentPage={currentPage}
              lastPdfUrl={lastPdfUrl}
              lastPdfName={lastPdfName}
              isRunning={isRunning}
              onPageChange={onPageChange}
              onNumPagesChange={setNumPages}
              onConvertGrayscale={convertToGrayscale}
              onConvertColors={convertColors}
              onRebuildPdf={upscaleLowResImages}
              onMakeBooklet={makeBooklet}
              onStartOver={handleStartOver}
              onBack={() => setCurrentStep(3)}
              appMode={appMode}
              heatmapData={heatmapData}
              isHeatmapLoading={heatmapLoading}
              onRunHeatmap={() => file && fileMeta && handleRunHeatmap(file, fileMeta, currentPage)}
              originalFile={originalFile}
              autoFixReport={autoFixReport}
              previewPages={previewPages}
              previewLoading={previewLoading}
            />
          )}
        </div>
      </main>

      <AIAuditModal
        isOpen={showVisualModal}
        onClose={() => setShowVisualModal(false)}
        issue={null}
        fileMeta={fileMeta}
        result={result}
        visualImage={visualPageImage}
        isVisualMode={true}
        cachedResponse={visualReports[currentPage] || null}
        onSaveResponse={(response) => {
          setVisualReports(prev => ({ ...prev, [currentPage]: response }));
        }}
      />
    </div>
  );
}
