// scripts/simulate-engagement.js
const db = require('../services/db');
const engagementEngine = require('../services/engagementEngine');
const csWorkflowService = require('../services/csWorkflowService');

async function simulate() {
    const args = process.argv.slice(2);
    const type = args.includes('--type') ? args[args.indexOf('--type') + 1] : 'high_usage';
    const tenantId = args.includes('--tenant') ? args[args.indexOf('--tenant') + 1] : 'test-tenant-' + Date.now();

    console.log(`--- CS Engagement Simulation: ${type} ---`);

    try {
        // 1. Ensure tenant exists
        const { rows: [existing] } = await db.query('SELECT id FROM tenants WHERE id = ?', [tenantId]);
        if (!existing) {
            await db.query(`
                INSERT INTO tenants (id, name, status, plan, created_at)
                VALUES (?, ?, 'ACTIVE', 'PRO', NOW())
            `, [tenantId, `Simulated ${tenantId}`]);
            console.log(`[SIM] Created tenant: ${tenantId}`);
        }

        if (type === 'high_usage') {
            console.log('[SIM] Simulating 95% quota usage...');
            // In a real simulation we'd insert jobs, here we override the engine trigger for efficiency
            await engagementEngine.triggerAutomation(tenantId, 'tenant.high_usage', { usage_percent: 95 });
            await csWorkflowService.startWorkflow(tenantId, 'UPSELL_PATH', { usage_percent: 95 });
        } else if (type === 'churn') {
            console.log('[SIM] Simulating churn risk (0 jobs last 7d)...');
            await engagementEngine.triggerAutomation(tenantId, 'tenant.churn_risk', { jobs7d: 0, jobs30d: 50 });
            await csWorkflowService.startWorkflow(tenantId, 'CHURN_PREVENTION', { score: 1, jobs7d: 0, jobs30d: 50 });
        }

        console.log('[SIM] Simulation complete. Checking logs...');

        const { rows: workflows } = await db.query(
            "SELECT * FROM cs_workflows WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 1",
            [tenantId]
        );

        if (workflows.length > 0) {
            const wf = workflows[0];
            const { rows: events } = await db.query(
                "SELECT * FROM cs_workflow_events WHERE workflow_id = ? ORDER BY created_at ASC",
                [wf.id]
            );
            console.log(`[SIM] Workflow ${wf.workflow_type} is ${wf.status}. Events logged: ${events.length}`);
            events.forEach(e => console.log(`  - [${e.created_at}] ${e.event_type}`));
        }

    } catch (err) {
        console.error('[SIM] Error:', err.message);
    }
}

simulate().then(() => process.exit(0));
