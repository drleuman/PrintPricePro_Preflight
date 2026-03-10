// scripts/export-billing.js
require('dotenv').config();
const db = require('../services/db');
const fs = require('fs');

/**
 * Export Tenant Billing Data to CSV or JSON
 * Usage: node scripts/export-billing.js <tenantId> <year> <month> [--from=YYYY-MM-DD --to=YYYY-MM-DD] [--format=csv|json] [--aggregate=daily|monthly]
 */
async function exportBilling() {
    const args = process.argv.slice(2);
    const tenantId = args[0];
    const year = args[1];
    const month = args[2];

    // Parse named arguments if present
    const fromArg = args.find(a => a.startsWith('--from='))?.split('=')[1];
    const toArg = args.find(a => a.startsWith('--to='))?.split('=')[1];
    const format = args.find(a => a.startsWith('--format='))?.split('=')[1] || 'csv';
    const aggregate = args.find(a => a.startsWith('--aggregate='))?.split('=')[1] || 'daily';

    if (!tenantId || (!year && !fromArg)) {
        console.error('Usage: node scripts/export-billing.js <tenantId> <year> <month> [--from=YYYY-MM-DD --to=YYYY-MM-DD] [--format=csv|json] [--aggregate=daily|monthly]');
        process.exit(1);
    }

    let startDate, endDate, label;
    if (fromArg && toArg) {
        startDate = fromArg;
        endDate = toArg;
        label = `${fromArg}_to_${toArg}`;
    } else {
        startDate = `${year}-${month.padStart(2, '0')}-01`;
        const lastDay = new Date(year, month, 0).getDate();
        endDate = `${year}-${month.padStart(2, '0')}-${lastDay}`;
        label = `${year}_${month}`;
    }

    console.log(`[EXPORT] Generating billing report for ${tenantId} (${startDate} to ${endDate}) in ${format} format [Agg: ${aggregate}]...`);

    try {
        let stats;
        if (aggregate === 'monthly') {
            const { rows } = await db.query(`
                SELECT 
                    LEFT(date, 7) as period, 
                    SUM(jobs_count) as jobs_count, 
                    SUM(batches_count) as batches_count, 
                    SUM(value_generated) as value_generated, 
                    SUM(hours_saved) as hours_saved, 
                    SUM(risk_reduction) as risk_reduction
                FROM tenant_usage_stats
                WHERE tenant_id = ? AND date >= ? AND date <= ?
                GROUP BY period
                ORDER BY period ASC
            `, [tenantId, startDate, endDate]);
            stats = rows;
        } else {
            const { rows } = await db.query(`
                SELECT date as period, jobs_count, batches_count, value_generated, hours_saved, risk_reduction
                FROM tenant_usage_stats
                WHERE tenant_id = ? AND date >= ? AND date <= ?
                ORDER BY period ASC
            `, [tenantId, startDate, endDate]);
            stats = rows;
        }

        if (stats.length === 0) {
            console.log('[EXPORT] No data found for the specified period.');
            process.exit(0);
        }

        const filename = `billing_${tenantId}_${label}.${format}`;

        if (format === 'json') {
            fs.writeFileSync(filename, JSON.stringify(stats, null, 2));
        } else {
            const headers = [aggregate === 'monthly' ? 'Month' : 'Date', 'Jobs', 'Batches', 'Value Generated (€)', 'Hours Saved', 'Risk Reduction'];
            const rows = stats.map(s => [
                s.period,
                s.jobs_count,
                s.batches_count,
                s.value_generated.toFixed(2),
                s.hours_saved.toFixed(2),
                (s.risk_reduction || 0).toFixed(2)
            ]);
            const csvContent = [headers, ...rows].map(r => r.join(',')).join('\n');
            fs.writeFileSync(filename, csvContent);
        }

        console.log(`[EXPORT] Report saved to ${filename}`);

        // Summary for CLI
        const totalValue = stats.reduce((acc, s) => acc + s.value_generated, 0);
        const totalJobs = stats.reduce((acc, s) => acc + s.jobs_count, 0);
        const totalRiskReduction = stats.reduce((acc, s) => acc + (s.risk_reduction || 0), 0);

        // Find peak period
        const peak = [...stats].sort((a, b) => b.jobs_count - a.jobs_count)[0];

        console.log(`[EXPORT] --- Summary ---`);
        console.log(`[EXPORT] Total Jobs: ${totalJobs}`);
        console.log(`[EXPORT] Total Value: €${totalValue.toFixed(2)}`);
        console.log(`[EXPORT] Risk Reduction Score: ${totalRiskReduction.toFixed(2)}`);
        console.log(`[EXPORT] Peak Usage ${aggregate === 'monthly' ? 'Month' : 'Day'}: ${peak.period} (${peak.jobs_count} jobs)`);

    } catch (err) {
        console.error('[EXPORT] Failed:', err.message);
    } finally {
        process.exit(0);
    }
}

if (require.main === module) {
    exportBilling();
}
