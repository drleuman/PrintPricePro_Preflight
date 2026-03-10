// scripts/governance-check.js
require('dotenv').config();
const db = require('../services/db');
const notifier = require('../services/notifier');

/**
 * Daily Governance Job
 * Checks for subscription expiries and churn risks.
 */
async function checkGovernance() {
    console.log('[GOVERNANCE] Starting daily check...');

    try {
        // 1. Check for Subscription Expiries (7 days and 1 day)
        // We use UTC since we enforced Z in db.js
        const { rows: expiring } = await db.query(`
            SELECT id, plan_expires_at, 
                   DATEDIFF(plan_expires_at, UTC_DATE()) as days_left
            FROM tenants
            WHERE status != 'QUARANTINED' 
              AND plan_expires_at IS NOT NULL
              AND DATEDIFF(plan_expires_at, UTC_DATE()) IN (7, 1, 0, -1)
        `);

        for (const tenant of expiring) {
            await notifier.notifyExpiry(tenant.id, tenant.days_left, tenant.plan_expires_at);
        }

        // 2. Churn Risk: Pro users with 0 jobs in last 7 days
        // (Simplified logic for the script)
        const { rows: churnRisks } = await db.query(`
            SELECT t.id 
            FROM tenants t
            LEFT JOIN tenant_usage_stats s ON t.id = s.tenant_id 
              AND s.date >= DATE_SUB(UTC_DATE(), INTERVAL 7 DAY)
            WHERE t.plan IN ('PRO', 'ENTERPRISE')
              AND t.status = 'ACTIVE'
            GROUP BY t.id
            HAVING SUM(COALESCE(s.jobs_count, 0)) = 0
            LIMIT 50
        `);

        for (const tenant of churnRisks) {
            await notifier.emitAlert(tenant.id, 'churn.risk', {
                reason: 'Zero activity in last 7 days for paid plan'
            });
        }

        console.log(`[GOVERNANCE] Check completed. Processed ${expiring.length} expiries and ${churnRisks.length} churn risks.`);
    } catch (err) {
        console.error('[GOVERNANCE] Job failed:', err.message);
    } finally {
        process.exit(0);
    }
}

if (require.main === module) {
    checkGovernance();
}
