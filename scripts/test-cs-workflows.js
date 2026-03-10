// scripts/test-cs-workflows.js
const db = require('../services/db');
const csWorkflowService = require('../services/csWorkflowService');
const engagementEngine = require('../services/engagementEngine');
const { v4: uuidv4 } = require('uuid');

async function testCSWorkflows() {
    console.log('--- Testing CS Workflows ---');
    const testTenantId = 'test-tenant-cs-' + Date.now();

    try {
        // 1. Setup Test Tenant
        await db.query(`
            INSERT INTO tenants (id, name, status, plan, created_at)
            VALUES (?, 'CS Test Tenant', 'ACTIVE', 'PRO', NOW())
        `, [testTenantId]);

        console.log('1. Tenant created:', testTenantId);

        // 2. Trigger a signal that should start a workflow
        // Churn risk: jobs7d = 0, jobs30d = 10 (simulated)
        // We call the service directly to verify initiation
        await csWorkflowService.startWorkflow(testTenantId, 'CHURN_PREVENTION', { score: 5, jobs7d: 0, jobs30d: 10 });

        // 3. Verify Workflow Initiation
        const { rows: [wf] } = await db.query(
            "SELECT * FROM cs_workflows WHERE tenant_id = ? AND workflow_type = 'CHURN_PREVENTION'",
            [testTenantId]
        );

        if (wf && wf.status === 'ACTIVE' && wf.current_step === 2) {
            console.log('2. SUCCESS: Workflow started and moved to Step 1 (current_step updated to 2)');
        } else {
            console.error('2. FAILED: Workflow not found or at wrong step:', wf);
            return;
        }

        // 4. Force next_action_at to NOW() to simulate time passing
        await db.query("UPDATE cs_workflows SET next_action_at = NOW() WHERE id = ?", [wf.id]);
        console.log('3. Time simulated: next_action_at set to NOW()');

        // 5. Run processPendingSteps
        await csWorkflowService.processPendingSteps();

        // 6. Verify Progression
        const { rows: [wfUpdated] } = await db.query("SELECT * FROM cs_workflows WHERE id = ?", [wf.id]);
        if (wfUpdated.current_step === 3) {
            console.log('4. SUCCESS: Workflow progressed to Step 2 (current_step updated to 3)');
        } else {
            console.error('4. FAILED: Workflow did not progress:', wfUpdated);
        }

        // Cleanup
        // await db.query('DELETE FROM cs_workflows WHERE id = ?', [wf.id]);
        // await db.query('DELETE FROM tenants WHERE id = ?', [testTenantId]);
        console.log('--- Test Finished ---');

    } catch (err) {
        console.error('Test error:', err.message);
    }
}

testCSWorkflows().then(() => process.exit(0));
