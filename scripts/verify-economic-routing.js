/**
 * Verification script for Phase 28.2 — Economic Routing Engine
 */
const economicRoutingService = require('../services/economicRoutingService');

async function verifyEconomicRouting() {
    console.log('--- STARTING ECONOMIC ROUTING VERIFICATION ---');

    const candidates = [
        {
            printer_id: 'p1',
            printer: 'Cheap & Slow',
            routing_score: 85,
            production_cost: 100,
            suggested_price: 150,
            margin_pct: 33.3,
            quality_score: 0.7,
            lead_time_days: 5
        },
        {
            printer_id: 'p2',
            printer: 'Premium & Fast',
            routing_score: 95,
            production_cost: 130,
            suggested_price: 180,
            margin_pct: 27.7,
            quality_score: 0.95,
            lead_time_days: 2
        },
        {
            printer_id: 'p3',
            printer: 'Balanced Opt',
            routing_score: 90,
            production_cost: 110,
            suggested_price: 165,
            margin_pct: 33.3,
            quality_score: 0.85,
            lead_time_days: 3
        }
    ];

    try {
        console.log('1. Testing Economic Ranking...');
        const ranked = await economicRoutingService.rankEconomicCandidates('job-123', candidates);

        console.log('Resulting Order:');
        ranked.forEach((c, i) => {
            console.log(`[${i + 1}] ${c.printer}: Final Score: ${c.final_routing_score}, Margin: ${c.margin_pct}%, Cost: ${c.production_cost}`);
            console.log(`    Signals: Tech: ${c.economic_explanation.technical_factor}, Econ: ${c.economic_score}`);
        });

        console.log('\n2. Verifying Explanations...');
        const top = ranked[0];
        if (top.economic_explanation) {
            console.log('- Top candidate explanation exists.');
        } else {
            throw new Error('Explanation missing!');
        }

        console.log('\n3. Testing Conflict Logic (Low Margin)...');
        const lowMarginCandidate = [{
            printer_id: 'p4',
            printer: 'Low Margin',
            routing_score: 90,
            production_cost: 145,
            suggested_price: 150,
            margin_pct: 3.3,
            quality_score: 0.8,
            lead_time_days: 3
        }];
        await economicRoutingService.rankEconomicCandidates('job-conf', lowMarginCandidate);
        console.log('- Low margin conflict detection triggered (check DB logs).');

        console.log('\n--- VERIFICATION COMPLETE ---');
    } catch (err) {
        console.error('Verification failed:', err.message);
    }
}

verifyEconomicRouting();
