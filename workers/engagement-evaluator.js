// workers/engagement-evaluator.js
const db = require('../services/db');
const engagementEngine = require('../services/engagementEngine');
const csWorkflowService = require('../services/csWorkflowService');
const { v4: uuidv4 } = require('uuid');

/**
 * Engagement Evaluator Worker (Phase 21.3)
 * Runs periodically to scan all tenants and evaluate automation rules.
 */
async function runEvaluator() {
    console.log('[EVALUATOR] Starting engagement evaluation cycle...');
    const startTime = Date.now();

    try {
        // 1. Fetch all active tenants
        // In a large system, we would batch this or use a queue of tenants.
        // For now, we fetch all.
        const { rows: tenants } = await db.query('SELECT id FROM tenants');
        console.log(`[EVALUATOR] Evaluating ${tenants.length} tenants...`);

        // 2. Evaluate each tenant
        for (const tenant of tenants) {
            await engagementEngine.evaluateTenant(tenant.id);
        }

        // 3. Process pending CS workflow steps
        await csWorkflowService.processPendingSteps();

        const duration = (Date.now() - startTime) / 1000;
        console.log(`[EVALUATOR] Finished evaluation cycle in ${duration}s`);

    } catch (err) {
        console.error('[EVALUATOR] Critical error in evaluation cycle:', err.message);
    }
}

// If run directly, execute once
if (require.main === module) {
    runEvaluator().then(() => {
        console.log('[EVALUATOR] Worker execution finished.');
        process.exit(0);
    });
}

// Export for use in a scheduler (e.g. node-cron or simple setInterval in a server process)
module.exports = {
    runEvaluator
};
