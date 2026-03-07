const settlementService = require('./settlementService');
const db = require('./db');

/**
 * Settlement Worker
 * Periodically identifies transactions ready for settlement and executes the workflow.
 */
class SettlementWorker {
    constructor(intervalMs = 15000) {
        this.intervalMs = intervalMs;
        this.isRunning = false;
    }

    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        console.log(`[SETTLEMENT-WORKER] Started with interval ${this.intervalMs}ms`);
        this.poll();
    }

    async poll() {
        while (this.isRunning) {
            try {
                await this.processPendingSettlements();
            } catch (err) {
                console.error('[SETTLEMENT-WORKER] Error in poll cycle:', err.message);
            }
            await new Promise(resolve => setTimeout(resolve, this.intervalMs));
        }
    }

    async processPendingSettlements() {
        // Find transactions that are CREATED (and potentially ready based on job status)
        // In this phase, we look for any transaction in 'CREATED' status.
        const { rows: pending } = await db.query(`
            SELECT id FROM financial_transactions 
            WHERE transaction_status = 'CREATED'
            LIMIT 10
        `);

        if (pending.length > 0) {
            console.log(`[SETTLEMENT-WORKER] Found ${pending.length} transactions pending settlement.`);
            for (const tx of pending) {
                try {
                    await settlementService.executeSettlementFlow(tx.id);
                } catch (err) {
                    console.error(`[SETTLEMENT-WORKER] Failed to process TXN ${tx.id}:`, err.message);
                }
            }
        }
    }

    stop() {
        this.isRunning = false;
        console.log('[SETTLEMENT-WORKER] Stopped.');
    }
}

module.exports = new SettlementWorker();
