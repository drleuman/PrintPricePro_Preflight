// scripts/audit-hardener.js
require('dotenv').config();
const db = require('../services/db');

async function auditHardener() {
    console.log('[AUDIT] Starting Platform Consistency Audit...');

    try {
        // 1. Quota Edge Cases Audit
        const { rows: tenants } = await db.query('SELECT id, name, daily_job_limit FROM tenants');
        console.log(`[AUDIT] Auditing ${tenants.length} tenants for quota consistency...`);

        for (const t of tenants) {
            if (t.daily_job_limit === 0) {
                console.warn(`[AUDIT] WARNING: Tenant ${t.name} (${t.id}) has 0 job limit (Hard Stop).`);
            }
        }

        // 2. Timezone / Date Consistency Audit
        const { rows: dbTime } = await db.query('SELECT NOW() as db_now, CURDATE() as db_today');
        const jsNow = new Date();
        const jsToday = jsNow.toISOString().split('T')[0];

        console.log(`[AUDIT] Timezone Sync Check:`);
        console.log(`[AUDIT] DB Now: ${dbTime[0].db_now}`);
        console.log(`[AUDIT] JS Now: ${jsNow.toISOString()}`);
        console.log(`[AUDIT] DB Today: ${dbTime[0].db_today}`);
        console.log(`[AUDIT] JS Today: ${jsToday}`);

        // 3. Billing Range Precision Audit
        console.log(`[AUDIT] Verifying billing range precision (BETWEEN boundary test)...`);
        const { rows: stats } = await db.query('SELECT MIN(date) as min_d, MAX(date) as max_d FROM tenant_usage_stats');
        if (stats[0].min_d) {
            const { rows: total } = await db.query('SELECT SUM(jobs_count) as total FROM tenant_usage_stats');
            const { rows: ranged } = await db.query('SELECT SUM(jobs_count) as total FROM tenant_usage_stats WHERE date BETWEEN ? AND ?', [stats[0].min_d, stats[0].max_d]);

            if (total[0].total === ranged[0].total) {
                console.log(`[AUDIT] Range precision: OK (Boundary matches total).`);
            } else {
                console.warn(`[AUDIT] WARNING: Range mismatch! Total: ${total[0].total}, Ranged: ${ranged[0].total}`);
            }
        }

        console.log('[AUDIT] Audit complete.');
    } catch (err) {
        console.error('[AUDIT] Audit failed:', err.message);
    } finally {
        process.exit(0);
    }
}

auditHardener();
