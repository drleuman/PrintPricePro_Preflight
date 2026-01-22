const express = require('express');
const multer = require('multer');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { PDFDocument } = require('pdf-lib');
const { runGs, sendPdfAndCleanup, safeUnlink, safeRmDir } = require('../services/ghostscript');

const router = express.Router();

// Setup upload
const uploadDir = path.join(os.tmpdir(), 'ppp-preflight');
try { fs.mkdirSync(uploadDir, { recursive: true }); } catch (e) { }

const upload = multer({
    storage: multer.diskStorage({
        destination: (_req, _file, cb) => cb(null, uploadDir),
        filename: (_req, file, cb) => {
            const safe = String(file.originalname || 'input.pdf').replace(/[^a-z0-9_.-]/gi, '_');
            cb(null, `${Date.now()}_${Math.random().toString(16).slice(2)}_${safe}`);
        },
    }),
    limits: { fileSize: 60 * 1024 * 1024 },
});

// Export for cleanup service if needed
router.uploadDir = uploadDir;

// -------- Routes --------

router.post('/grayscale', upload.single('file'), async (req, res) => {
    const inputPath = req.file && req.file.path;
    if (!inputPath) return res.status(400).json({ error: 'Missing file' });

    const baseName = path.basename(req.file.originalname || 'document.pdf').replace(/\.pdf$/i, '');
    const outName = `${baseName}_bw.pdf`;
    const outPath = path.join(uploadDir, `${Date.now()}_out_bw.pdf`);

    try {
        await runGs([
            '-dSAFER', '-dBATCH', '-dNOPAUSE', '-dQUIET',
            '-sDEVICE=pdfwrite',
            '-dCompatibilityLevel=1.4',
            '-dPDFSETTINGS=/prepress',
            '-sColorConversionStrategy=Gray',
            '-dProcessColorModel=/DeviceGray',
            '-dOverrideICC',
            '-dEmbedAllFonts=true',
            '-dSubsetFonts=true',
            '-dCompressFonts=true',
            '-dNOPLATFONTS',
            `-sOutputFile=${outPath}`,
            inputPath,
        ]);

        sendPdfAndCleanup(res, outPath, outName, () => {
            safeUnlink(inputPath);
            safeUnlink(outPath);
        });
    } catch (err) {
        console.error('grayscale conversion failed:', err);
        safeUnlink(inputPath);
        safeUnlink(outPath);
        res.status(500).json({ error: 'Grayscale conversion failed' });
    }
});

router.post('/convert-color', upload.single('file'), async (req, res) => {
    const inputPath = req.file && req.file.path;
    if (!inputPath) return res.status(400).json({ error: 'Missing file' });

    const profile = (req.body.profile || 'cmyk').toLowerCase();

    const baseName = path.basename(req.file.originalname || 'document.pdf').replace(/\.pdf$/i, '');
    const outName = `${baseName}_${profile}.pdf`;
    const outPath = path.join(uploadDir, `${Date.now()}_out_${profile}.pdf`);

    let args = [
        '-dSAFER', '-dBATCH', '-dNOPAUSE', '-dQUIET',
        '-sDEVICE=pdfwrite',
        '-dCompatibilityLevel=1.4',
        '-dPDFSETTINGS=/prepress',
        '-dOverrideICC',
        `-sOutputFile=${outPath}`,
    ];

    if (profile === 'cmyk') {
        args.push(
            '-sColorConversionStrategy=CMYK',
            '-dProcessColorModel=/DeviceCMYK',
            '-dConvertCMYKImagesToRGB=false',
            '-dAutoRotatePages=/None',
            '-dAutoFilterColorImages=false',
            '-dAutoFilterGrayImages=false',
            '-dColorImageFilter=/DCTEncode',
            '-dGrayImageFilter=/DCTEncode',
            '-dDownsampleMonoImages=false',
            '-dDownsampleGrayImages=false',
            '-dDownsampleColorImages=false'
        );
    } else {
        const profilesDir = path.join(__dirname, '../icc-profiles');
        const map = {
            'fogra39': 'CoatedFOGRA39.icc',
            'gracol': 'GRACoL2006_Coated1v2.icc',
            'swop': 'USWebCoatedSWOP.icc'
        };
        const fileName = map[profile] || `${profile}.icc`;
        const profilePath = path.join(profilesDir, fileName);

        if (fs.existsSync(profilePath)) {
            args.push(
                '-sColorConversionStrategy=CMYK',
                '-dProcessColorModel=/DeviceCMYK',
                `-sOutputICCProfile=${profilePath}`,
                '-dRenderIntent=1'
            );
        } else {
            console.warn(`Profile ${profile} not found at ${profilePath}, falling back to generic CMYK`);
            args.push(
                '-sColorConversionStrategy=CMYK',
                '-dProcessColorModel=/DeviceCMYK'
            );
        }
    }

    try {
        await runGs([...args, inputPath]);

        sendPdfAndCleanup(res, outPath, outName, () => {
            safeUnlink(inputPath);
            safeUnlink(outPath);
        });
    } catch (err) {
        console.error('Color conversion failed:', err);
        safeUnlink(inputPath);
        safeUnlink(outPath);
        res.status(500).json({ error: 'Color conversion failed' });
    }
});

