/**
 * Compatibility Engine
 * 
 * Evalua la compatibilidad de una imprenta/máquina específica con un trabajo
 * basado en sus capacidades técnicas y restricciones físicas.
 */
class CompatibilityEngine {
    /**
     * Evalua un perfil de imprenta contra los requerimientos de un trabajo.
     * 
     * @param {Object} technicalFacts Hechos técnicos del PDF.
     * @param {Object} productionIntent Intención detectada.
     * @param {Object} productionSpecs Especificaciones normalizadas (BPE).
     * @param {Object} printerProfile Perfil de capacidades de la imprenta (V3).
     * @returns {Object} CompatibilityAssessment
     */
    evaluate(technicalFacts, productionIntent, productionSpecs, printerProfile) {
        const evidence = [];
        const blockingReasons = [];
        const requiredActions = [];

        // 1. Evaluación Física (Physical)
        const physicalResult = this.evaluatePhysical(technicalFacts, productionSpecs, printerProfile);
        evidence.push(...physicalResult.evidence);
        blockingReasons.push(...physicalResult.blockingReasons);

        // 2. Evaluación Operativa (Operative)
        const operativeResult = this.evaluateOperative(technicalFacts, productionSpecs, printerProfile);
        evidence.push(...operativeResult.evidence);
        blockingReasons.push(...operativeResult.blockingReasons);
        requiredActions.push(...operativeResult.requiredActions);

        // 3. Evaluación Comercial (Placeholder)
        const commercialResult = this.evaluateCommercial(printerProfile);

        // Calcular Status final
        let status = 'ready';
        const hardBlockers = blockingReasons.filter(r => r.scope === 'physical' || r.scope === 'operative');

        if (hardBlockers.length > 0) {
            status = 'incompatible';
        } else if (evidence.some(e => !e.passed) || requiredActions.length > 0) {
            status = 'conditionally_ready';
        }

        return {
            printerId: printerProfile.printerId,
            machineId: printerProfile.machineId,
            status,
            scores: {
                physical: parseFloat(physicalResult.score.toFixed(3)),
                operative: parseFloat(operativeResult.score.toFixed(3)),
                commercial: parseFloat(commercialResult.score.toFixed(3))
            },
            blockingReasons,
            requiredActions,
            evidence,
            decisionExplanation: this.generateExplanation(status, evidence, blockingReasons, requiredActions)
        };
    }

    evaluatePhysical(facts, specs, profile) {
        const evidence = [];
        const blockingReasons = [];
        let score = 1.0;

        const caps = profile.capabilities;
        const bindingType = specs.bindingType;
        const pageCount = facts.info?.pages || specs.pageCount || 0;

        // Check A: Binding Support
        const bindingCap = caps.bindingConstraints[bindingType];
        if (!bindingCap || !bindingCap.supported) {
            score = 0;
            const msg = `Binding type '${bindingType}' is not supported by this machine.`;
            evidence.push({ id: 'binding_support', scope: 'physical', passed: false, message: msg });
            blockingReasons.push({ id: 'UNSUPPORTED_BINDING', scope: 'physical' });
        } else {
            evidence.push({ id: 'binding_support', scope: 'physical', passed: true });

            // Check B: Page count limits
            if (pageCount < (bindingCap.minPages || 0)) {
                score *= 0.5;
                const msg = `Page count (${pageCount}) is below machine minimum (${bindingCap.minPages}).`;
                evidence.push({ id: 'page_count_min', scope: 'physical', passed: false, message: msg });
                blockingReasons.push({ id: 'PAGES_BELOW_MIN', scope: 'physical' });
            } else if (bindingCap.maxPages && pageCount > bindingCap.maxPages) {
                score = 0;
                const msg = `Page count (${pageCount}) exceeds machine maximum (${bindingCap.maxPages}).`;
                evidence.push({ id: 'page_count_max', scope: 'physical', passed: false, message: msg });
                blockingReasons.push({ id: 'PAGES_EXCEED_MAX', scope: 'physical' });
            } else {
                evidence.push({ id: 'page_count_range', scope: 'physical', passed: true });
            }
        }

        // Check C: Format Limits (Trim Size)
        const width = specs.trimWidthMm;
        const height = specs.trimHeightMm;
        if (width > 0 && height > 0) {
            const f = caps.format;
            const outOfBounds = width < f.minWidthMm || width > f.maxWidthMm || height < f.minHeightMm || height > f.maxHeightMm;
            if (outOfBounds) {
                score = 0;
                const msg = `Trim size ${width}x${height} is outside machine bounds (${f.minWidthMm}x${f.minHeightMm} to ${f.maxWidthMm}x${f.maxHeightMm}).`;
                evidence.push({ id: 'format_bounds', scope: 'physical', passed: false, message: msg });
                blockingReasons.push({ id: 'FORMAT_OUT_OF_BOUNDS', scope: 'physical' });
            } else {
                evidence.push({ id: 'format_bounds', scope: 'physical', passed: true });
            }
        }

        // Check D: Paper GSM limits for Interior
        const paperUsage = caps.paperUsageLimits['interior'];
        const targetGsm = specs.paperGsm || 90;
        if (paperUsage && paperUsage.supported) {
            const min = paperUsage.minGsm || 0;
            const max = paperUsage.maxGsm || 999;
            const threshold = 0.15; // 15% tolerance for warning

            if (targetGsm < min * (1 - threshold) || targetGsm > max * (1 + threshold)) {
                score = 0; // Hard block
                const msg = `Target paper GSM (${targetGsm}) is extremely outside machine interior limits (${min}-${max}).`;
                evidence.push({ id: 'paper_gsm_interior', scope: 'physical', passed: false, message: msg });
                blockingReasons.push({ id: 'PAPER_GSM_OUT_OF_RANGE', scope: 'physical' });
            } else if (targetGsm < min || targetGsm > max) {
                score *= 0.6; // Heavy Penalty
                const msg = `Target paper GSM (${targetGsm}) is slightly outside machine interior limits (${min}-${max}). Possible but sub-optimal.`;
                evidence.push({ id: 'paper_gsm_interior', scope: 'physical', passed: false, message: msg });
                // Note: removed from blockingReasons to avoid 'incompatible' status if within 15%
            } else {
                evidence.push({ id: 'paper_gsm_interior', scope: 'physical', passed: true });
            }
        }

        return { score, evidence, blockingReasons };
    }

