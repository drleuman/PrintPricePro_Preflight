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
import { normalizePreflightResult, pickCanonicalJobId } from './utils/payloadNormalization';
import { normalizeDownloadFilename } from './utils/formatters';
import { usePreflightWorker } from './hooks/usePreflightWorker';
import { usePdfTools } from './hooks/usePdfTools';
import { pposFetch } from './lib/apiClient';

// Use CDN for worker to ensure stability in production across different server configs
const PDFJS_WORKER_URL = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
console.log('[APP][PDFJS][WORKER-SRC]', PDFJS_WORKER_URL);

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
  const [fixError, setFixError] = useState<any | null>(null);
  const [autoFixRunId, setAutoFixRunId] = useState<number | null>(null);
  const [sourceJobId, setSourceJobId] = useState<string | null>(null);
  const [targetJobId, setTargetJobId] = useState<string | null>(null);
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
    setFixError(null);
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
    getDownloadUrl,
    getAuthenticatedBlobUrl
  } = usePdfTools({
    onStatus: (st: string) => { setLdmStatus(st); },
    onComplete: (normalized: any) => {
      // Point of Application (Validation C): Check jobId BEFORE any state change
      const completedJobId = pickCanonicalJobId(normalized.meta?.jobId, normalized.id);
      if (completedJobId && activeJobIdRef.current && completedJobId !== activeJobIdRef.current) {
        console.warn('[APP][STALE-JOB-DETECTED]', { completed: completedJobId, active: activeJobIdRef.current });
        return;
      }

      console.log('[APP] Preflight Job Complete:', normalized);
      setResult(normalized);

      // v2.4.112: Resilient Artifact Selection (Analysis-Only Support)
      if (completedJobId) {
          // Selection Logic (Requirement 2 & 3)
          const artifacts = normalized.artifacts || normalized.result?.artifacts || {};
          const bestArtifactKey = artifacts.certified_pdf || artifacts.fixed_pdf || artifacts.final_fixed_pdf || null;

          console.log('[APP][ARTIFACT-RESOLUTION]', { 
            jobType, 
            available: Object.keys(artifacts), 
            selected: bestArtifactKey,
            autofix_effective: normalized.meta?.autofix_effective 
          });

          if (bestArtifactKey) {
            try {
              const bUrl = await getAuthenticatedBlobUrl(completedJobId, bestArtifactKey);
              if (bUrl) {
                console.log('[APP][SET-DOWNLOAD-URL]', { key: bestArtifactKey, jobId: completedJobId, url: bUrl });
                setLastPdfUrl(bUrl);
                lastPdfUrlRef.current = bUrl;
              }
            } catch (err) {
              console.error('[APP][ARTIFACT-RESOLVE-ERROR]', err);
            }
          } else if (file) {
            // Fallback to original uploaded file (client-side) if no certified artifact exists
            const url = URL.createObjectURL(file);
            console.log('[APP][SET-DOWNLOAD-URL][FALLBACK]', { url });
            setLastPdfUrl(url);
            lastPdfUrlRef.current = url;
          } else {
            console.warn('[APP][SKIP-ARTIFACT-URL] No artifact and no local file');
            setLastPdfUrl(null);
            lastPdfUrlRef.current = null;
          }
        };

        updateArtifactUrl();

        // v2.4.120: Premium Filename Resolution (No-Unknown Policy)
        const jobFileName = (normalized as any).meta?.fileName || (normalized as any).filename || (normalized as any).meta?.filename;
        const isInternalUuid = jobFileName && /^[0-9a-f-]{36}/.test(jobFileName);
        const isGenericName = jobFileName && jobFileName.toLowerCase().includes('unknown');

        let finalDisplayName = jobFileName;
        if (!jobFileName || isInternalUuid || isGenericName) {
          finalDisplayName = fileMeta?.name || file?.name || jobFileName || 'certified_document.pdf';
        }

        setLastPdfName(finalDisplayName);
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
        // v2.4.120: Forensic ID Propagation Bridge
        // We prioritize root keys then nested meta to ensure artifacts can resolve
        const jobId = pickCanonicalJobId(res.jobId, res.job_id, res.id, normalized.meta?.jobId, res.jobMeta?.id);
        if (jobId) {
          console.log('[APP][CANONICAL-JOB-ID]', { new: jobId, previous: activeJobIdRef.current });
          activeJobIdRef.current = jobId;

          const artifacts = normalized.artifacts || {};
          const bestArtifactKey = artifacts.certified_pdf || artifacts.fixed_pdf || artifacts.final_fixed_pdf || null;

          console.log('[APP][V2-START][ARTIFACT-RESOLUTION]', { jobType, selected: bestArtifactKey });

          if (bestArtifactKey) {
            getAuthenticatedBlobUrl(jobId, bestArtifactKey).then(bUrl => {
              if (bUrl) {
                console.log('[APP][SET-DOWNLOAD-URL][SYNC]', { key: bestArtifactKey, jobId, url: bUrl });
                setLastPdfUrl(bUrl);
                lastPdfUrlRef.current = bUrl;
              }
            }).catch(err => console.error('[APP][SYNC-ARTIFACT-ERROR]', err));
          } else if (file) {
            const url = URL.createObjectURL(file);
            console.log('[APP][SET-DOWNLOAD-URL][SYNC-FALLBACK]', { url });
            setLastPdfUrl(url);
            lastPdfUrlRef.current = url;
          } else {
            console.error('[APP][CRITICAL-SYNC-FAILURE] Success response received but NO canonical jobId found. Certification artifacts will be broken.');
            setLastPdfUrl(null);
            lastPdfUrlRef.current = null;
          }
          // v2.4.120: Sync Mode Filename Resolution
          const jobFileName = (normalized as any).meta?.fileName || (normalized as any).filename || (normalized as any).meta?.filename;
          const isInternalUuid = jobFileName && /^[0-9a-f-]{36}/.test(jobFileName);

          let finalDisplayName = jobFileName;
          if (!jobFileName || isInternalUuid) {
            finalDisplayName = fileMeta?.name || file?.name || jobFileName || 'certified_document.pdf';
          }

          setLastPdfName(finalDisplayName);
        } else {
          console.error('[APP][CRITICAL-SYNC-FAILURE] Success response received but NO canonical jobId found. Certification artifacts will be broken.');
          setLastPdfUrl(null);
          lastPdfUrlRef.current = null;
        }

        setCurrentStep(2);
        setLdmActive(false);
        return;
      }

      if (res.jobId) {
        activeJobIdRef.current = res.jobId;
        setSourceJobId(res.jobId); // Set sourceJobId on initial analyze
        console.log('[APP][V2-START] Async mode, Job ID set to', res.jobId);
        setLdmStatus('Engine Processing...');
        await handleV2JobComplete(res.jobId);

        // Final guard if onComplete didn't finish or for synchronous success
        if (activeJobIdRef.current === res.jobId) {
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
  }, [file, selectedPolicy, startV2Preflight, handleV2JobComplete, resetResidues, ldmActive, appMode, fileMeta, getAuthenticatedBlobUrl]);

  const handleAutoFix = useCallback(async (opts: any) => {
    if (!file) return;

    // Save current result as 'before' if not already set
    if (result && !autoFixBefore) {
      setAutoFixBefore(result);
      console.log('[APP][FIX-START] Storing Before state for Step 4 comparison');
    }

    setLdmActive(true);
    setFixError(null);
    setLdmStatus('Initializing AI Magic Fix on OS...');
    console.log('[APP][STEP3][STATE]', {
      status: 'FIX_INITIALIZING',
      sourceJobId: activeJobIdRef.current,
      policy: opts?.policy || selectedPolicy
    });

    try {
      const res = await autoFixServer(file, {
        policy: opts?.policy || selectedPolicy,
        jobId: activeJobIdRef.current
      });

      // Backend Contract: jobId might be in root, jobId, job_id, or nested in result
      let jobId = pickCanonicalJobId(res.jobId, res.job_id, res.id, res.result?.meta?.jobId, res.inlineResult?.meta?.jobId);

      console.log('[APP][FIX][NEXT-JOB-ID]', { jobId, sourceId: activeJobIdRef.current });

      if (jobId) {
        console.log('[APP][CANONICAL-JOB-ID][FROM-FIX]', { new: jobId, previous: activeJobIdRef.current });
        setTargetJobId(jobId);
        activeJobIdRef.current = jobId;
      }

      let jobResult: any = res.inlineResult || res.result || res.job || null;
      console.log('[APP][FIX-START-RES]', { jobId, isInline: !!jobResult });

      if (jobId && !jobResult) {
        activeJobIdRef.current = jobId;
        setLdmProgress(10);
        console.log('[APP][STEP3][STATE]', { status: 'FIX_POLLING', targetJobId: jobId });
        jobResult = await handleV2JobComplete(jobId);
      } else if (jobResult) {
        // Ensure jobId is synced from the inline result metadata
        if (!jobId) {
          jobId = pickCanonicalJobId(jobResult.meta?.jobId, jobResult.job_id, jobResult.id) || jobId;
          if (jobId) {
            setTargetJobId(jobId);
            activeJobIdRef.current = jobId;
          }
        }
      }

      if (jobResult) {
        const finalJobId = jobId || jobResult.meta?.jobId;
        console.log('[APP][FIX-COMPLETE-HAF]', { finalJobId, hasReport: !!jobResult.report });
        if (jobResult.report) setAutoFixReport(jobResult.report);

        const normalizedAfter = normalizePreflightResult(jobResult);
        setAutoFixAfter(normalizedAfter);
        setResult(normalizedAfter);

        console.log('[APP][STEP4][ARTIFACT-RESOLUTION]', {
          jobId: finalJobId,
          hasCorrectedArtifact: !!(jobResult.artifacts?.final_fixed_pdf || jobResult.artifacts?.certified_pdf)
        });

        // Final guards for artifact propagation
        if (finalJobId) {
          // v2.4.150: Strict AUTOFIX Artifact Resolution (Requirement A)
          const artifacts = jobResult.artifacts || {};
          const bestArtifactKey = artifacts.certified_pdf || artifacts.fixed_pdf || artifacts.final_fixed_pdf || null;

          console.log('[APP][FIX][ARTIFACT-RESOLUTION]', { 
            jobType, 
            selected: bestArtifactKey, 
            effective: normalizedAfter.meta?.autofix_effective 
          });

          if (bestArtifactKey) {
            getAuthenticatedBlobUrl(finalJobId, bestArtifactKey).then(bUrl => {
              if (bUrl) {
                console.log('[APP][ARTIFACT-URL]', { key: bestArtifactKey, url: bUrl });
                setLastPdfUrl(bUrl);
                lastPdfUrlRef.current = bUrl;
              }
            }).catch(err => console.error('[APP][FIX-ARTIFACT-ERROR]', err));
          } else if (file) {
            const url = URL.createObjectURL(file);
            console.log('[APP][ARTIFACT-URL][FALLBACK]', { url });
            setLastPdfUrl(url);
            lastPdfUrlRef.current = url;
          } else {
            setLastPdfUrl(null);
            lastPdfUrlRef.current = null;
          }
          // v2.4.120: AutoFix Filename Resolution
          const jobFileName = jobResult?.meta?.fileName || jobResult?.filename || jobResult?.meta?.filename;
          const isInternalUuid = jobFileName && /^[0-9a-f-]{36}/.test(jobFileName);
          const isGenericName = jobFileName && jobFileName.toLowerCase().includes('unknown');

          let finalDisplayName = jobFileName;
          if (!jobFileName || isInternalUuid || isGenericName) {
            finalDisplayName = fileMeta?.name || file?.name || jobFileName || 'certified_pdf.pdf';
          }

          setLastPdfName(finalDisplayName);
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
      const errorObj = {
        code: err.code || 'ENGINE_AUTOFIX_FAILURE',
        message: err.message || 'AI Magic Fix encountered a terminal error.',
        traceId: err.traceId || 'N/A'
      };
      setFixError(errorObj);
      console.log('[APP][AUTOFIX][TRIGGER-FAILED]', { error: err.message, code: errorObj.code });
      console.log('[APP][STEP3][STATE]', { status: 'FIX_FAILED', error: err.message });
    }
  }, [file, result, autoFixBefore, autoFixServer, handleV2JobComplete, getAuthenticatedBlobUrl, selectedPolicy, fileMeta]);

  const handleDownload = useCallback(async () => {
    // v2.4.140: Hardened Authenticated Download Stream
    // We prefer fetching a fresh artifact from the server on-demand to ensure auth-integrity
    const jobId = targetJobId || sourceJobId || result?.meta?.jobId || (result as any)?.id;
    const finalName = normalizeDownloadFilename(lastPdfName || fileMeta?.name || 'preflight', 'pdf');

    console.log('[DOWNLOAD][TRIGGER]', { jobId, name: finalName, hasPrevUrl: !!lastPdfUrl });

    if (!jobId && !lastPdfUrl) {
      setEngineError({
        code: 'ARTIFACT_UNAVAILABLE',
        message: 'No certified PDF available for download yet. Ensure analysis is complete.',
        traceId: 'UI_STATE_GUARD'
      });
      return;
    }

    try {
      setLdmActive(true);
      setLdmStatus('Downloading secure artifact...');

      let blob: Blob;

      // Requirement B: Context-Aware Download
      if (jobId && !jobId.includes('local')) {
        const artifacts = (result as any)?.artifacts || (autoFixAfter as any)?.artifacts || {};
        const artifactType = artifacts.certified_pdf ? 'certified_pdf' : (artifacts.fixed_pdf ? 'fixed_pdf' : 'final_fixed_pdf');
        const artifactUrl = `/api/v2/jobs/${jobId}/artifacts/${artifactType}`;
        
        console.log('[DOWNLOAD][AUTHENTICATED-STREAM]', { artifactUrl, artifactType });
        blob = await pposFetch<Blob>(artifactUrl);
      } else if (lastPdfUrl && lastPdfUrl.startsWith('blob:')) {
        // Fallback for local processing or if server fetch is impossible
        console.log('[DOWNLOAD][LOCAL-BLOB-FALLBACK]');
        const res = await fetch(lastPdfUrl);
        blob = await res.blob();
      } else if (lastPdfUrl) {
        console.log('[DOWNLOAD][URL-FETCH]', lastPdfUrl);
        blob = await pposFetch<Blob>(lastPdfUrl);
      } else {
        throw new Error('No downloadable source found for this career.');
      }

      // Trigger Browser Download via Safe Blob Object
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = finalName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setLdmActive(false);
    } catch (err: any) {
      console.error('[DOWNLOAD_ERROR]', err);
      setLdmActive(false);
      setEngineError({
        code: err.code || 'DOWNLOAD_FAILURE',
        message: err.message || 'Secure artifact retrieval failed. The server session might have expired or the link is stale.',
        traceId: err.traceId || 'N/A'
      });
    }
  }, [lastPdfUrl, lastPdfName, fileMeta, targetJobId, sourceJobId, result]);

  const handleDownloadReport = useCallback(() => {
    if (!result) return;
    try {
      const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const finalName = normalizeDownloadFilename(lastPdfName || fileMeta?.name || 'preflight', 'report');
      a.download = finalName;
      console.log('[DOWNLOAD][FILENAME][REPORT]', {
        original: lastPdfName || fileMeta?.name || 'unknown',
        normalized: finalName.replace('-report.json', ''),
        final: finalName
      });
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 100);
    } catch (err: any) {
      console.error('[REPORT_DOWNLOAD_ERROR]', err);
    }
  }, [result, lastPdfName, fileMeta]);
  const handleConvertCMYK = useCallback(async () => {
    if (!file) return;
    setLdmActive(true);
    setLdmStatus('Enforcing CMYK Policy...');
    try {
      const jobId = await convertColorServer(file, selectedProfile);
      if (jobId) {
        activeJobIdRef.current = jobId;
        await handleV2JobComplete(jobId);
        // handleV2JobComplete already triggers the blob fetch via callback
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
  }, [file, convertColorServer, selectedProfile, handleV2JobComplete]);

  const handleConvertGrayscale = useCallback(async () => {
    if (!file) return;
    setLdmActive(true);
    setLdmStatus('Converting to Grayscale...');
    try {
      const jobId = await convertToGrayscaleServer(file);
      if (jobId) {
        activeJobIdRef.current = jobId;
        await handleV2JobComplete(jobId);
      }
      setLdmActive(false);
    } catch (err: any) {
      setLdmActive(false);
      setEngineError({
        code: err.code || 'GRAYSCALE_CONVERSION_FAILURE',
        message: err.message || 'Grayscale conversion failed.',
        traceId: err.traceId || 'N/A'
      });
    }
  }, [file, convertToGrayscaleServer, handleV2JobComplete]);

  const handleRebuildPdf = useCallback(async () => {
    if (!file) return;
    setLdmActive(true);
    setLdmStatus('Rebuilding Forensic Carrier...');
    try {
      const jobId = await rebuildPdfServer(file, 300);
      if (jobId) {
        activeJobIdRef.current = jobId;
        await handleV2JobComplete(jobId);
      }
      setLdmActive(false);
    } catch (err: any) {
      setLdmActive(false);
      setEngineError({
        code: err.code || 'REBUILD_FAILURE',
        message: err.message || 'Forensic carrier rebuild failed.',
        traceId: err.traceId || 'N/A'
      });
    }
  }, [file, rebuildPdfServer, handleV2JobComplete]);

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
                    error={engineError}
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
                    error={fixError}
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
                    onDownloadReport={handleDownloadReport}
                    onStartOver={handleStartOver}
                    onBack={() => setCurrentStep(3)} // Allow back to Step 3
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
                    targetJobId={targetJobId}
                    sourceJobId={sourceJobId}
                  />
                )}

                {currentStep === 5 && (
                  <Step5DownloadV2_4
                    lastPdfUrl={lastPdfUrl}
                    lastPdfName={lastPdfName}
                    file={file}
                    onDownload={handleDownload}
                    onDownloadReport={handleDownloadReport}
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
