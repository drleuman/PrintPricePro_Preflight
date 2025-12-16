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
            });

            if (!res.ok) {
                throw new Error(`Server rebuild failed (HTTP ${res.status})`);
            }

            return await res.blob();
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

    return {
        isServerRunning,
        convertToGrayscaleServer,
        convertColorServer,
        rebuildPdfServer,
        createBookletClient,
    };
}
