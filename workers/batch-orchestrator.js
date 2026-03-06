const { Worker } = require('bullmq');
const { connection, enqueueJob } = require('../services/queue');
const db = require('../services/db');
const assetService = require('../services/assetService');
const { dispatchWebhook } = require('../services/webhookService');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');

// ---- Safety limits ----
const MAX_BATCH_FILES = Number(process.env.PPP_MAX_BATCH_FILES || 100);
const MAX_BATCH_BYTES = Number(process.env.PPP_MAX_BATCH_BYTES || 1024 * 1024 * 1024); // 1 GB default

/**
 * Batch Orchestrator Worker
 * Processes BATCH_ORCHESTRATE jobs from BullMQ.
 * Each job contains a reference to a stored ZIP asset.
 * It extracts PDFs, validates them, creates child AUTOFIX jobs, and tracks progress.
 */
const batchOrchestratorWorker = new Worker('batch-orchestrator', async (bullJob) => {
    const { batch_id, zip_asset_id, tenant_id, policy } = bullJob.data;
    const tempDir = path.join(__dirname, '..', 'uploads-v2-temp', `batch_${batch_id}`);

    try {
        await updateBatchStatus(batch_id, 'RUNNING');

        // 1. Retrieve ZIP asset path
        const zipAsset = await assetService.getAsset(zip_asset_id);
        if (!zipAsset) throw new Error(`ZIP asset ${zip_asset_id} not found`);

        // 2. Security: zip bomb & size guard (already checked at upload, double-check here)
        const zipStat = fs.statSync(zipAsset.storage_path);
        if (zipStat.size > MAX_BATCH_BYTES) {
            throw new Error(`ZIP size (${zipStat.size}) exceeds MAX_BATCH_BYTES (${MAX_BATCH_BYTES})`);
        }

        // 3. Extract
        fs.mkdirSync(tempDir, { recursive: true });
        const zip = new AdmZip(zipAsset.storage_path);
        const entries = zip.getEntries();

        // 4. Validate entries
        const pdfEntries = [];
        for (const entry of entries) {
            if (entry.isDirectory) continue;

            // Path traversal guard
            const entryName = entry.entryName;
            if (entryName.includes('..') || path.isAbsolute(entryName)) {
                console.warn(`[BATCH-ORCH][${batch_id}] Skipping suspicious entry: ${entryName}`);
                continue;
            }

            // Only PDFs
            if (!entryName.toLowerCase().endsWith('.pdf')) {
                console.warn(`[BATCH-ORCH][${batch_id}] Skipping non-PDF: ${entryName}`);
                continue;
            }

            pdfEntries.push(entry);
        }

        if (pdfEntries.length === 0) {
            throw new Error('No valid PDF files found in ZIP');
        }
        if (pdfEntries.length > MAX_BATCH_FILES) {
            throw new Error(`ZIP contains ${pdfEntries.length} files; max allowed is ${MAX_BATCH_FILES}`);
        }

        // 5. Update batch totals
        await db.query('UPDATE batches SET total_jobs = ? WHERE id = ?', [pdfEntries.length, batch_id]);

        // 6. Extract + create assets + enqueue child jobs
        const childJobIds = [];
        for (const entry of pdfEntries) {
            const safeName = path.basename(entry.entryName);
            const outPath = path.join(tempDir, crypto.randomUUID() + '_' + safeName);
            zip.extractEntryTo(entry, tempDir, false, true, false, path.basename(outPath));

            try {
                // Create asset for this individual PDF
                const asset = await assetService.createAsset({
                    filename: safeName,
                    filePath: outPath,
                    tenantId: tenant_id
                });

                // Enqueue child AUTOFIX job
                const childJob = await enqueueJob('AUTOFIX', {
                    asset_id: asset.id,
                    tenant_id,
                    policy: policy || 'OFFSET_CMYK_STRICT',
                    batch_id
                });

                // Persist child job to DB
                await db.query(
                    'INSERT INTO jobs (id, tenant_id, asset_id, batch_id, type, status) VALUES (?, ?, ?, ?, ?, ?)',
                    [childJob.id, tenant_id, asset.id, batch_id, 'AUTOFIX', 'QUEUED']
                );

                childJobIds.push(childJob.id);
            } catch (childErr) {
                console.error(`[BATCH-ORCH][${batch_id}] Failed to create job for "${safeName}":`, childErr.message);
                // Continue with remaining files
                await db.query('UPDATE batches SET failed_jobs = failed_jobs + 1 WHERE id = ?', [batch_id]);
            }
        }

        console.log(`[BATCH-ORCH][${batch_id}] Spawned ${childJobIds.length} child jobs.`);
        return { ok: true, batch_id, jobs_created: childJobIds.length };

    } catch (err) {
        console.error(`[BATCH-ORCH][${batch_id}] Fatal error:`, err.message);
        await updateBatchStatus(batch_id, 'FAILED');
        dispatchWebhook(bullJob.data.tenant_id, 'batch.failed', { batch_id, error: err.message });
        throw err;
    } finally {
        // Always clean up temp directory
        try {
            fs.rmSync(tempDir, { recursive: true, force: true });
        } catch (e) {
            console.warn(`[BATCH-ORCH] Temp cleanup failed for ${tempDir}:`, e.message);
        }
    }
}, { connection, concurrency: 2 });

