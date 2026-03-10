// scripts/aggregate-usage.js
require('dotenv').config();
const db = require('../services/db');

/**
 * Aggregates daily usage metrics for all tenants.
 * Can be run manually for a specific date or a range.
 * @param {string} [startDateStr] - Start Date (YYYY-MM-DD)
 * @param {string} [endDateStr] - End Date (YYYY-MM-DD), inclusive
 */
async function aggregateRange(startDateStr, endDateStr) {
    const end = endDateStr || startDateStr || new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const start = startDateStr || end;

    console.log(`[AGGREGATOR] Starting aggregation range: ${start} to ${end}`);

    let current = new Date(start);
    const stopAt = new Date(end);

    while (current <= stopAt) {
        const dateStr = current.toISOString().split('T')[0];
        await aggregateDate(dateStr);
        current.setDate(current.getDate() + 1);
    }
}

async function aggregateDate(targetDate) {
    console.log(`[AGGREGATOR] Processing date: ${targetDate}...`);
    try {
        const { rows: tenants } = await db.query('SELECT id FROM tenants');

        for (const tenant of tenants) {
            const tenantId = tenant.id;

            // 1. Get Job counts
            const { rows: [jobStats] } = await db.query(`
                SELECT COUNT(*) as jobs_count
                FROM jobs
                WHERE tenant_id = ? AND DATE(created_at) = ?
            `, [tenantId, targetDate]);

            // 2. Get Batch counts
            const { rows: [batchStats] } = await db.query(`
                SELECT COUNT(*) as batches_count
                FROM batches
                WHERE tenant_id = ? AND DATE(created_at) = ?
            `, [tenantId, targetDate]);

            // 3. Get ROI Metrics
            const { rows: [roiStats] } = await db.query(`
                SELECT 
                    SUM(COALESCE(value_generated, 0)) as value_total,
                    SUM(COALESCE(hours_saved, 0)) as hours_total
                FROM metrics
                WHERE tenant_id = ? AND DATE(created_at) = ?
            `, [tenantId, targetDate]);

            const jobs = Number(jobStats?.jobs_count || 0);
            const batches = Number(batchStats?.batches_count || 0);
            const value = Number(roiStats?.value_total || 0);
            const hours = Number(roiStats?.hours_total || 0);

            // Idempotent upsert
            if (jobs > 0 || batches > 0) {
                await db.query(`
                    INSERT INTO tenant_usage_stats 
                        (tenant_id, date, jobs_count, batches_count, value_generated, hours_saved)
                    VALUES (?, ?, ?, ?, ?, ?)
                    ON DUPLICATE KEY UPDATE
                        jobs_count = VALUES(jobs_count),
                        batches_count = VALUES(batches_count),
                        value_generated = VALUES(value_generated),
                        hours_saved = VALUES(hours_saved)
                `, [tenantId, targetDate, jobs, batches, value, hours]);
            }
        }
        console.log(`[AGGREGATOR] Date ${targetDate} completed.`);
    } catch (err) {
        console.error(`[AGGREGATOR] Error for ${targetDate}:`, err.message);
    }
}

// CLI Execution Support
if (require.main === module) {
    const start = process.argv[2];
    const end = process.argv[3];
    aggregateRange(start, end)
        .then(() => {
            console.log('[AGGREGATOR] Range process finished.');
            process.exit(0);
        })
        .catch(err => {
            console.error('[AGGREGATOR] Range process crashed:', err);
            process.exit(1);
        });
}

module.exports = aggregateRange;
