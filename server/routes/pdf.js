const express = require('express');
const multer = require('multer');
const path = require('path');
const os = require('os');
const fs = require('fs');
const crypto = require('crypto');
const { PDFDocument, PDFName, PDFArray, PDFDict, pushGraphicsState, popGraphicsState, concatTransformationMatrix } = require('pdf-lib');
const { runGs, sendPdfAndCleanup, safeUnlink, safeRmDir } = require('../services/ghostscript');
const { spawn } = require('child_process');

function execCmd(cmd, args, opts = {}) {
    const timeoutMs = opts.timeoutMs ?? 60000; // Increased timeout for larger docs

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

        p.on('error', (e) => {
            clearTimeout(t);
            resolve({ ok: false, code: -1, stdout: out, stderr: `${err}\nSpawn error: ${e.message}`, killed });
        });

        p.on('close', (code) => {
            clearTimeout(t);
            resolve({ ok: (code === 0 || code === null) && !killed, code, stdout: out, stderr: err, killed });
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
    if (lines.length < 2) return { images: [], perPage: {}, largePerPage: {}, total: 0 }; // Not enough lines for header + data
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
/**
 * Scans a PDF for Total Ink Coverage (TAC) peaks.
 * Uses Ghostscript pamcmyk device to extract raw separation data.
 */
async function scanTac(pdfPath, requestedProfile, hasSpots = false, isConfirmation = false) {
    const customPath = process.env.GS_PATH;
    const gsCmd = customPath || (process.platform === 'win32' ? 'gswin64c' : 'gs');

    const limitMap = { 'fogra39': 300, 'gracol': 320, 'swop': 300, 'fogra51': 300 };
    const limit = limitMap[requestedProfile] || 300;
    const dpi = isConfirmation ? 150 : 72;

    const args = [
        '-dSAFER', '-dNOPAUSE', '-dBATCH', '-dQUIET',
        '-sDEVICE=pamcmyk',
        `-r${dpi}`,
        '-o', '-',
        pdfPath
    ];

    return new Promise((resolve) => {
        const proc = spawn(gsCmd, args);
        let maxTacTotal = 0;
        let worstPage = 1;
        let currentPage = 0;
        let pagesExceeding = [];

        let buf = Buffer.alloc(0);

        proc.stdout.on('data', (chunk) => {
            buf = Buffer.concat([buf, chunk]);
            while (buf.length > 0) {
                const headerEnd = buf.indexOf('ENDHDR\n');
                if (headerEnd === -1) break;

                const header = buf.toString('utf8', 0, headerEnd);
                const wMatch = header.match(/WIDTH\s+(\d+)/);
                const hMatch = header.match(/HEIGHT\s+(\d+)/);
                if (!wMatch || !hMatch) {
                    buf = buf.slice(headerEnd + 7);
                    continue;
                }

                const w = parseInt(wMatch[1]);
                const h = parseInt(hMatch[2]);
                const bodySize = w * h * 4;
                if (buf.length < headerEnd + 7 + bodySize) break;

                currentPage++;
                let pageMaxTac = 0;
                let hotspotPixelCount = 0;
                const body = buf.slice(headerEnd + 7, headerEnd + 7 + bodySize);

                // Sample pixels
                const step = isConfirmation ? 4 : 16; // Finer scan in confirmation pass
                for (let i = 0; i < body.length; i += step) {
                    const tac = Math.round(((body[i] + body[i + 1] + body[i + 2] + body[i + 3]) / 255) * 100);
                    if (tac > pageMaxTac) pageMaxTac = tac;
                    if (tac > limit) hotspotPixelCount++;
                }

                // Minimum Area Logic: ignore microscopic hotspots (e.g. registration dots)
                // 0.5mm² at 72dpi ≈ 4 pixels. at 150dpi ≈ 18 pixels.
                const minPixels = dpi === 72 ? 4 : 18;
                const significantPeak = pageMaxTac > limit && hotspotPixelCount >= minPixels;

                if (significantPeak) {
                    if (pageMaxTac > maxTacTotal) {
                        maxTacTotal = pageMaxTac;
                        worstPage = currentPage;
                    }
                    if (!pagesExceeding.includes(currentPage)) pagesExceeding.push(currentPage);
                }

                buf = buf.slice(headerEnd + 7 + bodySize);
            }
        });

        proc.on('close', async () => {
            // Near-limit logic: if peak is within 5% of limit at 72dpi, trigger high-res pass
            if (!isConfirmation && maxTacTotal > (limit * 0.95) && maxTacTotal <= (limit + 10)) {
                const confirmed = await scanTac(pdfPath, requestedProfile, hasSpots, true);
                return resolve({ ...confirmed, confirmation_pass: true });
            }

            let risk = "green";
            if (maxTacTotal > limit + 15) risk = "blocking";
            else if (maxTacTotal > limit) risk = "attention";

            resolve({
                max_tac: maxTacTotal,
                limit,
                worst_page: worstPage,
                pages_exceeding: pagesExceeding.slice(0, 10),
                spot_colors_detected: hasSpots,
                measurement_dpi: dpi,
                confirmation_pass: isConfirmation,
                risk
            });
        });

        proc.on('error', (err) => {
            console.error('GS TAC Scan Process Error:', err);
            resolve({ max_tac: 0, limit, worst_page: 0, pages_exceeding: [], risk: "unknown" });
        });
    });
}

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

    try {
        await gsConvertColor(inputPath, outPath, profile);

        sendPdfAndCleanup(res, outPath, outName, () => {
            safeUnlink(inputPath);
            safeUnlink(outPath);
        });
    } catch (err) {
        console.error('Color conversion failed:', err);
        safeUnlink(inputPath);
        safeUnlink(outPath);
        res.status(500).json({ error: 'Color conversion failed', details: err.message });
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

        // Apply transformation matrix to the page content stream:
        // Translate(-W/2, -H/2) -> Scale(s, s) -> Translate(W/2, H/2)
        // This is non-destructive and preserves transparency/overprint
        p.prependOperators(
            pushGraphicsState(),
            concatTransformationMatrix(scale, 0, 0, scale, tx, ty)
        );
        p.pushOperators(popGraphicsState());

        // Set technical boxes (RIP-style)
        // TrimBox = original page size
        p.setTrimBox(0, 0, width, height);

        // BleedBox, MediaBox, CropBox = expanded by bleedPt
        const newX = -bleedPt;
        const newY = -bleedPt;
        const newW = width + 2 * bleedPt;
        const newH = height + 2 * bleedPt;

        p.setBleedBox(newX, newY, newW, newH);
        p.setMediaBox(newX, newY, newW, newH);
        p.setCropBox(newX, newY, newW, newH);
    }
    const outBytes = await doc.save();
    fs.writeFileSync(outPath, outBytes);
}

/**
 * Step 3: GS with OutputIntent hardening (PDF/X style)
 * Added options.finalizeOnly to allow embedding metadata without destructive color rewrite.
 */
async function gsConvertColor(inputPath, outPath, profile, options = { finalizeOnly: false }) {
    const prof = normalizeProfile(profile);
    const profilesDir = path.join(__dirname, '../icc-profiles');
    const map = {
        'fogra39': 'CoatedFOGRA39.icc',
        'iso_coated_v2': 'CoatedFOGRA39.icc', // Alias
        'gracol': 'GRACoL2006_Coated1v2.icc',
        'swop': 'USWebCoatedSWOP.icc'
    };
    const infoMap = {
        'fogra39': 'ISO Coated v2 (FOGRA39)',
        'gracol': 'GRACoL 2006',
        'swop': 'U.S. Web Coated (SWOP) v2'
    };
    const condMap = {
        'fogra39': 'FOGRA39',
        'gracol': 'GRACoL',
        'swop': 'SWOP'
    };

    const fileName = map[prof] || `${prof}.icc`;
    const profilePath = path.join(profilesDir, fileName);
    const info = infoMap[prof] || prof;
    const cond = condMap[prof] || prof;

    const args = [
        '-dSAFER', '-dBATCH', '-dNOPAUSE', '-dQUIET',
        '-sDEVICE=pdfwrite',
        '-dCompatibilityLevel=1.5',
        '-dPDFSETTINGS=/prepress',
        '-dDetectDuplicateImages=true',
        '-dEmbedAllFonts=true',
        '-dSubsetFonts=true',
        '-dCompressFonts=true',
        '-dNOPLATFONTS',
        '-dAutoRotatePages=/None',
        '-dDownsampleMonoImages=false',
        '-dDownsampleGrayImages=false',
        '-dDownsampleColorImages=false',
        '-dPreserveOverprintSettings=true',
        '-dBlackText=true',
    ];

    if (!options.finalizeOnly) {
        args.push(
            '-dUseCIEColor=true',
            '-sColorConversionStrategy=CMYK',
            '-dProcessColorModel=/DeviceCMYK',
            '-dOverrideICC=true',
            '-dRenderIntent=1' // Relative Colorimetric
        );
    }

    let psPath = null;
    if (fs.existsSync(profilePath)) {
        args.push(`-sOutputICCProfile=${profilePath}`);
        args.push(`-sDefaultCMYKProfile=${profilePath}`);
        args.push('-dPDFX');

        // Phase 3: Enforce OutputIntent for PDF/X recognition
        try {
            psPath = path.join(uploadDir, `pdfx_def_${Date.now()}.ps`);

            // Helper to escape PostScript strings
            const psEscape = (s) => String(s || '')
                .replace(/\\/g, '\\\\')
                .replace(/\(/g, '\\(')
                .replace(/\)/g, '\\)')
                .replace(/\r/g, '')
                .replace(/\n/g, ' ');

            const escapedProfilePath = psEscape(profilePath.replace(/\\/g, '/'));
            const psInfo = psEscape(info);
            const psCond = psEscape(cond);

            const psContent = `
[ /_objdef {icc_file} /type /stream /OBJ pdfmark
[ {icc_file} << /N 4 >> /PUT pdfmark
[ {icc_file} (${escapedProfilePath}) (r) file /PUT pdfmark

[ /_objdef {intent} /type /dict /OBJ pdfmark
[ {intent} <<
  /Type /OutputIntent
  /S /GTS_PDFX
  /OutputCondition (${psCond})
  /OutputConditionIdentifier (${psCond})
  /RegistryName (http://www.color.org)
  /Info (${psInfo})
  /DestOutputProfile {icc_file}
>> /PUT pdfmark

[ {Catalog} << /OutputIntents [ {intent} ] >> /PUT pdfmark
`;
            fs.writeFileSync(psPath, psContent);
        } catch (err) {
            console.warn('Failed to generate PDF/X definition:', err.message);
        }
    }

    // Bulletproof ordering: all flags first, then -o, then metadata .ps, then input.pdf
    args.push('-o', outPath);
    if (psPath) args.push('-f', psPath);
    args.push('-f', inputPath);

    try {
        await runGs(args);

        // Verification phase: deterministic check for OutputIntent
        try {
            const outBytes = fs.readFileSync(outPath);
            const doc = await PDFDocument.load(outBytes, { ignoreEncryption: true });
            const catalog = doc.catalog;
            const oi = catalog.get(PDFName.of('OutputIntents'));

            let verified = false;
            let identifier = null;
            let intentCount = 0;

            if (oi) {
                const oiArray = doc.context.lookup(oi);
                if (oiArray instanceof PDFArray) {
                    intentCount = oiArray.size();
                    for (let i = 0; i < intentCount; i++) {
                        const intent = doc.context.lookup(oiArray.get(i));
                        if (intent instanceof PDFDict) {
                            const s = intent.get(PDFName.of('S'));
                            const ident = intent.get(PDFName.of('OutputConditionIdentifier'));
                            if (s?.toString() === '/GTS_PDFX') {
                                verified = true;
                                if (ident) {
                                    const currentId = ident.toString().replace(/^\(|\)$/g, '');
                                    // If we haven't found a match yet, or this is an exact match for what we expected
                                    if (!identifier || currentId === cond) {
                                        identifier = currentId;
                                    }
                                }
                            }
                        }
                    }
                }
            }
            return { verified, identifier, expectedCond: cond, intentCount, gsMode: options.finalizeOnly ? 'finalize_only' : 'full_convert' };
        } catch (vErr) {
            console.warn('Post-conversion verification failed:', vErr.message);
            return { verified: false, identifier: null, expectedCond: cond, intentCount: 0, gsMode: options.finalizeOnly ? 'finalize_only' : 'full_convert' };
        }
    } catch (e) {
        throw new Error(`GS Error: ${e.message}. Args: ${args.join(' ')}`);
    } finally {
        if (psPath && fs.existsSync(psPath)) fs.unlinkSync(psPath);
    }
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
        args.push(`-sDefaultCMYKProfile=${profilePath}`);
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
    // --- Phase 4.1: Hard Limits & Input Detection ---
    let pageCount = 0;
    let sourceOI = { present: false, identifier: null };
    try {
        const bytes = fs.readFileSync(inputPath);
        const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
        pageCount = doc.getPageCount();
        if (pageCount > 100) {
            const e = new Error(`PDF has ${pageCount} pages. Max limit for AutoFix is 100.`);
            e.error_code = 'DOCUMENT_TOO_LARGE';
            e.step = 'pre-check';
            throw e;
        }

        // Future-proofing: Detect Input OutputIntent
        try {
            const catalog = doc.catalog;
            const oi = catalog.get(PDFName.of('OutputIntents'));
            if (oi) {
                const oiArray = doc.context.lookup(oi);
                if (oiArray instanceof PDFArray && oiArray.size() > 0) {
                    const intent = doc.context.lookup(oiArray.get(0));
                    if (intent instanceof PDFDict) {
                        sourceOI.present = true;
                        const ident = intent.get(PDFName.of('OutputConditionIdentifier'));
                        if (ident) sourceOI.identifier = ident.toString().replace(/^\(|\)$/g, '');
                    }
                }
            }
        } catch (e) { /* ignore detection errors */ }

    } catch (e) {
        if (e.error_code === 'DOCUMENT_TOO_LARGE') throw e;
        console.warn('Failed to pre-check input PDF:', e.message);
    }

    const report = {
        policy: {
            icc: options.profile === 'fogra39' ? "ISO Coated v2 (FOGRA39)" : options.profile,
            bleed_mm: options.bleedMm,
            min_dpi: options.dpiMin,
            preferred_dpi: options.dpiPreferred
        },
        prepress_summary: {
            certificate_id: `PPP-${new Date().toISOString().split('T')[0]}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
            engine_version: "2.4.0-stable",
            risk_level: "green",
            tac_summary: null,
            output_profile: options.profile === 'fogra39' ? "ISO Coated v2 (FOGRA39)" : options.profile,
            source_profile_detected: sourceOI.identifier || "none",
            source_outputintent_present: sourceOI.present,
            source_outputintent_identifier: sourceOI.identifier,
            conversion_bypassed: false,
            bypassed_stage: null,
            finalize_stage_ran: false,
            gs_mode: null,
            rewritten_by_gs: false,
            bypass_reason: null,
            outputintent: false,
            outputintent_valid: false,
            outputintent_count: 0,
            outputintent_identifier: null,
            matches_requested_profile: false,
            overprint_summary: {
                checked: true,
                risk: "green",
                issues_count: 0,
                registration_color_detected: false,
                black_text_knockout_detected: false,
                rich_black_text_detected: false
            }
        },
        quality_checks: {},
        fix_plan: [],
        applied: [],
        warnings: [],
        startedAt: new Date().toISOString()
    };

    // --- Pre-extract issues for cross-module analysis ---
    const knockoutIssues = issues.filter(i => i.id === 'black-text-knockout');
    const registrationIssues = issues.filter(i => i.id === 'registration-color-used');
    const richBlackIssues = issues.filter(i => i.id === 'rich-black-text');

    // --- Spot Color Policy Analysis ---
    const spotIssue = issues.find(i => i.id === 'spot-colors-detected');
    const spotData = spotIssue ? spotIssue.payload : { spot_names: [], page_spots: {}, spots_in_text: false };

    const SPOT_WHITELIST = [
        "cutcontour", "cut", "dieline", "die line", "crease", "fold", "perf", "perforation",
        "varnish", "spotuv", "uv", "gloss", "matte", "white"
    ];

    // Determine Policy
    // FOGRA/GRACoL -> OFFSET_CMYK_STRICT, else DIGITAL_POD_CONVERT
    const oiId = String(report.prepress_summary.source_outputintent_identifier || "").toUpperCase();
    const isStrictOffset = oiId.includes('FOGRA') || oiId.includes('GRACOL') || report.prepress_summary.output_profile.toUpperCase().includes('FOGRA');
    const policy = isStrictOffset ? "OFFSET_CMYK_STRICT" : "DIGITAL_POD_CONVERT";

    const whitelisted = [];
    const nonWhitelisted = [];

    spotData.spot_names.forEach(name => {
        const lower = name.toLowerCase();
        if (SPOT_WHITELIST.some(w => lower.includes(w))) {
            whitelisted.push(name);
        } else {
            nonWhitelisted.push(name);
        }
    });

    let spotRisk = "green";
    if (registrationIssues.length > 0) {
        spotRisk = "blocking"; // Registration in artwork is always bad
    } else if (policy === 'OFFSET_CMYK_STRICT') {
        if (nonWhitelisted.length > 0) spotRisk = "blocking";
        else if (whitelisted.length > 0) spotRisk = "green"; // Technical spots allowed in strict offset? Usually yes if they don't print
    } else {
        // DIGITAL_POD_CONVERT
        if (nonWhitelisted.length > 0) spotRisk = "attention";
        else if (whitelisted.length > 0) spotRisk = "green";
    }

    report.prepress_summary.spot_summary = {
        checked: true,
        spots_detected: spotData.spot_names.length > 0,
        spot_count: spotData.spot_names.length,
        spot_names: spotData.spot_names,
        whitelisted_spots: whitelisted,
        non_whitelisted_spots: nonWhitelisted,
        policy: policy,
        spots_in_text: spotData.spots_in_text,
        risk: spotRisk,
        worst_page: spotData.page_spots ? (Object.keys(spotData.page_spots)[0] || 1) : 1
    };

    // --- Overprint Analysis (from preflight payload) ---

    // Aggregate worst page for overprint
    const opPages = [...knockoutIssues, ...registrationIssues, ...richBlackIssues].map(i => i.page);
    const opWorstPage = opPages.length > 0 ? Math.min(...opPages) : 1;

    report.prepress_summary.overprint_summary = {
        checked: true,
        risk: (knockoutIssues.length > 0 || registrationIssues.length > 0) ? "blocking" : (richBlackIssues.length > 0 ? "attention" : "green"),
        issues_count: knockoutIssues.length + registrationIssues.length + richBlackIssues.length,
        registration_color_detected: registrationIssues.length > 0,
        black_text_knockout_detected: knockoutIssues.length > 0,
        rich_black_text_detected: richBlackIssues.length > 0,
        knockout_count: knockoutIssues.length,
        registration_count: registrationIssues.length,
        rich_black_count: richBlackIssues.length,
        worst_page: opWorstPage
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
    // Define potential steps
    const stepCmyk = { action: 'convert_cmyk', enabled: options.forceCmyk || needsRebuild };
    const stepBleed = { action: 'add_bleed_canvas', enabled: options.forceBleed };
    const stepRebuild = { action: 'rebuild_raster', enabled: needsRebuild };
    const stepFlatten = { action: 'flatten_transparency', enabled: needsFlatten };

    // --- PIPELINE ORDER CORE LOGIC ---
    // Rule 1: Always do rebuild_raster FIRST if needed (it creates a fresh RGB/Gray PDF)
    // Rule 2: Do add_bleed_canvas (pdf-lib) BEFORE final color conversion
    // Rule 3: Do flatten_transparency BEFORE or AS PART OF color conversion
    // Rule 4: ALWAYS end with convert_cmyk (Ghostscript) if any pdf-lib steps were run, 
    //         to restore ICC profile / OutputIntent.

    if (stepRebuild.enabled) report.fix_plan.push(stepRebuild);
    if (stepBleed.enabled) report.fix_plan.push(stepBleed);
    if (stepFlatten.enabled) report.fix_plan.push(stepFlatten);

    // Ensure CMYK is always the final step if anything else happened, to re-apply profile
    if (stepCmyk.enabled || stepRebuild.enabled || stepBleed.enabled) {
        stepCmyk.enabled = true; // Force enabled if we're rebuilding/bleeding
        report.fix_plan.push(stepCmyk);
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
                // Optimization: Skip if source already matches requested profile AND no color issues found
                const requestedProf = normalizeProfile(options.profile);
                const condMap = { 'fogra39': 'FOGRA39', 'gracol': 'GRACoL', 'swop': 'SWOP' };
                const expectedCond = condMap[requestedProf] || requestedProf;

                // Expanded color detection for safer bypass
                const hasColorIssues = issues.some(i =>
                    ['rgb-colors', 'cmyk-colors', 'spot-colors-detected', 'unintended-colors',
                        'mixed-rgb-cmyk', 'rgb-only-content', 'overprint-detected'].includes(i.id)
                );

                if (sourceOI.identifier === expectedCond && sourceOI.present && !hasColorIssues) {
                    report.applied.push({ step: 'convert_cmyk', status: 'skipped', reason: 'Source matches requested OutputIntent & no RGB/Spot issues detected' });
                    report.prepress_summary.conversion_bypassed = true;
                    report.prepress_summary.bypassed_stage = 'convert_cmyk';
                    report.prepress_summary.bypass_reason = 'source_matches_and_clean';

                    // Run "Finalize Only" path: embed fresh OutputIntent without color rewrite
                    const v = await gsConvertColor(currentPath, outPath, options.profile, { finalizeOnly: true });
                    report.prepress_summary.finalize_stage_ran = true;
                    report.prepress_summary.gs_mode = v.gsMode;
                    report.prepress_summary.rewritten_by_gs = true; // Structurally rewritten by pdfwrite

                    report.prepress_summary.outputintent = v.verified;
                    report.prepress_summary.outputintent_valid = v.verified;
                    report.prepress_summary.outputintent_identifier = v.identifier;
                    report.prepress_summary.matches_requested_profile = (v.identifier === v.expectedCond);
                    stepOk = true;
                } else {
                    const v = await gsConvertColor(currentPath, outPath, options.profile, { finalizeOnly: false });
                    report.prepress_summary.finalize_stage_ran = true;
                    report.prepress_summary.gs_mode = v.gsMode;
                    report.prepress_summary.rewritten_by_gs = true;
                    report.prepress_summary.outputintent = v.verified;
                    report.prepress_summary.outputintent_valid = v.verified;
                    report.prepress_summary.outputintent_count = v.intentCount;
                    report.prepress_summary.outputintent_identifier = v.identifier;
                    report.prepress_summary.matches_requested_profile = (v.identifier === v.expectedCond);
                    stepOk = true;
                }
            } else if (planStep.action === 'add_bleed_canvas') {
                await addBleedCanvasPdf(currentPath, outPath, options.bleedMm);
                stepOk = true;
                stepWarnings.push('Bleed added (1:1 content with professional Box geometry).');
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
            e.step = planStep.action; // Phase 0: attach step name to error
            report.warnings.push(`Step ${planStep.action} failed: ${e.message}`);
            throw e; // Re-throw to be caught by the route handler
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

            // --- Debug Mode: Save intermediate files ---
            if (process.env.DEBUG_PREPRESS === '1') {
                try {
                    const debugNameMap = {
                        'add_bleed_canvas': 'step1_geometry.pdf',
                        'convert_cmyk': report.prepress_summary.finalize_stage_ran ? 'step3_pdfx.pdf' : 'step2_cmyk.pdf',
                        'rebuild_raster': 'step0_raster.pdf'
                    };
                    const debugName = debugNameMap[planStep.action] || `step${stepIndex}_${planStep.action}.pdf`;
                    const debugPath = path.join(uploadDir, `${Date.now()}_DEBUG_${debugName}`);
                    fs.copyFileSync(outPath, debugPath);

                    // Attach debug info to report for headers
                    if (!report.debug_files) report.debug_files = {};
                    report.debug_files[planStep.action] = path.basename(debugPath);
                } catch (de) { console.warn('Debug save failed:', de); }
            }

            if (currentPath !== inputPath && tmpPathsRegistry) tmpPathsRegistry.add(currentPath);
            currentPath = outPath;
            if (tmpPathsRegistry) tmpPathsRegistry.add(outPath);
        }
    }

    // Final Risk Assessment initial state
    let finalRisk = "green";

    // --- TAC Scan: Final viability check ---
    try {
        const hasSpots = issues.some(i => i.id === 'spot-colors-detected');
        const tacResult = await scanTac(currentPath, options.profile, hasSpots);
        report.prepress_summary.tac_summary = tacResult;

        // Update risk if TAC is problematic
        if (tacResult.risk === 'blocking') finalRisk = "blocking";
        else if (tacResult.risk === 'attention' && finalRisk === 'green') finalRisk = "attention";
    } catch (tacErr) {
        console.warn('TAC Scan failed:', tacErr.message);
        report.warnings.push('Ink coverage scan could not be completed.');
    }

    // --- Overprint Risk Upgrade ---
    if (report.prepress_summary.overprint_summary.risk === 'blocking') {
        finalRisk = "blocking";
    } else if (report.prepress_summary.overprint_summary.risk === 'attention' && finalRisk === 'green') {
        finalRisk = "attention";
    }

    // --- Spot Color Policy Risk Upgrade ---
    if (report.prepress_summary.spot_summary?.risk === 'blocking') {
        finalRisk = "blocking";
    } else if (report.prepress_summary.spot_summary?.risk === 'attention' && finalRisk === 'green') {
        finalRisk = "attention";
    }

    // Final Risk Assessment: evaluate based on final state + remaining issues
    // 1. OutputIntent is MANDATORY for Green
    if (!report.prepress_summary.outputintent_valid) {
        finalRisk = "blocking";
    }

    // 2. Critical issues that weren't fixed
    const hasCritical = issues.some(i => i.severity === 'error' && !report.applied.some(a => a.action === 'rebuild_raster' || a.action === 'convert_cmyk'));
    if (hasCritical) finalRisk = "blocking";

    // 3. Warnings (like low-res) trigger 'attention' if not already 'blocking'
    const hasWarnings = issues.some(i => i.severity === 'warning');
    if (hasWarnings && finalRisk === "green") {
        finalRisk = "attention";
    }

    report.prepress_summary.risk_level = finalRisk;
    report.finishedAt = new Date().toISOString();
    report.duration_total_ms = Date.now() - new Date(report.startedAt).getTime();

    // --- Raster Guard: Post-check ---
    try {
        const outputQC = await detectRasterization(currentPath);
        report.quality_checks.output = outputQC;

        const allowRasterOutput = options.allowRasterOutput === true;
        const strictVector = options.strictVector !== false;

        // We only block if:
        // 1. Strict vector is enabled
        // 2. The output is rasterized
        // 3. The INPUT was NOT rasterized (meaning WE broke it)
        // 4. Tools (pdffonts/pdfimages) actually worked (QC.ok is true)
        const inputWasVector = report.quality_checks.input?.ok && !report.quality_checks.input?.is_rasterized;
        const outputBecameRaster = outputQC.ok && outputQC.is_rasterized;

        if (strictVector && inputWasVector && outputBecameRaster && !allowRasterOutput) {
            report.blocked = {
                reason: 'OUTPUT_RASTERIZED_BLOCKED',
                strictVector: true,
                allowRasterOutput: false
            };
            const e = new Error('OUTPUT_RASTERIZED_BLOCKED');
            e.report = report;
            throw e;
        }
    } catch (e) {
        if (e.message === 'OUTPUT_RASTERIZED_BLOCKED') throw e;
        console.warn('RasterGuard post-check failed (likely tools missing):', e.message);
        report.warnings.push('Raster Guard post-check skipped or failed.');
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

    const tStart = Date.now();
    try {
        const { report, finalPath } = await executeAutofixWorkflow(inputPath, originalFilename, options, issues, tempPathsToCleanup);
        finalPathToCleanup = finalPath;

        const tElapsed = Date.now() - tStart;
        const json = Buffer.from(JSON.stringify(report), 'utf8').toString('base64');
        res.setHeader('X-PPP-Autofix-Report', json);
        res.setHeader('X-PPP-Autofix-ElapsedMs', tElapsed.toString());

        // Debug Headers
        if (report.debug_files) {
            if (report.debug_files['add_bleed_canvas']) res.setHeader('X-PPP-Stage-Geometry', report.debug_files['add_bleed_canvas']);
            if (report.debug_files['convert_cmyk']) {
                res.setHeader('X-PPP-Stage-Color', report.debug_files['convert_cmyk']);
                res.setHeader('X-PPP-Stage-Finalize', report.debug_files['convert_cmyk']);
            }
        }

        const baseName = path.basename(originalFilename).replace(/\.pdf$/i, '');

        deliveredPdf = true;
        return sendPdfAndCleanup(res, finalPath, `${baseName}_fixed.pdf`, async () => {
            await safeUnlink(inputPath);
            for (const p of tempPathsToCleanup) await safeUnlink(p);
        });
    } catch (err) {
        const tElapsed = Date.now() - tStart;
        console.error('autofix orchestrator failed:', err);

        res.setHeader('X-PPP-Autofix-ElapsedMs', tElapsed.toString());

        // Phase 0: Instrument Failure Step
        const failedStep = err.step || 'unknown';
        res.setHeader('X-PPP-Autofix-Step-Failed', failedStep);
        res.setHeader('X-PPP-Autofix-Reason', err.message || 'unknown');

        // Handle specific rasterization blocking error
        if (err.message === 'OUTPUT_RASTERIZED_BLOCKED') {
            const blockedReport = err.report;
            const reportJson = Buffer.from(JSON.stringify(blockedReport || {}), 'utf8').toString('base64');
            res.setHeader('X-PPP-Autofix-Report', reportJson);
            return res.status(422).json({
                ok: false,
                error: 'OUTPUT_RASTERIZED_BLOCKED',
                error_code: 'STRICT_VECTOR_VIOLATION',
                step: 'raster_guard',
                message: 'Output PDF appears rasterized. Blocked by Raster Guard (strictVector).',
                report: blockedReport,
            });
        }

        const errorCode = err.error_code ||
            (err.message?.includes('TIMEOUT') ? 'TIMEOUT' :
                err.message?.includes('GS Error') ? 'GS_FAILED' : 'UNKNOWN_ERROR');

        return res.status(500).json({
            ok: false,
            error: 'AutoFix failed',
            error_code: errorCode,
            step: failedStep,
            details: err.message,
            stderr: err.stderr || undefined
        });
    } finally {
        if (!deliveredPdf) {
            await safeUnlink(inputPath);
            for (const p of tempPathsToCleanup) await safeUnlink(p);
        }
    }
});

router.post('/preview/pages', upload.single('file'), async (req, res) => {
    const inputPath = req.file?.path;
    if (!inputPath) return res.status(400).json({ error: 'Missing file' });

    const tmpDir = fs.mkdtempSync(path.join(uploadDir, 'preview-'));
    const imgPattern = path.join(tmpDir, 'page-%03d.png');

    try {
        // Ghostscript command for high-quality CMYK-aware preview
        // png16m supports millions of colors, r150 is specified resolution
        await runGs([
            '-dSAFER', '-dBATCH', '-dNOPAUSE', '-dQUIET',
            '-sDEVICE=png16m',
            '-r150',
            '-dUseCropBox',
            '-o', imgPattern,
            inputPath
        ]);

        const files = fs.readdirSync(tmpDir)
            .filter(f => /^page-\d+\.png$/i.test(f))
            .sort();

        const pages = files.map(f => {
            const filePath = path.join(tmpDir, f);
            const data = fs.readFileSync(filePath);
            return `data:image/png;base64,${data.toString('base64')}`;
        });

        res.json({
            ok: true,
            pageCount: pages.length,
            pages: pages
        });
    } catch (err) {
        console.error('Preview generation failed:', err);
        res.status(500).json({ error: 'Preview generation failed', details: err.message });
    } finally {
        safeUnlink(inputPath);
        safeRmDir(tmpDir);
    }
});

module.exports = router;

