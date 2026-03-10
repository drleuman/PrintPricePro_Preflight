/**
 * PrintPrice V2 Retention Cleanup
 * Enforces:
 * - Detailed Jobs/Reports: 14 days
 * - Aggregated Metrics: 90 days
 * - Temporary Assets: 48 hours
 */
const db = require('../services/db');
const fs = require('fs');
const path = require('path');

async function cleanup() {
    console.log('--- STARTING RETENTION CLEANUP ---');
    const tStart = Date.now();

    try {
        // 1. Delete Detailed Jobs/Reports older than 14 days
        const reportsResult = await db.query(`
            DELETE FROM reports 
            WHERE created_at < DATE_SUB(NOW(), INTERVAL 14 DAY)
        `);
        console.log(`[CLEANUP] Deleted ${reportsResult.affectedRows || 0} stale reports (>14d)`);

        // 2. Delete Stale Metrics older than 90 days
        const metricsResult = await db.query(`
            DELETE FROM metrics 
            WHERE created_at < DATE_SUB(NOW(), INTERVAL 90 DAY)
        `);
        console.log(`[CLEANUP] Deleted ${metricsResult.affectedRows || 0} stale metrics (>90d)`);

        // 3. Delete Temporary Assets older than 48 hours
        // We look for assets that are either in temp directories or logically marked
        const assetResult = await db.query(`
            SELECT id, storage_path FROM assets 
            WHERE created_at < DATE_SUB(NOW(), INTERVAL 48 HOUR)
            AND (filename LIKE 'fixed_%' OR filename LIKE 'tmp_%')
        `);

        let deletedFiles = 0;
        for (const asset of assetResult.rows) {
            try {
                if (fs.existsSync(asset.storage_path)) {
                    fs.unlinkSync(asset.storage_path);
                    deletedFiles++;
                }
                await db.query('DELETE FROM assets WHERE id = ?', [asset.id]);
            } catch (e) {
                console.error(`[CLEANUP] Failed to delete asset ${asset.id}:`, e.message);
            }
        }
        console.log(`[CLEANUP] Deleted ${deletedFiles} temporary files/assets (>48h)`);

        const duration = Date.now() - tStart;
        console.log(`--- CLEANUP COMPLETED IN ${duration}ms ---`);
    } catch (err) {
        console.error('[CLEANUP-ERROR]', err.message);
    }
}

cleanup().then(() => process.exit(0));
