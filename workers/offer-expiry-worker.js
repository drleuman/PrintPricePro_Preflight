/**
 * Background worker to automatically expire stale production offers.
 */
const productionOfferService = require('../services/productionOfferService');

console.log('[OFFER-WORKER] Starting Production Offer Expiry Worker...');

async function runWorker() {
    try {
        const expiredCount = await productionOfferService.processExpirations();
        if (expiredCount > 0) {
            console.log(`[OFFER-WORKER] Successfully expired ${expiredCount} offers.`);
        }
    } catch (err) {
        console.error('[OFFER-WORKER] Error in cycle:', err.message);
    }

    // Schedule next run in 60 seconds
    setTimeout(runWorker, 60000);
}

// Start immediately
runWorker();
