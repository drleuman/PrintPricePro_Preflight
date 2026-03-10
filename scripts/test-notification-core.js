// scripts/test-notification-core.js
require('dotenv').config();
const notifier = require('../services/notifier');
const db = require('../services/db');

async function testCore() {
    console.log('--- STARTING NOTIFICATION CORE TEST ---');

    const tenantId = 'test-tenant-' + Date.now();

    try {
        // 1. Setup Tenant
        console.log(`Setting up test tenant: ${tenantId}`);
        await db.query("INSERT INTO tenants (id, name) VALUES (?, ?)", [tenantId, 'Test Tenant']);

        // 2. Trigger Event
        console.log('Triggering quota.80 event...');
        const result = await notifier.notifyTenantEvent({
            tenantId,
            eventType: 'quota.80',
            payload: { usage: 800, limit: 1000 }
        });

        console.log('Result:', result);

        if (result.status === 'created') {
            // 3. Verify DB Row
            const { rows: [row] } = await db.query("SELECT * FROM notifications WHERE id = ?", [result.id]);
            console.log('DB Row Created:', row ? 'YES' : 'NO');

            // 4. Verify Audit Trail
            const { rows: events } = await db.query("SELECT * FROM notification_events WHERE notification_id = ?", [result.id]);
            console.log('Audit Events Count:', events.length);
            events.forEach(e => console.log(` - Event: ${e.event}`));
        } else {
            console.error('FAILED to create notification');
        }

    } catch (err) {
        console.error('Test failed:', err.message);
    } finally {
        // Cleanup NOT performed to allow inspection in Dashboard
        console.log('--- TEST FINISHED ---');
        console.log(`Tenant ID left for inspection: ${tenantId}`);
        process.exit();
    }
}

testCore();
