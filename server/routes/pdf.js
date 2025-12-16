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
            '-dProcessColorModel=/DeviceCMYK'
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

module.exports = router;
