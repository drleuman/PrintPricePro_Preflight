/**
 * worker/pdf_probe.js
 * Faster PDF probing using Ghostscript to avoid large memory allocations
 */
const { spawn } = require('child_process');
const fs = require('fs');

async function probe() {
    const pdfPath = process.argv[2];
    if (!pdfPath) {
        console.error('Usage: node pdf_probe.js <path>');
        process.exit(1);
    }

    // Resolve GS command
    let gsCmd = process.env.GS_PATH || (process.platform === 'win32' ? 'gswin64c' : 'gs');

    // Basic page count probe
    const escapedPath = pdfPath.replace(/\\/g, '/').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
    const args = [
        '-dSAFER', '-dNOPAUSE', '-dBATCH', '-dQUIET',
        '-dNODISPLAY',
        '--permit-file-read=' + pdfPath,
        '-c', `(${escapedPath}) (r) file runpdfbegin pdfpagecount = quit`
    ];

    const proc = spawn(gsCmd, args);
    let out = '';
    let err = '';
    proc.stdout.on('data', d => out += d);
    proc.stderr.on('data', d => err += d);
    proc.on('close', code => {
        if (code === 0) {
            console.log(JSON.stringify({ pageCount: parseInt(out.trim(), 10) }));
            process.exit(0);
        } else {
            console.error('GS Error:', err);
            process.exit(1);
        }
    });
}

probe().catch(() => process.exit(1));
