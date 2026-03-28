/**
 * Stub for preflight.worker.ts to allow build to pass.
 * This should be replaced with the actual PDF processing worker logic.
 */
self.onmessage = (e) => {
    console.log('[Worker Stub] received command:', e.data.type);
    if (e.data.type === 'analyze') {
        self.postMessage({
            type: 'analysisResult',
            result: { ok: true, issues: [], stats: { pages: 1 } }
        });
    }
};
export {};
