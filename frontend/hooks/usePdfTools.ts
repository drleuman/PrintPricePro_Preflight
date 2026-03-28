import { useState, useCallback } from 'react';
import { pposFetch } from '../lib/apiClient';
import { createBooklet } from '../utils/imposition';
import { PreflightResult } from '../types';

type PdfToolsCallbacks = {
    onStatus?: (status: string, progress: number) => void;
    onComplete?: (result: PreflightResult) => void;
};

export function usePdfTools(callbacks?: PdfToolsCallbacks) {
    const [isServerRunning, setIsServerRunning] = useState(false);

    const startV2Preflight = useCallback(async (file: File, policy: string) => {
        setIsServerRunning(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('policy', policy);
            const res = await pposFetch<any>('/api/v2/jobs', {
                method: 'POST',
                body: formData,
            });
            return res;
        } finally {
            setIsServerRunning(false);
        }
    }, []);

    const convertToGrayscaleServer = useCallback(async (file: File) => {
        const res = await startV2Preflight(file, 'DIGITAL_AUTO_FIX');
        return res.job_id || res.jobId;
    }, [startV2Preflight]);

    const convertColorServer = useCallback(async (file: File, profile: string = 'iso_coated_v3') => {
        const res = await startV2Preflight(file, 'OFFSET_CMYK_STRICT');
        return res.job_id || res.jobId;
    }, [startV2Preflight]);

    const rebuildPdfServer = useCallback(async (file: File, dpi: number = 300) => {
        const res = await startV2Preflight(file, 'BOOK_INTERIOR_STANDARD');
        return res.job_id || res.jobId;
    }, [startV2Preflight]);

    const autoFixServer = useCallback(async (
        file: File,
        opts?: any
    ): Promise<{ jobId: string }> => {
        const res = await startV2Preflight(file, opts?.policy || 'DIGITAL_AUTO_FIX');
        return { jobId: res.job_id || res.jobId };
    }, [startV2Preflight]);

    const getJobStatus = useCallback(async (jobId: string) => {
        return await pposFetch<any>(`/api/v2/jobs/${jobId}`);
    }, []);

    const pollJob = useCallback(async (jobId: string, onProgress?: (p: number) => void) => {
        return new Promise((resolve, reject) => {
            let attempt = 0;
            const interval = setInterval(async () => {
                attempt++;
                try {
                    const job = await getJobStatus(jobId);
                    if (onProgress && job.progress !== undefined) onProgress(job.progress);

                    // Normalize status names from PPOS
                    const status = (job.status || '').toUpperCase();
                    if (['COMPLETED', 'SUCCEEDED', 'SUCCESS'].includes(status)) {
                        clearInterval(interval);
                        resolve(job);
                    } else if (['FAILED', 'ERROR'].includes(status)) {
                        clearInterval(interval);
                        reject(new Error(job.error?.message || 'Job failed at PrintPrice OS'));
                    }
                    
                    if (attempt > 300) { // 10 min timeout
                         clearInterval(interval);
                         reject(new Error('Job polling timed out.'));
                    }
                } catch (e) {
                    clearInterval(interval);
                    reject(e);
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
        if (callbacks?.onComplete && (res as any).report) {
            callbacks.onComplete((res as any).report);
        }
        return res;
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
