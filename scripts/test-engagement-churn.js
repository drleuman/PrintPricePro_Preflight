// scripts/test-engagement-churn.js
require('dotenv').config();
const db = require('../services/db');
const engagementEngine = require('../services/engagementEngine');

async function testChurnEngagement() {
    console.log('--- STARTING CHURN ENGAGEMENT TEST ---');

    const tenantId = 'engage-churn-' + Date.now();

    try {
        // 1. Setup Tenant
        console.log(`Setting up test tenant: ${tenantId}`);
        await db.query("INSERT INTO tenants (id, name) VALUES (?, ?)", [tenantId, 'Churn Test Tenant']);

        // 2. Mock Jobs (None in last 7d, 10 in last 30d)
        console.log('Mocking job history (high past activity, zero recent activity)...');
        const oldDate = new Date();
        oldDate.setDate(oldDate.getDate() - 15);

        for (let i = 0; i < 10; i++) {
            await db.query("INSERT INTO jobs (id, tenant_id, created_at) VALUES (?, ?, ?)", [Date.now() + i, tenantId, oldDate]);
        }

        // 3. Run Evaluator Logic
        console.log('Running Engagement Evaluator for tenant...');
        await engagementEngine.evaluateTenant(tenantId);

        // 4. Verify Results
        const { rows: signals } = await db.query(
            "SELECT * FROM engagement_events WHERE tenant_id = ? AND signal_type = 'tenant.churn_risk'",
            [tenantId]
        );

        console.log('Engagement Events Created:', signals.length);
        if (signals.length > 0) {
            console.log('SUCCESS: Churn risk detected correctly. ✅');
            console.log('Score Data:', signals[0].metadata_json);
        } else {
            console.error('FAILURE: Churn risk not detected. ❌');
        }

    } catch (err) {
        console.error('Test failed:', err.message);
    } finally {
        process.exit();
    }
}

testChurnEngagement();
