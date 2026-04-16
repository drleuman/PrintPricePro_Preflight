import * as pdfjsLib from 'pdfjs-dist';

/**
 * Preflight Worker Engine (Recovery)
 * Handles compute-intensive tasks like TAC (Total Area Coverage) analysis
 * and eventually full preflight checks.
 */
const ctx: Worker = self as any;

// Verification for canvas support in workers
const supportsOffscreenCanvas = typeof OffscreenCanvas !== 'undefined';
if (!supportsOffscreenCanvas) {
    console.warn('[WORKER] OffscreenCanvas is not supported. Heatmap rendering may fail.');
}


ctx.onmessage = async (e) => {
    const { type, buffer, pageIndex, fileMeta } = e.data;

    try {
        if (type === 'analyze') {
            // v2.4+ Monolith: Analysis delegated to PPOS. Local worker analysis disabled to prevent mock pollution.
            throw new Error('Local worker analysis is deprecated. Use PPOS engine via BFF /api/v2/jobs.');
        } 
        else if (type === 'tacHeatmap') {
            const data = new Uint8Array(buffer);
            const loadingTask = pdfjsLib.getDocument({ data });
            const pdf = await loadingTask.promise;
            
            // Get specific page (1-indexed in PDF.js)
            const pageNum = (pageIndex || 0) + 1;
            const page = await pdf.getPage(pageNum);
            
            // We want a fixed grid for the heatmap (e.g., 40xN)
            const samplesX = 40;
            const viewport = page.getViewport({ scale: 1.0 });
            const ratio = viewport.height / viewport.width;
            const samplesY = Math.round(samplesX * ratio);
            
            // Render to OffscreenCanvas at the sampling resolution
            if (!supportsOffscreenCanvas) {
                throw new Error('Heatmap aborted: OffscreenCanvas API is not available in this environment.');
            }
            const canvas = new OffscreenCanvas(samplesX, samplesY);
            const context = canvas.getContext('2d', { willReadFrequently: true });
            
            if (!context) throw new Error('Could not get OffscreenCanvas context');
            
            const renderViewport = page.getViewport({ scale: samplesX / viewport.width });
            await page.render({
                canvasContext: context as any,
                viewport: renderViewport
            }).promise;
            
            // Extract pixel data
            const imageData = context.getImageData(0, 0, samplesX, samplesY).data;
            const resultValues = new Uint8Array(samplesX * samplesY);
            let maxTac = 0;
            
            for (let i = 0; i < imageData.length; i += 4) {
                const r = imageData[i] / 255;
                const g = imageData[i + 1] / 255;
                const b = imageData[i + 2] / 255;
                
                // CMYK Estimation (Standard RGB to CMYK)
                const k = 1 - Math.max(r, g, b);
                let c = 0, m = 0, y = 0;
                
                if (k < 1) {
                    c = (1 - r - k) / (1 - k);
                    m = (1 - g - k) / (1 - k);
                    y = (1 - b - k) / (1 - k);
                }
                
                // Total Area Coverage (0 to 4.0)
                const tac = c + m + y + k;
                if (tac > maxTac) maxTac = tac;
                
                // Map to 0-255 (where 255 = 400% TAC)
                resultValues[i / 4] = Math.min(255, Math.floor((tac / 4) * 255));
            }
            
            ctx.postMessage({
                type: 'tacHeatmapResult',
                pageIndex,
                width: samplesX,
                height: samplesY,
                values: resultValues,
                maxTac: maxTac * 100
            }, [resultValues.buffer]);
            
            await pdf.destroy();
        }
        else if (type === 'renderPageAsImage') {
            // Stub for page rendering
            ctx.postMessage({ type: 'renderPageResult', base64: '' });
        }
    } catch (err: any) {
        console.error('[Worker Error]', err);
        ctx.postMessage({
            type: type === 'tacHeatmap' ? 'tacHeatmapError' : 'analysisError',
            message: err.message
        });
    }
};

export {};


