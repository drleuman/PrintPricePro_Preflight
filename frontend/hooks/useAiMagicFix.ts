import { useCallback, useRef, useState, useEffect } from 'react';
import { AppMode, FileMeta, PreflightResult } from '../types';
import { normalizePreflightResult, pickCanonicalJobId, getBestArtifactKey, getCanonicalFileName } from '../utils/payloadNormalization';

export type FixIntent = 'incremental_magic' | 'full_magic' | 'manual_with_cmyk';

type RequestedFixRow = { id?: string; repairStrategy: string | null };

function hasCmykInRequested(requestedFixes: RequestedFixRow[]) {
  return requestedFixes.some(
    (f) => f.repairStrategy === 'CONVERT_CMYK' || f.repairStrategy === 'RGB→CMYK',
  );
}

function hasBleedInRequested(requestedFixes: RequestedFixRow[]) {
  return requestedFixes.some(
    (f) => f.repairStrategy === 'APPLY_BLEED' || f.repairStrategy === 'BLEED',
  );
}

/**
 * Merges caller opts into the JSON `options` sent to POST .../actions/fix.
 * - `forceBleed` → options.forceBleed + APPLY_BLEED row when needed (BFF + PPOS).
 * - `fixIntent` drives CMYK bundling: full_magic / manual_with_cmyk append CONVERT_CMYK; incremental_magic does not.
 * - AI auto-trigger with empty body builds requestedFixes from analysis issues (full_magic).
 */
export function mergeStatefulFixOptions(
  opts: Record<string, any> | undefined,
  result: PreflightResult | null,
  appMode: AppMode,
): Record<string, any> {
  const base =
    opts?.options && typeof opts.options === 'object' && !Array.isArray(opts.options)
      ? { ...opts.options }
      : {};

  if (opts?.magicFixProfile) base.magicFixProfile = opts.magicFixProfile;
  if (opts?.targetProfile) base.targetProfile = opts.targetProfile;
  if (opts?.hardeningAction) base.hardeningAction = opts.hardeningAction;
  
  const rawRequestedFixes = Array.isArray(opts?.requestedFixes) 
    ? opts.requestedFixes 
    : base.requestedFixes;

  const requestedFixes: RequestedFixRow[] = Array.isArray(rawRequestedFixes)
    ? rawRequestedFixes.map((f: any) => ({
        id: f?.id,
        repairStrategy: f?.repairStrategy ?? f?.repair_strategy ?? null,
      }))
    : [];

  let fixIntent = opts?.fixIntent as FixIntent | undefined;

  const noStructuralPayload =
    requestedFixes.length === 0 && !opts?.forceBleed && !base.type && !base.repairStrategy;

  if (!fixIntent) {
    if (appMode === 'manual') {
      fixIntent = 'manual_with_cmyk';
    } else if (appMode === 'ai' && noStructuralPayload && result?.issues?.length) {
      fixIntent = 'full_magic';
    }
  }

  if (fixIntent === 'full_magic' && requestedFixes.length === 0 && result?.issues?.length) {
    const fromIssues = result.issues
      .filter((i) => i.fixable)
      .map((i) => ({
        id: i.id,
        repairStrategy: (i.repairStrategy || i.fix_method || null) as string | null,
      }))
      .filter((x) => x.repairStrategy);
    requestedFixes.push(...fromIssues);
  }

  if (opts?.forceBleed === true) {
    base.forceBleed = true;
    if (!hasBleedInRequested(requestedFixes)) {
      requestedFixes.push({ id: 'force-bleed', repairStrategy: 'APPLY_BLEED' });
    }
  }

  if (opts?.bleedIngressMode === 'safe' || opts?.bleedIngressMode === 'aggressive') {
    base.bleedIngressMode = opts.bleedIngressMode;
  }

  if (fixIntent === 'full_magic' || fixIntent === 'manual_with_cmyk') {
    if (!hasCmykInRequested(requestedFixes)) {
      requestedFixes.push({ id: '__bundle_cmyk', repairStrategy: 'CONVERT_CMYK' });
    }
  }

  const cleaned = requestedFixes.filter((x) => x.repairStrategy);
  if (cleaned.length) {
    base.requestedFixes = cleaned;
  } else {
    delete base.requestedFixes;
  }

  return base;
}

