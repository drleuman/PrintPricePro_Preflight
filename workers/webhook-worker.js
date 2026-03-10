const { Worker } = require('bullmq');
const { connection } = require('../services/queue');
const crypto = require('crypto');

/**
 * Webhook Worker: Processes outgoing webhook requests with HMAC signing and retries.
 */
const webhookWorker = new Worker('webhooks-v2', async (job) => {
    const { url, eventType, payload, secretKey, tenantId } = job.data;
    const body = JSON.stringify({
        event: eventType,
        ...payload,
        sent_at: new Date().toISOString()
    });

    const headers = {
        'Content-Type': 'application/json',
        'User-Agent': 'PrintPrice-Webhooks/1.0',
        'X-PPP-Event': eventType,
        'X-PPP-Delivery-ID': job.id
    };

    // HMAC Signing (if secret exists)
    if (secretKey) {
        const signature = crypto
            .createHmac('sha256', secretKey)
            .update(body)
            .digest('hex');
        headers['X-PPP-Signature'] = `sha256=${signature}`;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000); // 15s timeout

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers,
            body,
            signal: controller.signal
        });

        clearTimeout(timeout);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        console.log(`[WEBHOOK-WORKER] Delivered ${eventType} to ${url} (Job ${job.id})`);
    } catch (err) {
        clearTimeout(timeout);
        console.error(`[WEBHOOK-WORKER] Failed to deliver ${eventType} to ${url} (Attempt ${job.attemptsMade + 1}):`, err.message);
        throw err; // Allow BullMQ to retry based on backoff config
    }
}, {
    connection,
    concurrency: 5,
    limiter: {
        max: 50,
        duration: 1000
    }
});

webhookWorker.on('failed', (job, err) => {
    console.error(`[WEBHOOK-WORKER] Job ${job.id} failed after all retries:`, err.message);
});

module.exports = webhookWorker;
