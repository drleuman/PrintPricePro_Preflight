const db = require('./db');
const crypto = require('crypto');
const commercialCommitmentService = require('./commercialCommitmentService');
const settlementReadinessService = require('./settlementReadinessService');

/**
 * Marketplace Readiness Service
 * Evaluates and manages commercial commitment states.
 */
class MarketplaceReadinessService {
    /**
     * Builds a commitment JSON for a session and marks it ready.
     */
    async markCommercialReady(sessionId, offerId) {
        try {
            const { rows: [offer] } = await db.query(`
                SELECT po.*, p.name as printer_name, p.currency
                FROM production_offers po
                JOIN printer_nodes p ON po.printer_id = p.id
                WHERE po.id = ?
            `, [offerId]);

            if (!offer) throw new Error('Offer not found');

            const commitment = {
                printer_id: offer.printer_id,
                printer_name: offer.printer_name,
                offer_id: offer.id,
                committed_price: offer.committed_price || offer.suggested_price,
                currency: offer.currency,
                committed_lead_time_days: offer.committed_lead_time_days || offer.lead_time_days,
                ready_at: new Date().toISOString(),
                terms_version: '1.0-standard'
            };

            // Update session state
            await db.query(`
                INSERT INTO marketplace_session_state (id, marketplace_session_id, state, selected_offer_id, commercial_commitment_json)
                VALUES (?, ?, 'COMMERCIALLY_READY', ?, ?)
                ON DUPLICATE KEY UPDATE 
                    state = 'COMMERCIALLY_READY', 
                    selected_offer_id = VALUES(selected_offer_id),
                    commercial_commitment_json = VALUES(commercial_commitment_json)
            `, [crypto.randomUUID(), sessionId, offerId, JSON.stringify(commitment)]);

            // Update offer
            await db.query('UPDATE production_offers SET commercial_ready = TRUE WHERE id = ?', [offerId]);

            await this.logCommercialEvent(null, sessionId, offerId, 'COMMERCIAL_READY', commitment);

            // Phase 29.1: Auto-create commercial commitment
            const commitmentId = await commercialCommitmentService.createCommitmentFromSession(sessionId);
            await settlementReadinessService.buildSettlementPlaceholder(commitmentId);

            return commitment;
        } catch (err) {
            console.error('[READINESS] Failed to mark ready:', err.message);
            throw err;
        }
    }

    async logCommercialEvent(jobId, sessionId, offerId, type, metadata = {}) {
        const id = crypto.randomUUID();
        await db.query(`
            INSERT INTO commercial_events (id, job_id, marketplace_session_id, offer_id, event_type, metadata_json)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [id, jobId, sessionId, offerId, type, JSON.stringify(metadata)]);
    }

    /**
     * Periodic task to expire sessions.
     */
    async expireNegotiationSessions() {
        // Logic to find sessions with last activity older than X hours
        // and counteroffers older than Y hours.
        // For Phase 29, we'll implement the query for the worker.
    }
}

module.exports = new MarketplaceReadinessService();
