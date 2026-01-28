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
    // NOTE: `gs` for Linux, `gswin64c` for Windows
    const gsCmd = process.platform === 'win32' ? 'gswin64c' : 'gs';
    try {
        await execFileAsync(gsCmd, args, { maxBuffer: 1024 * 1024 * 20 });
    } catch (e) {
        if (process.platform === 'win32' && e.code === 'ENOENT') {
            // Fallback to 'gswin32c' or just 'gs' if 64-bit missing
            await execFileAsync('gs', args, { maxBuffer: 1024 * 1024 * 20 });
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
 * Streams a PDF to the response and runs a cleanup function afterwards.
 * @param {import('express').Response} res 
 * @param {string} filePath 
 * @param {string} downloadName 
 * @param {function} cleanupFn 
 */
function sendPdfAndCleanup(res, filePath, downloadName, cleanupFn) {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${downloadName}"`);
    const stream = fs.createReadStream(filePath);
    stream.on('error', async (err) => {
        console.error('PDF stream error:', err);
        if (!res.headersSent) res.status(500).json({ error: 'Failed to stream output PDF' });
        try { cleanupFn && await cleanupFn(); } catch (e) { console.error('Cleanup after stream error failed:', e); }
    });
    res.on('finish', async () => { try { cleanupFn && await cleanupFn(); } catch (e) { console.error('Cleanup after stream finish failed:', e); } });
    stream.pipe(res);
}

module.exports = {
    runGs,
    safeUnlink,
    safeRmDir,
    sendPdfAndCleanup
};