/**
 * Update batch status in the database.
 */
async function updateBatchStatus(batchId, status) {
    const finishedAt = ['SUCCEEDED', 'FAILED', 'PARTIAL'].includes(status) ? new Date() : null;
    await db.query(
        'UPDATE batches SET status = ?, finished_at = ? WHERE id = ?',
        [status, finishedAt, batchId]
    );
}

/**
 * Recalculate and update aggregate batch metrics.
 * Called by the autofix worker after each child job completes.
 */
async function reconcileBatchProgress(batchId) {
    const { rows: [agg] } = await db.query(`
        SELECT
            COUNT(*) as total,
            SUM(CASE WHEN status = 'SUCCEEDED' THEN 1 ELSE 0 END) as completed,
            SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) as failed,
            SUM(CASE WHEN status = 'CANCELED' THEN 1 ELSE 0 END) as canceled
        FROM jobs WHERE batch_id = ?
    `, [batchId]);

    const total = Number(agg.total || 0);
    const completed = Number(agg.completed || 0);
    const failed = Number(agg.failed || 0);
    const canceled = Number(agg.canceled || 0);
    const done = completed + failed + canceled;

    // Aggregate ROI metrics from the metrics table
    const { rows: [roi] } = await db.query(`
        SELECT
            AVG(risk_score_before) as avg_risk_before,
            AVG(risk_score_after) as avg_risk_after,
            SUM(hours_saved) as hours_saved_total,
            SUM(value_generated) as value_generated_total
        FROM metrics m
        JOIN jobs j ON j.id = m.job_id
        WHERE j.batch_id = ?
    `, [batchId]);

    // Determine batch status
    let batchStatus = 'RUNNING';
    if (done >= total && total > 0) {
        if (failed === 0 && canceled === 0) batchStatus = 'SUCCEEDED';
        else if (completed === 0) batchStatus = 'FAILED';
        else batchStatus = 'PARTIAL';
    }

    const finishedAt = ['SUCCEEDED', 'FAILED', 'PARTIAL'].includes(batchStatus) ? new Date() : null;

    await db.query(`
        UPDATE batches SET
            status = ?,
            completed_jobs = ?,
            failed_jobs = ?,
            canceled_jobs = ?,
            risk_score_before_avg = ?,
            risk_score_after_avg = ?,
            hours_saved_total = ?,
            value_generated_total = ?,
            finished_at = ?
        WHERE id = ?
    `, [
        batchStatus,
        completed, failed, canceled,
        roi?.avg_risk_before || null,
        roi?.avg_risk_after || null,
        roi?.hours_saved_total || 0,
        roi?.value_generated_total || 0,
        finishedAt,
        batchId
    ]);

    // If batch is fully done, fire the appropriate granular webhook
    if (['SUCCEEDED', 'FAILED', 'PARTIAL'].includes(batchStatus)) {
        const { rows: [batch] } = await db.query('SELECT tenant_id FROM batches WHERE id = ?', [batchId]);
        if (batch) {
            // Map status to a specific event type so integrators don't have to inspect the body
            const eventType = batchStatus === 'SUCCEEDED'
                ? 'batch.completed'
                : batchStatus === 'PARTIAL'
                    ? 'batch.partial'
                    : 'batch.failed';

            dispatchWebhook(batch.tenant_id, eventType, {
                batch_id: batchId,
                status: batchStatus,
                total_jobs: total,
                completed_jobs: completed,
                failed_jobs: failed,
                value_generated: Number(roi?.value_generated_total || 0),
                hours_saved: Number(roi?.hours_saved_total || 0)
            });
        }
    }

    return batchStatus;
}

console.log('[BATCH-ORCHESTRATOR] Worker started, listening for batch jobs...');

module.exports = { batchOrchestratorWorker, reconcileBatchProgress, updateBatchStatus };
