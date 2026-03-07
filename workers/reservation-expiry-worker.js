const reservationService = require('../services/reservationService');

/**
 * Reservation Expiry Worker
 * Runs every minute to clear stale capacity locks.
 */
async function runExpiryJob() {
    console.log('[WORKER] Starting reservation expiry check...', new Date().toISOString());
    try {
        const expiredCount = await reservationService.expireReservations();
        if (expiredCount > 0) {
            console.log(`[WORKER] Expired ${expiredCount} reservations.`);
        }
    } catch (err) {
        console.error('[WORKER] Expiry job failed:', err.message);
    }
}

// Simple interval for simulation (in production this might be a cron or scheduled task)
setInterval(runExpiryJob, 60000);

// Run immediately on start
runExpiryJob();
