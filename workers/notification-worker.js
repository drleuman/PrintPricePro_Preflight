// workers/notification-worker.js
const { Worker } = require('bullmq');
const db = require('../services/db');
const { connection } = require('../services/queue');
const emailProvider = require('../services/emailProvider');
const webhookProvider = require('../services/webhookProvider');
const templates = require('../notifications/templates');

/**
 * Enhanced Notification Delivery Worker (Phase 21.2)
 */
const notificationWorker = new Worker('notifications-v2', async (job) => {
    const { notificationId } = job.data;
    console.log(`[WORKER-NOTIFY] Processing notification: ${notificationId}`);

    try {
        // 1. Fetch Notification
        const { rows: [notification] } = await db.query(
            'SELECT * FROM notifications WHERE id = ?',
            [notificationId]
        );

        if (!notification) {
            console.error(`[WORKER-NOTIFY] Notification ${notificationId} not found`);
            return;
        }

        if (notification.status !== 'PENDING' && notification.status !== 'FAILED') {
            return;
        }

        // 2. Fetch Tenant Data
        const { rows: [tenant] } = await db.query(
            'SELECT * FROM tenants WHERE id = ?',
            [notification.tenant_id]
        );

        const { rows: [prefs] } = await db.query(
            'SELECT * FROM tenant_notification_preferences WHERE tenant_id = ?',
            [notification.tenant_id]
        );

        // 3. Attempt Delivery
        const deliveryResult = await deliver(notification, tenant, prefs);

        if (deliveryResult.success) {
            await db.query(
                'UPDATE notifications SET status = ?, sent_at = NOW(), attempt_count = attempt_count + 1 WHERE id = ?',
                ['SENT', notificationId]
            );
            await audit(notificationId, `${notification.channel.toUpperCase()}_SENT`, {
                info: deliveryResult.info || 'Delivered successfully',
                response_time: deliveryResult.response_time,
                status_code: deliveryResult.status_code
            });
            console.log(`[WORKER-NOTIFY] Notification ${notificationId} SENT via ${notification.channel}`);
        } else {
            await handleFailure(notification, deliveryResult);
        }
    } catch (err) {
        console.error(`[WORKER-NOTIFY] Critical error processing ${notificationId}:`, err.message);
        throw err;
    }
}, { connection });

/**
 * Real Delivery Logic (Phase 21.2)
 */
async function deliver(notification, tenant, prefs) {
    const { channel, event_type, payload_json, subject, id, tenant_id } = notification;
    const payload = typeof payload_json === 'string' ? JSON.parse(payload_json) : payload_json;

    await audit(id, `${channel.toUpperCase()}_ATTEMPT`, { attempt: notification.attempt_count + 1 });

    if (channel === 'email') {
        try {
            // 1. Prepare recipients
            const recipients = prefs?.email_recipients_json || [];
            const to = Array.isArray(recipients) ? recipients.join(', ') : recipients;

            if (!to) {
                return { success: false, error: 'No email recipients configured for tenant' };
            }

            // 2. Render Template
            const templateKey = event_type.replace('.', '_');
            const data = {
                ...payload,
                tenant_name: tenant?.name || tenant_id,
                dashboard_link: process.env.DASHBOARD_URL || `https://app.printprice.pro/dashboard/${tenant_id}`
            };

            const rendered = templates.render(templateKey, data);

            // 3. Send
            const result = await emailProvider.sendEmail({
                to,
                subject: rendered.subject,
                text: rendered.text,
                html: rendered.html
            });

            return { success: true, info: `Email sent: ${result.messageId}` };
        } catch (err) {
            return { success: false, error: err.message };
        }
    }

    if (channel === 'webhook') {
        const url = tenant?.webhook_url;
        const secret = tenant?.webhook_secret;

        if (!url) {
            return { success: false, error: 'No webhook URL configured for tenant' };
        }

        const result = await webhookProvider.sendWebhook({
            url,
            secret,
            payload,
            eventType: event_type,
            tenantId: tenant_id,
            notificationId: id
        });

        return result;
    }

    return { success: false, error: `Unsupported channel: ${channel}` };
}

/**
 * Retry Policy Logic 
 */
async function handleFailure(notification, result) {
    const retryDelays = [1, 5, 30, 360];
    const nextAttempt = notification.attempt_count + 1;
    const errorMessage = result.error || result.error_message || 'Unknown error';

    const channelPrefix = notification.channel.toUpperCase();
    await audit(notification.id, `${channelPrefix}_FAILED`, {
        error: errorMessage,
        status_code: result.status_code,
        response_time: result.response_time
    });

    if (nextAttempt <= retryDelays.length) {
        const delayMin = retryDelays[nextAttempt - 1];
        const nextRun = new Date(Date.now() + delayMin * 60000);

        await db.query(`
            UPDATE notifications 
            SET status = 'FAILED', 
                attempt_count = ?, 
                last_error = ?, 
                scheduled_at = ? 
            WHERE id = ?
        `, [nextAttempt, errorMessage, nextRun, notification.id]);

        console.log(`[WORKER-NOTIFY] Notification ${notification.id} FAILED (${notification.channel}), retrying in ${delayMin}m`);
    } else {
        await db.query(`
            UPDATE notifications 
            SET status = 'FAILED', 
                attempt_count = ?, 
                last_error = ? 
            WHERE id = ?
        `, [nextAttempt, errorMessage, notification.id]);

        console.error(`[WORKER-NOTIFY] Notification ${notification.id} FATAL FAILURE after ${nextAttempt} attempts`);
    }
}

async function audit(notificationId, event, metadata = {}) {
    await db.query(`
        INSERT INTO notification_events (notification_id, event, metadata_json)
        VALUES (?, ?, ?)
    `, [notificationId, event, JSON.stringify(metadata)]);
}

notificationWorker.on('failed', (job, err) => {
    console.error(`[WORKER-NOTIFY] Job ${job?.id} failed:`, err.message);
});

console.log('[WORKER-NOTIFY] Notification worker ready (Phase 21.2).');

module.exports = notificationWorker;
