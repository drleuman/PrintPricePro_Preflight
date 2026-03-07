// services/csWorkflowService.js
const db = require('./db');
const notifier = require('./notifier');
const { v4: uuidv4 } = require('uuid');

class CSWorkflowService {
    /**
     * Log a workflow event for observability.
     */
    async logEvent(workflowId, eventType, metadata = {}) {
        try {
            await db.query(`
                INSERT INTO cs_workflow_events (workflow_id, event_type, metadata_json)
                VALUES (?, ?, ?)
            `, [workflowId, eventType, JSON.stringify(metadata)]);
        } catch (err) {
            console.error(`[CS-WORKFLOW] Error logging event ${eventType}:`, err.message);
        }
    }

    /**
     * Start a CS workflow for a tenant if one isn't already active for that type.
     */
    async startWorkflow(tenantId, workflowType, initialMetadata = {}) {
        try {
            // 1. Check for active workflow of this type
            const { rows: [active] } = await db.query(
                "SELECT id FROM cs_workflows WHERE tenant_id = ? AND workflow_type = ? AND status = 'ACTIVE'",
                [tenantId, workflowType]
            );

            if (active) {
                console.log(`[CS-WORKFLOW] Workflow ${workflowType} already active for ${tenantId}. Skipping.`);
                return;
            }

            // 2. Create Workflow
            const workflowId = uuidv4();
            await db.query(`
                INSERT INTO cs_workflows (id, tenant_id, workflow_type, status, current_step, metadata_json)
                VALUES (?, ?, ?, 'ACTIVE', 1, ?)
            `, [workflowId, tenantId, workflowType, JSON.stringify(initialMetadata)]);

            console.log(`[CS-WORKFLOW] Started ${workflowType} for ${tenantId}. ID: ${workflowId}`);
            await this.logEvent(workflowId, 'WORKFLOW_STARTED', initialMetadata);

            // 3. Execute First Step
            await this.executeStep(workflowId, 1);

        } catch (err) {
            console.error(`[CS-WORKFLOW] Error starting workflow ${workflowType}:`, err.message);
        }
    }

    /**
     * Execute a specific step in a workflow.
     */
    async executeStep(workflowId, stepNumber) {
        try {
            const { rows: [workflow] } = await db.query('SELECT * FROM cs_workflows WHERE id = ?', [workflowId]);
            if (!workflow || workflow.status !== 'ACTIVE') return;

            const tenantId = workflow.tenant_id;
            const type = workflow.workflow_type;

            console.log(`[CS-WORKFLOW] Executing ${type} step ${stepNumber} for ${tenantId}`);

            let eventType = null;
            let nextActionDays = null;
            let isLastStep = false;

            // Define Workflow Logic
            if (type === 'CHURN_PREVENTION') {
                if (stepNumber === 1) {
                    eventType = 'cs.outreach_1'; // "We miss you"
                    nextActionDays = 3;
                } else if (stepNumber === 2) {
                    eventType = 'cs.outreach_2'; // "Optimization tips"
                    nextActionDays = 4;
                } else if (stepNumber === 3) {
                    eventType = 'cs.outreach_3'; // "Schedule a callback"
                    isLastStep = true;
                }
            } else if (type === 'UPSELL_PATH') {
                if (stepNumber === 1) {
                    eventType = 'cs.upsell_intro'; // "You are crushing it"
                    nextActionDays = 5;
                } else if (stepNumber === 2) {
                    eventType = 'cs.upsell_proposal'; // "Recommended plan upgrade"
                    isLastStep = true;
                }
            } else if (type === 'RENEWAL_RECOVERY') {
                if (stepNumber === 1) {
                    eventType = 'cs.renewal_reminder';
                    isLastStep = true;
                }
            }

            if (eventType) {
                await notifier.notifyTenantEvent({
                    tenantId,
                    eventType,
                    payload: workflow.metadata_json,
                    dedupeKey: `csv:${workflowId}:${stepNumber}`
                });

                await this.logEvent(workflowId, 'STEP_EXECUTED', { stepNumber, eventType });

                // Update Workflow State
                if (isLastStep) {
                    await db.query("UPDATE cs_workflows SET status = 'COMPLETED', last_action_at = NOW() WHERE id = ?", [workflowId]);
                    await this.logEvent(workflowId, 'WORKFLOW_COMPLETED');
                } else {
                    const nextActionAt = nextActionDays ? new Date(Date.now() + nextActionDays * 24 * 60 * 60 * 1000) : null;
                    await db.query(`
                        UPDATE cs_workflows 
                        SET current_step = ?, last_action_at = NOW(), next_action_at = ?
                        WHERE id = ?
                    `, [stepNumber + 1, nextActionAt, workflowId]);
                }
            }

        } catch (err) {
            console.error(`[CS-WORKFLOW] Error executing step ${stepNumber} for ${workflowId}:`, err.message);
        }
    }

    /**
     * Process pending workflow steps (called by worker).
     */
    async processPendingSteps() {
        try {
            const { rows: pending } = await db.query(
                "SELECT id, current_step FROM cs_workflows WHERE status = 'ACTIVE' AND next_action_at <= NOW()"
            );

            for (const item of pending) {
                await this.executeStep(item.id, item.current_step);
            }
        } catch (err) {
            console.error('[CS-WORKFLOW] Error processing pending steps:', err.message);
        }
    }
}

module.exports = new CSWorkflowService();
