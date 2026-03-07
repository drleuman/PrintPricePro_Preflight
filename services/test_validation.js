require('dotenv').config();
const db = require('./db');
const connectService = require('./connectService');
const capacityService = require('./capacityService');
const printerRegistry = require('./printerRegistry');
const routingService = require('./routingService');
const intelligenceService = require('./intelligenceService');
const { v4: uuidv4 } = require('uuid');

async function test() {
    console.log('--- STARTING ONBOARDING & ROUTING VALIDATION ---');

    try {
        // 1. Ensure Machine Profiles exist
        const heidelbergProfileId = uuidv4();
        const hpIndigoProfileId = uuidv4();

        await db.query(`INSERT INTO machine_profiles (id, name, type, max_tac, min_res_dpi, requires_bleed) 
            VALUES (?, 'Heidelberg XL75', 'OFFSET', 300, 250, true)`, [heidelbergProfileId]);

        await db.query(`INSERT INTO machine_profiles (id, name, type, max_tac, min_res_dpi, requires_bleed) 
            VALUES (?, 'HP Indigo', 'DIGITAL', 320, 200, false)`, [hpIndigoProfileId]);

        console.log('Created machine profiles.');

        // 2. Onboard Node A (Madrid Offset)
        const nodeA = await connectService.createPrinterNode({
            name: 'Madrid Offset',
            legal_name: 'Madrid Offset S.L.',
            vat_id: 'ESB12345678',
            website: 'https://madrid-offset.com',
            country: 'Spain',
            city: 'Madrid',
            contact: { name: 'Juan Perez', email: 'juan@madrid-offset.com', role: 'Production Manager' }
        });
        await db.query("UPDATE printer_nodes SET status = 'ACTIVE' WHERE id = ?", [nodeA.id]);

        // Add machine to Node A
        await printerRegistry.registerMachine(nodeA.id, {
            machineProfileId: heidelbergProfileId,
            nickname: 'XL75-Main',
            capacityIndex: 1.0
        });

        // Add capacity for Node A
        const today = new Date().toISOString().split('T')[0];
        await capacityService.updateCapacity(nodeA.id, today, {
            total: 1.0,
            available: 0.6,
            leadTimeDays: 2
        });

        console.log('Node A Onboarded (Madrid Offset). Connect Status:', (await connectService.getPrinterProfile(nodeA.id)).connect_status);

        // 3. Onboard Node B (Lisbon Digital)
        const nodeB = await connectService.createPrinterNode({
            name: 'Lisbon Digital',
            legal_name: 'Lisbon Digital LDA',
            vat_id: 'PT500600700',
            website: 'https://lisbon-digital.pt',
            country: 'Portugal',
            city: 'Lisbon',
            contact: { name: 'Maria Silva', email: 'maria@lisbon-digital.pt', role: 'Owner' }
        });
        await db.query("UPDATE printer_nodes SET status = 'ACTIVE' WHERE id = ?", [nodeB.id]);

        // Add machine to Node B
        await printerRegistry.registerMachine(nodeB.id, {
            machineProfileId: hpIndigoProfileId,
            nickname: 'Indigo-HQ',
            capacityIndex: 1.0
        });

        // Add capacity for Node B
        await capacityService.updateCapacity(nodeB.id, today, {
            total: 1.0,
            available: 0.8,
            leadTimeDays: 1
        });

        console.log('Node B Onboarded (Lisbon Digital). Connect Status:', (await connectService.getPrinterProfile(nodeB.id)).connect_status);

        // 4. Test Routing
        console.log('\n--- TESTING ROUTING ---');

        // Create a fake job feature
        const jobId = uuidv4();
        await intelligenceService.logJobFeatures(jobId, 'tenant_test', {
            max_tac: 305,
            min_dpi: 300,
            has_bleed: true,
            color_profile: 'FOGRA39',
            fonts: ['Inter-Bold']
        });

        const recommendation = await routingService.recommendRoute(jobId, { date: today });
        console.log('Recommendation:', JSON.stringify(recommendation, null, 2));

        if (recommendation.recommendation && recommendation.recommendation.printer === 'Lisbon Digital') {
            console.log('SUCCESS: Lisbon Digital recommended (Madrid Offset penalized by TAC).');

            // Phase 26.2: Record Outcome
            console.log('\n--- TESTING LEARNING LOOP (Phase 26.2) ---');
            const routingIntelligence = require('./routingIntelligence');
            const qualityScoreService = require('./qualityScoreService');

            await routingIntelligence.recordOutcome(jobId, 'DELIVERED');

            const LisbonPerf = await qualityScoreService.getPrinterPerformance(nodeB.id);
            console.log('Lisbon Digital Performance after 1 DELIVERED:', JSON.stringify(LisbonPerf, null, 2));

            const profileAfter = await connectService.getPrinterProfile(nodeB.id);
            console.log('Lisbon Digital Quality Score after 1 DELIVERED:', profileAfter.quality_score);

            if (profileAfter.quality_score > 0.5) {
                console.log('SUCCESS: Quality Score increased after successful delivery.');
            }
        } else {
            console.log('FAILURE or Unexpected result.');
        }

    } catch (err) {
        console.error('Test failed:', err);
    } finally {
        process.exit(0);
    }
}

test();
