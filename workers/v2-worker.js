/**
 * @project PrintPrice Pro - V2 Background Worker
 * @author Manuel Enrique Morales (https://manuelenriquemorales.com/)
 * @social https://x.com/manuel_emorales | https://www.linkedin.com/in/manuelenriquemorales/
 */
const { Worker } = require('bullmq');
/**
 * @project PrintPrice Pro - Deterministic Analysis Service
 * @author Manuel Enrique Morales (https://manuelenriquemorales.com/)
 * @social https://x.com/manuel_emorales | https://www.linkedin.com/in/manuelenriquemorales/
 */
const { spawnSafe } = require('./processRunner');
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
const productionSignalService = require('../services/productionSignalService');
const intentDetector = require('../services/intentDetector');
const bindingIntelligence = require('../services/bindingIntelligenceService');
const bpeAdapter = require('../services/bpePayloadAdapter');
const matchmaker = require('../services/matchmaker');
const { auditBleed, classifyDocument } = require('../services/geometryAuditService');
const { getPdfGeometryGS } = require('../utils-server/pdfInfo');

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
        const policyObj = reportService.policyEngine.loadPolicy(policy);
        const report = reportService.buildReport(asset, analysisResults, policyObj);

        // Enrichment: Phase 32 Editorial Geometry & Classification
        try {
            const geometry = await getPdfGeometryGS(asset.storage_path);
            report.bleedAudit = auditBleed(geometry);
            report.classification = classifyDocument(geometry, analysisResults.info?.pages || 1);
        } catch (geomErr) {
            console.error('[V2-WORKER] Geometry enrichment failed:', geomErr.message);
            report.bleedAudit = { status: 'ERROR', message: 'Geometry extraction failed' };
            report.classification = { type: 'DOCUMENT', format: 'UNKNOWN' };
        }

        // V3 Intelligence Layer: Edition Intent (Hito V3.1)
        try {
            const signals = productionSignalService.extractSignals(analysisResults);
            const intent = intentDetector.detect(signals);
            report.production = report.production || {};
            report.production.intent = intent;

            // V3 Intelligence Layer: Binding (Hito V3.2)
            // Normalize BPE specs from job metadata or requested profile
            const productionSpecs = bpeAdapter.normalize(job.metadata_json || {});
            const binding = bindingIntelligence.assess(analysisResults, intent, productionSpecs);
            report.production.binding = binding;

            // Merge findings
            if (binding.findings) {
                report.findings = report.findings || [];
                report.findings.push(...binding.findings);
            }

            // V3 Matchmaking Layer (Hito V4)
            const matchmaking = await matchmaker.match(analysisResults, intent, productionSpecs);
            report.production.matchmaking = matchmaking;

            // Final Decision Bridge
            report.decision = {
                best_printer_id: matchmaking.best_printer_id,
                status: matchmaking.status,
                explanation: matchmaking.decision_explanation
            };
        } catch (v3err) {
            console.error(`[WORKER][${job.id}] V3 Production Intelligence failed:`, v3err.message);
        }

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
    const tQueueWait = tStart - job.timestamp;

    let currentFile = null;
    let fixPath = null;
    let outcome = 'SUCCESS';
    let tAnalysisStart, tAnalysisEnd, tFixStart, tFixEnd, tRecheckStart, tRecheckEnd;
    let beforeReport = null;
    let afterReport = null;
    let delta = { fixed_count: 0 };

    try {
        // Soft-check cancellation
        const jobRecord = await db.query('SELECT status FROM jobs WHERE id = ?', [job.id]);
        if (jobRecord.rows[0]?.status === 'CANCELED' || jobRecord.rows[0]?.status === 'CANCEL_REQUESTED') {
            console.log(`[WORKER][${job.id}] AUTOFIX Job was canceled before starting. Skipping.`);
            outcome = ErrorTaxonomy.JOB_CANCELED;
            return { ok: false, canceled: true };
        }

        await updateJobStatus(job.id, 'RUNNING', 10);

        const originalAsset = await assetService.getAsset(asset_id);
        if (!originalAsset) throw new Error(ErrorTaxonomy.ASSET_NOT_FOUND);

        currentFile = originalAsset.storage_path;
        fixPath = path.join(path.dirname(originalAsset.storage_path), `tmp_fix_${job.id}.pdf`);
        const fixFilename = `fixed_${originalAsset.filename}`;

        // 1. Initial Analysis
        tAnalysisStart = Date.now();
        const analysisResults = await deterministicService.analyze(originalAsset.storage_path);
        tAnalysisEnd = Date.now();

        // Admission Control: Page Count
        const pageCount = analysisResults.info?.pages || 0;
        if (pageCount > 1000) {
            outcome = ErrorTaxonomy.ADMISSION_PAGES_EXCEEDED;
            throw new Error(`PDF exceeds 1000 page limit (${pageCount})`);
        }

        const policyObj = reportService.policyEngine.loadPolicy(policy);
        beforeReport = reportService.buildReport(originalAsset, analysisResults, policyObj);

        // V3 Intelligence Layer (Before Fix)
        try {
            const signals = productionSignalService.extractSignals(analysisResults);
            beforeReport.production = beforeReport.production || {};
            const intentBefore = intentDetector.detect(signals);
            beforeReport.production.intent = intentBefore;

            const specsBefore = bpeAdapter.normalize(job.metadata_json || {});
            beforeReport.production.binding = bindingIntelligence.assess(analysisResults, intentBefore, specsBefore);
        } catch (v3err) { }

        await updateJobStatus(job.id, 'RUNNING', 30);

        // 2. Perform Fixes (Dynamic Policy-Driven AutoFix)
        tFixStart = Date.now();
        const actions = reportService.policyEngine.getAutoFixActions(policyObj);
        const iccProfile = policyObj.color?.icc_profile || 'iso_coated_v3';
        const bleedMm = policyObj.document?.bleed_mm_required || 3;

        const findings = beforeReport.findings || [];
        const appliedFixes = [];

        for (const action of actions) {
            console.log(`[AUTOFIX][${job.id}] Evaluating action: ${action}`);

            if (action === 'convert_cmyk') {
                const needsCmyk = findings.some(f => ['rgb-only-content', 'spot-color-detected', 'tac_limit'].includes(f.id));
                if (needsCmyk) {
                    const stepPath = path.join(path.dirname(fixPath), `cmyk_${job.id}.pdf`);
                    await autofixService.convertCmyk(currentFile, stepPath, iccProfile);
                    if (currentFile !== originalAsset.storage_path) try { fs.unlinkSync(currentFile); } catch (e) { }
                    currentFile = stepPath;
                    appliedFixes.push('convert_cmyk');
                }
            } else if (action === 'add_bleed') {
                const needsBleed = findings.some(f => ['missing-bleed-info', 'bleed_mm_required'].includes(f.id));
                if (needsBleed) {
                    const stepPath = path.join(path.dirname(fixPath), `bleed_${job.id}.pdf`);
                    await autofixService.addBleed(currentFile, stepPath, bleedMm);
                    if (currentFile !== originalAsset.storage_path) try { fs.unlinkSync(currentFile); } catch (e) { }
                    currentFile = stepPath;
                    appliedFixes.push('add_bleed');
                }
            }
        }

        let fixedAsset = null;
        if (appliedFixes.length > 0) {
            fs.renameSync(currentFile, fixPath);
            fixedAsset = await assetService.createAsset({
                filename: fixFilename,
                filePath: fixPath,
                tenantId: tenant_id
            });
            // Note: currentFile is now fixPath which will be cleaned up in finally
        }
        tFixEnd = Date.now();

        if (!fixedAsset) {
            outcome = 'NO_FIXES_NEEDED';
            await updateJobStatus(job.id, 'SUCCEEDED', 100);
            return { status: 'no_fixes_applied' };
        }

        await updateJobStatus(job.id, 'RUNNING', 60);

        // 3. Re-analyze Fixed Asset
        tRecheckStart = Date.now();
        const analysisAfter = await deterministicService.analyze(fixedAsset.storage_path);
        afterReport = reportService.buildReport(fixedAsset, analysisAfter, policyObj);

        // Enrichment: Add geometry to after-report
        try {
            const geometry = await getPdfGeometryGS(fixedAsset.storage_path);
            afterReport.bleedAudit = auditBleed(geometry);
            afterReport.classification = classifyDocument(geometry, analysisAfter.info?.pages || 1);
        } catch (geomErr) {
            console.warn('[AUTOFIX-WORKER] Geometry enrichment failed for fixed asset');
            afterReport.bleedAudit = { status: 'UNKNOWN' };
            afterReport.classification = { type: 'DOCUMENT' };
        }

        // V3 Intelligence Layer (After Fix)
        try {
            const signalsAfter = productionSignalService.extractSignals(analysisAfter);
            afterReport.production = afterReport.production || {};
            const intentAfter = intentDetector.detect(signalsAfter);
            afterReport.production.intent = intentAfter;

            const specsAfter = bpeAdapter.normalize(job.metadata_json || {});
            afterReport.production.binding = bindingIntelligence.assess(analysisAfter, intentAfter, specsAfter);

            // V3 Matchmaking Layer (Hito V4)
            const matchmakingAfter = await matchmaker.match(analysisAfter, intentAfter, specsAfter);
            afterReport.production.matchmaking = matchmakingAfter;
            afterReport.decision = {
                best_printer_id: matchmakingAfter.best_printer_id,
                status: matchmakingAfter.status,
                explanation: matchmakingAfter.decision_explanation
            };
        } catch (v3err) { }

        tRecheckEnd = Date.now();

        // 4. Compute Delta
        delta = deltaService.computeDelta(beforeReport, afterReport);

        // 5. Attach Telemetry to Internal Report
        const telemetry = {
            analysis_ms: (tAnalysisEnd || 0) - (tAnalysisStart || 0),
            fix_ms: (tFixEnd || 0) - (tFixStart || 0),
            recheck_ms: (tRecheckEnd || 0) - (tRecheckStart || 0),
            queue_wait_ms: tQueueWait,
            total_ms: Date.now() - tStart,
            outcome,
            finding_count_before: beforeReport?.findings?.length || 0,
            finding_count_after: afterReport?.findings?.length || 0
        };
        if (afterReport) afterReport.telemetry = telemetry;

        // 6. Save report
        await db.query(`
                INSERT INTO reports (id, job_id, asset_id, summary, findings, version, data, delta)
                VALUES (?, ?, ?, ?, ?, 'v2', ?, ?)
            `, [crypto.randomUUID(), job.id, fixedAsset.id, `AutoFix completed. ${delta.fixed_count} issues resolved.`, JSON.stringify(afterReport.findings), JSON.stringify(afterReport), JSON.stringify(delta)]);

        await updateJobStatus(job.id, 'SUCCEEDED', 100);

        // Webhook & Batch reconciliation remains same...
        dispatchWebhook(tenant_id, 'job.completed', {
            job_id: job.id,
            risk_score_before: beforeReport.risk_score,
            risk_score_after: afterReport.risk_score,
            fixed_file_asset_id: fixedAsset.id
        });

        if (job.data?.batch_id) reconcileBatchProgress(job.data.batch_id).catch(() => { });

        return { ok: true, fixed_asset_id: fixedAsset.id, delta };

    } catch (err) {
        outcome = err.message.includes('TIMEOUT') ? ErrorTaxonomy.TOOL_TIMEOUT : (outcome === 'SUCCESS' ? ErrorTaxonomy.AUTOFIX_FAILED : outcome);
        console.error(`[AUTOFIX-WORKER][${job.id}] Failed:`, err);
        await updateJobStatus(job.id, 'FAILED', 0, { message: err.message, code: outcome });

        dispatchWebhook(tenant_id, 'job.failed', { job_id: job.id, error: err.message, code: outcome });
        if (job.data?.batch_id) reconcileBatchProgress(job.data.batch_id).catch(() => { });
        throw err;
    } finally {
        const processing_ms = Date.now() - tStart;

        // Robust Cleanup
        if (fixPath && fs.existsSync(fixPath)) try { fs.unlinkSync(fixPath); } catch (e) { }
        // If currentFile is a step path (not the original asset), clean it up
        if (currentFile && currentFile.includes(`_${job.id}.pdf`) && fs.existsSync(currentFile)) try { fs.unlinkSync(currentFile); } catch (e) { }

        // Log Telemetry
        const telemetry = {
            analysis_ms: (tAnalysisEnd || 0) - (tAnalysisStart || 0),
            fix_ms: (tFixEnd || 0) - (tFixStart || 0),
            recheck_ms: (tRecheckEnd || 0) - (tRecheckStart || 0),
            queue_wait_ms: tQueueWait,
            total_ms: processing_ms,
            outcome,
            finding_count_before: beforeReport?.findings?.length || 0,
            finding_count_after: afterReport?.findings?.length || 0
        };

        db.query(`
            INSERT INTO metrics (
                id, job_id, tenant_id, policy_slug, success, outcome, processing_ms, 
                file_size_bytes, page_count, delta_score,
                risk_score_before, risk_score_after, hours_saved, value_generated,
                telemetry_json
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            crypto.randomUUID(), job.id, tenant_id, policy || 'OFFSET_CMYK_STRICT',
            outcome === 'SUCCESS' || outcome === 'NO_FIXES_NEEDED',
            outcome, processing_ms, 0, beforeReport?.document?.pageCount || 0,
            delta.fixed_count || 0, beforeReport?.risk_score || 0, afterReport?.risk_score || 0,
            ((delta.fixed_count || 0) * 15) / 60, (delta.fixed_count || 0) * 25,
            JSON.stringify({
                ...telemetry,
                matchmaking: afterReport?.production?.matchmaking ? {
                    best_score: afterReport.production.matchmaking.candidates[0]?.scores?.overall || 0,
                    candidate_count: afterReport.production.matchmaking.metadata.total_scanned,
                    compatible_count: afterReport.production.matchmaking.metadata.compatible_count
                } : null
            })
        ]).catch(e => console.error('[TELEMETRY-FAIL]', e));
    }
}, { connection, concurrency: 1 });

console.log('[V2-WORKERS] Started listening for jobs...');

module.exports = {
    v2Worker,
    autofixWorker
};
