const db = require('./db');
const crypto = require('crypto');
const pricingIntelligenceService = require('./pricingIntelligenceService');

class QuoteService {
    /**
     * Creates a new job quote for a given printer/machine candidate.
     */
    async createJobQuote(jobId, printerId, machineId, routingAuditId = null) {
        const id = crypto.randomUUID();

        try {
            // 1. Resolve Profile
            const profile = await pricingIntelligenceService.resolvePricingProfile(printerId, machineId);
            if (!profile) return null; // No pricing available for this node

            // 2. Gather Inputs (In a real scenario, this would fetch Job features/report)
            // Mocking inputs for Phase 28.1 implementation foundation
            const inputs = {
                estimated_sheet_count: 50, // Default for now
                color_factor: 0.1,
                tac_excess_factor: 0.05,
                bleed_factor: 1,
                is_rush: false,
                lead_time_days: 3
            };

            // 3. Calculate
            const productionCost = pricingIntelligenceService.calculateProductionCost(inputs, profile);
            const suggestedPrice = pricingIntelligenceService.calculateSuggestedPrice(productionCost);
            const margin = Number((suggestedPrice - productionCost).toFixed(4));
            const marginPct = Number((margin / suggestedPrice * 100).toFixed(4));

            const breakdown = pricingIntelligenceService.buildBreakdown(inputs, profile, productionCost, suggestedPrice);

            // 4. Persist
            await db.query(`
                INSERT INTO job_quotes (
                    id, job_id, printer_id, machine_id, routing_audit_id, 
                    production_cost, suggested_price, estimated_margin, margin_pct, 
                    pricing_version, calculation_breakdown_json
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                id, jobId, printerId, machineId, routingAuditId,
                productionCost, suggestedPrice, margin, marginPct,
                'v28.1', JSON.stringify(breakdown)
            ]);

            await this.logEvent(id, 'QUOTE_CREATED', { jobId, printerId });

            return {
                id,
                production_cost: productionCost,
                suggested_price: suggestedPrice,
                estimated_margin: margin,
                margin_pct: marginPct
            };
        } catch (err) {
            console.error('[QUOTE-SERVICE] Failed to create quote:', err.message);
            return null;
        }
    }

    /**
     * Logs pricing events.
     */
    async logEvent(quoteId, type, metadata) {
        const id = crypto.randomUUID();
        try {
            await db.query(
                "INSERT INTO pricing_events (id, job_quote_id, event_type, metadata_json) VALUES (?, ?, ?, ?)",
                [id, quoteId, type, JSON.stringify(metadata)]
            );
        } catch (err) {
            console.error('[QUOTE-SERVICE] Event logging failed:', err.message);
        }
    }

    /**
     * Retrieves quotes for a job.
     */
    async getQuotesForJob(jobId) {
        const { rows } = await db.query("SELECT * FROM job_quotes WHERE job_id = ?", [jobId]);
        return rows;
    }
}

module.exports = new QuoteService();
