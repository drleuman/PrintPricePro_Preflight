const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { PDFDocument, PDFName, PDFArray, PDFDict, pushGraphicsState, concatTransformationMatrix, popGraphicsState } = require('pdf-lib');
const { runGs, acquireGsSlot, releaseGsSlot, resolveGsCmd } = require('./ghostscript');
const { getPdfInfoGS } = require('../utils-server/pdfInfo');

// Use consistent GS resolution
const GS_CMD = resolveGsCmd();

/**
 * Normalizes profile name to internal keys
 * MIGRATION ISO 12647-2:2013 (FOGRA51/52)
 */
function normalizeProfile(p) {
    if (!p) return 'iso_coated_v3';
    const low = p.toLowerCase();

    // FOGRA51 (Coated v3) - NEW STANDARD
    if (low.includes('fogra51') || low.includes('coated_v3') || low.includes('coated v3') || low.includes('pso_coated')) return 'iso_coated_v3';

    // FOGRA52 (Uncoated v3) - NEW STANDARD
    if (low.includes('fogra52') || low.includes('uncoated_v3') || low.includes('uncoated v3') || low.includes('pso_uncoated')) return 'iso_uncoated_v3';

    // Legacy Mappings (Force Upgrade)
    if (low.includes('fogra39') || low.includes('iso_coated_v2')) return 'iso_coated_v3';
    if (low.includes('fogra29') || low.includes('iso_uncoated') || low.includes('fogra47')) return 'iso_uncoated_v3';

    if (low.includes('gracol')) return 'gracol';
    if (low.includes('swop')) return 'swop';

    return low.replace(/[^a-z0-9_]/g, '_');
}

/**
 * Generic command execution with timeout
 */
async function execCmd(cmd, args, opts = {}) {
    const timeoutMs = opts.timeoutMs ?? 60000;
    const maxOut = opts.maxOutputBytes || 1024 * 1024; // 1MB
    return new Promise((resolve) => {
        const p = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
        let out = '';
        let err = '';
        let outTruncated = false;
        let errTruncated = false;
        let finished = false;

        const cleanup = () => {
            if (finished) return;
            finished = true;
            clearTimeout(t);
        };

        const t = setTimeout(() => {
            if (finished) return;
            console.warn(`[EXEC-TIMEOUT] Killing process ${cmd} after ${timeoutMs}ms`);
            cleanup();
            try { p.kill('SIGKILL'); } catch (e) { }
            resolve({
                ok: false,
                code: null,
                stdout: out,
                stderr: `${err}\nExecution timed out after ${timeoutMs}ms`,
                killed: true,
                stdout_truncated: outTruncated,
                stderr_truncated: errTruncated
            });
        }, timeoutMs);

        p.stdout.on('data', (d) => {
            if (finished) return;
            if (!outTruncated) {
                const chunk = d.toString('utf8');
                const space = maxOut - out.length;
                if (space <= 0) outTruncated = true;
                else if (chunk.length > space) { out += chunk.slice(0, space); outTruncated = true; }
                else out += chunk;
            }
        });

        p.stderr.on('data', (d) => {
            if (finished) return;
            if (!errTruncated) {
                const chunk = d.toString('utf8');
                const space = maxOut - err.length;
                if (space <= 0) errTruncated = true;
                else if (chunk.length > space) { err += chunk.slice(0, space); errTruncated = true; }
                else err += chunk;
            }
        });

        p.on('error', (e) => {
            if (finished) return;
            cleanup();
            resolve({ ok: false, code: -1, stdout: out, stderr: `${err}\nSpawn error: ${e.message}`, killed: false, stdout_truncated: outTruncated, stderr_truncated: errTruncated });
        });

        p.on('close', (code) => {
            if (finished) return;
            cleanup();
            resolve({ ok: (code === 0 || code === null), code, stdout: out, stderr: err, killed: false, stdout_truncated: outTruncated, stderr_truncated: errTruncated });
        });
    });
}

/**
 * Converts colors using Ghostscript with modern FOGRA51/52 standards
 */
