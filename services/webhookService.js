const db = require('./db');
const { webhookQueue } = require('./queue');

/**
 * Dispatches a webhook event to all active listeners for a given tenant + event type.
 * Enqueues jobs to BullMQ for reliable delivery, retries, and HMAC signing.
 *
 * @param {string} tenantId - The tenant whose webhooks to call.
 * @param {string} eventType - e.g. 'job.completed', 'job.failed', 'job.canceled'
 * @param {object} payload - The data to send in the webhook body.
 */
async function dispatchWebhook(tenantId, eventType, payload) {
    try {
        const { rows: hooks } = await db.query(
            'SELECT url, secret_key FROM webhooks WHERE tenant_id = ? AND event_type = ? AND active = TRUE',
            [tenantId, eventType]
        );

        if (hooks.length === 0) return;

        const dispatches = hooks.map(hook => {
            return webhookQueue.add(eventType, {
                url: hook.url,
                eventType,
                payload,
                secretKey: hook.secret_key,
                tenantId
            }, {
                attempts: 5,
                backoff: {
                    type: 'exponential',
                    delay: 10_000, // 10s base backoff
                },
                removeOnComplete: true,
                removeOnFail: false,
            });
        });

        await Promise.all(dispatches);
    } catch (err) {
        console.error('[WEBHOOK-DISPATCH] Failed to enqueue webhooks:', err.message);
    }
}

module.exports = { dispatchWebhook };
