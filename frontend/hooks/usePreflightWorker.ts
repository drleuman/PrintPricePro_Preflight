import { useEffect, useRef, useState, useCallback } from 'react';
import {
    PreflightResult,
    PreflightWorkerCommand,
    PreflightWorkerMessage,
    FileMeta,
} from '../types';
import * as pdfjsLib from 'pdfjs-dist';

// Ensure PDF.js worker is configured in the main thread context for heatmap rendering
const PDFJS_WORKER_URL = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;

type WorkerCallbacks = {
    onAnalysisResult?: (result: PreflightResult) => void;
    onTransformResult?: (blob: Blob, meta: FileMeta, operation: string) => void;
    onError?: (error: string) => void;
    onHeatmapResult?: (data: { values: Uint8Array; width: number; height: number; maxTac: number }) => void;
    onRenderPageResult?: (base64: string) => void;
};

export function usePreflightWorker(callbacks: WorkerCallbacks) {
    const workerRef = useRef<Worker | null>(null);
    const [isWorkerReady, setIsWorkerReady] = useState(false);
    const [isWorkerRunning, setIsWorkerRunning] = useState(false);

    const callbacksRef = useRef(callbacks);
    callbacksRef.current = callbacks;

    useEffect(() => {
        let w: Worker;
        try {
            w = new Worker(new URL('../workers/preflight.worker.ts', import.meta.url), {
                type: 'module',
            });
            workerRef.current = w;
            setIsWorkerReady(true);

            w.onerror = (e) => {
                console.error('Worker runtime error', e);
                setIsWorkerRunning(false);
                callbacksRef.current.onError?.(e.message || 'Fatal worker execution error');
            };

            w.onmessage = (ev: MessageEvent<PreflightWorkerMessage>) => {
                const data = ev.data;
                if (!data) return;

                const cb = callbacksRef.current;

                if (data.type === 'analysisProgress') {
                    // Optional: expose progress
                } else if (data.type === 'analysisResult') {
                    setIsWorkerRunning(false);
                    cb.onAnalysisResult?.(data.result);
                } else if (data.type === 'analysisError') {
                    setIsWorkerRunning(false);
                    cb.onError?.(data.message);
                } else if (data.type === 'transformResult') {
                    setIsWorkerRunning(false);
                    const blob = new Blob([data.buffer], { type: 'application/pdf' });
                    cb.onTransformResult?.(blob, data.fileMeta, data.operation);
                } else if (data.type === 'transformError') {
                    setIsWorkerRunning(false);
                    cb.onError?.(`${data.operation} failed: ${data.message}`);
                } else if (data.type === 'tacHeatmapResult') {
                    setIsWorkerRunning(false);
                    cb.onHeatmapResult?.({
                        values: data.values,
                        width: data.width,
                        height: data.height,
                        maxTac: data.maxTac
                    });
                } else if (data.type === 'tacHeatmapError') {
                    setIsWorkerRunning(false);
                    cb.onError?.(`Heatmap failed: ${data.message}`);
                } else if (data.type === 'renderPageResult') {
                    setIsWorkerRunning(false);
                    cb.onRenderPageResult?.(data.base64);
                } else if (data.type === 'renderError') {
                    setIsWorkerRunning(false);
                    cb.onError?.(`Render failed: ${data.message}`);
                }
            };
        } catch (e) {
            console.error('Error creating worker', e);
            callbacksRef.current.onError?.('Failed to create worker');
        }

        return () => {
            if (w) w.terminate();
            workerRef.current = null;
            setIsWorkerReady(false);
        };
    }, []);

    const runAnalysis = useCallback(async (file: File, fileMeta: FileMeta, config?: any) => {
        if (!workerRef.current) return;
        try {
            setIsWorkerRunning(true);
            const buffer = await file.arrayBuffer();
            const cmd: PreflightWorkerCommand = {
                type: 'analyze',
                fileMeta,
                buffer,
                config,
            };
            workerRef.current.postMessage(cmd, [buffer]);
        } catch (e) {
            setIsWorkerRunning(false);
            callbacks.onError?.((e as Error).message);
        }
    }, [callbacks.onError]);

    const runClientGrayscale = useCallback(async (file: File, fileMeta: FileMeta) => {
        if (!workerRef.current) return;
        try {
            setIsWorkerRunning(true);
            const buffer = await file.arrayBuffer();
            const cmd: PreflightWorkerCommand = {
                type: 'convertToGrayscale',
                fileMeta,
                buffer,
            };
            workerRef.current.postMessage(cmd, [buffer]);
        } catch (e) {
            setIsWorkerRunning(false);
            callbacks.onError?.((e as Error).message);
        }
    }, []);

    const runClientUpscale = useCallback(async (file: File, fileMeta: FileMeta, minDpi: number = 150) => {
        if (!workerRef.current) return;
        try {
            setIsWorkerRunning(true);
            const buffer = await file.arrayBuffer();
            const cmd: PreflightWorkerCommand = {
                type: 'upscaleLowResImages',
                fileMeta,
                buffer,
                minDpi,
            };
            workerRef.current.postMessage(cmd, [buffer]);
        } catch (e) {
            setIsWorkerRunning(false);
            callbacks.onError?.((e as Error).message);
        }
    }, []);

    const runFixBleed = useCallback(async (file: File, fileMeta: FileMeta, mode: 'safe' | 'aggressive' = 'safe') => {
        if (!workerRef.current) return;
        try {
            setIsWorkerRunning(true);
            const buffer = await file.arrayBuffer();
            const cmd: PreflightWorkerCommand = {
                type: 'fixBleed',
                fileMeta,
                buffer,
                mode,
            };
            workerRef.current.postMessage(cmd, [buffer]);
        } catch (e) {
            setIsWorkerRunning(false);
            callbacks.onError?.((e as Error).message);
        }
    }, []);

    const runTacHeatmap = useCallback(async (file: File, fileMeta: FileMeta, pageIndex: number) => {
        if (!workerRef.current) return;
        try {
            console.log('[APP][HEATMAP][MAIN-THREAD-RENDER]', { pageIndex });
            setIsWorkerRunning(true);
            const buffer = await file.arrayBuffer();

            // v2.4+ Refactor: Render PDF in main thread to avoid Worker DOM dependency crashes
            const loadingTask = pdfjsLib.getDocument({ data: buffer });
            const pdf = await loadingTask.promise;
            
            const pageNum = (pageIndex || 0) + 1;
            const page = await pdf.getPage(pageNum);
            
            const samplesX = 40;
            const viewport = page.getViewport({ scale: 1.0 });
            const ratio = viewport.height / viewport.width;
            const samplesY = Math.round(samplesX * ratio);

            // Create a temporary canvas in the main thread (DOM available)
            const canvas = document.createElement('canvas');
            canvas.width = samplesX;
            canvas.height = samplesY;
            const context = canvas.getContext('2d', { willReadFrequently: true });
            
            if (!context) throw new Error('Could not get 2D context for heatmap rendering');
            
            const renderViewport = page.getViewport({ scale: samplesX / viewport.width });
            await page.render({
                canvasContext: context as any,
                viewport: renderViewport
            }).promise;
            
            // Extract raw image data to send to worker for TAC calculation
            const imageData = context.getImageData(0, 0, samplesX, samplesY).data;
            
            const cmd: any = {
                type: 'tacHeatmap',
                fileMeta,
                pageIndex,
                imageData,
                width: samplesX,
                height: samplesY
            };
            
            // Send to worker for computational TAC calculation
            workerRef.current.postMessage(cmd, [imageData.buffer]);
            
            await pdf.destroy();
        } catch (e) {
            setIsWorkerRunning(false);
            console.error('[APP][HEATMAP][MAIN-THREAD-ERROR]', e);
            callbacks.onError?.((e as Error).message);
        }
    }, [callbacks.onError]);

    const runRenderPageAsImage = useCallback(async (file: File, fileMeta: FileMeta, pageIndex: number) => {
        if (!workerRef.current) return;
        try {
            setIsWorkerRunning(true);
            const buffer = await file.arrayBuffer();
            const cmd: PreflightWorkerCommand = {
                type: 'renderPageAsImage',
                fileMeta,
                buffer,
                pageIndex
            };
            workerRef.current.postMessage(cmd, [buffer]);
        } catch (e) {
            setIsWorkerRunning(false);
            callbacks.onError?.((e as Error).message);
        }
    }, []);

    const [error, setError] = useState<string | null>(null);

    // Update the existing ref set at the top
    useEffect(() => {
        callbacksRef.current = {
            ...callbacks,
            onError: (err: string) => {
                setError(err);
                callbacks.onError?.(err);
            }
        };
    }, [callbacks]);

    return {
        isWorkerReady,
        isWorkerRunning,
        error,
        runAnalysis,
        runClientGrayscale,
        runClientUpscale,
        runFixBleed,
        runTacHeatmap,
        runRenderPageAsImage,
    };
}
