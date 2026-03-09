const fs = require('fs');
const path = require('path');

/**
 * SpineCalculator
 * 
 * Calculates theoretical spine width using paper caliper data.
 */
class SpineCalculator {
    constructor() {
        this.rulesPath = path.join(__dirname, '../registry/binding_rules.json');
        this.rules = this.loadRules();
    }

    loadRules() {
        try {
            const data = fs.readFileSync(this.rulesPath, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            console.error('[SpineCalculator] Failed to load rules:', error);
            return {};
        }
    }

    /**
     * Calculates the theoretical spine width in millimeters.
     */
    calculateTheoreticalSpine(params) {
        const { pageCount, paperType = 'coated', paperGsm = 130 } = params;

        const typeGroup = this.rules.paper_calipers[paperType] || this.rules.paper_calipers['coated'];
        const caliper = typeGroup[String(paperGsm)] || typeGroup['default'];

        const spine_mm = (pageCount / 2) * caliper;

        return {
            spine_mm: Number(spine_mm.toFixed(3)),
            caliper: caliper,
            source: 'binding_rules_registry'
        };
    }

    /**
     * Evaluates the delta between detected and theoretical spine.
     */
    evaluateDelta(detected, theoretical, bindingType = 'perfect') {
        const delta = Math.abs(detected - theoretical);
        const bindingRules = this.rules.binding_types[bindingType] || this.rules.binding_types['perfect'];
        const thresholds = bindingRules.tolerances.spine_delta_mm;

        let classification = 'BLOCKING';
        let status = 'error';

        if (delta <= thresholds.green) {
            classification = 'GREEN';
            status = 'ok';
        } else if (delta <= thresholds.attention) {
            classification = 'ATTENTION';
            status = 'warning';
        }

        return {
            delta: Number(delta.toFixed(3)),
            classification,
            status,
            thresholds
        };
    }
}

module.exports = new SpineCalculator();
