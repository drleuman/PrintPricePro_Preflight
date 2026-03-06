const { Worker } = require('bullmq');
const { connection } = require('../services/queue');
const db = require('../services/db');
const assetService = require('../services/assetService');
const deterministicService = require('../services/deterministicService');
const reportService = require('../services/reportService');
const autofixService = require('../services/autofixService');
const deltaService = require('../services/deltaService');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { dispatchWebhook } = require('../services/webhookService');
const { reconcileBatchProgress } = require('./batch-orchestrator');

/**
 * Common worker logic to update job status in the Database with transition validation.
 */
async function updateJobStatus(jobId, status, progress = 0, error = null) {
    const tStart = Date.now();
    try {
        // State Machine validation
        const current = await db.query('SELECT status FROM jobs WHERE id = ?', [jobId]);
        const currentStatus = current.rows[0]?.status;

        // Disallow moving out of terminal states
        if (currentStatus === 'SUCCEEDED' || currentStatus === 'FAILED' || currentStatus === 'CANCELED') {
            console.warn(`[STATE-MACHINE][${jobId}] Rejecting transition from terminal state ${currentStatus} to ${status}`);
            return;
        }

        await db.query(`
            UPDATE jobs 
            SET status = ?, progress = ?, error = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [status, progress, error ? JSON.stringify(error) : null, jobId]);

        // Log Event
        await db.query(`
            INSERT INTO job_events (id, job_id, event, metadata)
            VALUES (?, ?, ?, ?)
        `, [
            crypto.randomUUID(),
            jobId,
            `STATUS_CHANGED_${status}`,
            JSON.stringify({ progress, timestamp: new Date().toISOString() })
        ]);
    } catch (err) {
        console.error(`[UPDATE-STATUS-ERROR][${jobId}]`, err.message);
    }
}

/**
 * The V2 Background Worker.
 */
const v2Worker = new Worker('preflight-v2', async (job) => {
    const { asset_id, tenant_id, policy } = job.data;
    console.log(`[WORKER][${job.id}] Starting ${job.name} for asset ${asset_id}`);

    try {
        // Soft-check cancellation
        const jobRecord = await db.query('SELECT status FROM jobs WHERE id = ?', [job.id]);
        if (jobRecord.rows[0]?.status === 'CANCELED' || jobRecord.rows[0]?.status === 'CANCEL_REQUESTED') {
            console.log(`[WORKER][${job.id}] Job was canceled before starting. Skipping.`);
            return { ok: false, canceled: true };
        }

        await updateJobStatus(job.id, 'RUNNING', 10);

        const asset = await assetService.getAsset(asset_id);
        if (!asset) throw new Error('Asset not found');

        // Real Deterministic Analysis (BE-204)
        const analysisResults = await deterministicService.analyze(asset.storage_path);

        await updateJobStatus(job.id, 'RUNNING', 60);

        // Build V2 Report
        const report = reportService.buildReport(asset, analysisResults);

        // Save report to DB
        await db.query(`
            INSERT INTO reports (id, job_id, asset_id, summary, findings, version, data)
            VALUES (?, ?, ?, ?, ?, 'v2', ?)
        `, [crypto.randomUUID(), job.id, asset_id, 'Standard V2 Deterministic Analysis', JSON.stringify(report.findings), JSON.stringify(report)]);

        await updateJobStatus(job.id, 'SUCCEEDED', 100);
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

    const tStart = Date.now();
    try {
        // Soft-check cancellation
        const jobRecord = await db.query('SELECT status FROM jobs WHERE id = ?', [job.id]);
        if (jobRecord.rows[0]?.status === 'CANCELED' || jobRecord.rows[0]?.status === 'CANCEL_REQUESTED') {
            console.log(`[WORKER][${job.id}] AUTOFIX Job was canceled before starting. Skipping.`);
            return { ok: false, canceled: true };
        }

        await updateJobStatus(job.id, 'RUNNING', 10);

        const originalAsset = await assetService.getAsset(asset_id);
        if (!originalAsset) throw new Error('Asset not found');

        // 1. Fetch the "Before" report
        const beforeResult = await db.query('SELECT data FROM reports WHERE asset_id = ? AND version = \'v2\' ORDER BY created_at DESC LIMIT 1', [asset_id]);
        const beforeReport = beforeResult.rows[0]?.data;
        if (!beforeReport) throw new Error('Original preflight report not found for deltas');

        // 2. Perform Fixes (AutoFix Step)
        const fixFilename = `fixed_${originalAsset.filename}`;
        const fixPath = path.join(path.dirname(originalAsset.storage_path), `tmp_fix_${job.id}.pdf`);

        await updateJobStatus(job.id, 'RUNNING', 30);

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

        await updateJobStatus(job.id, 'RUNNING', 70);

        // 4. Re-analyze Fixed Asset (Post-Fix Recheck)
        const analysisAfter = await deterministicService.analyze(fixedAsset.storage_path);
        const afterReport = reportService.buildReport(fixedAsset, analysisAfter);

        // 5. Compute Delta
        const delta = deltaService.computeDelta(beforeReport, afterReport);

        // 6. Save final report with delta
        await db.query(`
            INSERT INTO reports (id, job_id, asset_id, summary, findings, version, data, delta)
            VALUES (?, ?, ?, ?, ?, 'v2', ?, ?)
        `, [
            crypto.randomUUID(),
            job.id,
            fixedAsset.id,
            `AutoFix completed. ${delta.fixed_count} issues resolved.`,
            JSON.stringify(afterReport.findings),
            JSON.stringify(afterReport),
            JSON.stringify(delta)
        ]);

        // 7. Log Telemetry / Metrics
        const processing_ms = Date.now() - tStart;

        // ROI Calculation
        const fixedCount = delta.fixed_count || 0;
        const hoursSaved = (fixedCount * 15) / 60;
        const valueGenerated = fixedCount * 25;

        // Risk Scores
        const riskScoreBefore = beforeReport.risk_score || 0;
        const riskScoreAfter = afterReport.risk_score || 0;

        await db.query(`
            INSERT INTO metrics (
                id, job_id, tenant_id, policy_slug, success, processing_ms, 
                file_size_bytes, page_count, delta_score,
                risk_score_before, risk_score_after, hours_saved, value_generated
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            crypto.randomUUID(),
            job.id,
            tenant_id,
            policy || 'OFFSET_CMYK_STRICT',
            true,
            processing_ms,
            originalAsset.size || 0,
            afterReport.document?.pageCount || 0,
            fixedCount,
            riskScoreBefore,
            riskScoreAfter,
            hoursSaved,
            valueGenerated
        ]);

        await updateJobStatus(job.id, 'SUCCEEDED', 100);

        // Dispatch webhook notification (fire-and-forget)
        dispatchWebhook(tenant_id, 'job.completed', {
            job_id: job.id,
            risk_score_before: riskScoreBefore,
            risk_score_after: riskScoreAfter,
            value_generated: valueGenerated,
            hours_saved: hoursSaved,
            fixed_file_asset_id: fixedAsset.id
        });

        // If this job belongs to a batch, reconcile batch progress
        if (job.data?.batch_id) {
            reconcileBatchProgress(job.data.batch_id).catch(err => {
                console.error(`[BATCH-RECONCILE] Failed for batch ${job.data.batch_id}:`, err.message);
            });
        }

        return { ok: true, fixed_asset_id: fixedAsset.id, delta };
    } catch (err) {
        const processing_ms = Date.now() - tStart;
        // Best effort to log failure telemetry
        db.query(`
            INSERT INTO metrics (id, job_id, tenant_id, policy_slug, success, processing_ms, file_size_bytes, page_count, delta_score)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [crypto.randomUUID(), job.id, tenant_id, policy || 'OFFSET_CMYK_STRICT', false, processing_ms, 0, 0, 0]).catch(() => { });

        console.error(`[AUTOFIX-WORKER][${job.id}] Failed:`, err);
        await updateJobStatus(job.id, 'FAILED', 0, { message: err.message });

        // Dispatch webhook notification (fire-and-forget)
        dispatchWebhook(tenant_id, 'job.failed', {
            job_id: job.id,
            error: err.message
        });

        // If this job belongs to a batch, reconcile batch progress (count failure)
        if (job.data?.batch_id) {
            reconcileBatchProgress(job.data.batch_id).catch(() => { });
        }

        throw err;
    }
}, { connection, concurrency: 1 });

console.log('[V2-WORKERS] Started listening for jobs...');

module.exports = {
    v2Worker,
    autofixWorker
};
