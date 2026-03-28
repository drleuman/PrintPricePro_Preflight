'use strict';

const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const queue = require('../services/queue');
const ppos = require('../../config/ppos');
const licenseGuard = require('../middleware/licenseGuard');

const router = express.Router();

if (!fs.existsSync(ppos.tempUploadDir)) {
    fs.mkdirSync(ppos.tempUploadDir, { recursive: true });
}

const upload = multer({
    dest: ppos.tempUploadDir,
    limits: { fileSize: 500 * 1024 * 1024 }
});

function safeFilename(name) {
    return String(name || 'document.pdf').replace(/[^a-zA-Z0-9._-]/g, '_');
}

function ensureDir(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}

function getTenantId(req) {
    return req.auth?.tenantId || req.user?.tenantId || 'default';
}

router.post(
    '/jobs',
    upload.single('file'),
    licenseGuard({ action: 'analyze' }),
    async (req, res) => {
        const requestId = req.id || `req_${Date.now()}`;
        const tenantId = getTenantId(req);

        try {
            if (!req.file) {
                return res.status(400).json({ error: 'No PDF provided.' });
            }

            const policy = req.body?.policy || 'OFFSET_CMYK_STRICT';
            const jobId = uuidv4();
            const assetId = jobId;
            const filename = safeFilename(req.file.originalname || 'document.pdf');

            const inputDir = path.join(
                ppos.storageBase,
                'tenants',
                tenantId,
                'jobs',
                jobId,
                'input'
            );

            ensureDir(inputDir);

            const finalPath = path.join(inputDir, filename);

            fs.copyFileSync(req.file.path, finalPath);
            fs.unlinkSync(req.file.path);

            const fileUrl = path.posix.join(
                ppos.storageBase,
                'tenants',
                tenantId,
                'jobs',
                jobId,
                'input',
                filename
            );

            console.log('[BFF][UPLOAD]', {
                requestId,
                tenantId,
                tempPath: req.file.path,
                finalPath,
                fileUrl
            });

            const job = await queue.enqueueJob('PREFLIGHT', {
                requestId,
                jobId,
                assetId,
                tenantId,
                policy,
                fileUrl,
                filename,
                size: req.file.size
            });

            console.log('[BFF][JOB-CREATE]', {
                requestId,
                tenantId,
                jobId: job.id,
                policy,
                fileUrl,
                status: job.status
            });

            return res.status(201).json({
                id: job.id,
                jobId: job.id,
                status: job.status,
                tenantId,
                policy,
                input: {
                    assetId,
                    fileUrl,
                    filename,
                    size: req.file.size
                }
            });
        } catch (error) {
            if (req.file?.path) {
                fs.unlink(req.file.path, () => { });
            }

            console.error('[BFF][JOB-CREATE][ERROR]', {
                requestId,
                tenantId,
                error: error.message
            });

            return res.status(500).json({
                error: 'Failed to create V2 preflight job.',
                message: error.message
            });
        }
    }
);

/**
 * GET /api/v2/jobs/policies
 * Returns available preflight policies for the frontend.
 */
router.get('/policies', (req, res) => {
    // Canonical policies for PrintPrice Pro Preflight
    const policies = [
        { slug: 'OFFSET_CMYK_STRICT', name: 'Offset CMYK (Strict)' },
        { slug: 'DIGITAL_FOGRA39', name: 'Digital (Fogra 39)' },
        { slug: 'ISO_COATED_V2_39L', name: 'ISO Coated v2 (39L)' },
        { slug: 'NEWSPRINT_COLDSET', name: 'Newsprint (Coldset)' },
        { slug: 'GENERIC_RGB_GUARD', name: 'Generic RGB Guard' }
    ];

    res.json({
        ok: true,
        policies
    });
});

module.exports = router;
