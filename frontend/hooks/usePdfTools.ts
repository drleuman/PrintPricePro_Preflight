import { useState, useCallback } from 'react';
import { pposFetch } from '../lib/apiClient';
import { createBooklet } from '../utils/imposition';
import { PreflightResult } from '../types';

import { normalizePreflightResult } from '../utils/payloadNormalization';

type PdfToolsCallbacks = {
    onStatus?: (status: string, progress: number) => void;
    onComplete?: (result: PreflightResult) => void;
};

export function usePdfTools(callbacks?: PdfToolsCallbacks) {
    const [isServerRunning, setIsServerRunning] = useState(false);

    const startV2Preflight = useCallback(async (file: File, policy: string, options?: any) => {
        setIsServerRunning(true);
        try {
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

            const formData = new FormData();
            
            // Requirement 2: Añade el PDF con la clave exacta 'file'
            formData.append('file', file);
            
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

            console.log('[CREATE-JOB][SUCCESS-BFF]', {
                jobId: res.jobId || res.job_id || res.id,
                inline: !!res.inlineResult
            });

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
        return res.jobId || res.job_id || res.id;
    }, [startV2Preflight]);
    
    const convertColorServer = useCallback(async (file: File, profile: string = 'OFFSET_MODERN_COATED') => {
        const res = await startV2Preflight(file, profile, { mode: 'CONVERT_COLOR' });
        return res.jobId || res.job_id || res.id;
    }, [startV2Preflight]);
    
    const rebuildPdfServer = useCallback(async (file: File, dpi: number = 300) => {
        const res = await startV2Preflight(file, 'OFFSET_MODERN_COATED', { mode: 'REBUILD', dpi });
        return res.jobId || res.job_id || res.id;
    }, [startV2Preflight]);
    
    const autoFixServer = useCallback(async (
        file: File,
        opts?: any
    ): Promise<any> => {
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
                    if (['COMPLETED', 'SUCCEEDED', 'SUCCESS'].includes(status)) {
                        clearInterval(interval);
                        resolve(job);
                    } else if (['FAILED', 'ERROR'].includes(status)) {
                        clearInterval(interval);
                        const jobErr = job.error || {};
                        const throwErr: any = new Error(jobErr.message || 'Job failed at PrintPrice OS');
                        throwErr.code = jobErr.code || jobErr.errorCode || 'ENGINE_JOB_FAILED';
                        throwErr.traceId = jobErr.traceId || job.traceId || 'POLL_ERR_CHAIN';
                        throwErr.v2 = true;
                        reject(throwErr);
                    }
                    
                    if (attempt > 300) { // 10 min timeout
                         clearInterval(interval);
                         const timeoutErr: any = new Error('Job polling timed out.');
                         timeoutErr.code = 'POLLING_TIMEOUT';
                         timeoutErr.traceId = 'BFF_TIMEOUT';
                         timeoutErr.v2 = true;
                         reject(timeoutErr);
                    }
            }, 2000);
        });
    }, [getJobStatus]);

    const getDownloadUrl = useCallback((jobId: string, artifactId: string = 'final_fixed_pdf') => {
        return `/api/v2/jobs/${jobId}/artifacts/${artifactId}`;
    }, []);

    const createBookletClient = useCallback(async (file: File) => {
        const arrayBuffer = await file.arrayBuffer();
        const pdfBytes = await createBooklet(arrayBuffer);
        return new Blob([pdfBytes as any], { type: 'application/pdf' });
    }, []);

    const handleV2JobComplete = useCallback(async (jobId: string) => {
        const res = await pollJob(jobId);
        
        const normalizedResult = normalizePreflightResult(res);
        if (normalizedResult && callbacks?.onComplete) {
            callbacks.onComplete(normalizedResult);
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
        startV2Preflight,
        handleV2JobComplete,
    };
}
