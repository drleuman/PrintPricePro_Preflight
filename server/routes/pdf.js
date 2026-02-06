const express = require('express');
const multer = require('multer');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { PDFDocument } = require('pdf-lib');
const { runGs, sendPdfAndCleanup, safeUnlink, safeRmDir } = require('../services/ghostscript');
const { spawn } = require('child_process');

function execCmd(cmd, args, opts = {}) {
    const timeoutMs = opts.timeoutMs ?? 20000;

    return new Promise((resolve) => {
        const p = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
        let out = '';
        let err = '';
        let killed = false;

        const t = setTimeout(() => {
            killed = true;
            try { p.kill('SIGKILL'); } catch (e) { }
        }, timeoutMs);

        p.stdout.on('data', (d) => (out += d.toString('utf8')));
        p.stderr.on('data', (d) => (err += d.toString('utf8')));

        p.on('close', (code) => {
            clearTimeout(t);
            resolve({ ok: code === 0 && !killed, code, stdout: out, stderr: err, killed });
        });
    });
}

function parsePdffonts(stdout) {
    // pdffonts output: header lines then table rows
    const lines = stdout.split('\n').map(l => l.trim()).filter(Boolean);
    // Find the separator row with dashes
    const sepIdx = lines.findIndex(l => /^-+$/.test(l.replace(/\s+/g, '')));
    // Some versions have "-----" row; if not found, fallback:
    const dataLines = sepIdx >= 0 ? lines.slice(sepIdx + 1) : lines.slice(2);

    // Each row starts with a font name typically; ignore totals if any
    const rows = dataLines.filter(l => l && !l.toLowerCase().startsWith('name'));
    // Heuristic: valid rows contain at least 5 columns separated by spaces
    const fontRows = rows.filter(l => l.split(/\s+/).length >= 5);
    return { fontsCount: fontRows.length, fontRows };
}

function parsePdfimagesList(stdout) {
    // pdfimages -list output:
    // page num type width height color comp bpc enc interp object ID x-ppi y-ppi size ratio
    const lines = stdout.split('\n').map(l => l.trim()).filter(Boolean);
    // Find header line starting with "page"
    const headerIdx = lines.findIndex(l => l.toLowerCase().startsWith('page '));
    if (headerIdx < 0) return { images: [], perPage: {}, largePerPage: {}, total: 0 };

    const data = lines.slice(headerIdx + 1).filter(l => /^\d+/.test(l));
    const images = [];
    for (const line of data) {
        const cols = line.split(/\s+/);
        // page is first col, width col index varies but usually:
        // [page, num, type, width, height, color, ...]
        const page = parseInt(cols[0], 10);
        const width = parseInt(cols[3], 10);
        const height = parseInt(cols[4], 10);
        if (!Number.isFinite(page) || !Number.isFinite(width) || !Number.isFinite(height)) continue;
        images.push({ page, width, height, area: width * height });
    }

    const perPage = {};
    const largePerPage = {};
    for (const img of images) {
        perPage[img.page] = (perPage[img.page] || 0) + 1;

        // "large image" heuristic: roughly full-page-ish bitmap
        const isLarge = (img.width >= 1200 && img.height >= 1200) || img.area >= 1_800_000;
        if (isLarge) largePerPage[img.page] = (largePerPage[img.page] || 0) + 1;
    }

    return { images, perPage, largePerPage, total: images.length };
}

