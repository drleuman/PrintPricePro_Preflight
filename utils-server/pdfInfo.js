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
        let proc;
        try {
            proc = spawn(gsCmd, args);
        } catch (e) {
            return reject(new Error(`GS spawn failed synchronously: ${e.message}`));
        }

        proc.on('error', (err) => {
            if (finished) return;
            finished = true;
            clearTimeout(t);
            reject(new Error(`GS spawn failed: ${err.message}`));
        });

        let out = '';
        let err = '';
        let finished = false;

        const t = setTimeout(() => {
            if (finished) return;
            finished = true;
            try { proc.kill('SIGKILL'); } catch (e) { }
            reject(new Error('GS info timeout (30s)'));
        }, 30000);

        proc.stdout.on('data', (d) => { if (!finished) out += d.toString(); });
        proc.stderr.on('data', (d) => { if (!finished) err += d.toString(); });

        proc.on('close', (code) => {
            if (finished) return;
            finished = true;
            clearTimeout(t);
            if (code === 0) {
                const pageCount = parseInt(out.trim(), 10);
                resolve({ pageCount });
            } else {
                reject(new Error(`GS failed to get page count: ${err}`));
            }
        });
    });
}

// GS command to get MediaBox, TrimBox, and BleedBox of the first page
async function getPdfGeometryGS(pdfPath) {
    const gsCmd = resolveGs();

    // PS snippet to get various page boxes
    const psSnippet = `
        (${pdfPath.replace(/\\/g, '/')}) (r) file runpdfbegin
        1 pdfgetpage
        dup /MediaBox get {= ( ) print} forall ( | ) print
        dup /TrimBox known { dup /TrimBox get {= ( ) print} forall } { (null) print } ifelse ( | ) print
        dup /BleedBox known { dup /BleedBox get {= ( ) print} forall } { (null) print } ifelse
        (\n) print quit
    `;

    const args = [
        '-dSAFER', '-dNOPAUSE', '-dBATCH', '-dQUIET',
        '-dNODISPLAY',
        '-c', psSnippet
    ];

    return new Promise((resolve, reject) => {
        let proc;
        try {
            proc = spawn(gsCmd, args);
        } catch (e) {
            return reject(new Error(`GS spawn failed synchronously: ${e.message}`));
        }

        proc.on('error', (err) => reject(new Error(`GS spawn failed: ${err.message}`)));

        let out = '';
        proc.stdout.on('data', (d) => out += d.toString());
        proc.on('close', (code) => {
            if (code === 0) {
                // Output format: "x1 y1 x2 y2 | tx1 ty1 tx2 ty2 | bx1 by1 bx2 by2"
                const sections = out.trim().split('|').map(s => s.trim());

                const parseBox = (str) => {
                    if (!str || str === 'null') return null;
                    const b = str.split(/\s+/).map(Number);
                    return b.length === 4 ? b : null;
                };

                const mediaBox = parseBox(sections[0]);
                const trimBox = parseBox(sections[1]) || mediaBox;
                const bleedBox = parseBox(sections[2]) || mediaBox;

                resolve({ mediaBox, trimBox, bleedBox });
            } else {
                reject(new Error('GS failed to get geometry boxes'));
            }
        });
    });
}

module.exports = { getPdfInfoGS, getPdfGeometryGS };
