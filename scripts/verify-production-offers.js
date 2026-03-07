/**
 * Verification script for Phase 28.3 — Production Offers
 */
const productionOfferService = require('../services/productionOfferService');

async function verifyOffers() {
    console.log('--- STARTING PRODUCTION OFFERS VERIFICATION ---');

    const candidate = {
        printer_id: 'p1',
        machine_id: 'm1',
        quote_id: 'q1',
        production_cost: 100,
        suggested_price: 150,
        estimated_margin: 50,
        margin_pct: 33.3,
        lead_time_days: 3
    };

    try {
        console.log('1. Testing Offer Creation...');
        const offerId = await productionOfferService.createOfferFromRouting('job-123', candidate, 'ra-1', 'ea-1');
        console.log(`- Offer created: ${offerId}`);

        console.log('\n2. Testing Admin Metrics...');
        // We'll simulate checking via DB since we don't have a live Express environment here
        const db = require('../services/db');
        const { rows } = await db.query('SELECT offer_status FROM production_offers WHERE id = ?', [offerId]);
        console.log(`- Offer status: ${rows[0].offer_status}`);

        console.log('\n3. Testing Acceptance Flow...');
        // First move to SENT
        await db.query("UPDATE production_offers SET offer_status = 'SENT' WHERE id = ?", [offerId]);
        await productionOfferService.acceptOffer(offerId);
        const { rows: accepted } = await db.query('SELECT offer_status FROM production_offers WHERE id = ?', [offerId]);
        console.log(`- After acceptance: ${accepted[0].offer_status}`);

        console.log('\n4. Testing Background Expiry...');
        const expiredId = await productionOfferService.createOfferFromRouting('job-expired', candidate, 'ra-2', 'ea-2');
        // Backdate to forced expiry
        await db.query("UPDATE production_offers SET offer_expires_at = TIMESTAMPADD(MINUTE, -20, CURRENT_TIMESTAMP) WHERE id = ?", [expiredId]);
        const count = await productionOfferService.processExpirations();
        console.log(`- Expired count: ${count}`);

        console.log('\n--- VERIFICATION COMPLETE ---');
    } catch (err) {
        console.error('Verification failed:', err.message);
    }
}

verifyOffers();
