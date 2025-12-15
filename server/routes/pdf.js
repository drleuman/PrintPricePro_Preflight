const express = require('express');
const multer = require('multer');
const path = require('path');
const os = require('os');
const fs = require('fs');
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

// Helper for sending uploadDir to the cleanup service if needed,
// but for now we export it or lets just rely on cleanup service knowing the path.
// Actually, better to export it so server.js can instantiate cleanup on it.
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

router.post('/rgb-to-cmyk', upload.single('file'), async (req, res) => {
    const inputPath = req.file && req.file.path;
    if (!inputPath) return res.status(400).json({ error: 'Missing file' });

    const baseName = path.basename(req.file.originalname || 'document.pdf').replace(/\.pdf$/i, '');
    const outName = `${baseName}_cmyk.pdf`;
    const outPath = path.join(uploadDir, `${Date.now()}_out_cmyk.pdf`);

    try {
        await runGs([
            '-dSAFER', '-dBATCH', '-dNOPAUSE', '-dQUIET',
            '-sDEVICE=pdfwrite',
            '-dCompatibilityLevel=1.4',
            '-dPDFSETTINGS=/prepress',
            '-sColorConversionStrategy=CMYK',
            '-dProcessColorModel=/DeviceCMYK',
            '-dOverrideICC',
            `-sOutputFile=${outPath}`,
            inputPath,
        ]);

        sendPdfAndCleanup(res, outPath, outName, () => {
            safeUnlink(inputPath);
            safeUnlink(outPath);
        });
    } catch (err) {
        console.error('RGB->CMYK conversion failed:', err);
        safeUnlink(inputPath);
        safeUnlink(outPath);
        res.status(500).json({ error: 'RGB to CMYK conversion failed' });
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
        // 1) rasterize
        await runGs([
            '-dSAFER', '-dBATCH', '-dNOPAUSE', '-dQUIET',
            '-sDEVICE=png16m',
            `-r${dpi}`,
            '-o', imgPattern,
            inputPath,
        ]);

        // 2) rebuild PDF from images
        const imgs = fs
            .readdirSync(tmpDir)
            .filter((f) => /page-\d+\.png$/i.test(f))
            .sort()
            .map((f) => path.join(tmpDir, f));

        if (!imgs.length) {
            throw new Error('No images were produced during rebuild');
        }

        await runGs([
            '-dSAFER', '-dBATCH', '-dNOPAUSE', '-dQUIET',
            '-sDEVICE=pdfwrite',
            '-dCompatibilityLevel=1.4',
            `-sOutputFile=${outPath}`,
            ...imgs,
        ]);
        // NOTE: Fixed interpolation missing backtick above, wait, I put backtick but I need to make sure to use it in CodeContent correctly.
        // The above line `-sOutputFile=${outPath}` inside the string needs to be template literal in the file content.

        sendPdfAndCleanup(res, outPath, outName, () => {
            safeUnlink(inputPath);
            safeUnlink(outPath);
            safeRmDir(tmpDir);
        });
    } catch (err) {
        console.error('rebuild dpi failed:', err);
        safeUnlink(inputPath);
        safeUnlink(outPath);
        safeRmDir(tmpDir);
        res.status(500).json({ error: 'Rebuild failed' });
    }
});

module.exports = router;
