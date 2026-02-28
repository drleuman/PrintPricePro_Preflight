const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const GS_COMMON_PATHS = ['/usr/bin/gs', '/usr/local/bin/gs', '/usr/bin/ghostscript'];
let _gsCmd = null;
function resolveGs() {
    if (_gsCmd) return _gsCmd;
    if (process.env.GS_PATH) { _gsCmd = process.env.GS_PATH; return _gsCmd; }
    if (process.platform === 'win32') { _gsCmd = 'gswin64c'; return _gsCmd; }
    for (const p of GS_COMMON_PATHS) { if (fs.existsSync(p)) { _gsCmd = p; return _gsCmd; } }
    _gsCmd = 'gs';
    return _gsCmd;
}

async function getPdfInfoGS(pdfPath) {
    const gsCmd = resolveGs();

    // Command to get page count and some basic info
    // We use -dNODISPLAY and a small PS snippet
    const args = [
        '-dSAFER', '-dNOPAUSE', '-dBATCH', '-dQUIET',
        '-dNODISPLAY',
        '-c', `(${pdfPath.replace(/\\/g, '/')}) (r) file runpdfbegin pdfpagecount = quit`
    ];

    return new Promise((resolve, reject) => {
        const proc = spawn(gsCmd, args);
        let out = '';
        let err = '';

        proc.stdout.on('data', (d) => out += d.toString());
        proc.stderr.on('data', (d) => err += d.toString());

        proc.on('close', (code) => {
            if (code === 0) {
                const pageCount = parseInt(out.trim(), 10);
                resolve({ pageCount });
            } else {
                reject(new Error(`GS failed to get page count: ${err}`));
            }
        });
    });
}

// Another GS command to get MediaBox/TrimBox of the first page
async function getPdfGeometryGS(pdfPath) {
    const gsCmd = resolveGs();

    const args = [
        '-dSAFER', '-dNOPAUSE', '-dBATCH', '-dQUIET',
        '-dNODISPLAY',
        '-c', `(${pdfPath.replace(/\\/g, '/')}) (r) file runpdfbegin 1 pdfgetpage /MediaBox get {= ( ) print} forall (\n) print quit`
    ];

    return new Promise((resolve, reject) => {
        const proc = spawn(gsCmd, args);
        let out = '';
        proc.stdout.on('data', (d) => out += d.toString());
        proc.on('close', (code) => {
            if (code === 0) {
                const parts = out.trim().split(/\s+/).map(Number);
                if (parts.length === 4) {
                    resolve({ mediaBox: parts });
                } else {
                    resolve({ mediaBox: null });
                }
            } else {
                reject(new Error('GS failed to get geometry'));
            }
        });
    });
}

module.exports = { getPdfInfoGS, getPdfGeometryGS };
