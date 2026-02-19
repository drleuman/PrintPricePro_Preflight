const fs = require('fs');
const { execFile } = require('child_process');
const { promisify } = require('util');
const execFileAsync = promisify(execFile);
const unlinkAsync = promisify(fs.unlink);
const rmdirAsync = promisify(fs.rmdir);

/**
 * Executes Ghostscript with the provided arguments.
 * @param {string[]} args - Array of command line arguments for gs.
 */
async function runGs(args) {
    // Priority: 1. GS_PATH env var, 2. OS-specific default
    const customPath = process.env.GS_PATH;
    const gsCmd = customPath || (process.platform === 'win32' ? 'gswin64c' : 'gs');

    try {
        await execFileAsync(gsCmd, args, { maxBuffer: 1024 * 1024 * 50 }); // 50MB buffer
    } catch (e) {
        // Fallback for Windows if gswin64c fails
        if (!customPath && process.platform === 'win32' && e.code === 'ENOENT') {
            try {
                await execFileAsync('gs', args, { maxBuffer: 1024 * 1024 * 50 });
            } catch (e2) {
                throw e2;
            }
        } else {
            throw e;
        }
    }
}

async function safeUnlink(p) {
    if (!p) return;
    try { await unlinkAsync(p); } catch (e) { console.warn(`Failed to unlink ${p}:`, e.message); }
}

async function safeRmDir(dir) {
    if (!dir) return;
    try { await rmdirAsync(dir, { recursive: true }); } catch (e) { console.warn(`Failed to remove dir ${dir}:`, e.message); }
}

/**
 * Sends a PDF to the response and runs a cleanup function afterwards.
 * Uses whole-file reading instead of streaming for maximum compatibility with proxies.
 * @param {import('express').Response} res 
 * @param {string} filePath 
 * @param {string} downloadName 
 * @param {function} cleanupFn 
 */
async function sendPdfAndCleanup(res, filePath, downloadName, cleanupFn) {
    try {
        // Ensure file exists and get size
        let stats;
        try { stats = await fs.promises.stat(filePath); } catch (e) { throw new Error(`File not found: ${filePath}`); }

        // Robust headers for large generated files
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Length', stats.size);
        res.setHeader('Content-Disposition', `attachment; filename="${downloadName}"`);
        res.setHeader('X-Accel-Buffering', 'no'); // Disable Nginx buffering
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

        // Expose useful headers; CORS origin handled globally
        res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition, X-PPP-Autofix-Report, Content-Length');

        // Stream file to client to avoid buffering whole file in memory
        const stream = fs.createReadStream(filePath);
        stream.on('error', (err) => {
            console.error('Stream error while sending PDF:', err);
            if (!res.headersSent) res.status(500).json({ error: 'Failed to stream PDF', details: err.message });
            // Attempt cleanup
            if (cleanupFn) try { cleanupFn(); } catch (_) { }
        });

        stream.pipe(res);

        // After stream finishes, run cleanup
        stream.on('close', async () => {
            if (cleanupFn) {
                try { await cleanupFn(); } catch (e) { console.error('Cleanup failed:', e); }
            }
        });
    } catch (err) {
        console.error('sendPdfAndCleanup error:', err);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Failed to process output PDF', details: err.message });
        }
        // Attempt cleanup even on error
        if (cleanupFn) {
            try { await cleanupFn(); } catch (e) { }
        }
    }
}

module.exports = {
    runGs,
    safeUnlink,
    safeRmDir,
    sendPdfAndCleanup
};
