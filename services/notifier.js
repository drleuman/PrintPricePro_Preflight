// services/notifier.js
const db = require('./db');
const { v4: uuidv4 } = require('uuid');
const registry = require('./notificationRegistry');
const queue = require('./queue');

/**
 * Production-grade Notification & Alerting Service (Phase 21.1)
 */
class NotifierService {
    /**
     * Decision engine to notify a tenant about an event.
     * 
     * @param {object} params
     * @param {string} params.tenantId
     * @param {string} params.eventType - e.g. 'quota.80'
     * @param {object} params.payload - Contextual data for the notification
     * @param {string} [params.channelOverride] - Optionally force a channel
     * @param {string} [params.dedupeContext] - Extra string to make dedupe more specific
     */
    async notifyTenantEvent({ tenantId, eventType, payload, channelOverride, dedupeContext = '' }) {
        const config = registry.getEventConfig(eventType);
        if (!config) {
            console.warn(`[NOTIFIER] Unknown event type: ${eventType}`);
            return { status: 'invalid', message: 'Unknown event type' };
        }

        const channel = channelOverride || config.channel;

        try {
            // 1. Check Tenant Preferences
            const { rows: [prefs] } = await db.query(
                'SELECT * FROM tenant_notification_preferences WHERE tenant_id = ?',
                [tenantId]
            );

            // Mapping event type to pref field (basic version)
            const prefField = eventType.replace('.', '_') + '_email';
            if (prefs && prefs[prefField] === 0) {
                console.log(`[NOTIFIER][${tenantId}] ${eventType} suppressed by preference`);
                return { status: 'suppressed', reason: 'User preference' };
            }

            // 2. Compute Dedupe Key
            // e.g. tenant:123:event:quota.80:window:2024-03-07
            const now = new Date();
            const dateStr = now.toISOString().split('T')[0];
            const dedupeKey = `tenant:${tenantId}:event:${eventType}:context:${dedupeContext}:window:${dateStr}`;

            // 3. Check for duplicates in the DB (within the window defined by the registry if we wanted windowed uniqueness)
            // For this phase, we use a simple windowed dedupe_key uniqueness.
            const { rows: [existing] } = await db.query(
                'SELECT id FROM notifications WHERE dedupe_key = ? AND created_at > NOW() - INTERVAL ? HOUR',
                [dedupeKey, config.dedupe_window_hours || 24]
            );

            if (existing) {
                console.log(`[NOTIFIER][${tenantId}] ${eventType} duplicate found, skipping.`);
                return { status: 'duplicate', id: existing.id };
            }

            // 4. Create Notification Record
            const notificationId = uuidv4();
            await db.query(`
                INSERT INTO notifications (
                    id, tenant_id, event_type, channel, status, dedupe_key, subject, payload_json
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                notificationId,
                tenantId,
                eventType,
                channel,
                'PENDING',
                dedupeKey,
                config.subject,
                JSON.stringify(payload)
            ]);

            // 5. Audit Event
            await this.auditNotification(notificationId, 'NOTIFICATION_CREATED', { dedupe_key: dedupeKey });

            // 6. Enqueue for Worker
            await queue.notificationQueue.add('deliver', { notificationId });
            await this.auditNotification(notificationId, 'NOTIFICATION_QUEUED');

            return { status: 'created', id: notificationId };
        } catch (err) {
            console.error('[NOTIFIER] Orchestration failed:', err.message);
            throw err;
        }
    }

    /**
     * Audit trail helper
     */
    async auditNotification(notificationId, event, metadata = {}) {
        try {
            await db.query(`
                INSERT INTO notification_events (notification_id, event, metadata_json)
                VALUES (?, ?, ?)
            `, [notificationId, event, JSON.stringify(metadata)]);
        } catch (err) {
            console.error('[NOTIFIER] Failed to audit notification event:', err.message);
        }
    }

    /**
     * Legacy support for Phase 20 alerts (maintained for compatibility)
     */
    async emitAlert(tenantId, alertType, details = {}) {
        // Map alert type to new event taxonomy if possible, or just log
        console.log(`[NOTIFIER][LEGACY] Emitting alert: ${alertType}`);
        return this.notifyTenantEvent({
            tenantId,
            eventType: alertType.toLowerCase().replace('_', '.'),
            payload: details
        });
    }
}

module.exports = new NotifierService();
