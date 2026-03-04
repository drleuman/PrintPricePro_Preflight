import PreflightWorker from '../workers/preflight.worker?worker';

declare global {
    interface Window {
        runPreflightBase64: (base64: string, filename: string) => Promise<any>;
    }
}

function base64ToArrayBuffer(base64: string) {
    const binary_string = window.atob(base64);
    const len = binary_string.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binary_string.charCodeAt(i);
    }
    return bytes.buffer;
}

window.runPreflightBase64 = (base64, filename) => {
    return new Promise((resolve, reject) => {
        const buffer = base64ToArrayBuffer(base64);
        const worker = new PreflightWorker();

        worker.onmessage = (e) => {
            if (e.data.type === 'analysisResult') {
                worker.terminate();
                resolve(e.data.result);
            } else if (e.data.type === 'analysisError') {
                worker.terminate();
                reject(e.data.message);
            }
        };

        worker.onerror = (e) => {
            worker.terminate();
            reject(e.message);
        };

        worker.postMessage({
            type: 'analyze',
            fileMeta: { name: filename, size: buffer.byteLength, type: 'application/pdf' },
            buffer
        });
    });
};
