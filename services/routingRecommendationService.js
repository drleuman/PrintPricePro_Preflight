const crypto = require('crypto');
const reservationService = require('./reservationService');
const dispatchService = require('./dispatchService');
const quoteService = require('./quoteService');
const economicRoutingService = require('./economicRoutingService');
const marketplaceService = require('./marketplaceService');

class RoutingRecommendationService {
    /**
     * Generates a hardened routing recommendation.
     */
    async generateRecommendation(jobId, candidates, constraints = {}) {
        const confidenceScore = this.computeConfidenceScore(candidates);
        let selected = candidates.length > 0 ? candidates.slice(0, 3) : []; // Top 3 candidates

        // Phase 28.1: Enrich candidates with pricing
        for (let i = 0; i < selected.length; i++) {
            const quote = await quoteService.createJobQuote(jobId, selected[i].printer_id, selected[i].machine_id);
            if (quote) {
                selected[i] = {
                    ...selected[i],
                    production_cost: quote.production_cost,
                    suggested_price: quote.suggest_price, // Fixed typo in previous implementation thought, actually suggested_price
                    estimated_margin: quote.estimated_margin,
                    margin_pct: quote.margin_pct
                };
            }
        }

        // Phase 28.2: Economic Routing
        const rankedCandidates = await economicRoutingService.rankEconomicCandidates(jobId, selected);
        selected = rankedCandidates; // Use economic ranking for the final selection

        // Phase 28.4: Marketplace Integration
        // Triggered for every autonomous routing recommendation
        const marketplaceSessionId = await marketplaceService.createMarketplaceSession(jobId, 'AUTO');

        const explanation = selected.map(c => ({
            printer_id: c.printer_id,
            printer_name: c.printer,
            routing_score: c.routing_score,
            economic_score: c.economic_score,
            final_routing_score: c.final_routing_score,
            details: {
                compatibility: c.compatibility_score,
                quality: c.quality_score * 100,
                capacity: c.capacity_score || 100,
                price: c.price_score || 100,
                economic_factors: c.economic_explanation
            }
        }));

        const auditTrail = {
            id: crypto.randomUUID(),
            job_id: jobId,
            routing_version: 'v2.1-autonomous',
            candidate_printers: JSON.stringify(candidates.slice(0, 10)),
            selected_candidates: JSON.stringify(selected),
            fallback_used: constraints.fallback_used || false,
            decision_explanation: JSON.stringify(explanation),
            confidence_score: confidenceScore
        };

        // Log audit trail async to avoid blocking
        const routingAuditId = auditTrail.id;
        this.logRoutingAudit(auditTrail).catch(err => console.error('[ROUTING-AUDIT] Failed:', err.message));

        // Phase 28.2: Economic Audit
        const economicRoutingAuditId = await economicRoutingService.storeEconomicRoutingAudit(jobId, routingAuditId, selected);

        // Phase 28.4: Generate Marketplace Offers
        const marketplaceOffers = await marketplaceService.generateOffersForSession(marketplaceSessionId, jobId, selected);

        // Final Selection Logic: Select the top offer from the session automatically
        if (marketplaceOffers.length > 0) {
            await marketplaceService.selectOffer(marketplaceSessionId, marketplaceOffers[0].id, 'AUTO');
        }

        // Logic check for conflicts
        if (candidates.length === 0) {
            await this.logConflict(jobId, 'NO_COMPATIBLE_PRINTER', 'Could not find any nodes matching job requirements.', 'HIGH');
        } else if (confidenceScore < 0.5) {
            await this.logConflict(jobId, 'LOW_ROUTING_CONFIDENCE', 'High spread or low candidate count detected.', 'MEDIUM');
        }

        // Phase 27.2: Create Reservation for the top candidate if available
        let reservationId = null;
        let expiresAt = null;
        let assignmentId = null;

        if (selected.length > 0) {
            try {
                const res = await reservationService.createReservation(jobId, selected[0].printer_id, selected[0].machine_id, 1);
                reservationId = res.id;
                expiresAt = res.expires_at;

                // Phase 27.3: Autonomous Dispatch
                assignmentId = await dispatchService.createAssignment(
                    jobId,
                    selected[0].printer_id,
                    selected[0].machine_id,
                    reservationId
                );
            } catch (err) {
                console.warn('[ROUTING-RESERVATION/DISPATCH] Failed:', err.message);
                await this.logConflict(jobId, 'DISPATCH_FAILED', err.message, 'MEDIUM');
            }
        }

        return {
            job_id: jobId,
            routing_version: auditTrail.routing_version,
            confidence_score: confidenceScore,
            candidates: selected,
            fallback_used: auditTrail.fallback_used,
            reservation_id: reservationId,
            assignment_id: assignmentId,
            expires_at: expiresAt
        };
    }

