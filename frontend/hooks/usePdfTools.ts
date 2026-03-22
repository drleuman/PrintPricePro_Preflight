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

    const convertToGrayscaleServer = useCallback(async (file: File) => {
        setIsServerRunning(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('target', 'gray');

            const res = await pposFetch<any>('/api/v2/jobs', {
                method: 'POST',
                body: formData,
            });

            const jobId = res.jobId || res.job_id;
            return await pposFetch<Blob>(`/api/v2/jobs/${jobId}/actions/fix`, {
                method: 'POST',
                body: JSON.stringify({ target: 'gray' })
            });
        } finally {
            setIsServerRunning(false);
        }
    }, []);

    const convertColorServer = useCallback(async (file: File, profile: string = 'iso_coated_v3'): Promise<Blob> => {
        setIsServerRunning(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('profile', profile);
            formData.append('target', 'cmyk');

            const res = await pposFetch<any>('/api/v2/jobs', {
                method: 'POST',
                body: formData,
            });

            const jobId = res.jobId || res.job_id;
            return await pposFetch<Blob>(`/api/v2/jobs/${jobId}/actions/fix`, {
                method: 'POST',
                body: JSON.stringify({ target: 'cmyk', profile })
            });
        } finally {
            setIsServerRunning(false);
        }
    }, []);

    const rebuildPdfServer = useCallback(async (file: File, dpi: number = 300) => {
        setIsServerRunning(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('dpiPreferred', String(dpi));
            formData.append('forceRebuild', '1');

            const res = await pposFetch<any>('/api/v2/jobs', {
                method: 'POST',
                body: formData,
            });

            const jobId = res.jobId || res.job_id;
            return await pposFetch<Blob>(`/api/v2/jobs/${jobId}/actions/fix`, {
                method: 'POST',
                body: JSON.stringify({ dpiPreferred: dpi, forceRebuild: true })
            });
        } finally {
            setIsServerRunning(false);
        }
    }, []);

    const autoFixServer = useCallback(async (
        file: File,
        opts?: {
            target?: 'cmyk' | 'gray';
            profile?: string;
            bleedMm?: number;
            dpiPreferred?: number;
            issues?: any;
            flatten?: boolean;
            forceBleed?: boolean;
            forceCmyk?: boolean;
        }
    ): Promise<{ blob: Blob; report?: any; jobId?: string; ldm?: boolean }> => {
        setIsServerRunning(true);
        try {
            const formData = new FormData();
            formData.append('file', file);

            const res = await pposFetch<any>('/api/v2/jobs', {
                method: 'POST',
                body: formData,
            });

            const jobId = res.jobId || res.job_id;

            const fixRes = await pposFetch<any>(`/api/v2/jobs/${jobId}/actions/fix`, {
                method: 'POST',
                body: JSON.stringify({
                    target: opts?.target || 'cmyk',
                    profile: opts?.profile || 'iso_coated_v3',
                    bleedMm: opts?.bleedMm ?? 3,
                    dpiPreferred: opts?.dpiPreferred ?? 300,
                    issues: opts?.issues,
                    forceBleed: opts?.forceBleed,
                    forceCmyk: opts?.forceCmyk,
                    flatten: opts?.flatten,
                })
            });

            if (fixRes instanceof Blob) {
                return { blob: fixRes, report: {} };
            }

            if (fixRes.jobId || fixRes.job_id) {
                return { blob: new Blob(), jobId: fixRes.jobId || fixRes.job_id, ldm: true };
            }

            return { blob: new Blob(), report: {} };
        } finally {
            setIsServerRunning(false);
        }
    }, []);

    const getJobStatus = useCallback(async (jobId: string) => {
        return await pposFetch<any>(`/api/v2/jobs/${jobId}`);
    }, []);

    const pollJob = useCallback(async (jobId: string, onProgress?: (p: number) => void) => {
        return new Promise((resolve, reject) => {
            const interval = setInterval(async () => {
                try {
                    const job = await getJobStatus(jobId);
                    if (onProgress && job.progress !== undefined) onProgress(job.progress);

                    if (job.status === 'COMPLETED' || job.status === 'SUCCEEDED' || job.status === 'SUCCESS') {
                        clearInterval(interval);
                        resolve(job);
                    } else if (job.status === 'FAILED' || job.status === 'ERROR') {
                        clearInterval(interval);
                        reject(new Error(job.error?.message || 'Job failed'));
                    }
                } catch (e) {
                    clearInterval(interval);
                    reject(e);
                }
            }, 2000);
        });
    }, [getJobStatus]);

    const getLdmPagePreviewUrl = useCallback((jobId: string, page: number) => {
        return `/api/v2/preflight/preview/${jobId}/${page}`;
    }, []);

    const createBookletClient = useCallback(async (file: File) => {
        const arrayBuffer = await file.arrayBuffer();
        const pdfBytes = await createBooklet(arrayBuffer);
        return new Blob([pdfBytes as any], { type: 'application/pdf' });
    }, []);

    const generatePreviewServer = useCallback(async (file: File): Promise<{ ok: boolean; previews: any[]; jobId?: string }> => {
        setIsServerRunning(true);
        try {
            const formData = new FormData();
            formData.append('file', file);

            const res = await pposFetch<any>('/api/v2/jobs', {
                method: 'POST',
                body: formData,
            });

            const jobId = res.jobId || res.job_id;

            return await pposFetch<any>('/api/v2/preflight/preview/pages', {
                method: 'POST',
                body: JSON.stringify({ jobId }),
            });
        } finally {
            setIsServerRunning(false);
        }
    }, []);

    const startV2Preflight = useCallback(async (file: File, policy: string) => {
        const formData = new FormData();
        formData.append('pdf', file);
        formData.append('policy', policy);
        const res = await pposFetch<any>('/api/v2/preflight/analyze', {
            method: 'POST',
            body: formData,
        });
        if (callbacks?.onComplete && res.result) {
            callbacks.onComplete(res.result);
        }
        return res;
    }, [callbacks]);

    const handleV2JobComplete = useCallback(async (jobId: string) => {
        const res = await pollJob(jobId);
        if (callbacks?.onComplete && (res as any).result) {
            callbacks.onComplete((res as any).result);
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
        generatePreviewServer,
        getJobStatus,
        pollJob,
        getLdmPagePreviewUrl,
        startV2Preflight,
        handleV2JobComplete,
    };
}