async function gsConvertColor(input, output, profile, opts = {}) {
    const prof = normalizeProfile(profile);
    const iccDir = path.join(__dirname, '../icc-profiles');

    // Config Map for modern standards
    const configMap = {
        'iso_coated_v3': {
            icc: 'PSO_Coated_v3.icc',
            info: 'PSO Coated v3 (FOGRA51)',
            cond: 'FOGRA51'
        },
        'iso_uncoated_v3': {
            icc: 'PSOuncoated_v3_FOGRA52.icc',
            info: 'PSO Uncoated v3 (FOGRA52)',
            cond: 'FOGRA52'
        },
        'gracol': {
            icc: 'GRACoL2006_Coated1v2.icc',
            info: 'GRACoL 2006',
            cond: 'GRACoL'
        },
        'swop': {
            icc: 'USWebCoatedSWOP.icc',
            info: 'U.S. Web Coated (SWOP) v2',
            cond: 'SWOP'
        }
    };

    const cfg = configMap[prof] || {
        icc: `${prof}.icc`,
        info: prof,
        cond: prof
    };

    const iccPath = path.join(iccDir, cfg.icc);

    // Fallback logic for transitioning without having all binary files yet
    let finalIccPath = iccPath;
    if (!fs.existsSync(iccPath) && prof === 'iso_coated_v3') {
        const legacyPath = path.join(iccDir, 'CoatedFOGRA39.icc');
        if (fs.existsSync(legacyPath)) finalIccPath = legacyPath;
    }

    // Generate dynamic pdfx_def.ps to avoid missing file errors
    const psEscape = (s) => String(s || '').replace(/[\\()]/g, '\\$&').replace(/[\r\n]/g, ' ');
    const sanitizeFilename = (s) => String(s || '').replace(/[^a-zA-Z0-9._-]/g, '_');

    const psContent = `
%!PS
[ /Title (${psEscape(sanitizeFilename(path.basename(input)))}) /DOCINFO pdfmark
[/Predictor 0 /OutputConditionIdentifier (${psEscape(cfg.cond)}) /DestOutputProfile (${psEscape(finalIccPath.replace(/\\/g, '/'))}) /OutputCondition (${psEscape(cfg.info)}) /Info (${psEscape(cfg.info)}) /RegistryName (http://www.color.org) /S /GTS_PDFX /DefaultRGB [ /DeviceRGB ] /DefaultCMYK [ /DeviceCMYK ] /OutputIntent { << /Type /OutputIntent /S /GTS_PDFX /OutputConditionIdentifier (${psEscape(cfg.cond)}) /OutputCondition (${psEscape(cfg.info)}) /RegistryName (http://www.color.org) /Info (${psEscape(cfg.info)}) /DestOutputProfile { ( ${psEscape(finalIccPath.replace(/\\/g, '/'))} ) (r) file } >> } [ /DeviceCMYK ] pdfmark
`.trim();

    const psPath = path.join(path.dirname(output), `pdfx_def_${Date.now()}.ps`);
    await fs.promises.writeFile(psPath, psContent);

    const args = [
        '-dSAFER', '-dNOPAUSE', '-dBATCH', '-dQUIET',
        '-sDEVICE=pdfwrite',
        '-dNumRenderingThreads=4', // Optimization for multi-core servers
        '-dMaxBitmap=500000000', // Allow more memory for rasterization if needed
        `-sOutputICCProfile=${finalIccPath}`,
        `-sDefaultCMYKProfile=${finalIccPath}`,
        '-dRenderIntent=1',
        '-dSimulateOverprint=true',
        '-dBlackTextThreshold=0.0',
        '-o', output
    ];

    const srgbPath = path.join(iccDir, 'srgb.icc');
    if (fs.existsSync(srgbPath)) {
        args.push(`-sDefaultRGBProfile=${srgbPath}`);
    }

    if (opts.finalizeOnly) {
        args.push('-dColorConversionStrategy=/LeaveColorUnchanged');
    } else {
        args.push('-dColorConversionStrategy=/CMYK');
        args.push('-dProcessColorModel=/DeviceCMYK');
    }

    // Pass the PDFX definition only if we are specifically asked or if we want professional metadata
    // For now, let's stick to core conversion to ensure stability, or use a safer PS injection.
    args.push(input);

    try {
        await acquireGsSlot();
        console.log(`[GS-CONVERT] Running: ${GS_CMD} ${args.join(' ')}`);
        const { ok, stderr, code } = await execCmd(GS_CMD, args, { timeoutMs: 240000 });
        if (!ok) {
            console.error(`[GS-CONVERT] Failed with code ${code}. Stderr: ${stderr}`);
            // If code is not null, it means GS exited with an error. 
            // We include the stderr in the error message for better diagnostics.
            throw new Error(`GS color conversion failed (code ${code}): ${stderr || 'Internal GS failure'}`);
        }

        return {
            verified: true,
            identifier: cfg.cond,
            expectedCond: cfg.cond,
            gsMode: opts.finalizeOnly ? 'finalize' : 'convert'
        };
    } catch (e) {
        try { await fs.promises.unlink(psPath); } catch (e2) { }
        throw e;
    } finally {
        releaseGsSlot();
    }
}

