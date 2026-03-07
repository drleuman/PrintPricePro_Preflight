// scripts/test-notification-retry.js
require('dotenv').config();
const notifier = require('../services/notifier');
const db = require('../services/db');

async function testRetry() {
    console.log('--- STARTING NOTIFICATION RETRY TEST ---');

    const tenantId = 'retry-tenant-' + Date.now();

    try {
        await db.query("INSERT INTO tenants (id, name) VALUES (?, ?)", [tenantId, 'Retry Test Tenant']);

        console.log('Triggering event with simulated failure...');
        const result = await notifier.notifyTenantEvent({
            tenantId,
            eventType: 'tenant.high_usage',
            payload: { simulate_failure: true }
        });

        console.log('Notification created:', result.id);
        console.log('Worker should pick this up and fail. Please wait 5 seconds...');

        await new Promise(resolve => setTimeout(resolve, 5000));

        const { rows: [row] } = await db.query("SELECT status, attempt_count, last_error, scheduled_at FROM notifications WHERE id = ?", [result.id]);

        console.log('Current Status:', row.status);
        console.log('Attempt Count:', row.attempt_count);
        console.log('Last Error:', row.last_error);
        console.log('Next Scheduled At:', row.scheduled_at);

        if (row.status === 'FAILED' && row.attempt_count > 0) {
            console.log('SUCCESS: Retry policy triggered correctly.');
        } else {
            console.error('FAILURE: Notification not moved to FAILED/Retry state. Ensure worker is running.');
        }

    } catch (err) {
        console.error('Test failed:', err.message);
    } finally {
        process.exit();
    }
}

testRetry();
