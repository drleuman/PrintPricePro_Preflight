// scripts/verify-connect-phase-26.js
const db = require('../services/db');
const connectService = require('../services/connectService');
const printerRegistry = require('../services/printerRegistry');
const capacityService = require('../services/capacityService');
const routingService = require('../services/routingService');
const intelligenceService = require('../intelligenceService');
const { v4: uuidv4 } = require('uuid');

async function testFullConnectWorkflow() {
    console.log('--- Phase 26.1: End-to-End Network Verification ---');

    let printerId;
    let apiKey;
    const machineProfileId = uuidv4();
    const jobId = uuidv4();
    const featureId = uuidv4();

    try {
        // 1. Setup Environment
        await db.query(`INSERT INTO machine_profiles (id, name, type, max_tac, min_res_dpi, requires_bleed) VALUES (?, 'Heidelberg XL-106', 'OFFSET', 300, 300, true)`, [machineProfileId]);
        await db.query(`INSERT INTO print_features (id, job_id, tac_actual, dpi_min, has_bleed) VALUES (?, ?, 280, 450, true)`, [featureId, jobId]);

        // 2. Onboarding
        console.log('[STEP 1] Onboarding Printer Node...');
        const nodeData = await connectService.createPrinterNode({
            name: 'Berlin Production Center',
            legal_name: 'BPC GmbH',
            country: 'Germany',
            city: 'Berlin'
        });
        printerId = nodeData.id;
        apiKey = nodeData.apiKey;
        console.log('Printer ID:', printerId);
        console.log('API Key Received:', apiKey ? 'YES' : 'FAILED');

        // Check initial status
        const profileBefore = await connectService.getPrinterProfile(printerId);
        console.log('Initial Status:', profileBefore.status, '| Connect Status:', profileBefore.connect_status);

        // 3. Capability Declaration
        console.log('[STEP 2] Registering Machines...');
        await printerRegistry.registerMachine(printerId, {
            machineProfileId,
            nickname: 'Main Press 01',
            capacityIndex: 1.2
        });

        // 4. Capacity Sync
        console.log('[STEP 3] Syncing Capacity...');
        const today = new Date().toISOString().split('T')[0];
        await capacityService.updateCapacity(printerId, today, {
            total: 10,
            available: 5,
            leadTimeDays: 2
        });

        // Verify status is now READY
        const profileAfter = await connectService.getPrinterProfile(printerId);
        console.log('Updated Connect Status:', profileAfter.connect_status);

        // 5. Routing Test (Should FAIL because status is still PENDING_REVIEW)
        console.log('[STEP 4] Testing Routing Eligibility (Expect failure - PENDING)...');
        const candidatesPending = await routingService.discoverCompatibleNodes(featureId);
        const isEligiblePending = candidatesPending.some(c => c.printer === 'Berlin Production Center');
        console.log('Printer found in routing (PENDING):', isEligiblePending);

        // 6. Admin Approval
        console.log('[STEP 5] Admin Approval...');
        await db.query(`UPDATE printer_nodes SET status = 'ACTIVE' WHERE id = ?`, [printerId]);

        // 7. Final Routing Test (Should PASS)
        console.log('[STEP 6] Final Routing Verification (Expect SUCCESS)...');
        const candidatesActive = await routingService.discoverCompatibleNodes(featureId);
        const finalCandidate = candidatesActive.find(c => c.printer === 'Berlin Production Center');

        if (finalCandidate) {
            console.log('MATCH FOUND!');
            console.log('Routing Score:', finalCandidate.routing_score);
            console.log('Reasoning:', finalCandidate.penalties.length === 0 ? 'Perfect match' : 'Compatible with minor penalties');
            console.log('--- SUCCESS: PHASE 26.1 VERIFIED ---');
        } else {
            console.error('FAILED: Printer still missing from routing engine.');
        }

    } catch (err) {
        console.error('[CRITICAL-FAILURE]', err.stack);
    } finally {
        console.log('\n[CLEANUP] Purging test data...');
        if (printerId) await db.query('DELETE FROM printer_nodes WHERE id = ?', [printerId]);
        await db.query('DELETE FROM machine_profiles WHERE id = ?', [machineProfileId]);
        await db.query('DELETE FROM print_features WHERE id = ?', [featureId]);
    }
}

testFullConnectWorkflow().then(() => process.exit(0));
