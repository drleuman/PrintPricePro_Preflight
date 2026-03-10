/**
 * Final Integration Test: Phases 32, 33, 34
 */

const { auditBleed, classifyDocument } = require('./services/geometryAuditService');
const Matchmaker = require('./services/routingRecommendationService');

async function runFinalTest() {
    console.log('--- Final Integration Test: Editorial Engines ---');

    const mockGeometry = {
        mediaBox: [0, 0, 595, 842], // A4
        trimBox: [10, 10, 585, 832], // 10pt inset
        bleedBox: [0, 0, 595, 842]   // Matches Media
    };

    // 1. Classification & Spine
    const classification = classifyDocument(mockGeometry, 100);
    console.log('1. Classification (100 pages):');
    console.log(`   - Type: ${classification.type}`);
    console.log(`   - Format: ${classification.format}`);
    console.log(`   - Spine: ${classification.spineMm.toFixed(2)}mm`);

    // 2. Bleed Audit
    const bleed = auditBleed(mockGeometry);
    console.log('2. Bleed Audit:');
    console.log(`   - Status: ${bleed.status}`);
    console.log(`   - Message: ${bleed.message}`);

    // 3. Matchmaking
    const mockPreflight = {
        metrics: { max_tac: 320 },
        classification: { widthMm: 210, heightMm: 297 }
    };

    const candidates = [
        { printer_id: 'P1', printer: 'Digital Press A', max_ink_limit: 300, max_width_mm: 500, max_height_mm: 700, routing_score: 90 },
        { printer_id: 'P2', printer: 'Offset Press B', max_ink_limit: 340, max_width_mm: 720, max_height_mm: 1020, routing_score: 85 }
    ];

    console.log('3. Matchmaking (Document TAC 320%):');
    const filtered = await Matchmaker.filterCandidatesByCapability('job-123', candidates, mockPreflight);

    filtered.forEach(c => {
        console.log(`   - ${c.printer}: Score ${c.routing_score.toFixed(1)} | Reason: ${c.compatibility_reason}`);
    });

    if (filtered.length === 1 && filtered[0].printer_id === 'P2') {
        console.log('✅ Matchmaking Logic Correct: Filtered out P1 due to TAC limit.');
    } else {
        console.warn('⚠️ Matchmaking Logic check failed or unexpected candidates.');
    }

    console.log('\n--- Integration Test Complete ---');
}

runFinalTest();
