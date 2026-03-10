// scripts/test-graph-schema.js
const db = require('../services/db');
const intelligenceService = require('../services/intelligenceService');
const { v4: uuidv4 } = require('uuid');

async function testScoring() {
    console.log('--- Testing Intelligence Graph Scoring Engine ---');

    const mId = uuidv4();
    const pId = uuidv4();
    const paperId = uuidv4();
    const fId = uuidv4();

    try {
        // 1. Setup Mock Machine
        await db.query(`
            INSERT INTO machine_profiles (id, name, type, max_tac, min_res_dpi, requires_bleed)
            VALUES (?, 'Heidelberg Offset', 'OFFSET', 300, 300, true)
        `, [mId]);

        // 2. Setup Mock Paper
        await db.query(`
            INSERT INTO paper_profiles (id, name, weight, absorption_coefficient, icc_profile)
            VALUES (?, 'Coated Glossy 150g', 150, 0.05, 'iso_coated_v3')
        `, [paperId]);

        // 3. Setup Mock Policy
        await db.query(`
            INSERT INTO policy_constraints (id, policy_name, tac_limit, min_dpi, bleed_required)
            VALUES (?, 'HIGH_QUALITY_STRICT', 320, 300, true)
        `, [pId]);

        const scenarios = [
            {
                name: 'Scenario A: Perfect Match',
                features: { max_tac: 280, min_dpi: 350, has_bleed: true, color_profile: 'iso_coated_v3' }
            },
            {
                name: 'Scenario B: TAC Violation (-30)',
                features: { max_tac: 310, min_dpi: 350, has_bleed: true, color_profile: 'iso_coated_v3' }
            },
            {
                name: 'Scenario C: Missing Bleed (-40)',
                features: { max_tac: 280, min_dpi: 350, has_bleed: false, color_profile: 'iso_coated_v3' }
            },
            {
                name: 'Scenario D: Low Resolution (-25)',
                features: { max_tac: 280, min_dpi: 150, has_bleed: true, color_profile: 'iso_coated_v3' }
            },
            {
                name: 'Scenario E: Multiple Penalties (TAC + Bleed = 30 points remaining)',
                features: { max_tac: 310, min_dpi: 350, has_bleed: false, color_profile: 'iso_coated_v3' }
            }
        ];

        for (const s of scenarios) {
            console.log(`\n[TEST] ${s.name}`);

            // Log features for this scenario
            const fUuid = uuidv4();
            await intelligenceService.logJobFeatures('job-' + fUuid, 'tenant-1', {
                max_tac: s.features.max_tac,
                min_dpi: s.features.min_dpi,
                has_bleed: s.features.has_bleed,
                color_profile: s.features.color_profile,
                fonts: []
            });

            // The logJobFeatures uses uuidv4 for ID internally, we need to fetch it or modify service to return it.
            // For test simplicity, let's query the last one.
            const { rows } = await db.query('SELECT id FROM print_features ORDER BY created_at DESC LIMIT 1');
            const featureId = rows[0].id;

            const result = await intelligenceService.calculateCompatibilityScore(featureId, mId, paperId, pId);
            console.log(`Score: ${result.score}`);
            if (result.penalties.length > 0) {
                console.log('Penalties:', result.penalties);
            }
        }

    } catch (err) {
        console.error('[TEST-FAILED]', err.message);
    } finally {
        // Cleanup
        await db.query('DELETE FROM machine_profiles WHERE id = ?', [mId]);
        await db.query('DELETE FROM paper_profiles WHERE id = ?', [paperId]);
        await db.query('DELETE FROM policy_constraints WHERE id = ?', [pId]);
        await db.query('DELETE FROM print_features WHERE tenant_id = "tenant-1"');
    }
}

testScoring().then(() => process.exit(0));
