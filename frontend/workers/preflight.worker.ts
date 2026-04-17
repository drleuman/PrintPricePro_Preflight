// v2.4+ Monolith: Robust PDF.js worker initialization for heatmap/preview
// Note: PDF rendering is now moved to Main Thread to avoid DOM/Canvas dependency in Workers
console.log('[APP][HEATMAP][WORKER-DEGRADED]');

/**
 * Preflight Worker Engine (Recovery)
 * Handles compute-intensive tasks like TAC (Total Area Coverage) analysis.
 */
const ctx: Worker = self as any;

ctx.onmessage = async (e) => {
    const { type, buffer, pageIndex, fileMeta, imageData, width, height } = e.data;

    try {
        if (type === 'analyze') {
            // v2.4+ Monolith: Analysis delegated to PPOS. Local worker analysis disabled to prevent mock pollution.
            throw new Error('Local worker analysis is deprecated. Use PPOS engine via BFF /api/v2/jobs.');
        } 
        else if (type === 'tacHeatmap') {
            // v2.4+ Refactor: Worker no longer renders PDF to avoid document.createElement crashes.
            // It now receives pre-rendered imageData from the main thread.
            
            if (!imageData) {
                throw new Error('Heatmap failed: Missing imageData from main thread render.');
            }

            const samplesX = width || 40;
            const samplesY = height;
            const data = imageData; // Uint8ClampedArray [r,g,b,a, r,g,b,a, ...]
            
            // Extract pixel data and calculate TAC
            const resultValues = new Uint8Array(samplesX * samplesY);
            let maxTac = 0;
            
            for (let i = 0; i < data.length; i += 4) {
                const r = data[i] / 255;
                const g = data[i + 1] / 255;
                const b = data[i + 2] / 255;
                
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
        }
        else if (type === 'renderPageAsImage') {
            // Stub for page rendering (Legacy)
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


