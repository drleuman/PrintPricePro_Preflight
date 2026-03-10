/**
 * Verification script for Phase 29.1 — Commercial Commitments
 */
const commercialCommitmentService = require('../services/commercialCommitmentService');
const settlementReadinessService = require('../services/settlementReadinessService');
const db = require('../services/db');

async function verifyCommercialCommitments() {
    console.log('--- STARTING COMMERCIAL COMMITMENT VERIFICATION ---');

    const sessionId = 'session-cc-test-1';
    const offerId = 'offer-cc-test-1';

    try {
        console.log('1. Mocking Commercially Ready Session...');
        await db.query(`
            INSERT INTO production_offers (id, job_id, printer_id, machine_id, suggested_price, production_cost, margin_pct, lead_time_days)
            VALUES (?, 'job-cc-1', 'p1', 'm1', 250.00, 200.00, 20.0, 5)
            ON DUPLICATE KEY UPDATE id = id
        `, [offerId]);

        const commitmentMetadata = {
            printer_id: 'p1',
            offer_id: offerId,
            committed_price: 250.00,
            currency: 'EUR',
            committed_lead_time_days: 5
        };

        await db.query(`
            INSERT INTO marketplace_session_state (id, marketplace_session_id, state, selected_offer_id, commercial_commitment_json)
            VALUES ('mss1', ?, 'COMMERCIALLY_READY', ?, ?)
            ON DUPLICATE KEY UPDATE state = 'COMMERCIALLY_READY'
        `, [sessionId, offerId, JSON.stringify(commitmentMetadata)]);

        console.log('\n2. Creating Commitment...');
        const commitmentId = await commercialCommitmentService.createCommitmentFromSession(sessionId);
        const commitment = await commercialCommitmentService.getCommitment(commitmentId);
        console.log(`- Commitment created: ${commitment.id}`);
        console.log(`- Transaction Ref: ${commitment.transaction_reference}`);
        console.log(`- Status: ${commitment.commercial_commitment_status}`);

        console.log('\n3. Building Settlement Placeholder...');
        await settlementReadinessService.buildSettlementPlaceholder(commitmentId);
        const { rows: [detail] } = await db.query('SELECT * FROM settlement_placeholders WHERE commercial_commitment_id = ?', [commitmentId]);
        console.log(`- Payable to Printer: ${detail.payable_to_printer}`);
        console.log(`- Platform Fee: ${detail.platform_fee}`);

        console.log('\n4. Locking Commitment...');
        await commercialCommitmentService.lockCommitment(commitmentId);
        await settlementReadinessService.recomputeSettlementState(commitmentId);

        const finalCC = await commercialCommitmentService.getCommitment(commitmentId);
        console.log(`- Final Status: ${finalCC.commercial_commitment_status}`);
        console.log(`- Settlement Readiness: ${finalCC.settlement_readiness_status}`);

        console.log('\n--- COMMERCIAL COMMITMENT VERIFICATION COMPLETE ---');
    } catch (err) {
        console.error('Verification failed:', err.message);
    }
}

verifyCommercialCommitments();
