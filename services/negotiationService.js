const db = require('./db');
const crypto = require('crypto');

/**
 * Negotiation Service
 * Manages the counteroffer cycle and commercial terms.
 */
class NegotiationService {
    /**
     * Opens a new negotiation for an offer.
     */
    async openNegotiation(offerId) {
        await db.query(`
            UPDATE production_offers 
            SET negotiation_status = 'OPEN' 
            WHERE id = ? AND negotiation_status = 'NONE'
        `, [offerId]);

        await this.logCommercialEvent(null, null, offerId, 'NEGOTIATION_OPENED', {});
    }

    /**
     * Creates a counteroffer.
     */
    async createCounteroffer(offerId, counterparty, payload) {
        const id = crypto.randomUUID();
        const { proposed_price, proposed_lead_time_days, proposed_notes } = payload;

        try {
            // 1. Supersede existing pending counteroffers for this offer
            await db.query(`
                UPDATE offer_counteroffers 
                SET counteroffer_status = 'SUPERSEDED' 
                WHERE offer_id = ? AND counteroffer_status = 'PENDING'
            `, [offerId]);

            // 2. Insert new counteroffer
            await db.query(`
                INSERT INTO offer_counteroffers 
                (id, offer_id, counterparty, proposed_price, proposed_lead_time_days, proposed_notes)
                VALUES (?, ?, ?, ?, ?, ?)
            `, [id, offerId, counterparty, proposed_price, proposed_lead_time_days, proposed_notes]);

            // 3. Update offer status and counter count
            await db.query(`
                UPDATE production_offers 
                SET negotiation_status = 'COUNTERED', 
                    counteroffer_count = counteroffer_count + 1 
                WHERE id = ?
            `, [offerId]);

            await this.logCommercialEvent(null, null, offerId, 'OFFER_COUNTERED', { counteroffer_id: id, counterparty, proposed_price });

            return id;
        } catch (err) {
            console.error('[NEGOTIATION] Failed to create counteroffer:', err.message);
            throw err;
        }
    }

    /**
     * Accepts a counteroffer and commits terms.
     */
    async acceptCounteroffer(counterofferId) {
        try {
            const { rows: [co] } = await db.query('SELECT * FROM offer_counteroffers WHERE id = ?', [counterofferId]);
            if (!co) throw new Error('Counteroffer not found');

            // 1. Mark as ACCEPTED
            await db.query("UPDATE offer_counteroffers SET counteroffer_status = 'ACCEPTED' WHERE id = ?", [counterofferId]);

            // 2. Commit terms to offer
            await db.query(`
                UPDATE production_offers 
                SET negotiation_status = 'ACCEPTED',
                    committed_price = ?,
                    committed_lead_time_days = ?
                WHERE id = ?
            `, [co.proposed_price, co.proposed_lead_time_days, co.offer_id]);

            await this.logCommercialEvent(null, null, co.offer_id, 'COUNTEROFFER_ACCEPTED', { counteroffer_id: counterofferId });

            return true;
        } catch (err) {
            console.error('[NEGOTIATION] Acceptance failed:', err.message);
            throw err;
        }
    }

    /**
     * Rejects a counteroffer.
     */
    async rejectCounteroffer(counterofferId) {
        try {
            const { rows: [co] } = await db.query('SELECT * FROM offer_counteroffers WHERE id = ?', [counterofferId]);
            if (!co) throw new Error('Counteroffer not found');

            await db.query("UPDATE offer_counteroffers SET counteroffer_status = 'REJECTED' WHERE id = ?", [counterofferId]);

            await this.logCommercialEvent(null, null, co.offer_id, 'COUNTEROFFER_REJECTED', { counteroffer_id: counterofferId });

            return true;
        } catch (err) {
            console.error('[NEGOTIATION] Rejection failed:', err.message);
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
}

module.exports = new NegotiationService();
