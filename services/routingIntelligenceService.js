// services/routingIntelligenceService.js
const db = require('./db');
const { v4: uuidv4 } = require('uuid');

class RoutingIntelligenceService {
    constructor() {
        this.weights = {
            compatibility: 0.35,
            quality: 0.25,
            capacity: 0.20,
            price: 0.10,
            distance: 0.10
        };
    }

    /**
     * Combines multiple factors into a single ranking score (0-100).
     */
    calculateRoutingScore(factors) {
        const {
            compatibility_score = 1.0, // 0 to 1
            quality_score = 0.5,       // 0 to 1
            capacity_score = 1.0,      // 0 to 1
            price_score = 1.0,         // 0 to 1 (lower price = higher score)
            distance_score = 1.0       // 0 to 1 (closer = higher score)
        } = factors;

        const w = this.weights;
        const totalScore = (
            (compatibility_score * w.compatibility) +
            (quality_score * w.quality) +
            (capacity_score * w.capacity) +
            (price_score * w.price) +
            (distance_score * w.distance)
        ) * 100;

        return Math.round(totalScore);
    }

    /**
     * Ranks candidates based on intelligence metrics.
     */
    rankCandidates(jobId, nodes, jobFeatures) {
        return nodes.map(node => {
            const compatibility = 1.0; // Placeholder for logic that matches jobFeatures to node machines
            const quality = node.quality_score || 0.5;
            const capacity = node.capacity_available_today > 0 ? 1.0 : 0.2;
            const price = 1.0 / (node.price_index || 1.0); // Normalize price
            const distance = 1.0; // Placeholder for geo logic

            const score = this.calculateRoutingScore({
                compatibility_score: compatibility,
                quality_score: quality,
                capacity_score: capacity,
                price_score: price,
                distance_score: distance
            });

            return {
                printer_id: node.id,
                printer_name: node.name,
                routing_score: score,
                compatibility_score: Math.round(compatibility * 100),
                quality_score: Math.round(quality * 100),
                capacity_score: Math.round(capacity * 100),
                price_score: Math.round(price * 100),
                distance_score: Math.round(distance * 100)
            };
        }).sort((a, b) => b.routing_score - a.routing_score);
    }

    /**
     * Persists routing attempt for analytics.
     */
    async storeRoutingHistory(jobId, candidates) {
        try {
            const queries = candidates.map(c => {
                const id = uuidv4();
                return db.query(`
                    INSERT INTO routing_history 
                    (id, job_id, printer_id, routing_score, compatibility_score, quality_score, capacity_score, price_score, distance_score)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                `, [
                    id, jobId, c.printer_id,
                    c.routing_score / 100,
                    c.compatibility_score / 100,
                    c.quality_score / 100,
                    c.capacity_score / 100,
                    c.price_score / 100,
                    c.distance_score / 100
                ]);
            });
            await Promise.all(queries);
        } catch (err) {
            console.error('[ROUTING-INTEL] Failed to store history:', err.message);
        }
    }
}

module.exports = new RoutingIntelligenceService();