async function detectRasterization(pdfPath) {
    // Returns a robust signal to decide "this PDF is basically images per page"
    const result = {
        ok: true,
        tools: { pdffonts: null, pdfimages: null },
        fonts_count: 0,
        images_total: 0,
        pages_with_large_images: 0,
        large_images_per_page: {}, // {page: count}
        images_per_page: {},       // {page: count}
        is_rasterized: false,
        reasons: [],
    };

    // 1) pdffonts
    const fontsRes = await execCmd('pdffonts', [pdfPath]);
    result.tools.pdffonts = { ok: fontsRes.ok, code: fontsRes.code, killed: fontsRes.killed };
    if (fontsRes.ok) {
        const { fontsCount } = parsePdffonts(fontsRes.stdout);
        result.fonts_count = fontsCount;
    } else {
        result.ok = false;
        result.reasons.push('pdffonts_failed_or_missing');
    }

    // 2) pdfimages -list
    const imgRes = await execCmd('pdfimages', ['-list', pdfPath]);
    result.tools.pdfimages = { ok: imgRes.ok, code: imgRes.code, killed: imgRes.killed };
    if (imgRes.ok) {
        const parsed = parsePdfimagesList(imgRes.stdout);
        result.images_total = parsed.total;
        result.images_per_page = parsed.perPage;
        result.large_images_per_page = parsed.largePerPage;
        result.pages_with_large_images = Object.keys(parsed.largePerPage).length;
    } else {
        result.ok = false;
        result.reasons.push('pdfimages_failed_or_missing');
    }

    // 3) Decision heuristic
    const pagesWithLarge = result.pages_with_large_images;

    if (result.fonts_count === 0 && pagesWithLarge >= 6) {
        result.is_rasterized = true;
        result.reasons.push('no_fonts_and_large_images_on_many_pages');
    } else if (result.fonts_count <= 1 && pagesWithLarge >= 8) {
        result.is_rasterized = true;
        result.reasons.push('almost_no_fonts_and_large_images_on_most_pages');
    } else {
        result.is_rasterized = false;
    }

    return result;
}

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
    fileFilter: (_req, file, cb) => {
        if (file.mimetype === 'application/pdf') {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only PDF files are allowed.'), false);
        }
    },
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
        '-dCompatibilityLevel=1.5', // Lowering to 1.3 causes rasterization on transparency
        '-dPDFSETTINGS=/prepress',
        '-dEmbedAllFonts=true',
        '-dSubsetFonts=true',
        '-dCompressFonts=true',
        '-dNOPLATFONTS',
        '-dDetectDuplicateImages=true',
        '-dAutoRotatePages=/None',
        '-dOverrideICC',
        `-sOutputFile=${outPath}`,
    ];

    if (profile === 'cmyk') {
        args.push(
            '-sColorConversionStrategy=CMYK',
            '-dProcessColorModel=/DeviceCMYK',
            '-dConvertCMYKImagesToRGB=false',
            '-dAutoFilterColorImages=false',
            '-dAutoFilterGrayImages=false',
            '-dColorImageFilter=/DCTEncode',
            '-dGrayImageFilter=/DCTEncode',
            '-dDownsampleMonoImages=false',
            '-dDownsampleGrayImages=false',
            '-dDownsampleColorImages=false',
            '-dPreserveOverprintSettings=true'
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
                `-sDefaultCMYKProfile=${profilePath}`,
                '-dRenderIntent=1',
                '-dBlackText=true',
                '-dBlackVector=true'
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

        const newW = width + (bleedPt * 2);
        const newH = height + (bleedPt * 2);

        // Calculate scale to cover the new area
        const sx = newW / width;
        const sy = newH / height;
        const s = Math.max(sx, sy);

        const drawW = width * s;
        const drawH = height * s;

        // Center the scaled content
        const x = (newW - drawW) / 2;
        const y = (newH - drawH) / 2;

        const newPage = dst.addPage([newW, newH]);
        newPage.drawPage(embedded, { x, y, xScale: s, yScale: s });
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
        '-dCompatibilityLevel=1.5', // 1.3 or 1.4 can force rasterization in some profiles
        '-dPDFSETTINGS=/prepress',
        '-dDetectDuplicateImages=true',
        '-dEmbedAllFonts=true',
        '-dSubsetFonts=true',
        '-dCompressFonts=true',
        '-dNOPLATFONTS',
        '-dAutoRotatePages=/None',
        '-dColorImageDownsampleType=/Bicubic',
        '-dGrayImageDownsampleType=/Bicubic',
        '-dMonoImageDownsampleType=/Bicubic',
        '-dDownsampleMonoImages=false',
        '-dDownsampleGrayImages=false',
        '-dDownsampleColorImages=false',
        '-dPreserveOverprintSettings=true',
        '-dBlackText=true',
        '-dBlackVector=true',
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
    // NOTE: Flattening to PDF 1.3 is the only reliable way with GS to flatten,
    // but it WILL rasterize anything under transparent objects.
    // If the goal is strict vector fonts, we might want to skip this or use higher resolution.
    await runGs([
        '-dSAFER', '-dBATCH', '-dNOPAUSE', '-dQUIET',
        '-sDEVICE=pdfwrite',
        '-dCompatibilityLevel=1.3',
        '-dPDFSETTINGS=/prepress',
        '-dEmbedAllFonts=true',
        '-dSubsetFonts=true',
        '-dCompressFonts=true',
        '-dNOPLATFONTS',
        '-r600', // Higher resolution for the rasterized parts
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

    try {
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
            throw new Error('No raster images generated.');
        }

        const doc = await PDFDocument.create();

        // Convert pixel dimensions -> PDF points preserving physical size:
        // pt = px * 72 / dpi
        const pxToPt = (px) => (px * 72) / dpi;

        for (const imgPath of imgs) {
            const pngBytes = fs.readFileSync(imgPath);
            const png = await doc.embedPng(pngBytes);

            const wPt = pxToPt(png.width);
            const hPt = pxToPt(png.height);

            const page = doc.addPage([wPt, hPt]);
            page.drawImage(png, { x: 0, y: 0, width: wPt, height: hPt });
        }
        const outBytes = await doc.save();
        fs.writeFileSync(outPath, outBytes);
    } finally {
        safeRmDir(tmpDir);
    }
}

async function executeAutofixWorkflow(inputPath, originalFilename, options, issues, tmpPathsRegistry) {
    const report = {
        policy: {
            icc: options.profile === 'fogra39' ? "ISO Coated v2 (FOGRA39)" : options.profile,
            bleed_mm: options.bleedMm,
            min_dpi: options.dpiMin,
            preferred_dpi: options.dpiPreferred
        },
        quality_checks: {},
        fix_plan: [],
        applied: [],
        warnings: [],
        startedAt: new Date().toISOString()
    };

    // --- Raster Guard: Pre-check ---
    try {
        const strictVector = options.strictVector !== false;
        const inputQC = await detectRasterization(inputPath);
        report.quality_checks.input = inputQC;
        report.quality_checks.tools_available = inputQC.ok;

        if (strictVector && inputQC.is_rasterized) {
            report.warnings.push('Input PDF appears rasterized (no fonts + large images). Vector text cannot be recovered.');
        }
    } catch (e) {
        console.warn('RasterGuard pre-check failed:', e);
        report.warnings.push('Raster Guard unavailable: pdffonts/pdfimages missing or failed. Install poppler-utils.');
    }

    // 1) Build Plan
    let needsRebuild = options.forceRebuild === true || issues.some(i => String(i.id || '').toLowerCase() === 'low-res-images');

    // --- Raster Guard: Block Rebuild ---
    const strictVector = options.strictVector !== false;
    const allowRasterRebuild = options.allowRasterRebuild === true;
    if (strictVector && needsRebuild && !allowRasterRebuild) {
        report.warnings.push('Rebuild/raster step was disabled by Raster Guard (strictVector). Use allowRasterRebuild:true to override.');
        needsRebuild = false;
    }

    const needsFlatten = options.flatten || (options.aggressive && shouldFlattenFromIssues(issues));

    // Define potential steps
    const stepCmyk = { action: 'convert_cmyk', enabled: options.forceCmyk || needsRebuild };
    const stepBleed = { action: 'add_bleed_canvas', enabled: options.forceBleed };
    const stepRebuild = { action: 'rebuild_raster', enabled: needsRebuild };
    const stepFlatten = { action: 'flatten_transparency', enabled: needsFlatten };

    if (needsRebuild) {
        // If rebuilding, do it early, and ensure CMYK is LAST to fix RGB output from rebuild
        report.fix_plan.push(stepRebuild);
        report.fix_plan.push(stepBleed);
        report.fix_plan.push(stepFlatten);
        report.fix_plan.push(stepCmyk);
    } else {
        // Standard order if no rebuild needed
        report.fix_plan.push(stepCmyk);
        report.fix_plan.push(stepBleed);
        report.fix_plan.push(stepRebuild);
        report.fix_plan.push(stepFlatten);
    }

    let currentPath = inputPath;
    // tmpPathsRegistry is passed in

    for (const planStep of report.fix_plan) {
        if (!planStep.enabled) continue;

        const stepIndex = report.applied.length + 1;
        // Unique name: autofix-TIMESTAMP-INDEX-ACTION-RANDOM.pdf
        const uniqueSuffix = Math.random().toString(16).slice(2, 8);
        const outPath = path.join(uploadDir, `autofix-${Date.now()}-${stepIndex}-${planStep.action}-${uniqueSuffix}.pdf`);

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
                stepWarnings.push('Bleed added (scaled content).');
            } else if (planStep.action === 'rebuild_raster') {
                await rebuildAtDpi(currentPath, outPath, options.dpiPreferred);
                stepOk = true;
                stepWarnings.push('Rasterized pages to ensure visual accuracy.');
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
            report.applied.push({
                step: stepIndex,
                action: planStep.action,
                ok: true,
                ms,
                input: path.basename(currentPath),
                output: path.basename(outPath),
                warnings: stepWarnings
            });
            if (currentPath !== inputPath && tmpPathsRegistry) tmpPathsRegistry.add(currentPath);
            currentPath = outPath;
            if (tmpPathsRegistry) tmpPathsRegistry.add(outPath);
        }
    }

    report.endedAt = new Date().toISOString();
    report.duration_total_ms = Date.now() - new Date(report.startedAt).getTime();

    // --- Raster Guard: Post-check ---
    try {
        const outputQC = await detectRasterization(currentPath);
        report.quality_checks.output = outputQC;

        const allowRasterOutput = options.allowRasterOutput === true;
        if (options.strictVector !== false && outputQC.is_rasterized && !allowRasterOutput) {
            report.blocked = {
                reason: 'OUTPUT_RASTERIZED_BLOCKED',
                strictVector: options.strictVector !== false,
                allowRasterOutput: options.allowRasterOutput === true
            };
            const e = new Error('OUTPUT_RASTERIZED_BLOCKED');
            e.report = report;
            throw e; // Throw to be caught by the route handler
        }
    } catch (e) {
        console.warn('RasterGuard post-check failed:', e);
        report.warnings.push('Raster Guard post-check failed (pdffonts/pdfimages missing or errored).');
        if (e.message === 'OUTPUT_RASTERIZED_BLOCKED') throw e; // Re-throw specific error
    }

    return { report, finalPath: currentPath };
}

router.post('/autofix', upload.single('file'), async (req, res) => {
    const inputPath = req.file?.path;
    if (!inputPath) return res.status(400).json({ error: 'No PDF uploaded' });

    const originalFilename = req.file?.originalname || 'document.pdf';

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
        flatten: String(req.body.flatten || '0') === '1',
        strictVector: String(req.body.strictVector || '1') === '1',
        allowRasterRebuild: String(req.body.allowRasterRebuild || '0') === '1',
        allowRasterOutput: String(req.body.allowRasterOutput || '0') === '1',
    };

    const payload = req.body.issues ? safeJsonParse(req.body.issues) : null;
    const issues = extractIssuesFromPayload(payload);

    let deliveredPdf = false;
    let finalPathToCleanup = inputPath;
    const tempPathsToCleanup = new Set();

    try {
        const { report, finalPath } = await executeAutofixWorkflow(inputPath, originalFilename, options, issues, tempPathsToCleanup);
        finalPathToCleanup = finalPath;
        // tempPathsToCleanup is already populated by executeAutofixWorkflow

        const json = Buffer.from(JSON.stringify(report), 'utf8').toString('base64');
        res.setHeader('X-PPP-Autofix-Report', json);

        const baseName = path.basename(originalFilename).replace(/\.pdf$/i, '');

        deliveredPdf = true;
        return sendPdfAndCleanup(res, finalPath, `${baseName}_fixed.pdf`, async () => {
            await safeUnlink(inputPath);
            for (const p of tempPathsToCleanup) await safeUnlink(p);
        });
    } catch (err) {
        console.error('autofix orchestrator failed:', err);
        // Handle specific rasterization blocking error
        if (err.message === 'OUTPUT_RASTERIZED_BLOCKED') {
            // Need to reconstruct the report from the error object if it was blocked
            const blockedReport = err.report;
            const reportJson = Buffer.from(JSON.stringify(blockedReport || {}), 'utf8').toString('base64');
            res.setHeader('X-PPP-Autofix-Report', reportJson);
            return res.status(422).json({
                ok: false,
                error: 'OUTPUT_RASTERIZED_BLOCKED',
                message: 'Output PDF appears rasterized. Blocked by Raster Guard (strictVector).',
                report: blockedReport,
            });
        }
        return res.status(500).json({ error: 'AutoFix failed', details: err.message });
    } finally {
        if (!deliveredPdf) {
            await safeUnlink(inputPath);
            for (const p of tempPathsToCleanup) await safeUnlink(p);
        }
    }
});

module.exports = router;

