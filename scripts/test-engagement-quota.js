// scripts/test-engagement-quota.js
require('dotenv').config();
const db = require('../services/db');
const engagementEngine = require('../services/engagementEngine');

async function testQuotaEngagement() {
    console.log('--- STARTING QUOTA ENGAGEMENT TEST ---');

    const tenantId = 'engage-quota-' + Date.now();

    try {
        // 1. Setup Tenant with high usage
        console.log(`Setting up test tenant: ${tenantId}`);
        await db.query(`
            INSERT INTO tenants (id, name, quota_usage_percent) 
            VALUES (?, ?, ?)
        `, [tenantId, 'Quota Test Tenant', 85]);

        // 2. Run Evaluator Logic
        console.log('Running Engagement Evaluator for tenant...');
        await engagementEngine.evaluateTenant(tenantId);

        // 3. Verify Results
        const { rows: signals } = await db.query(
            "SELECT * FROM engagement_events WHERE tenant_id = ? AND signal_type = 'quota.80'",
            [tenantId]
        );

        console.log('Engagement Events Created:', signals.length);
        if (signals.length > 0) {
            console.log('SUCCESS: Quota 80% signal triggered automation. ✅');
            console.log('Metadata:', signals[0].metadata_json);
        } else {
            console.error('FAILURE: Quota signal not triggered. ❌');
        }

    } catch (err) {
        console.error('Test failed:', err.message);
    } finally {
        process.exit();
    }
}

testQuotaEngagement();
