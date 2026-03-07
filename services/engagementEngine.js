// services/engagementEngine.js
const db = require('./db');
const notifier = require('./notifier');
const csWorkflowService = require('./csWorkflowService');
const { v4: uuidv4 } = require('uuid');

class EngagementEngine {
    /**
     * Calculate Activity Score for a tenant.
     * ActivityScore = (jobs_last_7d * 1.5) + (jobs_last_30d * 0.5)
     */
    async calculateActivityScore(tenantId) {
        const last7dQuery = `SELECT COUNT(*) as count FROM jobs WHERE tenant_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)`;
        const last30dQuery = `SELECT COUNT(*) as count FROM jobs WHERE tenant_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)`;

        const [res7d, res30d] = await Promise.all([
            db.query(last7dQuery, [tenantId]),
            db.query(last30dQuery, [tenantId])
        ]);

        const jobs7d = res7d.rows[0]?.count || 0;
        const jobs30d = res30d.rows[0]?.count || 0;

        const score = (jobs7d * 1.5) + (jobs30d * 0.5);
        return { score, jobs7d, jobs30d };
    }

    /**
     * Evaluate engagement rules for a single tenant.
     */
    async evaluateTenant(tenantId) {
        console.log(`[ENGAGEMENT] Evaluating tenant: ${tenantId}`);

        try {
            // 1. Fetch Tenant State
            const { rows: [tenant] } = await db.query('SELECT * FROM tenants WHERE id = ?', [tenantId]);
            if (!tenant) return;

            // Fetch Usage & Subscription Data
            const { score, jobs7d, jobs30d } = await this.calculateActivityScore(tenantId);
            const usagePercent = tenant.quota_usage_percent || 0; // Assuming this column exists or is calculated elsewhere

            // 2. Apply Rules

            // RULE: Quota 100
            if (usagePercent >= 100) {
                await this.triggerAutomation(tenantId, 'quota.100', { usage_percent: usagePercent });
            }
            // RULE: Quota 80 (Deduplicated manually by rule frequency in core or engine)
            else if (usagePercent >= 80) {
                await this.triggerAutomation(tenantId, 'quota.80', { usage_percent: usagePercent });
            }

            // RULE: Renewal Reminders (7d / 1d)
            if (tenant.plan_expires_at) {
                const expiresAt = new Date(tenant.plan_expires_at);
                const today = new Date();
                const diffDays = Math.ceil((expiresAt - today) / (1000 * 60 * 60 * 24));

                if (diffDays === 7) {
                    await this.triggerAutomation(tenantId, 'plan.expiry_7d', { expiry_date: tenant.plan_expires_at });
                    await csWorkflowService.startWorkflow(tenantId, 'RENEWAL_RECOVERY', { expiry_date: tenant.plan_expires_at });
                } else if (diffDays === 1) {
                    await this.triggerAutomation(tenantId, 'plan.expiry_1d', { expiry_date: tenant.plan_expires_at });
                } else if (diffDays < 0) {
                    await this.triggerAutomation(tenantId, 'plan.expired', { expiry_date: tenant.plan_expires_at });
                }
            }

            // RULE: High Usage (90% + sustained logic would require history, simple 90% for now)
            if (usagePercent >= 90) {
                await this.triggerAutomation(tenantId, 'tenant.high_usage', { usage_percent: usagePercent });
                await csWorkflowService.startWorkflow(tenantId, 'UPSELL_PATH', { usage_percent: usagePercent });
            }

            // RULE: Churn Risk (jobs_7d == 0 AND jobs_30d > 5)
            if (jobs7d === 0 && jobs30d > 5) {
                await this.triggerAutomation(tenantId, 'tenant.churn_risk', { score, jobs7d, jobs30d });
                await csWorkflowService.startWorkflow(tenantId, 'CHURN_PREVENTION', { score, jobs7d, jobs30d });
            }

        } catch (err) {
            console.error(`[ENGAGEMENT] Error evaluating tenant ${tenantId}:`, err.message);
        }
    }

    /**
     * Trigger an automation action.
     */
    async triggerAutomation(tenantId, eventType, metadata = {}) {
        // Deterministic dedupe key for automation decisions (once per 24h per event type)
        const dateKey = new Date().toISOString().split('T')[0];
        const dedupeKey = `auto:${tenantId}:${eventType}:${dateKey}`;

        // 1. Check if we already took this action today
        const { rows: [existing] } = await db.query(
            'SELECT id FROM engagement_events WHERE tenant_id = ? AND signal_type = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 1 DAY)',
            [tenantId, eventType]
        );

        if (existing) {
            return; // Already triggered in the last 24h
        }

        console.log(`[ENGAGEMENT] Triggering automation: ${eventType} for ${tenantId}`);

        // 2. Record Decision
        const eventId = uuidv4();
        await db.query(`
            INSERT INTO engagement_events (id, tenant_id, signal_type, action_taken, metadata_json)
            VALUES (?, ?, ?, ?, ?)
        `, [eventId, tenantId, eventType, 'NOTIFY', JSON.stringify(metadata)]);

        // 3. Call Notifier
        await notifier.notifyTenantEvent({
            tenantId,
            eventType,
            payload: metadata,
            dedupeKey // Pass same key to notifier for safety
        });
    }
}

module.exports = new EngagementEngine();
