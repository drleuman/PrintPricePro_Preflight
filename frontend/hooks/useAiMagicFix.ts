import { useCallback, useRef, useState, useEffect } from 'react';
import { AppMode, FileMeta, PreflightResult } from '../types';
import { normalizePreflightResult, pickCanonicalJobId, getBestArtifactKey, getCanonicalFileName } from '../utils/payloadNormalization';

interface UseAiMagicFixParams {
  file: File | null;
  fileMeta: FileMeta | null;
  appMode: AppMode;
  currentStep: number;
  result: PreflightResult | null;
  activeJobIdRef: React.MutableRefObject<string | null>;
  autoFixServer: (file: File, opts: { policy: string; jobId: string | null }) => Promise<any>;
  handleV2JobComplete: (jobId: string) => Promise<any>;
  getAuthenticatedBlobUrl: (jobId: string, key: string) => Promise<string | null>;
  selectedPolicy: string;
  ldmActive: boolean;
  ldmStatus: string | null;
  setLdmActive: (v: boolean) => void;
  setLdmStatus: (v: string | null) => void;
  setLdmProgress: (v: number) => void;
  setCurrentStep: (v: number) => void;
  setCurrentPage: (v: number) => void;
  setResult: (v: PreflightResult | null) => void;
  setLastPdfUrl: (v: string | null) => void;
  lastPdfUrlRef: React.MutableRefObject<string | null>;
  setLastPdfName: (v: string | null) => void;
}

export interface UseAiMagicFixReturn {
  autoFixBefore: PreflightResult | null;
  autoFixAfter: PreflightResult | null;
  autoFixReport: any | null;
  fixError: any | null;
  targetJobId: string | null;
  autoFixRunId: number | null;
  triggerAutoFix: (opts?: any) => Promise<void>;
  resetAiFix: () => void;
  setAutoFixBefore: (v: PreflightResult | null) => void;
}

