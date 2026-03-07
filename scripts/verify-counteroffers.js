/**
 * Verification script for Phase 29 — Counteroffers
 */
const negotiationService = require('../services/negotiationService');
const db = require('../services/db');

async function verifyCounteroffers() {
    console.log('--- STARTING COUNTEROFFER VERIFICATION ---');

    const offerId = 'offer-negotiate-1';

    try {
        console.log('1. Mocking Offer...');
        await db.query(`
            INSERT INTO production_offers (id, job_id, printer_id, machine_id, suggested_price, lead_time_days)
            VALUES (?, 'job-neg-1', 'p1', 'm1', 150.00, 2)
            ON DUPLICATE KEY UPDATE id = id
        `, [offerId]);

        console.log('\n2. Creating Printer Counteroffer...');
        const coId = await negotiationService.createCounteroffer(offerId, 'PRINTER', {
            proposed_price: 175.00,
            proposed_lead_time_days: 3,
            proposed_notes: 'Price adjustment for rush delivery'
        });
        console.log(`- Counteroffer created: ${coId}`);

        console.log('\n3. Verifying Superseding...');
        const coId2 = await negotiationService.createCounteroffer(offerId, 'PRINTER', {
            proposed_price: 180.00,
            proposed_lead_time_days: 4,
            proposed_notes: 'Revised adjustment'
        });

        const { rows: [prevCo] } = await db.query('SELECT counteroffer_status FROM offer_counteroffers WHERE id = ?', [coId]);
        console.log(`- Previous counteroffer status: ${prevCo.counteroffer_status} (Expected: SUPERSEDED)`);

        console.log('\n4. Accepting Counteroffer...');
        await negotiationService.acceptCounteroffer(coId2);

        const { rows: [offer] } = await db.query('SELECT negotiation_status, committed_price FROM production_offers WHERE id = ?', [offerId]);
        console.log(`- Offer status: ${offer.negotiation_status}, Committed Price: ${offer.committed_price}`);

        console.log('\n--- COUNTEROFFER VERIFICATION COMPLETE ---');
    } catch (err) {
        console.error('Verification failed:', err.message);
    }
}

verifyCounteroffers();
