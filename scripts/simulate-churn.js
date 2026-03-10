// scripts/simulate-churn.js
require('dotenv').config();
const db = require('../services/db');

/**
 * Simulate Churn & Update Account Health
 * Marks tenants as AT_RISK and calculates an Intensity/Activity Score.
 */
async function simulateChurn() {
    console.log('[CHURN] Starting churn risk analysis...');

    try {
        // Find active tenants to analyze (exclude already suspended or expired)
        const { rows: tenants } = await db.query(`
            SELECT id, name, last_active_at, status, plan, plan_expires_at 
            FROM tenants 
            WHERE status = 'ACTIVE' 
              AND (plan_expires_at > NOW() OR plan_expires_at IS NULL)
        `);

        console.log(`[CHURN] Analyzing ${tenants.length} active tenants...`);

        for (const t of tenants) {
            // 1. Calculate Activity Score (Weighted last 7d vs 30d intensity)
            const { rows: usage } = await db.query(`
                SELECT 
                    SUM(CASE WHEN date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY) THEN jobs_count ELSE 0 END) as jobs_7d,
                    SUM(jobs_count) as jobs_30d
                FROM tenant_usage_stats
                WHERE tenant_id = ? AND date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
            `, [t.id]);

            const jobs7d = usage[0]?.jobs_7d || 0;
            const jobs30d = usage[0]?.jobs_30d || 0;

            // Weighted Activity Score: (jobs_7d * 1.5) + (jobs_30d * 0.5)
            const activityScore = (jobs7d * 1.5) + (jobs30d * 0.5);

            // 2. Detect Inactivity Churn Risk (>7 days since last activity)
            const isInactive = t.last_active_at && new Date(t.last_active_at).getTime() < new Date().getTime() - 7 * 24 * 60 * 60 * 1000;

            if (isInactive || activityScore < 5) {
                console.log(`[CHURN] ${t.name} (${t.id}) at risk. Score: ${activityScore.toFixed(1)}`);

                await db.query(`
                    INSERT INTO tenant_alerts_history (tenant_id, alert_type, details_json)
                    VALUES (?, ?, ?)
                `, [t.id, 'CHURN_RISK', JSON.stringify({
                    reason: isInactive ? 'Inactivity (>7 days)' : 'Low engagement score',
                    score: activityScore,
                    last_active: t.last_active_at
                })]);
            }
        }

        console.log('[CHURN] Analysis complete.');
    } catch (err) {
        console.error('[CHURN] Analysis failed:', err.message);
    } finally {
        process.exit(0);
    }
}

if (require.main === module) {
    simulateChurn();
}
