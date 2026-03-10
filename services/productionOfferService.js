const db = require('./db');
const crypto = require('crypto');

/**
 * Production Offer Service
 * Manages the formal proposal lifecycle to printer nodes.
 */
class ProductionOfferService {
    /**
     * Creates a formal offer from a routing decision.
     */
    async createOfferFromRouting(jobId, candidate, routingAuditId, econAuditId) {
        const id = crypto.randomUUID();
        const expiryMinutes = 10;
        const expiresAt = new Date(Date.now() + expiryMinutes * 60000);

        try {
            await db.query(`
                INSERT INTO production_offers (
                    id, job_id, printer_id, machine_id, quote_id, 
                    routing_audit_id, economic_routing_audit_id,
                    production_cost, suggested_price, estimated_margin, margin_pct,
                    lead_time_days, offer_expires_at, offer_status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')
            `, [
                id, jobId, candidate.printer_id, candidate.machine_id, candidate.quote_id,
                routingAuditId, econAuditId,
                candidate.production_cost, candidate.suggested_price,
                candidate.estimated_margin, candidate.margin_pct,
                candidate.lead_time_days, expiresAt
            ]);

            await this.logEvent(id, 'OFFER_CREATED', { expiry_minutes: expiryMinutes });
            return id;
        } catch (err) {
            console.error('[OFFER-SERVICE] Creation failed:', err.message);
            throw err;
        }
    }

    /**
     * Mark an offer as accepted.
     */
    async acceptOffer(id) {
        try {
            const { rows: [offer] } = await db.query('SELECT * FROM production_offers WHERE id = ?', [id]);
            if (!offer) throw new Error('Offer not found');
            if (offer.offer_status !== 'SENT' && offer.offer_status !== 'VIEWED') {
                throw new Error(`Cannot accept offer in status: ${offer.offer_status}`);
            }

            await db.query("UPDATE production_offers SET offer_status = 'ACCEPTED' WHERE id = ?", [id]);
            await this.logEvent(id, 'OFFER_ACCEPTED');

            // TODO: In Phase 27.3/28.3 integration, this would trigger the formal job assignment confirmation
            return true;
        } catch (err) {
            console.error('[OFFER-SERVICE] Acceptance failed:', err.message);
            throw err;
        }
    }

    /**
     * Mark an offer as rejected.
     */
    async rejectOffer(id, reason) {
        try {
            await db.query("UPDATE production_offers SET offer_status = 'REJECTED' WHERE id = ?", [id]);
            await this.logEvent(id, 'OFFER_REJECTED', { reason });

            // Release reservation and trigger reroute
            // This would call ReservationService.release and RoutingService.reroute
            return true;
        } catch (err) {
            console.error('[OFFER-SERVICE] Rejection failed:', err.message);
            throw err;
        }
    }

    /**
     * Bulk expire stale offers.
     */
    async processExpirations() {
        try {
            const { rows: expired } = await db.query(`
                SELECT id, job_id FROM production_offers 
                WHERE offer_status IN ('PENDING', 'SENT', 'VIEWED') 
                AND offer_expires_at < CURRENT_TIMESTAMP
            `);

            for (const offer of expired) {
                await db.query("UPDATE production_offers SET offer_status = 'EXPIRED' WHERE id = ?", [offer.id]);
                await this.logEvent(offer.id, 'OFFER_EXPIRED');
                console.log(`[OFFER-SERVICE] Offer ${offer.id} expired for job ${offer.job_id}`);
            }
            return expired.length;
        } catch (err) {
            console.error('[OFFER-SERVICE] Expiration process failed:', err.message);
            return 0;
        }
    }

    async logEvent(offerId, type, metadata = {}) {
        const id = crypto.randomUUID();
        await db.query(`
            INSERT INTO production_offer_events (id, offer_id, event_type, metadata_json)
            VALUES (?, ?, ?, ?)
        `, [id, offerId, type, JSON.stringify(metadata)]);
    }
}

module.exports = new ProductionOfferService();
