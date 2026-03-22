'use strict';

const express = require('express');
const multer = require('multer');
const path = require('path');
const os = require('os');
const fs = require('fs');
const pdfPipeline = require('../services/pdfPipeline');
const apiKeyMiddleware = require('../middleware/apiKey');

const router = express.Router();
const uploadDir = process.env.PPP_UPLOAD_DIR || path.join(os.tmpdir(), 'ppp-preflight');

if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({
    storage: multer.diskStorage({
        destination: (_req, _file, cb) => cb(null, uploadDir),
        filename: (_req, file, cb) => {
            const safe = String(file.originalname || 'input.pdf').replace(/[^a-z0-9_.-]/gi, '_');
            cb(null, `${Date.now()}_${safe}`);
        },
    }),
    limits: { fileSize: 500 * 1024 * 1024 }
});

const sanitizeFilename = (s) => String(s || '').replace(/[^a-zA-Z0-9._-]/g, '_');

/**
 * Common helper for sending file and cleaning up.
 */
function sendAndCleanup(res, filePath, fileName) {
    res.download(filePath, fileName, (err) => {
        if (err) {
            console.error(`[PDF-ROUTER] Download error:`, err.message);
        }
        try {
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        } catch (e) { /* ignore */ }
    });
}

/**
 * --- DELEGATED ROUTES (PHASE 18.C) ---
 */

// 1. Grayscale
router.post('/grayscale', upload.single('file'), apiKeyMiddleware, async (req, res) => {
    const inputPath = req.file?.path;
    const outPath = path.join(uploadDir, `${Date.now()}_out_bw.pdf`);
    const original = sanitizeFilename(req.file.originalname || 'document.pdf');
    const outName = original.replace(/\.pdf$/i, '_bw.pdf');

    try {
        await pdfPipeline.execCmd('gs', ['-sColorConversionStrategy=Gray'], { 
            metadata: { filePath: inputPath } 
        });
        // Note: Real delegation would return the binary. For now we proxy via pipeline logic.
        // If the pipeline doesn't handle binary return yet, we'll need to expand it.
        res.status(501).json({ error: 'Grayscale delegation pending platform implementation' });
    } catch (err) {
        res.status(500).json({ error: 'Grayscale failed', details: err.message });
    } finally {
        if (inputPath && fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
    }
});

// 2. Color Conversion
router.post('/convert-color', upload.single('file'), apiKeyMiddleware, async (req, res) => {
    const inputPath = req.file?.path;
    const profile = (req.body.profile || 'cmyk').toLowerCase();
    const outPath = path.join(uploadDir, `${Date.now()}_out_${profile}.pdf`);
    const original = sanitizeFilename(req.file.originalname || 'document.pdf');
    const outName = original.replace(/\.pdf$/i, `_${profile}.pdf`);

    try {
        await pdfPipeline.gsConvertColor(inputPath, outPath, profile);
        sendAndCleanup(res, outPath, outName);
    } catch (err) {
        res.status(500).json({ error: 'Color conversion failed', details: err.message });
    } finally {
        if (inputPath && fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
    }
});

// 3. Rebuild (150 DPI)
router.post('/rebuild-150dpi', upload.single('file'), apiKeyMiddleware, async (req, res) => {
    const inputPath = req.file?.path;
    const dpi = Number(req.query.dpi) || 150;
    const outPath = path.join(uploadDir, `${Date.now()}_out_rebuild.pdf`);
    const original = sanitizeFilename(req.file.originalname || 'document.pdf');
    const outName = original.replace(/\.pdf$/i, '_rebuild.pdf');

    try {
        // Redirection to PPOS via pipeline
        await pdfPipeline.execCmd('gs', [`-r${dpi}`], { metadata: { filePath: inputPath } });
        res.status(501).json({ error: 'Rebuild delegation pending platform implementation' });
    } catch (err) {
        res.status(500).json({ error: 'Rebuild failed', details: err.message });
    } finally {
        if (inputPath && fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
    }
});

// 4. AutoFix
router.post('/autofix', upload.single('file'), apiKeyMiddleware, async (req, res) => {
    const inputPath = req.file?.path;
    const mode = req.body.target || 'cmyk';
    
    try {
        // Delegates to PPOS /analyze + /autofix flow via pdfPipeline or queue
        // For sync calls, we use the pipeline bridge.
        const result = await pdfPipeline.execCmd('autofix', [], { 
            metadata: { 
                filePath: inputPath,
                profile: req.body.profile,
                bleedMm: req.body.bleedMm
            } 
        });
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: 'AutoFix delegation failed', details: err.message });
    } finally {
        if (inputPath && fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
    }
});

// 5. Preview Pages
router.get('/preview/pages', (req, res) => res.status(405).json({ error: 'Method Not Allowed', message: 'Use POST' }));
router.post('/preview/pages', upload.single('file'), async (req, res) => {
    const inputPath = req.file?.path;
    try {
        const result = await pdfPipeline.execCmd('preview', [], { metadata: { filePath: inputPath } });
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: 'Preview generation failed', details: err.message });
    } finally {
        if (inputPath && fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
    }
});

module.exports = router;






















