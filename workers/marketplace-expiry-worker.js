const db = require('../services/db');
const negotiationService = require('../services/negotiationService');

/**
 * Marketplace Expiry Worker
 * Handles negotiation timeouts and session cleanup.
 */
async function processMarketplaceExpirations() {
    try {
        // 1. Expire stale counteroffers (12h)
        // Find PENDING counteroffers older than 12 hours
        await db.query(`
            UPDATE offer_counteroffers 
            SET counteroffer_status = 'EXPIRED' 
            WHERE counteroffer_status = 'PENDING' 
            AND created_at < DATE_SUB(NOW(), INTERVAL 12 HOUR)
        `);

        // 2. Expire stale negotiations (24h)
        // Find offers in COUNTERED or OPEN state with no activity in 24 hours
        // and mark them EXPIRED or CLOSED
        const { rows: staleOffers } = await db.query(`
            SELECT id FROM production_offers 
            WHERE negotiation_status IN ('OPEN', 'COUNTERED') 
            AND updated_at < DATE_SUB(NOW(), INTERVAL 24 HOUR)
        `);

        for (const offer of staleOffers) {
            await db.query(`
                UPDATE production_offers 
                SET negotiation_status = 'EXPIRED',
                    offer_status = 'EXPIRED'
                WHERE id = ?
            `, [offer.id]);

            await negotiationService.logCommercialEvent(null, null, offer.id, 'NEGOTIATION_EXPIRED', { reason: 'Timeout' });
        }

        // 3. Expire sessions with no selection (configurable timeout, e.g., 48h)
        await db.query(`
            UPDATE job_marketplace_sessions 
            SET session_status = 'EXPIRED' 
            WHERE session_status = 'OPEN' 
            AND created_at < DATE_SUB(NOW(), INTERVAL 48 HOUR)
        `);

    } catch (err) {
        console.error('[MARKETPLACE-WORKER] Error:', err.message);
    }
}

// Run every 10 minutes
if (process.env.NODE_ENV !== 'test') {
    console.log('[MARKETPLACE-WORKER] Starting Marketplace Expiry Worker...');
    setInterval(processMarketplaceExpirations, 10 * 60 * 1000);
    // Initial run
    processMarketplaceExpirations();
}

module.exports = { processMarketplaceExpirations };
