const db = require('./db');
const crypto = require('crypto');

/**
 * Economic Routing Service
 * Evaluates both production fitness and economic attractiveness.
 */
class EconomicRoutingService {
    constructor() {
        this.weights = {
            technical: 0.40,
            margin: 0.25,
            cost: 0.15,
            quality: 0.10,
            lead_time: 0.10
        };

        this.thresholds = {
            minimum_margin_pct: 15.0,
            low_margin_warning_pct: 20.0,
            minimum_final_score: 50
        };
    }

    /**
     * Ranks candidates by their final economic routing score.
     */
    async rankEconomicCandidates(jobId, candidates) {
        if (!candidates || candidates.length === 0) return [];

        // 1. Prepare data (extracting values for normalization)
        const costs = candidates.map(c => Number(c.production_cost || 0));
        const margins = candidates.map(c => Number(c.margin_pct || 0));
        const leadTimes = candidates.map(c => Number(c.lead_time_days || 3));

        const minCost = Math.min(...costs);
        const maxMargin = Math.max(...margins);
        const minLeadTime = Math.min(...leadTimes);

        // 2. Score each candidate
        const scoredCandidates = candidates.map(candidate => {
            const explanation = this.calculateSignals(candidate, { minCost, maxMargin, minLeadTime });

            const economicScore = (
                (explanation.margin_factor * 0.25) +
                (explanation.cost_factor * 0.15) +
                (explanation.quality_factor * 0.10) +
                (explanation.lead_time_factor * 0.10)
            ) / 0.60; // Normalize economic-only factors to 1.0

            const finalScore = (
                (explanation.technical_factor * this.weights.technical) +
                (explanation.margin_factor * this.weights.margin) +
                (explanation.cost_factor * this.weights.cost) +
                (explanation.quality_factor * this.weights.quality) +
                (explanation.lead_time_factor * this.weights.lead_time)
            ) * 100;

            return {
                ...candidate,
                economic_score: Math.round(economicScore * 100),
                final_routing_score: Math.round(finalScore),
                economic_explanation: explanation
            };
        });

        // 3. Detect Conflicts
        await this.detectAndLogConflicts(jobId, scoredCandidates);

        // 4. Sort by final score descending
        return scoredCandidates.sort((a, b) => b.final_routing_score - a.final_routing_score);
    }

    /**
     * Calculates normalized signals (0-1) for a candidate.
     */
    calculateSignals(candidate, baseline) {
        const technical_factor = (candidate.routing_score || 0) / 100;

        // Margin: 1.0 if it's the max margin in the set, scaled otherwise
        const margin_factor = baseline.maxMargin > 0
            ? Math.max(0, (candidate.margin_pct || 0) / baseline.maxMargin)
            : 0;

        // Cost: 1.0 if it's the cheapest, scaled otherwise (inverse)
        const cost_factor = candidate.production_cost > 0
            ? Math.max(0, baseline.minCost / candidate.production_cost)
            : 0;

        const quality_factor = (candidate.quality_score || 0.5);

        // Lead Time: Shorter is better (1.0 if it's the min lead time)
        const lead_time_factor = candidate.lead_time_days > 0
            ? Math.max(0, baseline.minLeadTime / candidate.lead_time_days)
            : 0;

        return {
            technical_factor: Number(technical_factor.toFixed(4)),
            margin_factor: Number(margin_factor.toFixed(4)),
            cost_factor: Number(cost_factor.toFixed(4)),
            quality_factor: Number(quality_factor.toFixed(4)),
            lead_time_factor: Number(lead_time_factor.toFixed(4))
        };
    }

    /**
     * Detects and logs economic conflicts.
     */
    async detectAndLogConflicts(jobId, candidates) {
        for (const c of candidates) {
            // Negative Margin
            if (c.production_cost > c.suggested_price) {
                await this.logConflict(jobId, c.printer_id, 'NEGATIVE_MARGIN', `Estimated production cost (${c.production_cost}) exceeds suggested price (${c.suggested_price}).`, 'HIGH');
            }
            // Low Margin
            else if (c.margin_pct < this.thresholds.minimum_margin_pct) {
                await this.logConflict(jobId, c.printer_id, 'LOW_MARGIN', `Candidate margin (${c.margin_pct}%) is below minimum threshold of ${this.thresholds.minimum_margin_pct}%.`, 'MEDIUM');
            }
            // High Cost Outlier (> 150% of cheapest)
            const costs = candidates.map(can => can.production_cost);
            const minCost = Math.min(...costs);
            if (c.production_cost > minCost * 1.5) {
                await this.logConflict(jobId, c.printer_id, 'HIGH_COST_OUTLIER', `Candidate cost is significantly higher (>50%) than the market minimum.`, 'LOW');
            }
        }

        // Global Conflict: No Viable Routes
        const viable = candidates.filter(c => c.final_routing_score >= this.thresholds.minimum_final_score);
        if (viable.length === 0 && candidates.length > 0) {
            await this.logConflict(jobId, null, 'NO_ECONOMICALLY_VIABLE_ROUTE', 'All candidates failed to meet the minimum economic routing threshold.', 'HIGH');
        }
    }

    /**
     * Logs economic conflicts.
     */
    async logConflict(jobId, printerId, type, description, severity) {
        const id = crypto.randomUUID();
        try {
            await db.query(`
                INSERT INTO economic_routing_conflicts (id, job_id, printer_id, conflict_type, conflict_description, severity)
                VALUES (?, ?, ?, ?, ?, ?)
            `, [id, jobId, printerId, type, description, severity]);
        } catch (err) {
            console.error('[ECON-ROUTING] Failed to log conflict:', err.message);
        }
    }

    /**
     * Stores the final decision audit.
     */
    async storeEconomicRoutingAudit(jobId, routingAuditId, result) {
        const id = crypto.randomUUID();
        try {
            const best = result[0] || {};
            await db.query(`
                INSERT INTO economic_routing_audit (
                    id, job_id, routing_audit_id, economic_routing_version, 
                    candidate_summary_json, selected_printer_id, selected_machine_id,
                    final_decision_json
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                id, jobId, routingAuditId, 'v28.2',
                JSON.stringify(result.map(r => ({ id: r.printer_id, score: r.final_routing_score }))),
                best.printer_id, best.machine_id, JSON.stringify(best)
            ]);
            return id;
        } catch (err) {
            console.error('[ECON-ROUTING] Failed to store audit:', err.message);
            return null;
        }
    }
}

module.exports = new EconomicRoutingService();
