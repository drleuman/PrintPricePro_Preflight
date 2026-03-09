/**
 * @project PrintPrice Pro - Production Matchmaker Engine
 * @author Manuel Enrique Morales (https://manuelenriquemorales.com/)
 * @social https://x.com/manuel_emorales | https://www.linkedin.com/in/manuelenriquemorales/
 */
const db = require('./db');
const capabilitySync = require('./capabilitySyncService');
const compatibilityEngine = require('./compatibilityEngine');
const weightsConfig = require('../registry/matchmaker_weights.json');

/**
 * Matchmaker Service
 * 
 * Orquestra el proceso de selección de la mejor imprenta para un trabajo.
 */
class Matchmaker {
    constructor() {
        this.weights = weightsConfig.weights || { physical: 0.45, operative: 0.35, commercial: 0.20 };
        this.thresholds = weightsConfig.score_thresholds || { minimum_overall: 0.6, minimum_physical: 0.8 };
    }

    /**
     * Encuentra los mejores candidatos para un trabajo.
     * 
     * @param {Object} technicalFacts 
     * @param {Object} productionIntent 
     * @param {Object} productionSpecs 
     * @returns {Promise<Object>} Matchmaking result
     */
    async match(technicalFacts, productionIntent, productionSpecs) {
        try {
            // 1. Obtener todos los perfiles activos
            const printerProfiles = await capabilitySync.getActivePrinterProfiles();

            if (printerProfiles.length === 0) {
                return {
                    status: 'no_printers_available',
                    decision_explanation: 'No active printers found in the registry.'
                };
            }

            // 2. Evaluar cada perfil
            const assessments = printerProfiles.map(profile => {
                const assessment = compatibilityEngine.evaluate(technicalFacts, productionIntent, productionSpecs, profile);

                // Calcular Score Final (Weighted)
                assessment.scores.overall = parseFloat(this.calculateOverallScore(assessment.scores).toFixed(3));
                return assessment;
            });

            // 3. Filtrar por Thresholds e Incompatibilidad
            const validCandidates = assessments.filter(a => {
                if (a.status === 'incompatible') return false;

                // Aplicar Thresholds
                if (a.scores.overall < this.thresholds.minimum_overall) return false;
                if (a.scores.physical < this.thresholds.minimum_physical) return false;

                return true;
            });

            // 4. Ordenar y Seleccionar (con Tie-Breaker)
            const sortedAssessments = validCandidates.sort((a, b) => {
                const delta = b.scores.overall - a.scores.overall;

                // Tie-breaker: si la diferencia es mínima (< 0.01), usar el tie-breaker configurado
                if (Math.abs(delta) < 0.01) {
                    if (weightsConfig.tie_breaker === 'cost_lowest') {
                        // price_index más bajo gana (ya contemplado en el score comercial, pero aquí forzamos)
                        const profileA = printerProfiles.find(p => p.printerId === a.printerId);
                        const profileB = printerProfiles.find(p => p.printerId === b.printerId);
                        return (profileA.price_index || 1.0) - (profileB.price_index || 1.0);
                    }
                }

                return delta;
            });

            const best = sortedAssessments.length > 0 ? sortedAssessments[0] : null;

            return {
                status: best ? 'success' : (validCandidates.length === 0 ? 'no_compatible_printers' : 'threshold_rejection'),
                best_printer_id: best ? best.printerId : null,
                best_machine_id: best ? best.machineId : null,
                decision_explanation: this.generateMatchmakingExplanation(best, assessments),
                candidates: assessments.sort((a, b) => b.scores.overall - a.scores.overall).slice(0, 5),
                metadata: {
                    matchmaker_version: '3.1.0',
                    weights_version: weightsConfig.version || '1.0.0',
                    weights_applied: this.weights,
                    thresholds_applied: this.thresholds,
                    total_scanned: assessments.length,
                    compatible_count: validCandidates.length
                }
            };
        } catch (err) {
            console.error('[MATCHMAKER] Error during matchmaking:', err.message);
            throw err;
        }
    }

    calculateOverallScore(scores) {
        return (scores.physical * this.weights.physical) +
            (scores.operative * this.weights.operative) +
            (scores.commercial * this.weights.commercial);
    }

    generateMatchmakingExplanation(best, all) {
        if (!best) {
            const topBlocker = this.extractTopBlockers(all);
            return `No compatible printer found. Most candidates were blocked by: ${topBlocker}.`;
        }

        const overallPct = Math.round(best.scores.overall * 100);
        return `Selected ${best.printerId} as the best match (${overallPct}% weighted score). ${best.decisionExplanation}`;
    }

    extractTopBlockers(assessments) {
        const blockerCounts = {};
        assessments.forEach(a => {
            a.blockingReasons.forEach(r => {
                blockerCounts[r.id] = (blockerCounts[r.id] || 0) + 1;
            });
        });

        const sorted = Object.entries(blockerCounts).sort((a, b) => b[1] - a[1]);
        return sorted.length > 0 ? sorted[0][0] : 'technical constraints';
    }
}

module.exports = new Matchmaker();