    evaluateOperative(facts, specs, profile) {
        const evidence = [];
        const blockingReasons = [];
        const requiredActions = [];
        let score = 1.0;

        const constraints = profile.constraints;

        // Check D: TAC (Total Area Coverage)
        const pdfTac = facts.maxTac || 0;
        if (pdfTac > constraints.maxTac) {
            score *= 0.8;
            const msg = `PDF TAC (${pdfTac}%) exceeds machine limit (${constraints.maxTac}%).`;
            evidence.push({ id: 'tac_limit', scope: 'operative', passed: false, message: msg });
            requiredActions.push({ id: 'REDUCE_TAC', actionability: 'required', scope: 'operative', message: 'Ink reduction required before printing.' });
        } else {
            evidence.push({ id: 'tac_limit', scope: 'operative', passed: true });
        }

        // Check E: Resolution (DPI)
        const pdfDpi = facts.minDpi || 300;
        if (pdfDpi < constraints.minDpi) {
            score *= 0.9;
            const msg = `PDF contains low-res images (${pdfDpi} DPI) below machine threshold (${constraints.minDpi} DPI).`;
            evidence.push({ id: 'dpi_quality', scope: 'operative', passed: false, message: msg });
            requiredActions.push({ id: 'UPSCALING_OR_RISK_ACCEPTANCE', actionability: 'recommended', scope: 'operative', message: 'Images may appear pixelated.' });
        } else {
            evidence.push({ id: 'dpi_quality', scope: 'operative', passed: true });
        }

        // Check F: Bleed Requirements
        if (constraints.requiresBleed && !specs.hasBleed && !facts.hasBleed) {
            score *= 0.7;
            const msg = `Machine requires bleed, but none detected in PDF or spec.`;
            evidence.push({ id: 'bleed_check', scope: 'operative', passed: false, message: msg });
            blockingReasons.push({ id: 'MISSING_REQUIRED_BLEED', scope: 'operative' });
        } else {
            evidence.push({ id: 'bleed_check', scope: 'operative', passed: true });
        }

        return { score, evidence, blockingReasons, requiredActions };
    }

    evaluateCommercial(profile) {
        // Use price_index as primary signal. Standard index is 1.0. 
        // We normalize so lower price index = higher score.
        const index = profile.price_index || 1.0;
        const score = Math.max(0, 1.2 - (index * 0.2)); // e.g., index 1.0 -> score 1.0; index 2.0 -> score 0.8
        return { score };
    }

    generateExplanation(status, evidence, blockers, actions) {
        if (status === 'ready') return 'Perfect match. Printer fully meets all physical and operative requirements.';

        if (status === 'incompatible') {
            const criticalFails = evidence.filter(e => !e.passed && e.message).map(e => e.message);
            return `Rejected: ${criticalFails.join(' ')}`;
        }

        // Conditionally Ready
        const issues = evidence.filter(e => !e.passed && e.message).map(e => e.message);
        const actionMsgs = actions.map(a => a.message);
        return `Compatible with adjustments: ${issues.join(' ')} ${actionMsgs.join(' ')}`.trim();
    }
}

module.exports = new CompatibilityEngine();
