// services/routingService.js
const db = require('./db');
const intelligenceService = require('./intelligenceService');
const routingIntelligence = require('./routingIntelligenceService');
const qualityService = require('./printerQualityService');
const recommendationService = require('./routingRecommendationService');

class RoutingService {
    /**
     * Finds compatible machines across the network for a specific job.
     */
    async discoverCompatibleNodes(featureId, constraints = {}) {
        const targetDate = constraints.date || new Date().toISOString().split('T')[0];
        try {
            // 1. Get candidate machines from eligible printers with capacity
            const { rows: machines } = await db.query(`
                SELECT m.*, p.id as printer_id, p.name as printer_name, p.country, p.city, p.price_index, p.quality_score,
                       p.sync_status, p.last_sync_at,
                       pc.capacity_available
                FROM machine_profiles m
                JOIN printer_machines pm ON m.id = pm.machine_profile_id
                JOIN printer_nodes p ON pm.printer_id = p.id
                LEFT JOIN printer_capacity pc ON p.id = pc.printer_id AND pc.date = ?
                WHERE p.status = 'ACTIVE' 
                  AND p.connect_status = 'READY'
                  AND p.sync_status != 'OFFLINE'
                  AND pm.status = 'ACTIVE'
                  AND (pm.machine_health = 'OK' OR pm.machine_health IS NULL)
                  AND (pc.capacity_available > 0 OR pc.capacity_available IS NULL)
            `, [targetDate]);

            // 2. Score each candidate
            const candidates = [];
            for (const machine of machines) {
                const result = await intelligenceService.calculateCompatibilityScore(
                    featureId,
                    machine.id,
                    constraints.paperId,
                    constraints.policyId,
                    { relaxedTAC: constraints.fallback } // Phase 27.1 Relaxation
                );

                if (result.score > 0) {
                    // Heuristic: (compatibility * 0.5) + (quality * 0.3) + (price_index_inv * 0.2)
                    // The machine.quality_score is now dynamic (Phase 26.2)
                    const normalizedPrice = 1.0 / (machine.price_index || 1.0);
                    const routingScore = (result.score * 0.5) + ((machine.quality_score * 100) * 0.3) + (normalizedPrice * 20);

                    candidates.push({
                        printer_id: machine.printer_id,
                        printer: machine.printer_name,
                        machine: machine.name,
                        machine_id: machine.id,
                        location: `${machine.city}, ${machine.country}`,
                        compatibility_score: result.score,
                        quality_score: machine.quality_score,
                        routing_score: Math.round(routingScore),
                        penalties: result.penalties
                    });
                }
            }

            // 3. Rank candidates using Intelligence Service (Phase 26.2)
            const ranked = routingIntelligence.rankCandidates(featureId, machines, {});

            return ranked;

        } catch (err) {
            console.error('[ROUTING-SERVICE] Discovery failed:', err.message);
            return [];
        }
    }

    /**
     * Final routing recommendation logic (Phase 26.2).
     */
    async recommendRoute(jobId, constraints) {
        // Fetch last features for job
        const { rows: [feature] } = await db.query(
            'SELECT id FROM print_features WHERE job_id = ? ORDER BY created_at DESC LIMIT 1',
            [jobId]
        );

        if (!feature) throw new Error('No features found for job. Run extraction first.');

        let candidates = await this.discoverCompatibleNodes(feature.id, constraints);
        let fallbackUsed = false;

        // Phase 27.1: Fallback Logic
        if (candidates.length === 0) {
            const fallback = await recommendationService.evaluateFallbackStrategies(feature.id, constraints);
            if (fallback.fallback_used) {
                fallbackUsed = true;
                // Retry discovery with relaxed constraints (in a real scenario, this would pass flags)
                candidates = await this.discoverCompatibleNodes(feature.id, { ...constraints, fallback: true });
            }
        }

        if (candidates.length === 0) {
            await recommendationService.logConflict(jobId, 'NO_COMPATIBLE_PRINTERS', 'Final attempt failed even with fallbacks.', 'HIGH');
            return {
                status: 'NO_COMPATIBLE_PRINTERS',
                recommendation: null,
                fallback_used: fallbackUsed
            };
        }

        // Phase 27.1: Hardened Recommendation
        const recommendation = await recommendationService.generateRecommendation(jobId, candidates, { fallback_used: fallbackUsed });

        return {
            status: 'SUCCESS',
            ...recommendation
        };
    }
}

module.exports = new RoutingService();