export function useAiMagicFix({
  file,
  fileMeta,
  appMode,
  currentStep,
  result,
  activeJobIdRef,
  autoFixServer,
  handleV2JobComplete,
  getAuthenticatedBlobUrl,
  selectedPolicy,
  ldmActive,
  ldmStatus,
  setLdmActive,
  setLdmStatus,
  setLdmProgress,
  setCurrentStep,
  setCurrentPage,
  setResult,
  setLastPdfUrl,
  lastPdfUrlRef,
  setLastPdfName,
}: UseAiMagicFixParams): UseAiMagicFixReturn {
  const [autoFixBefore, setAutoFixBefore] = useState<PreflightResult | null>(null);
  const [autoFixAfter, setAutoFixAfter] = useState<PreflightResult | null>(null);
  const [autoFixReport, setAutoFixReport] = useState<any | null>(null);
  const [fixError, setFixError] = useState<any | null>(null);
  const [targetJobId, setTargetJobId] = useState<string | null>(null);
  // Kept for prop compatibility with Step3 (currently always null — never set by engine)
  const [autoFixRunId] = useState<number | null>(null);

  const hasAutoTriggeredFixRef = useRef<string | null>(null);

  const resetAiFix = useCallback(() => {
    setAutoFixBefore(null);
    setAutoFixAfter(null);
    setAutoFixReport(null);
    setFixError(null);
    setTargetJobId(null);
    hasAutoTriggeredFixRef.current = null;
  }, []);

  const triggerAutoFix = useCallback(async (opts?: any) => {
    if (!file) return;

    if (result && !autoFixBefore) {
      setAutoFixBefore(result);
      console.log('[AI-FIX][START] Storing Before state for Step 4 comparison');
    }

    setLdmActive(true);
    setFixError(null);
    setLdmStatus('loader.magic');
    console.log('[AI-FIX][STEP3][STATE]', {
      status: 'FIX_INITIALIZING',
      sourceJobId: activeJobIdRef.current,
      policy: opts?.policy || selectedPolicy,
    });

    try {
      const res = await autoFixServer(file, {
        policy: opts?.policy || selectedPolicy,
        jobId: activeJobIdRef.current,
        options: opts?.options || {},
      });

      let jobId = pickCanonicalJobId(
        res.jobId,
        res.job_id,
        res.id,
        res.result?.meta?.jobId,
        res.inlineResult?.meta?.jobId,
      );

      console.log('[AI-FIX][NEXT-JOB-ID]', { jobId, sourceId: activeJobIdRef.current });

      if (jobId) {
        console.log('[AI-FIX][CANONICAL-JOB-ID]', { new: jobId, previous: activeJobIdRef.current });
        setTargetJobId(jobId);
        activeJobIdRef.current = jobId;
      }

      let jobResult: any = res.inlineResult || res.result || res.job || null;
      console.log('[AI-FIX][START-RES]', { jobId, isInline: !!jobResult });

      if (jobId && !jobResult) {
        activeJobIdRef.current = jobId;
        setLdmProgress(10);
        console.log('[AI-FIX][STEP3][STATE]', { status: 'FIX_POLLING', targetJobId: jobId });
        jobResult = await handleV2JobComplete(jobId);
      } else if (jobResult && !jobId) {
        jobId = pickCanonicalJobId(jobResult.meta?.jobId, jobResult.job_id, jobResult.id) ?? jobId;
        if (jobId) {
          setTargetJobId(jobId);
          activeJobIdRef.current = jobId;
        }
      }

      if (jobResult) {
        const finalJobId = jobId || jobResult.meta?.jobId;
        console.log('[AI-FIX][COMPLETE]', { finalJobId, hasReport: !!jobResult.report });

        if (jobResult.report) setAutoFixReport(jobResult.report);

        const normalizedAfter = normalizePreflightResult(jobResult);
        setResult(normalizedAfter);
        setAutoFixAfter(normalizedAfter);

        const bestArtifactKey = getBestArtifactKey(normalizedAfter.artifacts);
        console.log('[AI-FIX][ARTIFACT-RESOLUTION]', { jobId: finalJobId, selected: bestArtifactKey });

        if (bestArtifactKey) {
          getAuthenticatedBlobUrl(finalJobId, bestArtifactKey)
            .then(bUrl => {
              if (bUrl) {
                console.log('[AI-FIX][ARTIFACT-RESOLVED]', { jobId: finalJobId, key: bestArtifactKey });
                setLastPdfUrl(bUrl);
                lastPdfUrlRef.current = bUrl;
              }
            })
            .catch(err => console.error('[AI-FIX][ARTIFACT-ERROR]', err));
        } else if (file) {
          const url = URL.createObjectURL(file);
          setLastPdfUrl(url);
          lastPdfUrlRef.current = url;
        } else {
          setLastPdfUrl(null);
          lastPdfUrlRef.current = null;
        }

        setLastPdfName(getCanonicalFileName(jobResult, file));
        setCurrentPage(1);
        setCurrentStep(4);
      } else {
        console.error('[AI-FIX][FAILED] No jobResult found in res:', res);
        throw new Error('Engine returned no result data.');
      }

      setLdmActive(false);
    } catch (err: any) {
      console.error('[AI-FIX][ERROR]', err);
      setFixError(err);
      setLdmActive(false);
      setLdmStatus('');
      setLastPdfUrl(null);
      lastPdfUrlRef.current = null;
      console.log('[AI-FIX][TRIGGER-FAILED]', { error: err.message });
    }
  }, [
    file,
    result,
    autoFixBefore,
    autoFixServer,
    handleV2JobComplete,
    getAuthenticatedBlobUrl,
    selectedPolicy,
    fileMeta,
    activeJobIdRef,
    setLdmActive,
    setLdmStatus,
    setLdmProgress,
    setCurrentStep,
    setCurrentPage,
    setResult,
    setLastPdfUrl,
    lastPdfUrlRef,
    setLastPdfName,
  ]);

  // Deterministic AI Auto-Fix Trigger — only fires in 'ai' mode
  useEffect(() => {
    const jobId = activeJobIdRef.current;

    const isAnalysisComplete = !!result && result.type === 'ANALYZE';
    const isFixInProgress = ldmActive && !!ldmStatus?.includes('fix');
    const isFixDone = !!autoFixAfter || !!fixError;

    const canAutoTrigger =
      appMode === 'ai' &&
      currentStep === 3 &&
      isAnalysisComplete &&
      !isFixInProgress &&
      !isFixDone &&
      !!jobId &&
      hasAutoTriggeredFixRef.current !== jobId;

    if (canAutoTrigger) {
      console.log('[AI-FIX][AUTO-TRIGGER]', { jobId, type: result?.type });
      hasAutoTriggeredFixRef.current = jobId;
      triggerAutoFix({});
    }
  }, [appMode, currentStep, result, autoFixAfter, ldmActive, ldmStatus, fixError, triggerAutoFix, activeJobIdRef]);

  return {
    autoFixBefore,
    autoFixAfter,
    autoFixReport,
    fixError,
    targetJobId,
    autoFixRunId,
    triggerAutoFix,
    resetAiFix,
    setAutoFixBefore,
  };
}