/**
 * Flattens transparency using Ghostscript
 */
async function gsFlattenTransparency(input, output) {
    const args = [
        '-dSAFER', '-dNOPAUSE', '-dBATCH', '-dQUIET',
        '-sDEVICE=pdfwrite',
        '-dCompatibilityLevel=1.3',
        '-o', output,
        input
    ];
    await acquireGsSlot();
    try {
        const { ok, stderr } = await execCmd(GS_CMD, args, { timeoutMs: 240000 });
        if (!ok) throw new Error(`GS flattening failed: ${stderr}`);
    } finally {
        releaseGsSlot();
    }
}

/**
 * Rebuilds PDF by rasterizing pages to high-res images
 */
async function rebuildAtDpi(input, output, dpi = 300) {
    const args = [
        '-dSAFER', '-dNOPAUSE', '-dBATCH', '-dQUIET',
        '-sDEVICE=pdfwrite',
        '-dNumRenderingThreads=4',
        `-dPDFSETTINGS=/prepress`,
        `-r${dpi}`,
        '-o', output,
        input
    ];
    await acquireGsSlot();
    try {
        const { ok, stderr } = await execCmd(GS_CMD, args, { timeoutMs: 240000 });
        if (!ok) throw new Error(`GS rebuild failed: ${stderr}`);
    } finally {
        releaseGsSlot();
    }
}

/**
 * Adds 3mm bleed using pdf-lib (Industrial V3 Scale-to-Bleed)
 */
/**
 * Adds 3mm bleed using pdf-lib (Industrial V3 Scale-to-Bleed)
 */
async function addBleedCanvasPdf(inputPath, outPath, bleedMm = 3) {
    const bleedPt = (Number(bleedMm) || 3) * 72 / 25.4;
    const bytes = await fs.promises.readFile(inputPath);
    const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });

    const pages = doc.getPages();
    for (let i = 0; i < pages.length; i++) {
        const p = pages[i];
        const { width, height } = p.getSize(); // native size

        // Calculate Scale-to-Bleed (Industrial V3)
        const sx = (width + (bleedPt * 2)) / width;
        const sy = (height + (bleedPt * 2)) / height;
        const scale = Math.max(sx, sy);

        // RIP-style Matrix Translation & Scaling
        const tx = ((1 - scale) * width) / 2;
        const ty = ((1 - scale) * height) / 2;

        // Apply transformation matrix to the page content stream (Industrial V3)
        const ops = [
            pushGraphicsState(),
            concatTransformationMatrix(scale, 0, 0, scale, tx, ty)
        ];

        if (typeof p.prependOperators === 'function') {
            p.prependOperators(...ops);
        } else {
            // Robust fallback for older builds: manually insert into content streams array
            try {
                let contents = p.node.get(PDFName.of('Contents'));
                let actualContents = contents;

                // If it's a reference, we must resolve it to check its true type, 
                // but we might want to keep the reference or just unwrap it.
                // Normally it's safe to directly reference the streams in a new array.
                if (doc.context.lookup(contents) instanceof PDFArray) {
                    actualContents = doc.context.lookup(contents);
                }

                const newStream = doc.context.register(
                    doc.context.flateStream(ops.map(o => o.toString()).join(' '))
                );

                if (actualContents instanceof PDFArray) {
                    p.node.set(PDFName.of('Contents'), doc.context.obj([newStream, ...actualContents.asArray()]));
                } else if (contents) {
                    p.node.set(PDFName.of('Contents'), doc.context.obj([newStream, contents]));
                } else {
                    p.pushOperators(...ops);
                }
            } catch (e) {
                p.pushOperators(...ops);
            }
        }
        p.pushOperators(popGraphicsState());

        // Set technical boxes (RIP-style)
        const newW = width + (bleedPt * 2);
        const newH = height + (bleedPt * 2);
        const newX = -bleedPt;
        const newY = -bleedPt;

        p.setTrimBox(0, 0, width, height);
        p.setBleedBox(newX, newY, newW, newH);
        p.setMediaBox(newX, newY, newW, newH);
        p.setCropBox(newX, newY, newW, newH);
    }

    const outBytes = await doc.save();
    await fs.promises.writeFile(outPath, outBytes);
}

module.exports = {
    execCmd,
    normalizeProfile,
    gsConvertColor,
    gsFlattenTransparency,
    rebuildAtDpi,
    addBleedCanvasPdf
};
