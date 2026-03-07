// scripts/test-notification-dedupe.js
require('dotenv').config();
const notifier = require('../services/notifier');
const db = require('../services/db');

async function testDedupe() {
    console.log('--- STARTING NOTIFICATION DEDUPE TEST ---');

    const tenantId = 'dedupe-tenant-' + Date.now();

    try {
        await db.query("INSERT INTO tenants (id, name) VALUES (?, ?)", [tenantId, 'Dedupe Test Tenant']);

        console.log('Triggering first event...');
        const res1 = await notifier.notifyTenantEvent({
            tenantId,
            eventType: 'quota.100',
            payload: { usage: 1000, limit: 1000 }
        });
        console.log('First Attempt Status:', res1.status);

        console.log('Triggering duplicate event...');
        const res2 = await notifier.notifyTenantEvent({
            tenantId,
            eventType: 'quota.100',
            payload: { usage: 1005, limit: 1000 }
        });
        console.log('Second Attempt Status:', res2.status);

        if (res1.status === 'created' && res2.status === 'duplicate') {
            console.log('SUCCESS: Deduplication logic verified.');
        } else {
            console.error('FAILURE: Unexpected dedupe behavior.');
        }

    } catch (err) {
        console.error('Test failed:', err.message);
    } finally {
        process.exit();
    }
}

testDedupe();
