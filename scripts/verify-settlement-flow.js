/**
 * Verification script for Phase 31 — Settlement Flow
 */
const settlementService = require('../services/settlementService');
const financialLedgerService = require('../services/financialLedgerService');
const db = require('../services/db');
const crypto = require('crypto');

async function verifySettlementFlow() {
    console.log('--- STARTING SETTLEMENT FLOW VERIFICATION ---');

    const commitmentId = crypto.randomUUID();
    const jobId = 'job-settle-verify-1';

    try {
        console.log('1. Mocking Financial Transaction...');
        await db.query(`
            INSERT INTO commercial_commitments (
                id, transaction_reference, job_id, printer_id, currency, 
                committed_price, committed_production_cost, committed_margin
            ) VALUES (?, 'PPC-SETTLE-001', ?, 'p2', 'EUR', 500.00, 400.00, 100.00)
        `, [commitmentId, jobId]);

        const txId = await financialLedgerService.createFinancialTransaction(commitmentId);

        console.log('2. Executing Settlement Workflow...');
        const result = await settlementService.executeSettlementFlow(txId);
        console.log(`- Settlement executed. Ext Ref: ${result.externalReference}`);

        const finalTx = await financialLedgerService.getTransaction(txId);

        console.log('\n3. Verifying Final State...');
        console.log(`- Status: ${finalTx.transaction_status}`);

        const { rows: inv } = await db.query('SELECT count(*) as count FROM invoices WHERE transaction_id = ?', [txId]);
        console.log(`- Invoices generated: ${inv[0].count}`);

        const { rows: pay } = await db.query('SELECT payout_status FROM payouts WHERE transaction_id = ?', [txId]);
        console.log(`- Payout status: ${pay[0].payout_status}`);

        if (finalTx.transaction_status === 'SETTLED' && pay[0].payout_status === 'COMPLETED') {
            console.log('✅ SETTLEMENT FLOW OK: Transaction finalized.');
        } else {
            console.error('❌ SETTLEMENT FAILED: Final state incorrect.');
        }

        console.log('\n--- SETTLEMENT FLOW VERIFICATION COMPLETE ---');
        process.exit(0);
    } catch (err) {
        console.error('Verification failed:', err.message);
        process.exit(1);
    }
}

verifySettlementFlow();
