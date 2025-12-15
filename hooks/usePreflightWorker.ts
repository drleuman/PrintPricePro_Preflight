import { useEffect, useRef, useState, useCallback } from 'react';
import {
    PreflightResult,
    PreflightWorkerCommand,
    PreflightWorkerMessage,
    FileMeta,
} from '../types';

type WorkerCallbacks = {
    onAnalysisResult?: (result: PreflightResult) => void;
    onTransformResult?: (blob: Blob, meta: FileMeta, operation: string) => void;
    onError?: (error: string) => void;
};

export function usePreflightWorker(callbacks: WorkerCallbacks) {
    const workerRef = useRef<Worker | null>(null);
    const [isWorkerReady, setIsWorkerReady] = useState(false);
    const [isWorkerRunning, setIsWorkerRunning] = useState(false);

    useEffect(() => {
        let w: Worker;
        try {
            w = new Worker(new URL('../workers/preflight.worker.ts', import.meta.url), {
                type: 'module',
            });
            workerRef.current = w;
            setIsWorkerReady(true);

            w.onmessage = (ev: MessageEvent<PreflightWorkerMessage>) => {
                const data = ev.data;
                if (!data) return;

                if (data.type === 'analysisProgress') {
                    // Optional: expose progress
                } else if (data.type === 'analysisResult') {
                    setIsWorkerRunning(false);
                    callbacks.onAnalysisResult?.(data.result);
                } else if (data.type === 'analysisError') {
                    setIsWorkerRunning(false);
                    callbacks.onError?.(data.message);
                } else if (data.type === 'transformResult') {
                    setIsWorkerRunning(false);
                    const blob = new Blob([data.buffer], { type: 'application/pdf' });
                    callbacks.onTransformResult?.(blob, data.fileMeta, data.operation);
                } else if (data.type === 'transformError') {
                    setIsWorkerRunning(false);
                    callbacks.onError?.(`${data.operation} failed: ${data.message}`);
                }
            };
        } catch (e) {
            console.error('Error creating worker', e);
            callbacks.onError?.('Failed to create worker');
        }

        return () => {
            if (w) w.terminate();
            workerRef.current = null;
            setIsWorkerReady(false);
        };
    }, []); // Eslint disable-line react-hooks/exhaustive-deps

    const runAnalysis = useCallback(async (file: File, fileMeta: FileMeta) => {
        if (!workerRef.current) return;
        try {
            setIsWorkerRunning(true);
            const buffer = await file.arrayBuffer();
            const cmd: PreflightWorkerCommand = {
                type: 'analyze',
                fileMeta,
                buffer,
            };
            workerRef.current.postMessage(cmd, [buffer]);
        } catch (e) {
            setIsWorkerRunning(false);
            callbacks.onError?.((e as Error).message);
        }
    }, []);

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

    return {
        isWorkerReady,
        isWorkerRunning,
        runAnalysis,
        runClientGrayscale,
        runClientUpscale,
    };
}
