// scripts/test-connect-foundations.js
const db = require('../services/db');
const connectService = require('../services/connectService');
const { v4: uuidv4 } = require('uuid');

async function testConnect() {
    console.log('--- Testing Phase 26.1: PrintPrice Connect Foundations ---');

    let printerId;
    const machineProfileId = uuidv4();
    const paperProfileId = uuidv4();

    try {
        // 1. Setup Mock Profiles for lookup
        await db.query(`INSERT INTO machine_profiles (id, name, type, max_tac, min_res_dpi, requires_bleed) VALUES (?, 'Test Machine', 'OFFSET', 300, 300, true)`, [machineProfileId]);
        await db.query(`INSERT INTO paper_profiles (id, name, weight, absorption_coefficient, icc_profile) VALUES (?, 'Test Paper', 100, 0.05, 'cmyk_profile')`, [paperProfileId]);

        // 2. Onboarding
        console.log('[TEST] Onboarding new printer node...');
        const node = await connectService.createPrinterNode({
            name: 'Berlin Print Works',
            legal_name: 'Berlin Print Works GmbH',
            vat_id: 'DE123456789',
            country: 'Germany',
            city: 'Berlin',
            contact: {
                name: 'Hans Müller',
                email: 'hans@printworks.de',
                role: 'Technical Director'
            }
        });
        printerId = node.id;
        console.log('Printer Created:', printerId);

        // 3. Machine Inventory
        console.log('[TEST] Updating machine inventory...');
        await connectService.updateMachineInventory(printerId, [
            { machineProfileId }
        ]);

        // 4. Paper Catalog
        console.log('[TEST] Updating paper catalog...');
        await connectService.updatePaperCatalog(printerId, [
            { paperProfileId, available: true }
        ]);

        // 5. Capacity Sync
        console.log('[TEST] Syncing capacity...');
        const today = new Date().toISOString().split('T')[0];
        await connectService.updateCapacity(printerId, today, {
            available: 0.8,
            total: 1.0,
            leadTime: 2
        });

        // 6. Verification (Consolidated Profile)
        console.log('[TEST] Verifying consolidated profile...');
        const profile = await connectService.getPrinterProfile(printerId);

        console.log('\n--- PRINTER PROFILE ---');
        console.log('Name:', profile.name);
        console.log('Connect Status:', profile.connect_status);
        console.log('Machines:', profile.machines.length);
        console.log('Papers:', profile.papers.length);

        if (profile.machines.length > 0 && profile.connect_status === 'PARTIALLY_CONFIGURED') {
            console.log('SUCCESS: Connect Foundations functional.');
        } else {
            console.log('FAILED: Profile or status mismatch.');
        }

    } catch (err) {
        console.error('[TEST-FAILED]', err.message);
    } finally {
        if (printerId) {
            console.log('\n[CLEANUP] Removing test node data...');
            await db.query('DELETE FROM printer_nodes WHERE id = ?', [printerId]);
        }
        await db.query('DELETE FROM machine_profiles WHERE id = ?', [machineProfileId]);
        await db.query('DELETE FROM paper_profiles WHERE id = ?', [paperProfileId]);
    }
}

testConnect().then(() => process.exit(0));
