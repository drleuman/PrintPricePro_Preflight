const db = require('./db');
const crypto = require('crypto');
const productionOfferService = require('./productionOfferService');

/**
 * Marketplace Interaction Service
 * Orchestrates multi-offer sessions and selection logic.
 */
class MarketplaceService {
    /**
     * Creates a decision session for a job.
     */
    async createMarketplaceSession(jobId, mode = 'AUTO') {
        const id = crypto.randomUUID();
        try {
            await db.query(`
                INSERT INTO job_marketplace_sessions (id, job_id, selection_mode)
                VALUES (?, ?, ?)
            `, [id, jobId, mode]);

            await this.logMarketplaceEvent(jobId, id, null, 'SESSION_CREATED', { mode });
            return id;
        } catch (err) {
            console.error('[MARKETPLACE] Failed to create session:', err.message);
            throw err;
        }
    }

    /**
     * Generates multiple offers for a session based on candidates.
     */
    async generateOffersForSession(sessionId, jobId, candidates) {
        // Take top 3 for the marketplace session
        const topCandidates = candidates.slice(0, 3);
        const offers = [];

        for (let i = 0; i < topCandidates.length; i++) {
            const candidate = topCandidates[i];

            // Re-rank score for marketplace context
            const priorityScore = this.calculatePriorityScore(candidate);

            const offerId = await productionOfferService.createOfferFromRouting(
                jobId,
                candidate,
                candidate.routing_audit_id || null,
                candidate.economic_routing_audit_id || null
            );

            // Link to session and update rank
            await db.query(`
                UPDATE production_offers 
                SET marketplace_session_id = ?, 
                    offer_rank = ?, 
                    offer_priority_score = ? 
                WHERE id = ?
            `, [sessionId, i + 1, priorityScore, offerId]);

            offers.push({ id: offerId, ...candidate, priorityScore });
        }

        await this.logMarketplaceEvent(jobId, sessionId, null, 'OFFERS_GENERATED', { count: offers.length });
        return offers;
    }

    /**
     * Selects an offer and closes/cancels others.
     */
    async selectOffer(sessionId, offerId, mode = 'AUTO') {
        try {
            const { rows: [session] } = await db.query('SELECT * FROM job_marketplace_sessions WHERE id = ?', [sessionId]);
            if (!session) throw new Error('Session not found');

            // 1. Mark session as SELECTED
            await db.query(`
                UPDATE job_marketplace_sessions 
                SET session_status = 'SELECTED', selected_offer_id = ?, selection_mode = ?
                WHERE id = ?
            `, [offerId, mode, sessionId]);

            // 2. Mark selected offer
            await db.query('UPDATE production_offers SET offer_selected = TRUE WHERE id = ?', [offerId]);

            // 3. Cancel remaining offers in the session
            await db.query(`
                UPDATE production_offers 
                SET offer_status = 'CANCELLED' 
                WHERE marketplace_session_id = ? AND id != ? AND offer_status IN ('PENDING', 'SENT', 'VIEWED')
            `, [sessionId, offerId]);

            await this.logMarketplaceEvent(session.job_id, sessionId, offerId, 'OFFER_SELECTED', { mode });

            return true;
        } catch (err) {
            console.error('[MARKETPLACE] Selection failed:', err.message);
            throw err;
        }
    }

    /**
     * Priority score: Technical (60%) + Margin Factor (20%) + Lead Time Factor (20%)
     */
    calculatePriorityScore(candidate) {
        const techScore = (candidate.final_routing_score || 0) / 100;
        const marginFactor = (candidate.margin_pct || 0) / 40; // Normalize against 40% as a high benchmark
        const leadTimeFactor = Math.max(0, 1 - (candidate.lead_time_days || 5) / 10); // Faster is better

        return (techScore * 0.6 + Math.min(1, marginFactor) * 0.2 + leadTimeFactor * 0.2) * 100;
    }

    async logMarketplaceEvent(jobId, sessionId, offerId, type, metadata = {}) {
        const id = crypto.randomUUID();
        await db.query(`
            INSERT INTO marketplace_events (id, job_id, marketplace_session_id, offer_id, event_type, metadata_json)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [id, jobId, sessionId, offerId, type, JSON.stringify(metadata)]);
    }
}

module.exports = new MarketplaceService();
