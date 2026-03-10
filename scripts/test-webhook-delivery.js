// scripts/test-webhook-delivery.js
const axios = require('axios');
const crypto = require('crypto');
const express = require('express');
require('dotenv').config();
const notifier = require('../services/notifier');
const db = require('../services/db');

async function testWebhook() {
    console.log('--- STARTING WEBHOOK DELIVERY TEST ---');

    const port = 9999;
    const secret = 'pp_secret_123';
    const app = express();
    app.use(express.json());

    // 1. Mock Webhook Receiver
    const server = app.post('/webhook', (req, res) => {
        const signature = req.headers['x-printprice-signature'];
        console.log('\n[MOCK-RECEIVER] Received webhook!');
        console.log('[MOCK-RECEIVER] Signature:', signature);
        console.log('[MOCK-RECEIVER] Body:', JSON.stringify(req.body, null, 2));

        // Verify Signature
        const expectedHash = crypto.createHmac('sha256', secret)
            .update(JSON.stringify(req.body))
            .digest('hex');

        if (signature === `sha256=${expectedHash}`) {
            console.log('[MOCK-RECEIVER] Signature VALID ✅');
            res.status(200).send('OK');
        } else {
            console.error('[MOCK-RECEIVER] Signature INVALID ❌');
            console.log('[MOCK-RECEIVER] Expected:', `sha256=${expectedHash}`);
            res.status(401).send('Invalid Signature');
        }
    });

    const expressServer = app.listen(port);
    console.log(`[MOCK-RECEIVER] Listening on http://localhost:${port}/webhook`);

    const tenantId = 'webhook-test-' + Date.now();

    try {
        // 2. Setup Tenant with Webhook
        console.log(`Setting up test tenant: ${tenantId}`);
        await db.query(`
            INSERT INTO tenants (id, name, webhook_url, webhook_secret) 
            VALUES (?, ?, ?, ?)
        `, [tenantId, 'Webhook Test Tenant', `http://localhost:${port}/webhook`, secret]);

        await db.query(`
            INSERT INTO tenant_notification_preferences (tenant_id, event_type, channel)
            VALUES (?, 'quota.100', 'webhook')
        `, [tenantId]);

        // 3. Trigger Event
        console.log('Triggering quota.100 event...');
        const result = await notifier.notifyTenantEvent({
            tenantId,
            eventType: 'quota.100',
            payload: { usage_percent: 100, plan_name: 'Enterprise' }
        });

        console.log('Notification created:', result.id);
        console.log('Waiting 5 seconds for worker processing...');
        await new Promise(r => setTimeout(r, 5000));

    } catch (err) {
        console.error('Test failed:', err.message);
    } finally {
        expressServer.close();
        console.log('--- TEST FINISHED ---');
        process.exit();
    }
}

testWebhook();
