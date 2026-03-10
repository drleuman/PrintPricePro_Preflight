// scripts/test-billing-logic.js
require('dotenv').config();
const db = require('../services/db');

async function testBilling() {
    console.log('[TEST] Starting Billing Logic Verification...');

    try {
        // 1. Check if aggregation exists
        const { rows: stats } = await db.query('SELECT COUNT(*) as count FROM tenant_usage_stats');
        console.log(`[TEST] Usage stats records found: ${stats[0].count}`);

        if (stats[0].count === 0) {
            console.warn('[TEST] WARNING: No usage stats found. Run aggregate-usage.js first.');
        }

        // 2. Test Range Query Consistency
        const { rows: tenants } = await db.query('SELECT DISTINCT tenant_id FROM tenant_usage_stats LIMIT 1');
        if (tenants.length > 0) {
            const tId = tenants[0].tenant_id;
            console.log(`[TEST] Testing range consistency for tenant: ${tId}`);

            // Get total for a month (January 2026 example)
            const year = '2026';
            const month = '01';
            const { rows: monthly } = await db.query(`
                SELECT SUM(jobs_count) as total 
                FROM tenant_usage_stats 
                WHERE tenant_id = ? AND date LIKE ?
            `, [tId, `${year}-${month}%`]);

            // Get total using range
            const start = `${year}-${month}-01`;
            const end = `${year}-${month}-31`;
            const { rows: ranged } = await db.query(`
                SELECT SUM(jobs_count) as total 
                FROM tenant_usage_stats 
                WHERE tenant_id = ? AND date BETWEEN ? AND ?
            `, [tId, start, end]);

            if (monthly[0].total === ranged[0].total) {
                console.log(`[TEST] SUCCESS: Monthly vs Ranged totals match (${monthly[0].total})`);
            } else {
                console.error(`[TEST] FAILED: Total mismatch! Monthly: ${monthly[0].total}, Ranged: ${ranged[0].total}`);
            }
        }

        console.log('[TEST] Verification complete.');
    } catch (err) {
        console.error('[TEST] Verification failed:', err.message);
    } finally {
        process.exit(0);
    }
}

testBilling();
