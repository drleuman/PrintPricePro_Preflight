import { useState, useCallback } from 'react';

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

    const convertRgbToCmykServer = useCallback(async (file: File) => {
        setIsServerRunning(true);
        try {
            const formData = new FormData();
            formData.append('file', file);

            const res = await fetch('/api/convert/rgb-to-cmyk', {
                method: 'POST',
                body: formData,
            });

            if (!res.ok) {
                throw new Error(`Server CMYK failed (HTTP ${res.status})`);
            }

            return await res.blob();
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

    return {
        isServerRunning,
        convertToGrayscaleServer,
        convertRgbToCmykServer,
        rebuildPdfServer,
    };
}
