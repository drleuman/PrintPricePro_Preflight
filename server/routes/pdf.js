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

// Export uploadDir for potential cleanup service usage
router.uploadDir = uploadDir;

function resolveIccProfilePath(profileName) {
  const profilesDir = path.join(__dirname, '../icc-profiles');
  const map = {
    'fogra39': 'CoatedFOGRA39.icc',
    'gracol': 'GRACoL2006_Coated1v2.icc',
    'swop': 'USWebCoatedSWOP.icc',
  };
  const fileName = map[String(profileName || '').toLowerCase()] || `${profileName}.icc`;
  const profilePath = path.join(profilesDir, fileName);
  return fs.existsSync(profilePath) ? profilePath : null;
}

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

  // profile: 'cmyk' (generic), 'fogra39', 'gracol', etc.
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
    const profilePath = resolveIccProfilePath(profile);

    if (profilePath) {
      args.push(
        '-sColorConversionStrategy=CMYK',
        '-dProcessColorModel=/DeviceCMYK',
        '-dUseCIEColor',
        `-sOutputICCProfile=${profilePath}`,
        '-dRenderIntent=1' // Relative colorimetric (habitual en prepress)
      );
    } else {
      console.warn(`Profile ${profile} not found, falling back to generic CMYK`);
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

  // final (optimizado) + intermedio (pdf-lib)
  const tmpPdfPath = path.join(uploadDir, `${Date.now()}_tmp_rebuild_${dpi}.pdf`);
  const outPath = path.join(uploadDir, `${Date.now()}_out_rebuild_${dpi}.pdf`);

  // Render pages to images and rebuild a fresh PDF.
  const tmpDir = fs.mkdtempSync(path.join(uploadDir, 'rebuild_'));
  const imgPattern = path.join(tmpDir, 'page-%03d.png');

  try {
    // 1) Rasterize (control de dpi real)
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

    if (!imgs.length) throw new Error('No images were produced during rebuild');

    // 2) Rebuild PDF from PNGs (pdf-lib) -> PDF intermedio
    const pdfDoc = await PDFDocument.create();

    // points = px * 72 / dpi  (mantiene tamaño físico coherente)
    const pxToPt = (px) => (px * 72) / dpi;

    for (const imgPath of imgs) {
      const pngBytes = fs.readFileSync(imgPath);
      const png = await pdfDoc.embedPng(pngBytes);

      const wPt = pxToPt(png.width);
      const hPt = pxToPt(png.height);

      const page = pdfDoc.addPage([wPt, hPt]);
      page.drawImage(png, { x: 0, y: 0, width: wPt, height: hPt });
    }

    fs.writeFileSync(tmpPdfPath, await pdfDoc.save());

    // 3) Optimización para OFFSET / prepress + CMYK (FOGRA39 si está disponible)
    // Nota: ahora Ghostscript procesa un PDF (no PNG), así que NO hay /syntaxerror.
    const fogra39Path = resolveIccProfilePath('fogra39');

    const gsArgs = [
      '-dSAFER', '-dBATCH', '-dNOPAUSE', '-dQUIET',
      '-sDEVICE=pdfwrite',
      '-dCompatibilityLevel=1.4',
      '-dPDFSETTINGS=/prepress',

      // Compresión / optimización sin re-muestrear (ya fijaste el DPI al rasterizar)
      '-dDetectDuplicateImages=true',
      '-dCompressPages=true',

      '-dDownsampleColorImages=false',
      '-dDownsampleGrayImages=false',
      '-dDownsampleMonoImages=false',

      // Offset: salida en CMYK
      '-sColorConversionStrategy=CMYK',
      '-dProcessColorModel=/DeviceCMYK',
      '-dOverrideICC',
      '-dUseCIEColor',
      '-dRenderIntent=1',
    ];

    if (fogra39Path) {
      gsArgs.push(`-sOutputICCProfile=${fogra39Path}`);
    } else {
      console.warn('FOGRA39 ICC not found in ../icc-profiles; using generic CMYK conversion.');
    }

    gsArgs.push(
      `-sOutputFile=${outPath}`,
      tmpPdfPath
    );

    await runGs(gsArgs);

    sendPdfAndCleanup(res, outPath, outName, () => {
      safeUnlink(inputPath);
      safeUnlink(tmpPdfPath);
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
      tmpPdfPath,
      tmpDir
    });
    safeUnlink(inputPath);
    safeUnlink(tmpPdfPath);
    safeUnlink(outPath);
    safeRmDir(tmpDir);
    res.status(500).json({
      error: 'Rebuild failed',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

module.exports = router;
