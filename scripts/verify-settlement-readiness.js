/**
 * Verification script for Settlement Readiness
 */
const commercialCommitmentService = require('../services/commercialCommitmentService');
const settlementReadinessService = require('../services/settlementReadinessService');
const db = require('../services/db');

async function verifySettlementReadiness() {
    console.log('--- STARTING SETTLEMENT READINESS VERIFICATION ---');

    const commitmentId = 'sr-test-target-1';

    try {
        console.log('1. Constructing Commitment...');
        await db.query(`
            INSERT INTO commercial_commitments (
                id, job_id, printer_id, machine_id, committed_price, committed_production_cost,
                committed_margin, committed_margin_pct, committed_lead_time_days,
                commercial_commitment_status, settlement_readiness_status, transaction_reference
            ) VALUES (?, 'job-sr-1', 'p1', 'm1', 300.00, 240.00, 60.00, 20.0, 3, 'READY', 'NOT_READY', 'PPC-TEST-SR-001')
            ON DUPLICATE KEY UPDATE id = id
        `, [commitmentId]);

        console.log('\n2. Building Placeholder...');
        await settlementReadinessService.buildSettlementPlaceholder(commitmentId);

        const { rows: [cc] } = await db.query('SELECT settlement_readiness_status FROM commercial_commitments WHERE id = ?', [commitmentId]);
        console.log(`- Status after placeholder build: ${cc.settlement_readiness_status} (Expected: READY_FOR_INVOICE)`);

        console.log('\n3. Locking Commitment...');
        await commercialCommitmentService.lockCommitment(commitmentId);
        await settlementReadinessService.recomputeSettlementState(commitmentId);

        const { rows: [ccFinal] } = await db.query('SELECT settlement_readiness_status FROM commercial_commitments WHERE id = ?', [commitmentId]);
        console.log(`- Status after lock: ${ccFinal.settlement_readiness_status} (Expected: READY_FOR_PAYOUT)`);

        console.log('\n4. Verifying Event Log...');
        const { rows: events } = await db.query('SELECT event_type FROM commercial_commitment_events WHERE commercial_commitment_id = ?', [commitmentId]);
        console.log(`- Events recorded: ${events.map(e => e.event_type).join(', ')}`);

        console.log('\n--- SETTLEMENT READINESS VERIFICATION COMPLETE ---');
    } catch (err) {
        console.error('Verification failed:', err.message);
    }
}

verifySettlementReadiness();
