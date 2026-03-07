// scripts/test-email-delivery.js
require('dotenv').config();
const notifier = require('../services/notifier');
const db = require('../services/db');

async function testEmail() {
    console.log('--- STARTING EMAIL DELIVERY TEST ---');

    const tenantId = 'email-test-' + Date.now();

    try {
        // 1. Setup Tenant with Preferences
        console.log(`Setting up test tenant: ${tenantId}`);
        await db.query("INSERT INTO tenants (id, name) VALUES (?, ?)", [tenantId, 'Email Test Tenant']);

        await db.query(`
            INSERT INTO tenant_notification_preferences (tenant_id, event_type, channel, email_recipients_json)
            VALUES (?, 'quota.80', 'email', ?)
        `, [tenantId, JSON.stringify(['test-recipient@example.com'])]);

        // 2. Trigger Event
        console.log('Triggering quota.80 event...');
        const result = await notifier.notifyTenantEvent({
            tenantId,
            eventType: 'quota.80',
            payload: { usage_percent: 85, plan_name: 'Pro', limit: 1000 }
        });

        console.log('Notification created:', result.id);
        console.log('Worker should pick this up. Please ensure worker is running and SMTP is configured.');

    } catch (err) {
        console.error('Test failed:', err.message);
    } finally {
        process.exit();
    }
}

testEmail();
