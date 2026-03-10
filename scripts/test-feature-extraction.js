// scripts/test-feature-extraction.js
const db = require('../services/db');
const JobProcessor = require('../services/jobProcessor');
const JobManager = require('../services/jobManager');
const fs = require('fs');
const path = require('path');

async function test() {
    console.log('--- Testing Print Feature Extraction ---');
    const jobId = 'test-intel-' + Date.now();
    const tenantId = 'test-tenant';

    try {
        // 1. Mock JobDir and File
        const jobDir = JobManager.getJobDir(jobId);
        await fs.promises.mkdir(jobDir, { recursive: true });
        const finalPath = path.join(jobDir, 'final_fixed.pdf');

        // Use an existing test file if possible, or create a mock
        // For test purposes, we'll try to find a small PDF in the workspace
        fs.writeFileSync(finalPath, '%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF');

        // 2. Mock DB Entry
        await db.query(`
            INSERT INTO jobs (id, tenant_id, filename, status)
            VALUES (?, ?, 'mock.pdf', 'FINALIZING')
        `, [jobId, tenantId]);

        // 3. Execution handleVerify
        console.log('[TEST] Running handleVerify...');
        await JobProcessor.handleVerify(jobId, { profile: 'iso_coated_v3' });

        // 4. Check Results
        const { rows } = await db.query('SELECT * FROM print_features WHERE job_id = ?', [jobId]);
        if (rows.length > 0) {
            console.log('[SUCCESS] Features logged:', JSON.stringify(rows[0].features_json, null, 2));
        } else {
            console.error('[FAILED] No features found in print_features table');
        }

    } catch (err) {
        console.error('[TEST] Error:', err.message);
    } finally {
        // Cleanup
        await db.query('DELETE FROM jobs WHERE id = ?', [jobId]);
        await db.query('DELETE FROM print_features WHERE job_id = ?', [jobId]);
    }
}

test().then(() => process.exit(0));
