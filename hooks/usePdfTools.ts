import { useState, useCallback } from 'react';
import { createBooklet } from '../utils/imposition.ts';

export function usePdfTools() {
    const [isServerRunning, setIsServerRunning] = useState(false);

    const convertToGrayscaleServer = useCallback(async (file: File) => {
        setIsServerRunning(true);
        try {
            const formData = new FormData();
            formData.append('file', file);

            const res = await fetch('/api/convert/grayscale', {
                method: 'POST',
                body: formData,
                cache: 'no-cache',
                credentials: 'same-origin',
            });

            if (!res.ok) {
                throw new Error(`Server grayscale failed (HTTP ${res.status})`);
            }

            return await res.blob();
        } finally {
            setIsServerRunning(false);
        }
    }, []);

    /* Removed old convertRgbToCmykServer */

    const convertColorServer = useCallback(async (file: File, profile: string = 'cmyk'): Promise<Blob> => {
        setIsServerRunning(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('profile', profile);

            // Use the new endpoint
            const res = await fetch('/api/convert/convert-color', {
                method: 'POST',
                body: formData,
                cache: 'no-cache',
                credentials: 'same-origin',
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || `Server error: ${res.status}`);
            }

            const blob = await res.blob();
            return blob;
        } finally {
            setIsServerRunning(false);
        }
    }, []);

    const rebuildPdfServer = useCallback(async (file: File, dpi: number = 150) => {
        setIsServerRunning(true);
        try {
            const formData = new FormData();
            formData.append('file', file);

            const res = await fetch(`/api/convert/rebuild-150dpi?dpi=${dpi}`, {
                method: 'POST',
                body: formData,
                cache: 'no-cache',
                credentials: 'same-origin',
            });

            if (!res.ok) {
                throw new Error(`Server rebuild failed (HTTP ${res.status})`);
            }

            return await res.blob();
        } finally {
            setIsServerRunning(false);
        }
    }, []);


    const autoFixServer = useCallback(async (
        file: File,
        opts?: {
            target?: 'cmyk' | 'gray';
            profile?: string; // default: iso_coated_v2 (FOGRA39)
            bleedMm?: number; // default: 3
            dpiPreferred?: number; // default: 300
            dpiMin?: number; // default: 150
            issues?: any; // optional PreflightResult
            forceRebuild?: boolean;
            forceBleed?: boolean;
            forceCmyk?: boolean;
            aggressive?: boolean;
            flatten?: boolean;
            safeOnly?: boolean;
            strictVector?: boolean;
        }
    ): Promise<{ blob: Blob; report?: any }> => {
        setIsServerRunning(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('target', opts?.target || 'cmyk');
            formData.append('profile', opts?.profile || 'iso_coated_v2');
            formData.append('bleedMm', String(opts?.bleedMm ?? 3));
            formData.append('dpiPreferred', String(opts?.dpiPreferred ?? 300));
            formData.append('dpiMin', String(opts?.dpiMin ?? 150));
            if (opts?.issues) formData.append('issues', JSON.stringify(opts.issues));
            if (opts?.forceRebuild) formData.append('forceRebuild', '1');
            if (opts?.forceBleed) formData.append('forceBleed', '1');
            if (opts?.forceCmyk) formData.append('forceCmyk', '1');
            if (opts?.aggressive) formData.append('aggressive', '1');
            if (opts?.flatten) formData.append('flatten', '1');
            if (opts?.safeOnly === false) formData.append('safeOnly', '0');
            if (opts?.strictVector === false) formData.append('strictVector', '0');
            else formData.append('strictVector', '1');

            const res = await fetch('/api/convert/autofix', {
                method: 'POST',
                body: formData,
                cache: 'no-cache',
                credentials: 'same-origin',
            });

            if (!res.ok) {
                const reportHeader = res.headers.get('X-PPP-Autofix-Report');
                let report: any = undefined;
                if (reportHeader) {
                    try {
                        report = JSON.parse(atob(reportHeader));
                    } catch { /* ignore */ }
                }

                const err = await res.json().catch(() => ({}));
                // If body has report, it might overwrite the header one (usually they match in 422 case)
                if (err.report) report = err.report;

                const error: any = new Error(err.message || err.error || `AutoFix failed (HTTP ${res.status})`);
                error.report = report;
                error.error_code = err.error_code;
                error.step = err.step;
                error.stderr = err.stderr;
                error.status = res.status;
                error.serverError = err; // attach full server error for debugging
                throw error;
            }

            const reportHeader = res.headers.get('X-PPP-Autofix-Report');
            let report: any | undefined = undefined;
            if (reportHeader) {
                try {
                    report = JSON.parse(atob(reportHeader));
                } catch { /* ignore */ }
            }

            const blob = await res.blob();
            return { blob, report };
        } finally {
            setIsServerRunning(false);
        }
    }, []);

    const createBookletClient = useCallback(async (file: File) => {
        // This is client side, so we don't set isServerRunning, but maybe we should Set "isWorkerRunning" or generic "loading"?
        // For now we just return promise.
        const arrayBuffer = await file.arrayBuffer();
        const pdfBytes = await createBooklet(arrayBuffer);
        return new Blob([pdfBytes as any], { type: 'application/pdf' });
    }, []);

    const generatePreviewServer = useCallback(async (file: File): Promise<{ ok: boolean; pages: string[]; pageCount: number }> => {
        setIsServerRunning(true);
        try {
            const formData = new FormData();
            formData.append('file', file);

            const res = await fetch('/api/convert/preview/pages', {
                method: 'POST',
                body: formData,
                cache: 'no-cache',
                credentials: 'same-origin',
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || `Preview failed: ${res.status}`);
            }

            return await res.json();
        } finally {
            setIsServerRunning(false);
        }
    }, []);

    return {
        isServerRunning,
        convertToGrayscaleServer,
        convertColorServer,
        rebuildPdfServer,
        autoFixServer,
        createBookletClient,
        generatePreviewServer,
    };
}
