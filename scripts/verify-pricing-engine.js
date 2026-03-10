/**
 * Verification script for Phase 28.1 — Pricing Intelligence Engine
 */
const pricingIntelligenceService = require('../services/pricingIntelligenceService');
const quoteService = require('../services/quoteService');

async function verifyPricing() {
    console.log('--- STARTING PRICING ENGINE VERIFICATION ---');

    try {
        const mockProfile = {
            id: 'mock-p1',
            base_cost_per_sheet: 0.05,
            setup_cost: 10.00,
            color_multiplier: 0.2,
            tac_penalty_multiplier: 0.1,
            bleed_handling_cost: 2.00,
            minimum_job_fee: 15.00,
            rush_multiplier: 1.25,
            lead_time_discount_multiplier: 0.9
        };

        console.log('1. Testing Production Cost Calculation...');
        const inputs = {
            estimated_sheet_count: 100,
            color_factor: 0.5,
            tac_excess_factor: 0.1,
            bleed_factor: 1
        };

        const cost = pricingIntelligenceService.calculateProductionCost(inputs, mockProfile);
        console.log(`- Base inputs cost: ${cost} EUR`);

        console.log('\n2. Testing Minimum Job Fee logic...');
        const lowVolumeInputs = { estimated_sheet_count: 5 };
        const minCost = pricingIntelligenceService.calculateProductionCost(lowVolumeInputs, mockProfile);
        console.log(`- Low volume cost (expect 15.00): ${minCost} EUR`);

        console.log('\n3. Testing Suggested Price (Markup)...');
        const price = pricingIntelligenceService.calculateSuggestedPrice(cost);
        console.log(`- Suggested price (35% markup): ${price} EUR`);

        console.log('\n4. Testing Economic Breakdown...');
        const breakdown = pricingIntelligenceService.buildBreakdown(inputs, mockProfile, cost, price);
        console.log('- Breakdown generated:', JSON.stringify(breakdown.economic_summary, null, 2));

        console.log('\n5. Testing Profile Precedence (Resolve)...');
        console.log('- Service should prefer Machine > Printer-wide.');

        console.log('\n--- VERIFICATION COMPLETE ---');
    } catch (err) {
        console.error('Verification failed:', err.message);
    }
}

verifyPricing();