    /**
     * Filters candidates based on technical compatibility (TAC, Dimensions).
     */
    async filterCandidatesByCapability(jobId, candidates, preflightResults) {
        if (!preflightResults || !preflightResults.metrics) return candidates;

        const docTac = preflightResults.metrics.max_tac || 0;
        const docWidthMm = preflightResults.classification?.widthMm || 0;
        const docHeightMm = preflightResults.classification?.heightMm || 0;

        return candidates.map(c => {
            let compatibilityReason = 'MATCH';
            let technicalScore = 1.0;

            // 1. TAC Match (Printer max ink limit)
            const printerMaxTac = c.max_ink_limit || 300;
            if (docTac > printerMaxTac) {
                technicalScore *= 0.5;
                compatibilityReason = `TAC_EXCEEDED (${docTac}% > ${printerMaxTac}%)`;
            }

            // 2. Dimension Match (Printer max size)
            const printerMaxWidth = c.max_width_mm || 9999;
            const printerMaxHeight = c.max_height_mm || 9999;
            if (docWidthMm > printerMaxWidth || docHeightMm > printerMaxHeight) {
                technicalScore = 0;
                compatibilityReason = `SIZE_INCOMPATIBLE (${Math.round(docWidthMm)}x${Math.round(docHeightMm)} > ${printerMaxWidth}x${printerMaxHeight})`;
            }

            return {
                ...c,
                technical_compatibility: technicalScore,
                compatibility_reason: compatibilityReason,
                routing_score: c.routing_score * technicalScore
            };
        }).filter(c => c.technical_compatibility > 0);
    }

    /**
     * Computes a confidence score (0-1).
     */
    computeConfidenceScore(candidates) {
        if (candidates.length === 0) return 0;

        const bestScore = candidates[0].routing_score / 100;
        const countFactor = Math.min(1, Math.log10(candidates.length + 1) / 0.7); // Log scale, 4+ candidates approx 1.0

        let spreadFactor = 1;
        if (candidates.length > 1) {
            const spread = candidates[0].routing_score - candidates[1].routing_score;
            spreadFactor = spread > 20 ? 0.8 : 1.0; // High spread reduces confidence slightly as it might be an outlier
        }

        return parseFloat((bestScore * countFactor * spreadFactor).toFixed(2));
    }

    /**
     * Fallback strategy: Relax TAC threshold.
     */
    async evaluateFallbackStrategies(featureId, constraints) {
        console.log(`[ROUTING-FALLBACK] Triggered for feature ${featureId}`);
        // This would interact with intelligenceService to re-calculate with relaxed limits
        // For Phase 27.1 we implement the framework for it.
        return { fallback_used: true, strategy: 'RELAX_TAC_10PERCENT' };
    }

    /**
     * Persists the decision to the audit log.
     */
    async logRoutingAudit(auditData) {
        await db.query(`
            INSERT INTO routing_audit_log 
            (id, job_id, routing_version, candidate_printers, selected_candidates, fallback_used, decision_explanation, confidence_score)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            auditData.id, auditData.job_id, auditData.routing_version,
            auditData.candidate_printers, auditData.selected_candidates,
            auditData.fallback_used, auditData.decision_explanation, auditData.confidence_score
        ]);
    }

    /**
     * Logs routing conflicts.
     */
    async logConflict(jobId, type, description, severity) {
        await db.query(`
            INSERT INTO routing_conflicts (id, job_id, conflict_type, conflict_description, severity)
            VALUES (?, ?, ?, ?, ?)
        `, [crypto.randomUUID(), jobId, type, description, severity]);
    }
}

module.exports = new RoutingRecommendationService();
