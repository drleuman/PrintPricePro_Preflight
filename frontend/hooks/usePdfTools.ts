import { useState, useCallback } from 'react';
import { pposFetch } from '../lib/apiClient';
import { createBooklet } from '../utils/imposition';
import { PreflightResult } from '../types';

import { normalizePreflightResult, pickCanonicalJobId } from '../utils/payloadNormalization';
import { isTerminalDiagnosticStatus, isTerminalFailureStatus } from '../utils/statusHelpers';


type PdfToolsCallbacks = {
    onStatus?: (status: string, progress: number) => void;
    onComplete?: (result: PreflightResult) => void;
};

export function usePdfTools(callbacks?: PdfToolsCallbacks) {
    const [isServerRunning, setIsServerRunning] = useState(false);

    const startV2Preflight = useCallback(async (file: File, policy: string, options?: any) => {
        setIsServerRunning(true);
        try {
            // Runtime Blob/File identity check — must run before any FormData access
            console.log('[FILE-DEBUG]', {
                type: Object.prototype.toString.call(file),
                isBlob: file instanceof Blob,
                isFile: file instanceof File,
                name: file?.name,
                size: file?.size,
            });

            if (!(file instanceof Blob)) {
                throw new Error(
                    `Upload aborted: file is not a valid Blob/File. ` +
                    `Got: ${Object.prototype.toString.call(file)}. ` +
                    `name=${(file as any)?.name}, size=${(file as any)?.size}`
                );
            }

            // DIAGNOSTIC LOGS (Requirement 5)
            console.log('[CREATE-JOB][DIAGNOSTIC]', {
                endpoint: '/api/v2/jobs',
                fileName: file.name,
                fileSize: file.size,
                fileType: file.type,
                policy: policy || 'OFFSET_MODERN_COATED',
                mode: options?.mode || 'N/A',
                isFormData: true
            });

            // v2.4.122: SES/Membrane Unwrapping (Fix: ENGINE TERMINATED)
            // Native FormData.append rejects Proxies in some environments (SES/Lockdown).
            // We recreate a native-branded Blob to ensure parameter 2 is a true Blob.
            const nativeBlob = new Blob([file], { type: file.type });
            const fileName = file.name || 'document.pdf';

            const formData = new FormData();

            // Requirement 2: Append with explicit filename so the server receives
            // a proper filename even when the browser omits it (e.g. Blob without name).
            formData.append('file', nativeBlob, fileName);

            // Campos adicionales
            formData.append('policy', policy || 'OFFSET_MODERN_COATED');
            if (options?.mode) {
                formData.append('intent', options.mode);
                formData.append('mode', options.mode); // Redundancy for PPOS contract safety
            }
            if (options?.jobMode) {
                formData.append('jobMode', options.jobMode);
            }

            // Requirement 3: No forzar Content-Type. pposFetch lo maneja.
            const res = await pposFetch<any>('/api/v2/jobs', {
                method: 'POST',
                body: formData,
            });

            // v2.4.135: Strict Canonical ID Preference (jobId || job_id || id)
            // Blindaje V3: Strict validation against 'job_' prefix
            const finalJobId = pickCanonicalJobId(res.jobId, res.job_id, res.id, res.inlineResult?.meta?.jobId, res.jobMeta?.id);
            console.log('[TOOL][CANONICAL-ID-RESOLVE]', { resolved: finalJobId, raw: res.id || res.jobId });
            
            console.log('[CREATE-JOB][SUCCESS-BFF]', {
                jobId: finalJobId,
                inline: !!res.inlineResult,
                status: res.status
            });

            if (!finalJobId) {
                console.warn('[CREATE-JOB][WARN] BFF returned success but NO jobId was found. Artifacts in Step 4 will fail to resolve.');
            }

            return res;
        } catch (err: any) {
            console.error('[CREATE-JOB][FAILURE-BFF]', {
                message: err.message,
                status: err.status,
                data: err.data
            });
            throw err;
        } finally {
            setIsServerRunning(false);
        }
    }, []);

    const convertToGrayscaleServer = useCallback(async (file: File) => {
        const res = await startV2Preflight(file, 'DIGITAL_RGB', { mode: 'CONVERT_GRAYSCALE' });
        return pickCanonicalJobId(res.jobId, res.job_id, res.id);
    }, [startV2Preflight]);

    const convertColorServer = useCallback(async (file: File, profile: string = 'OFFSET_MODERN_COATED') => {
        const res = await startV2Preflight(file, profile, { mode: 'CONVERT_COLOR' });
        return pickCanonicalJobId(res.jobId, res.job_id, res.id);
    }, [startV2Preflight]);

    const rebuildPdfServer = useCallback(async (file: File, dpi: number = 300) => {
        const res = await startV2Preflight(file, 'OFFSET_MODERN_COATED', { mode: 'REBUILD', dpi });
        return pickCanonicalJobId(res.jobId, res.job_id, res.id);
    }, [startV2Preflight]);

    const autoFixServer = useCallback(async (
        file: File,
        opts?: any
    ): Promise<any> => {
        // v2.4.120: Stateful Fix Action Support
        // If we have an existing jobId from the analysis phase, we use the stateful action endpoint
        if (opts?.jobId) {
            console.log(`[FIX][STATEFUL-ACTION] Triggering fix for existing job: ${opts.jobId}`);
            const res = await pposFetch<any>(`/api/v2/jobs/${opts.jobId}/actions/fix`, {
                method: 'POST',
                body: JSON.stringify({
                    policy: opts.policy || 'OFFSET_MODERN_COATED',
                    options: opts.options || {}
                })
            });
            // Ensure stateful fix response ID preservation
            const finalId = pickCanonicalJobId(res.jobId, res.job_id, res.id) || opts.jobId;
            return { ...res, jobId: finalId, id: finalId };
        }

        // Stateless Fallback: Re-upload for standalone fix runs
        const res = await startV2Preflight(file, opts?.policy || 'OFFSET_MODERN_COATED', { mode: 'AUTOFIX', ...opts });
        return res;
    }, [startV2Preflight]);

    const getJobStatus = useCallback(async (jobId: string) => {
        console.log('[POLL][JOB-ID]', { jobId });
        const res = await pposFetch<any>(`/api/v2/jobs/${jobId}`);
        // Log job data for debugging trace inventory regression
        console.log('[LDM] Job Data:', jobId, {
            status: res.status,
            hasReport: !!res.report,
            hasFindings: !!res.findings,
            hasIssues: !!res.issues
        });
        return res;
    }, []);

    const pollJob = useCallback(async (jobId: string, onProgress?: (p: number) => void) => {
        return new Promise((resolve, reject) => {
            let attempt = 0;
            const interval = setInterval(async () => {
                attempt++;
                let job: any;
                try {
                    if (jobId.startsWith('fix_')) {
                        console.log(`[APP][POLLING][FIX-JOB][Attempt ${attempt}]`, jobId);
                    }
                    job = await getJobStatus(jobId);
                } catch (err: any) {
                    // Resiliency: Handled transient 404s (Registration Lag)
                    // With large files, the job might not be persisted yet when the first polls hit.
                    if (err.status === 404 && attempt < 10) {
                        console.warn('[POLL][SYNC-LAG-RETRY]', { attempt, jobId });
                        if (onProgress) onProgress(0); // Show it's still initializing
                        return;
                    }
                    // Non-retryable error or too many 404s
                    clearInterval(interval);
                    reject(err);
                    return;
                }

                if (onProgress && job.progress !== undefined) onProgress(job.progress);

                // Normalize status names from PPOS
                const status = (job.status || '').toUpperCase();
                if (isTerminalDiagnosticStatus(status)) {
                    clearInterval(interval);
                    resolve(job);
                } else if (isTerminalFailureStatus(status)) {
                    clearInterval(interval);
                    
                    // v2.4.170: Robust Error Preservation
                    const jobErr = job.error;
                    const errorText = typeof jobErr === 'string' ? jobErr : (jobErr?.message || 'Job failed at PrintPrice OS');
                    const errorCode = typeof jobErr === 'string' ? 'ENGINE_JOB_FAILED' : (jobErr?.code || jobErr?.errorCode || 'ENGINE_JOB_FAILED');
                    
                    const throwErr: any = new Error(errorText);
                    throwErr.code = errorCode;
                    throwErr.traceId = job.traceId || jobErr?.traceId || 'POLL_ERR_CHAIN';
                    throwErr.v2 = true;
                    throwErr.raw = job; // Keep full job state for inspection
                    
                    console.error('[POLL][FAILED]', { jobId, status, error: errorText, code: errorCode });
                    reject(throwErr);
                }

                if (attempt > 300) { // 10 min timeout
                    clearInterval(interval);
                    const currentStatus = (job?.status || '').toUpperCase();
                    if (isTerminalStatus(currentStatus)) {
                        console.warn('[POLL][TIMEOUT-BUT-TERMINAL] Polling reached max attempts but status is terminal. Finalizing with latest payload.', job);
                        resolve(job);
                    } else {
                        const timeoutErr: any = new Error('Job polling timed out.');
                        timeoutErr.code = 'POLLING_TIMEOUT';
                        timeoutErr.traceId = 'BFF_TIMEOUT';
                        timeoutErr.v2 = true;
                        reject(timeoutErr);
                    }
                }
            }, 2000);
        });
    }, [getJobStatus]);

    const getDownloadUrl = useCallback((jobId: string, artifactId: string = 'certified_pdf') => {
        console.log('[APP][ARTIFACT][PREFERRED-KEY]', { jobId, requested: artifactId });
        return `/api/v2/jobs/${jobId}/artifacts/${artifactId}`;
    }, []);

    const getAuthenticatedBlobUrl = useCallback(async (jobId: string, artifactId: string = 'certified_pdf') => {
        // v2.4.165: Terminal ID Guard
        const safeJobId = pickCanonicalJobId(jobId);
        if (!safeJobId) {
            console.error('[APP][ARTIFACT][ABORTED] Non-canonical ID rejected for artifact stream:', jobId);
            return null;
        }

        const url = getDownloadUrl(safeJobId, artifactId);
        console.log(`[APP][ARTIFACT][CANONICAL-ID] Fetching protected artifact: ${url}`);
        try {
            const blob = await pposFetch<Blob>(url);
            if (!(blob instanceof Blob)) {
                console.error('[APP][ARTIFACT][ERROR] Expected Blob but got:', typeof blob);
                return null;
            }
            const blobUrl = URL.createObjectURL(blob);
            console.log('[APP][ARTIFACT][SUCCESS] Blob URL created:', blobUrl);
            return blobUrl;
        } catch (err: any) {
            console.error('[APP][ARTIFACT][FAILURE]', err.message);
            throw err;
        }
    }, [getDownloadUrl]);

    const createBookletClient = useCallback(async (file: File) => {
        const arrayBuffer = await file.arrayBuffer();
        const pdfBytes = await createBooklet(arrayBuffer);
        return new Blob([pdfBytes as any], { type: 'application/pdf' });
    }, []);

    const handleV2JobComplete = useCallback(async (jobId: string) => {
        const res = await pollJob(jobId);

        const normalizedResult = normalizePreflightResult(res);
        if (normalizedResult && callbacks?.onComplete) {
            await callbacks.onComplete(normalizedResult);
        }
        return normalizedResult || res;
    }, [pollJob, callbacks]);

    return {
        isServerRunning,
        convertToGrayscaleServer,
        convertColorServer,
        rebuildPdfServer,
        autoFixServer,
        createBookletClient,
        getJobStatus,
        pollJob,
        getDownloadUrl,
        getAuthenticatedBlobUrl,
        startV2Preflight,
        handleV2JobComplete,
    };
}
