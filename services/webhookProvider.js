// services/webhookProvider.js
const axios = require('axios');
const crypto = require('crypto');

class WebhookProvider {
    /**
     * Send a signed webhook notification.
     */
    async sendWebhook({ url, secret, payload, eventType, tenantId, notificationId }) {
        if (!url) throw new Error('Webhook URL is required');

        const timestamp = new Date().toISOString();
        const body = {
            event_type: eventType,
            tenant_id: tenantId,
            notification_id: notificationId,
            timestamp,
            payload
        };

        const jsonBody = JSON.stringify(body);
        const signature = this.generateSignature(jsonBody, secret);

        try {
            const startTime = Date.now();
            const response = await axios.post(url, body, {
                headers: {
                    'Content-Type': 'application/json',
                    'X-PrintPrice-Signature': `sha256=${signature}`
                },
                timeout: 5000 // 5s timeout protection
            });

            const responseTime = Date.now() - startTime;

            return {
                success: true,
                status_code: response.status,
                response_time: responseTime,
                response_data: response.data
            };
        } catch (err) {
            const responseTime = err.config ? (Date.now() - err.config.metadata?.startTime || 0) : 0;

            return {
                success: false,
                status_code: err.response?.status || 0,
                error_message: err.message,
                response_time: responseTime
            };
        }
    }

    /**
     * Compute HMAC SHA256 signature.
     */
    generateSignature(payload, secret) {
        if (!secret) return 'unsigned'; // Or throw if required
        return crypto
            .createHmac('sha256', secret)
            .update(payload)
            .digest('hex');
    }
}

module.exports = new WebhookProvider();
