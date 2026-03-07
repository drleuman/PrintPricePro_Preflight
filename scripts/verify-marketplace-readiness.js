/**
 * Verification script for Phase 29 — Marketplace Readiness
 */
const marketplaceReadinessService = require('../services/marketplaceReadinessService');
const db = require('../services/db');

async function verifyMarketplaceReadiness() {
    console.log('--- STARTING MARKETPLACE READINESS VERIFICATION ---');

    const sessionId = 'session-ready-1';
    const offerId = 'offer-ready-1';

    try {
        console.log('1. Mocking Data...');
        await db.query(`
            INSERT INTO printer_nodes (id, name, currency) 
            VALUES ('p1', 'Printer Alpha', 'EUR')
            ON DUPLICATE KEY UPDATE id = id
        `);
        await db.query(`
            INSERT INTO production_offers (id, job_id, printer_id, machine_id, suggested_price, lead_time_days)
            VALUES (?, 'job-ready-1', 'p1', 'm1', 200.00, 5)
            ON DUPLICATE KEY UPDATE id = id
        `, [offerId]);

        console.log('\n2. Marking Commercially Ready...');
        const commitment = await marketplaceReadinessService.markCommercialReady(sessionId, offerId);
        console.log(`- Commitment reached for printer: ${commitment.printer_name}`);
        console.log(`- Final Committed Price: ${commitment.committed_price} ${commitment.currency}`);

        console.log('\n3. Verifying Session State...');
        const { rows: [session] } = await db.query('SELECT state, selected_offer_id FROM marketplace_session_state WHERE marketplace_session_id = ?', [sessionId]);
        console.log(`- Session State: ${session.state}, Selected Offer: ${session.selected_offer_id}`);

        console.log('\n--- READINESS VERIFICATION COMPLETE ---');
    } catch (err) {
        console.error('Verification failed:', err.message);
    }
}

verifyMarketplaceReadiness();