router.post('/rebuild-150dpi', upload.single('file'), async (req, res) => {
    const inputPath = req.file && req.file.path;
    if (!inputPath) return res.status(400).json({ error: 'Missing file' });

    const requested = Number((req.query && req.query.dpi) || 150);
    const dpi = Number.isFinite(requested) ? Math.min(600, Math.max(72, requested)) : 150;

    const baseName = path.basename(req.file.originalname || 'document.pdf').replace(/\.pdf$/i, '');
    const outName = `${baseName}_rebuild_${dpi}dpi.pdf`;
    const outPath = path.join(uploadDir, `${Date.now()}_out_rebuild_${dpi}.pdf`);

    // Render pages to images and rebuild a fresh PDF.
    const tmpDir = fs.mkdtempSync(path.join(uploadDir, 'rebuild_'));
    const imgPattern = path.join(tmpDir, 'page-%03d.png');

    try {
        // 1) Rasterize PDF -> PNG (Ghostscript sí puede hacer esto)
        await runGs([
            '-dSAFER', '-dBATCH', '-dNOPAUSE', '-dQUIET',
            '-sDEVICE=png16m',
            `-r${dpi}`,
            '-o', imgPattern,
            inputPath,
        ]);

        const imgs = fs
            .readdirSync(tmpDir)
            .filter((f) => /^page-\d+\.png$/i.test(f))
            .sort()
            .map((f) => path.join(tmpDir, f));

        if (!imgs.length) {
            throw new Error('No images were produced during rebuild');
        }

        // 2) Rebuild PDF from PNGs using pdf-lib (NO Ghostscript here)
        const pdfDoc = await PDFDocument.create();

        // Convert pixel dimensions -> PDF points preserving physical size:
        // points = px * 72 / dpi
        const pxToPt = (px) => (px * 72) / dpi;

        for (const imgPath of imgs) {
            const pngBytes = fs.readFileSync(imgPath);
            const png = await pdfDoc.embedPng(pngBytes);

            const wPt = pxToPt(png.width);
            const hPt = pxToPt(png.height);

            const page = pdfDoc.addPage([wPt, hPt]);
            page.drawImage(png, { x: 0, y: 0, width: wPt, height: hPt });
        }

        const pdfBytes = await pdfDoc.save();
        fs.writeFileSync(outPath, pdfBytes);

        sendPdfAndCleanup(res, outPath, outName, () => {
            safeUnlink(inputPath);
            safeUnlink(outPath);
            safeRmDir(tmpDir);
        });
    } catch (err) {
        console.error('rebuild dpi failed:', err);
        console.error('Error details:', {
            message: err.message,
            stack: err.stack,
            inputPath,
            outPath,
            tmpDir
        });
        safeUnlink(inputPath);
        safeUnlink(outPath);
        safeRmDir(tmpDir);
        res.status(500).json({
            error: 'Rebuild failed',
            details: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
});


/**
 * AutoFix pipeline (server-side)
 * - Target: CMYK (ISO Coated v2 / FOGRA39) by default
 * - Optional: add 3mm bleed canvas
 * - Optional: rebuild at 300dpi (min 150) ONLY when issues indicate low-res (or forced)
 *
 * Request (multipart/form-data):
 *  - file: PDF
 *  - target: "cmyk" | "gray"   (default: "cmyk")
 *  - profile: "fogra39" | "iso_coated_v2" | "gracol" | "swop" | "<iccname>" (default: "iso_coated_v2")
 *  - bleedMm: number (default: 3)
 *  - dpiPreferred: number (default: 300)
 *  - dpiMin: number (default: 150)
 *  - issues: JSON string of PreflightResult (optional)
 *  - forceRebuild: "1" (optional)
 *  - forceBleed: "1" (optional)
 */
function mmToPt(mm) {
    return (Number(mm) || 0) * 72 / 25.4;
}

function safeJsonParse(str) {
    try { return JSON.parse(str); } catch (e) { return null; }
}

function normalizeProfile(p) {
    const v = String(p || '').trim().toLowerCase();
    if (!v) return 'fogra39';
    if (v === 'iso coated v2' || v === 'iso_coated_v2' || v === 'iso-coated-v2' || v === 'coatedfogra39' || v === 'fogra39') return 'fogra39';
    return v;
}

function extractIssuesFromPayload(payload) {
    // payload can be a PreflightResult or { issues: Issue[] }
    let issues = payload?.issues;
    if (!Array.isArray(issues) && Array.isArray(payload)) {
        issues = payload;
    }
    return Array.isArray(issues) ? issues : [];
}

function shouldFlattenFromIssues(issues) {
    if (!Array.isArray(issues)) return false;
    return issues.some((it) => {
        const cat = String(it?.category || '').toLowerCase();
        const id = String(it?.id || '').toLowerCase();
        return cat.includes('transparency') || id.includes('transparency');
    });
}

async function addBleedCanvasPdf(inputPath, outPath, bleedMm) {
    const bleedPt = mmToPt(bleedMm || 3);
    const bytes = fs.readFileSync(inputPath);
    const src = await PDFDocument.load(bytes);
    const dst = await PDFDocument.create();

    const pages = src.getPages();
    for (let i = 0; i < pages.length; i++) {
        const p = pages[i];
        const { width, height } = p.getSize();
        const [embedded] = await dst.embedPages([p]);
        const newPage = dst.addPage([width + (bleedPt * 2), height + (bleedPt * 2)]);
        newPage.drawPage(embedded, { x: bleedPt, y: bleedPt });
    }
    const outBytes = await dst.save();
    fs.writeFileSync(outPath, outBytes);
}

async function gsConvertColor(inputPath, outPath, profile) {
    const prof = normalizeProfile(profile);
    const profilesDir = path.join(__dirname, '../icc-profiles');
    const map = {
        'fogra39': 'CoatedFOGRA39.icc',
        'gracol': 'GRACoL2006_Coated1v2.icc',
        'swop': 'USWebCoatedSWOP.icc'
    };
    const fileName = map[prof] || `${prof}.icc`;
    const profilePath = path.join(profilesDir, fileName);

    const args = [
        '-dSAFER', '-dBATCH', '-dNOPAUSE', '-dQUIET',
        '-sDEVICE=pdfwrite',
        '-dPDFSETTINGS=/prepress',
        '-dDetectDuplicateImages=true',
        '-dEmbedAllFonts=true',
        '-dSubsetFonts=true',
        '-dCompressFonts=true',
        '-dAutoRotatePages=/None',
        '-dColorImageDownsampleType=/Bicubic',
        '-dGrayImageDownsampleType=/Bicubic',
        '-dMonoImageDownsampleType=/Bicubic',
        '-dDownsampleMonoImages=false',
        '-dDownsampleGrayImages=false',
        '-dDownsampleColorImages=false',
        '-sColorConversionStrategy=CMYK',
        '-sProcessColorModel=DeviceCMYK',
        '-dOverrideICC=true',
    ];

    if (fs.existsSync(profilePath)) {
        args.push(`-sOutputICCProfile=${profilePath}`);
        args.push(`-sDefaultCMYKProfile=${profilePath}`);
    }

    args.push('-o', outPath, inputPath);
    await runGs(args);
}

async function gsGrayscale(inputPath, outPath) {
    await runGs([
        '-dSAFER', '-dBATCH', '-dNOPAUSE', '-dQUIET',
        '-sDEVICE=pdfwrite',
        '-dCompatibilityLevel=1.4',
        '-dPDFSETTINGS=/prepress',
        '-dDetectDuplicateImages=true',
        '-dEmbedAllFonts=true',
        '-dSubsetFonts=true',
        '-dCompressFonts=true',
        '-dAutoRotatePages=/None',
        '-dDownsampleMonoImages=false',
        '-dDownsampleGrayImages=false',
        '-dDownsampleColorImages=false',
        '-sColorConversionStrategy=Gray',
        '-sProcessColorModel=DeviceGray',
        '-o', outPath,
        inputPath
    ]);
}

async function gsFlattenTransparency(inputPath, outPath) {
    // Flattening usually requires targeting a lower PDF version (1.3)
    await runGs([
        '-dSAFER', '-dBATCH', '-dNOPAUSE', '-dQUIET',
        '-sDEVICE=pdfwrite',
        '-dCompatibilityLevel=1.3',
        '-dPDFSETTINGS=/prepress',
        '-dEmbedAllFonts=true',
        '-dSubsetFonts=true',
        '-o', outPath,
        inputPath
    ]);
}

async function gsConvertToPdfX(inputPath, outPath, profilePath) {
    // PDF/X-4 configuration (simplified for GS)
    const args = [
        '-dSAFER', '-dBATCH', '-dNOPAUSE', '-dQUIET',
        '-sDEVICE=pdfwrite',
        '-dCompatibilityLevel=1.4',
        '-dPDFSETTINGS=/prepress',
        '-dEmbedAllFonts=true',
        '-dSubsetFonts=true',
        '-dProcessColorModel=/DeviceCMYK',
        '-sColorConversionStrategy=CMYK',
    ];

    if (fs.existsSync(profilePath)) {
        args.push(`-sOutputICCProfile=${profilePath}`);
    }

    // Note: True PDF/X-4 requires a .ps setup file or specific GS flags which might 
    // be complex to bundle here. For now, we ensure prepress CMYK + Profile.
    args.push('-o', outPath, inputPath);
    await runGs(args);
}

async function rebuildAtDpi(inputPath, outPath, dpi) {
    const tmpDir = fs.mkdtempSync(path.join(uploadDir, 'rebuild-'));
    const imgPattern = path.join(tmpDir, 'page-%03d.png');

    await runGs([
        '-dSAFER', '-dBATCH', '-dNOPAUSE', '-dQUIET',
        '-sDEVICE=png16m',
        `-r${dpi}`,
        '-o', imgPattern,
        inputPath,
    ]);

    const imgs = fs
        .readdirSync(tmpDir)
        .filter((f) => /^page-\d+\.png$/i.test(f))
        .sort()
        .map((f) => path.join(tmpDir, f));

    if (!imgs.length) {
        safeRmDir(tmpDir);
        throw new Error('No raster images generated.');
    }

    const doc = await PDFDocument.create();
    for (const imgPath of imgs) {
        const pngBytes = fs.readFileSync(imgPath);
        const png = await doc.embedPng(pngBytes);
        const page = doc.addPage([png.width, png.height]);
        page.drawImage(png, { x: 0, y: 0, width: png.width, height: png.height });
    }
    const outBytes = await doc.save();
    fs.writeFileSync(outPath, outBytes);
    safeRmDir(tmpDir);
}

router.post('/autofix', upload.single('file'), async (req, res) => {
    const inputPath = req.file?.path;
    if (!inputPath) return res.status(400).json({ error: 'No PDF uploaded' });

    const options = {
        target: String(req.body.target || 'cmyk').toLowerCase(),
        profile: normalizeProfile(req.body.profile || 'iso_coated_v2'),
        bleedMm: Number(req.body.bleedMm ?? 3) || 3,
        dpiPreferred: Number(req.body.dpiPreferred ?? 300) || 300,
        dpiMin: Number(req.body.dpiMin ?? 150) || 150,
        safeOnly: String(req.body.safeOnly || '1') === '1',
        aggressive: String(req.body.aggressive || '0') === '1',
        forceRebuild: String(req.body.forceRebuild || '0') === '1',
        forceBleed: String(req.body.forceBleed || '1') === '1',
        forceCmyk: String(req.body.forceCmyk || '1') === '1',
        flatten: String(req.body.flatten || '0') === '1'
    };

    const payload = req.body.issues ? safeJsonParse(req.body.issues) : null;
    const issues = extractIssuesFromPayload(payload);

    const report = {
        policy: {
            icc: options.profile === 'fogra39' ? "ISO Coated v2 (FOGRA39)" : options.profile,
            bleed_mm: options.bleedMm,
            min_dpi: options.dpiMin,
            preferred_dpi: options.dpiPreferred
        },
        fix_plan: [],
        applied: [],
        warnings: [],
        startedAt: new Date().toISOString()
    };

    // 1) Build Plan
    if (options.forceCmyk) report.fix_plan.push({ action: 'convert_cmyk', enabled: true });
    if (options.forceBleed) report.fix_plan.push({ action: 'add_bleed_canvas', enabled: true });

    const needsRebuild = options.forceRebuild || issues.some(i => i.id?.includes('low-res'));
    report.fix_plan.push({ action: 'rebuild_raster', enabled: needsRebuild });

    const needsFlatten = options.flatten || (options.aggressive && shouldFlattenFromIssues(issues));
    report.fix_plan.push({ action: 'flatten_transparency', enabled: needsFlatten });

    let currentPath = inputPath;
    const tmpPaths = [];

    try {
        for (const planStep of report.fix_plan) {
            if (!planStep.enabled) continue;

            const outPath = path.join(uploadDir, `autofix-${Date.now()}-${Math.random().toString(16).slice(2)}.pdf`);
            const t0 = Date.now();
            let stepOk = false;
            let stepWarnings = [];

            try {
                if (planStep.action === 'convert_cmyk') {
                    await gsConvertColor(currentPath, outPath, options.profile);
                    stepOk = true;
                } else if (planStep.action === 'add_bleed_canvas') {
                    await addBleedCanvasPdf(currentPath, outPath, options.bleedMm);
                    stepOk = true;
                    stepWarnings.push('Bleed added as canvas only; artwork may not extend to bleed.');
                } else if (planStep.action === 'rebuild_raster') {
                    await rebuildAtDpi(currentPath, outPath, options.dpiPreferred);
                    stepOk = true;
                    stepWarnings.push('Rebuild rasterizes pages (vectors/text become images).');
                } else if (planStep.action === 'flatten_transparency') {
                    await gsFlattenTransparency(currentPath, outPath);
                    stepOk = true;
                }
            } catch (e) {
                console.error(`Step ${planStep.action} failed:`, e);
                report.warnings.push(`Step ${planStep.action} failed: ${e.message}`);
            }

            if (stepOk) {
                const ms = Date.now() - t0;
                report.applied.push({ action: planStep.action, ok: true, ms, warnings: stepWarnings });
                if (currentPath !== inputPath) tmpPaths.push(currentPath);
                currentPath = outPath;
                tmpPaths.push(outPath);
            }
        }

        report.endedAt = new Date().toISOString();
        report.duration_total_ms = Date.now() - new Date(report.startedAt).getTime();

        const json = Buffer.from(JSON.stringify(report), 'utf8').toString('base64');
        res.setHeader('X-PPP-Autofix-Report', json);

        const baseName = path.basename(req.file.originalname || 'document.pdf').replace(/\.pdf$/i, '');
        return sendPdfAndCleanup(res, currentPath, `${baseName}_fixed.pdf`);
    } catch (err) {
        console.error('autofix orchestrator failed:', err);
        return res.status(500).json({ error: 'AutoFix failed', details: err.message });
    } finally {
        safeUnlink(inputPath);
        for (const p of tmpPaths) {
            if (p !== currentPath) safeUnlink(p);
        }
    }
});

module.exports = router;