interface UseAiMagicFixParams {
  file: File | null;
  fileMeta: FileMeta | null;
  appMode: AppMode;
  currentStep: number;
  result: PreflightResult | null;
  activeJobIdRef: React.MutableRefObject<string | null>;
  preflightJobIdRef: React.MutableRefObject<string | null>;
  autoFixServer: (file: File, opts: { policy: string; jobId: string | null; options?: any }) => Promise<any>;
  handleV2JobComplete: (jobId: string, onProgress?: (p: number) => void) => Promise<any>;
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
  preflightJobIdRef,
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
  const [autoFixRunId] = useState<number | null>(null);

  const hasAutoTriggeredFixRef = useRef<string | null>(null);
  const inFlightFixKeyRef = useRef<string | null>(null);

  const resetAiFix = useCallback(() => {
    setAutoFixBefore(null);
    setAutoFixAfter(null);
    setAutoFixReport(null);
    setFixError(null);
    setTargetJobId(null);
    hasAutoTriggeredFixRef.current = null;
    inFlightFixKeyRef.current = null;
  }, []);

  const triggerAutoFix = useCallback(
    async (opts?: any) => {
      if (!file) return;

      const mergedOptions = mergeStatefulFixOptions(opts, result, appMode);
      const sourceJobId = preflightJobIdRef.current || activeJobIdRef.current;
      const policyKey = opts?.policy || selectedPolicy;
      
      const reqFixes = mergedOptions.requestedFixes || opts?.requested_fixes || opts?.fixes || [];
      const fixesStr = Array.isArray(reqFixes)
        ? reqFixes
            .map((f: any) =>
              typeof f === 'string'
                ? f
                : f?.repairStrategy || f?.repair_strategy || f?.fix_method || f?.id || '',
            )
            .sort()
            .join(',')
        : '';

      const sourceKeyObj = {
        sourceJobId,
        policy: policyKey,
        fixes: fixesStr,
        forceBleed: !!(mergedOptions.forceBleed || opts?.forceBleed),
        targetProfile: mergedOptions.targetProfile || opts?.targetProfile || '',
      };
      const sourceKey = JSON.stringify(sourceKeyObj);

      if (inFlightFixKeyRef.current === sourceKey) {
        console.log('[AI-FIX][DUPLICATE-SUPPRESSED]', { sourceKey });
        return;
      }

      inFlightFixKeyRef.current = sourceKey;

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
        fixIntent: opts?.fixIntent,
        mergedKeys: Object.keys(mergedOptions),
      });

      try {
        const res = await autoFixServer(file, {
          policy: opts?.policy || selectedPolicy,
          jobId: preflightJobIdRef.current || activeJobIdRef.current,
          options: mergedOptions,
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
          setLdmProgress(0);
          console.log('[AI-FIX][STEP3][STATE]', { status: 'FIX_POLLING', targetJobId: jobId });
          jobResult = await handleV2JobComplete(jobId, (pct) => setLdmProgress(pct));
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

          const requiresReview = normalizedAfter.requiresHumanReview === true || normalizedAfter.productionCertified === false;
          const bestArtifactKey = getBestArtifactKey(normalizedAfter.artifacts, requiresReview);
          console.log('[AI-FIX][ARTIFACT-RESOLUTION]', { jobId: finalJobId, selected: bestArtifactKey });

          if (bestArtifactKey) {
            getAuthenticatedBlobUrl(finalJobId, bestArtifactKey)
              .then((bUrl) => {
                if (bUrl) {
                  console.log('[AI-FIX][ARTIFACT-RESOLVED]', { jobId: finalJobId, key: bestArtifactKey });
                  setLastPdfUrl(bUrl);
                  lastPdfUrlRef.current = bUrl;
                }
              })
              .catch((err) => console.error('[AI-FIX][ARTIFACT-ERROR]', err));
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
      } finally {
        inFlightFixKeyRef.current = null;
      }
    },
    [
      file,
      result,
      autoFixBefore,
      appMode,
      autoFixServer,
      handleV2JobComplete,
      getAuthenticatedBlobUrl,
      selectedPolicy,
      fileMeta,
      activeJobIdRef,
      preflightJobIdRef,
      setLdmActive,
      setLdmStatus,
      setLdmProgress,
      setCurrentStep,
      setCurrentPage,
      setResult,
      setLastPdfUrl,
      lastPdfUrlRef,
      setLastPdfName,
    ],
  );

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
      triggerAutoFix({ fixIntent: 'full_magic' });
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
