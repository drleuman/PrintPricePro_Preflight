const { execFile } = require('child_process');
const { promisify } = require('util');
const fs = require('fs');
const execFileAsync = promisify(execFile);

/**
 * Executes Ghostscript with the provided arguments.
 * @param {string[]} args - Array of command line arguments for gs.
 */
async function runGs(args) {
    // NOTE: `gs` must be installed in the runtime image.
    await execFileAsync('gs', args, { maxBuffer: 1024 * 1024 * 20 });
}

function safeUnlink(p) {
    if (!p) return;
    try { fs.unlinkSync(p); } catch (e) { }
}

function safeRmDir(dir) {
    if (!dir) return;
    try { fs.rmdirSync(dir, { recursive: true }); } catch (e) { }
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
    stream.on('error', (err) => {
        console.error('PDF stream error:', err);
        if (!res.headersSent) res.status(500).json({ error: 'Failed to stream output PDF' });
        try { cleanupFn && cleanupFn(); } catch (e) { }
    });
    res.on('finish', () => { try { cleanupFn && cleanupFn(); } catch (e) { } });
    stream.pipe(res);
}

module.exports = {
    runGs,
    safeUnlink,
    safeRmDir,
    sendPdfAndCleanup
};
