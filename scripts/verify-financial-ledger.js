/**
 * Verification script for Phase 31 — Financial Ledger Integrity
 */
const financialLedgerService = require('../services/financialLedgerService');
const db = require('../services/db');
const crypto = require('crypto');

async function verifyFinancialLedger() {
    console.log('--- STARTING FINANCIAL LEDGER VERIFICATION ---');

    const commitmentId = crypto.randomUUID();
    const jobId = 'job-fin-verify-1';

    try {
        console.log('1. Mocking Commercial Commitment...');
        await db.query(`
            INSERT INTO commercial_commitments (
                id, transaction_reference, job_id, printer_id, currency, 
                committed_price, committed_production_cost, committed_margin
            ) VALUES (?, 'PPC-VERIFY-001', ?, 'p1', 'EUR', 1000.00, 800.00, 200.00)
        `, [commitmentId, jobId]);

        console.log('2. Creating Financial Transaction & Initial Entries...');
        const txId = await financialLedgerService.createFinancialTransaction(commitmentId);
        console.log(`- Transaction created: ${txId}`);

        const tx = await financialLedgerService.getTransaction(txId);

        console.log('\n3. Verifying Ledger Balance (Double-Entry Principle)...');
        let balance = 0;
        tx.ledger.forEach(entry => {
            console.log(`  [${entry.account_type}] ${entry.entry_type}: ${entry.amount} ${entry.currency}`);
            if (entry.entry_type === 'DEBIT') balance += parseFloat(entry.amount);
            if (entry.entry_type === 'CREDIT') balance -= parseFloat(entry.amount);
        });

        if (balance === 0) {
            console.log('✅ BALANCE OK: Sum of Debits and Credits is Zero.');
        } else {
            console.error(`❌ BALANCE ERROR: Residual balance of ${balance}`);
        }

        console.log('\n4. Verifying Commitment Integrity...');
        if (parseFloat(tx.gross_amount) === 1000.00 && parseFloat(tx.platform_fee) === 200.00) {
            console.log('✅ FINANCIAL DATA OK: Values match commitment.');
        } else {
            console.error('❌ DATA MISMATCH: Financial transaction values do not match commitment.');
        }

        console.log('\n--- FINANCIAL LEDGER VERIFICATION COMPLETE ---');
        process.exit(0);
    } catch (err) {
        console.error('Verification failed:', err.message);
        process.exit(1);
    }
}

verifyFinancialLedger();
