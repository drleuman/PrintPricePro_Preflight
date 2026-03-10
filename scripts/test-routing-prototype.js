// scripts/test-routing-prototype.js
const db = require('../services/db');
const routingService = require('../services/routingService');
const intelligenceService = require('../services/intelligenceService');
const { v4: uuidv4 } = require('uuid');

async function testRouting() {
    console.log('--- Testing Phase 26.1: Routing Prototype ---');

    const tenantId = 'test-tenant';
    const jobId = 'job-routing-' + Date.now();
    const printer1 = uuidv4();
    const printer2 = uuidv4();
    const machineLimit300 = uuidv4();
    const machineLimit350 = uuidv4();

    try {
        // 1. Setup Network Nodes
        console.log('[SETUP] Creating printer nodes...');
        await db.query(`INSERT INTO printer_nodes (id, name, country, city, status) VALUES (?, 'Madrid Offset', 'Spain', 'Madrid', 'ACTIVE')`, [printer1]);
        await db.query(`INSERT INTO printer_nodes (id, name, country, city, status) VALUES (?, 'Lyon Digital', 'France', 'Lyon', 'ACTIVE')`, [printer2]);

        // 2. Setup Machine Profiles
        await db.query(`INSERT INTO machine_profiles (id, name, type, max_tac, min_res_dpi, requires_bleed) VALUES (?, 'KBA Rapida', 'OFFSET', 300, 300, true)`, [machineLimit300]);
        await db.query(`INSERT INTO machine_profiles (id, name, type, max_tac, min_res_dpi, requires_bleed) VALUES (?, 'HP Indigo', 'DIGITAL', 350, 200, false)`, [machineLimit350]);

        // 3. Link Machines to Printers
        await db.query(`INSERT INTO printer_machines (id, printer_id, machine_profile_id, status) VALUES (?, ?, ?, 'UP')`, [uuidv4(), printer1, machineLimit300]);
        await db.query(`INSERT INTO printer_machines (id, printer_id, machine_profile_id, status) VALUES (?, ?, ?, 'UP')`, [uuidv4(), printer2, machineLimit350]);

        // 4. Mock Job Features (TAC = 320, Bleed = NO)
        console.log('[SETUP] Logging job features (TAC=320, Bleed=NO)...');
        await intelligenceService.logJobFeatures(jobId, tenantId, {
            max_tac: 320,
            min_dpi: 300,
            has_bleed: false,
            fonts: []
        });

        // 5. Test Routing Recommendation
        console.log('[TEST] Requesting routing recommendation...');
        const result = await routingService.recommendRoute(jobId, {});

        console.log('\n--- ROUTING RESULT ---');
        console.log('Status:', result.status);
        if (result.recommendation) {
            console.log('Recommended Printer:', result.recommendation.printer);
            console.log('Machine:', result.recommendation.machine);
            console.log('Compatibility Score:', result.recommendation.scores.compatibility);
            console.log('Rationale: Madrid Offset has a TAC penalty and missing bleed penalty, while Lyon Digital handles 350 TAC and no bleed.');
        }

    } catch (err) {
        console.error('[TEST-FAILED]', err.message);
    } finally {
        // Cleanup
        console.log('\n[CLEANUP] Removing test data...');
        await db.query('DELETE FROM printer_machines WHERE printer_id IN (?, ?)', [printer1, printer2]);
        await db.query('DELETE FROM printer_nodes WHERE id IN (?, ?)', [printer1, printer2]);
        await db.query('DELETE FROM machine_profiles WHERE id IN (?, ?)', [machineLimit300, machineLimit350]);
        await db.query('DELETE FROM print_features WHERE tenant_id = ?', [tenantId]);
    }
}

testRouting().then(() => process.exit(0));
