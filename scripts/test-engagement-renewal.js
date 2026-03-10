// scripts/test-engagement-renewal.js
require('dotenv').config();
const db = require('../services/db');
const engagementEngine = require('../services/engagementEngine');

async function testRenewalEngagement() {
    console.log('--- STARTING RENEWAL ENGAGEMENT TEST ---');

    const tenantId = 'engage-renew-' + Date.now();
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 7); // Set to 7 days from now

    try {
        // 1. Setup Tenant with expiring plan
        console.log(`Setting up test tenant: ${tenantId} (Expires in 7 days)`);
        await db.query(`
            INSERT INTO tenants (id, name, plan_expires_at) 
            VALUES (?, ?, ?)
        `, [tenantId, 'Renewal Test Tenant', expiryDate.toISOString().split('T')[0]]);

        // 2. Run Evaluator Logic
        console.log('Running Engagement Evaluator for tenant...');
        await engagementEngine.evaluateTenant(tenantId);

        // 3. Verify Results
        const { rows: signals } = await db.query(
            "SELECT * FROM engagement_events WHERE tenant_id = ? AND signal_type = 'plan.expiry_7d'",
            [tenantId]
        );

        console.log('Engagement Events Created:', signals.length);
        if (signals.length > 0) {
            console.log('SUCCESS: Plan expiry reminder triggered. ✅');
        } else {
            console.error('FAILURE: Renewal signal not triggered. ❌');
        }

    } catch (err) {
        console.error('Test failed:', err.message);
    } finally {
        process.exit();
    }
}

testRenewalEngagement();
