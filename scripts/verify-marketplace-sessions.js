/**
 * Verification script for Phase 28.4 — Marketplace Interaction
 */
const marketplaceService = require('../services/marketplaceService');
const db = require('../services/db');

async function verifyMarketplace() {
    console.log('--- STARTING MARKETPLACE VERIFICATION ---');

    const jobId = 'job-market-1';
    const candidates = [
        {
            printer_id: 'p1',
            printer: 'Printer A',
            final_routing_score: 95,
            margin_pct: 35,
            lead_time_days: 2,
            production_cost: 100,
            suggested_price: 154
        },
        {
            printer_id: 'p2',
            printer: 'Printer B',
            final_routing_score: 88,
            margin_pct: 25,
            lead_time_days: 1,
            production_cost: 120,
            suggested_price: 160
        }
    ];

    try {
        console.log('1. Creating Marketplace Session...');
        const sessionId = await marketplaceService.createMarketplaceSession(jobId, 'AUTO');
        console.log(`- Session created: ${sessionId}`);

        console.log('\n2. Generating Offers...');
        const offers = await marketplaceService.generateOffersForSession(sessionId, jobId, candidates);
        console.log(`- Generated ${offers.length} offers`);
        offers.forEach(o => console.log(`  [Rank ${o.offer_rank}] ${o.printer}: Prio Score ${o.priorityScore.toFixed(2)}`));

        console.log('\n3. Testing Auto-Selection...');
        await marketplaceService.selectOffer(sessionId, offers[0].id, 'AUTO');

        const { rows: [selected] } = await db.query('SELECT selected_offer_id, session_status FROM job_marketplace_sessions WHERE id = ?', [sessionId]);
        console.log(`- Session Status: ${selected.session_status}, Selected ID: ${selected.selected_offer_id}`);

        console.log('\n4. Verifying Cancellation of Laggers...');
        const { rows: canceled } = await db.query('SELECT offer_status FROM production_offers WHERE id = ?', [offers[1].id]);
        console.log(`- Other offer status: ${canceled[0].offer_status}`);

        console.log('\n--- VERIFICATION COMPLETE ---');
    } catch (err) {
        console.error('Verification failed:', err.message);
    }
}

verifyMarketplace();
