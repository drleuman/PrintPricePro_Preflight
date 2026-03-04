const { Worker } = require('bullmq');
const { connection } = require('../services/queue');
const db = require('../services/db');
const assetService = require('../services/assetService');
const deterministicService = require('../services/deterministicService');
const reportService = require('../services/reportService');
const autofixService = require('../services/autofixService');
const deltaService = require('../services/deltaService');

/**
 * Common worker logic to update job status in the Database.
 */
async function updateJobStatus(jobId, status, progress = 0, error = null) {
    await db.query(`
        UPDATE jobs 
        SET status = $1, progress = $2, error = $3, updated_at = CURRENT_TIMESTAMP
        WHERE id = $4
    `, [status, progress, error ? JSON.stringify(error) : null, jobId]);
}

/**
 * The V2 Background Worker.
 */
const v2Worker = new Worker('preflight-v2', async (job) => {
    const { asset_id, tenant_id, policy } = job.data;
    console.log(`[WORKER][${job.id}] Starting ${job.name} for asset ${asset_id}`);

    try {
        await updateJobStatus(job.id, 'PROCESSING', 10);

        const asset = await assetService.getAsset(asset_id);
        if (!asset) throw new Error('Asset not found');

        // Real Deterministic Analysis (BE-204)
        const analysisResults = await deterministicService.analyze(asset.storage_path);

        await updateJobStatus(job.id, 'PROCESSING', 60);

        // Build V2 Report
        const report = reportService.buildReport(asset, analysisResults);

        // Save report to DB
        await db.query(`
            INSERT INTO reports (job_id, asset_id, summary, findings, version, data)
            VALUES ($1, $2, $3, $4, 'v2', $5)
        `, [job.id, asset_id, 'Standard V2 Deterministic Analysis', JSON.stringify(report.findings), JSON.stringify(report)]);

        await updateJobStatus(job.id, 'COMPLETED', 100);
        console.log(`[WORKER][${job.id}] Completed successfully with ${report.findings.length} findings`);

        return { ok: true, report_id: job.id };
    } catch (err) {
        console.error(`[WORKER][${job.id}] Failed:`, err);
        await updateJobStatus(job.id, 'FAILED', 0, { message: err.message });
        throw err;
    }
}, {
    connection,
    concurrency: parseInt(process.env.PPP_MAX_WORKERS || '4', 10)
});

// Also handle AutoFix queue with a separate worker instance or logic
const autofixWorker = new Worker('autofix-v2', async (job) => {
    const { asset_id, tenant_id, policy } = job.data;
    console.log(`[WORKER][${job.id}] Starting AUTOFIX for asset ${asset_id}`);

    try {
        const tStart = Date.now();
        await updateJobStatus(job.id, 'PROCESSING', 10);

        const originalAsset = await assetService.getAsset(asset_id);
        if (!originalAsset) throw new Error('Asset not found');

        // 1. Fetch the "Before" report
        const beforeResult = await db.query('SELECT data FROM reports WHERE asset_id = $1 AND version = \'v2\' ORDER BY created_at DESC LIMIT 1', [asset_id]);
        const beforeReport = beforeResult.rows[0]?.data;
        if (!beforeReport) throw new Error('Original preflight report not found for deltas');

        // 2. Perform Fixes (AutoFix Step)
        const fixFilename = `fixed_${originalAsset.filename}`;
        const fixPath = path.join(path.dirname(originalAsset.storage_path), `tmp_fix_${job.id}.pdf`);

        await updateJobStatus(job.id, 'PROCESSING', 30);

        // Simple policy logic for Week 3
        let currentFile = originalAsset.storage_path;
        if (policy === 'OFFSET_CMYK_STRICT' || policy === 'AUTO') {
            const hasRgb = beforeReport.findings.some(f => f.id === 'rgb-only-content');
            const hasNoBleed = beforeReport.findings.some(f => f.id === 'missing-bleed-info');

            if (hasRgb) {
                const step1 = path.join(path.dirname(fixPath), `step1_${job.id}.pdf`);
                await autofixService.convertCmyk(currentFile, step1);
                currentFile = step1;
            }
            if (hasNoBleed) {
                const step2 = path.join(path.dirname(fixPath), `step2_${job.id}.pdf`);
                await autofixService.addBleed(currentFile, step2);
                if (currentFile !== originalAsset.storage_path) try { fs.unlinkSync(currentFile); } catch (e) { }
                currentFile = step2;
            }
        }

        fs.renameSync(currentFile, fixPath);

        // 3. Create Fixed Asset
        const fixedAsset = await assetService.createAsset({
            filename: fixFilename,
            filePath: fixPath,
            tenantId: tenant_id
        });
        try { fs.unlinkSync(fixPath); } catch (e) { }

        await updateJobStatus(job.id, 'PROCESSING', 70);

        // 4. Re-analyze Fixed Asset (Post-Fix Recheck)
        const analysisAfter = await deterministicService.analyze(fixedAsset.storage_path);
        const afterReport = reportService.buildReport(fixedAsset, analysisAfter);

        // 5. Compute Delta
        const delta = deltaService.computeDelta(beforeReport, afterReport);

        // 6. Save final report with delta
        await db.query(`
            INSERT INTO reports (job_id, asset_id, summary, findings, version, data, delta)
            VALUES ($1, $2, $3, $4, 'v2', $5, $6)
        `, [
            job.id,
            fixedAsset.id,
            `AutoFix completed. ${delta.fixed_count} issues resolved.`,
            JSON.stringify(afterReport.findings),
            JSON.stringify(afterReport),
            JSON.stringify(delta)
        ]);

        // 7. Log Telemetry / Metrics
        const processing_ms = Date.now() - tStart;
        await db.query(`
            INSERT INTO metrics (job_id, tenant_id, policy_slug, success, processing_ms, file_size_bytes, page_count, delta_score)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [job.id, tenant_id, policy || 'OFFSET_CMYK_STRICT', true, processing_ms, originalAsset.size || 0, afterReport.summary?.pages || 0, delta.fixed_count || 0]);

        await updateJobStatus(job.id, 'COMPLETED', 100);
        return { ok: true, fixed_asset_id: fixedAsset.id, delta };
    } catch (err) {
        const processing_ms = Date.now() - tStart;
        // Best effort to log failure telemetry
        db.query(`
            INSERT INTO metrics (job_id, tenant_id, policy_slug, success, processing_ms, file_size_bytes, page_count, delta_score)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [job.id, tenant_id, policy || 'OFFSET_CMYK_STRICT', false, processing_ms, 0, 0, 0]).catch(() => { });

        console.error(`[AUTOFIX-WORKER][${job.id}] Failed:`, err);
        await updateJobStatus(job.id, 'FAILED', 0, { message: err.message });
        throw err;
    }
}, { connection, concurrency: 1 });

console.log('[V2-WORKERS] Started listening for jobs...');

module.exports = {
    v2Worker,
    autofixWorker
};
