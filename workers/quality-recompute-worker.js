// workers/quality-recompute-worker.js
const db = require('../services/db');
const qualityService = require('../services/printerQualityService');

async function recomputeGlobalPerformance() {
    console.log('[WORKER] Starting daily quality recomputation...');
    try {
        const { rows: printers } = await db.query('SELECT id FROM printer_nodes WHERE status = "ACTIVE"');

        for (const p of printers) {
            await qualityService.updatePrinterPerformance(p.id);
        }

        console.log(`[WORKER] Successfully recomputed performance for ${printers.length} nodes.`);
    } catch (err) {
        console.error('[WORKER] Global recomputation failed:', err.message);
    }
}

// simulate run
if (require.main === module) {
    recomputeGlobalPerformance().then(() => process.exit(0));
}

module.exports = { recomputeGlobalPerformance };
