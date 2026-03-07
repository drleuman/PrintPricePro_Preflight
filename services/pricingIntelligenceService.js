const db = require('./db');

class PricingIntelligenceService {
    /**
     * Resolves the best pricing profile for a printer/machine combination.
     * machine_id is nullable.
     */
    async resolvePricingProfile(printerId, machineId = null) {
        try {
            // 1. Try Machine-specific profile
            if (machineId) {
                const { rows: machineProfiles } = await db.query(
                    "SELECT * FROM printer_pricing_profiles WHERE printer_id = ? AND machine_id = ? AND active = TRUE",
                    [printerId, machineId]
                );
                if (machineProfiles.length > 0) return machineProfiles[0];
            }

            // 2. Try Printer-wide profile
            const { rows: printerProfiles } = await db.query(
                "SELECT * FROM printer_pricing_profiles WHERE printer_id = ? AND pricing_scope = 'PRINTER' AND active = TRUE",
                [printerId]
            );
            if (printerProfiles.length > 0) return printerProfiles[0];

            return null;
        } catch (err) {
            console.error('[PRICING-INTEL] Failed to resolve profile:', err.message);
            return null;
        }
    }

    /**
     * Core production cost formula.
     */
    calculateProductionCost(inputs, profile) {
        const {
            estimated_sheet_count = 1,
            color_factor = 0, // 0 to 1
            tac_excess_factor = 0, // 0 to 1
            bleed_factor = 0, // 0 or 1
            is_rush = false,
            lead_time_days = 3
        } = inputs;

        const baseCost = Number(profile.base_cost_per_sheet) * estimated_sheet_count;
        const setupCost = Number(profile.setup_cost);
        const colorCost = Number(profile.color_multiplier) * color_factor * baseCost;
        const tacPenalty = Number(profile.tac_penalty_multiplier) * tac_excess_factor * baseCost;
        const bleedCost = Number(profile.bleed_handling_cost) * bleed_factor;

        let total = Math.max(
            Number(profile.minimum_job_fee),
            (baseCost + setupCost + colorCost + tacPenalty + bleedCost)
        );

        // Multipliers
        if (is_rush) {
            total *= Number(profile.rush_multiplier || 1.2);
        }

        // Simple lead time discount: if lead time > default(3), apply discount
        if (lead_time_days > 5) {
            total *= Number(profile.lead_time_discount_multiplier || 0.95);
        }

        return Number(total.toFixed(4));
    }

    /**
     * Estimates suggested price based on production cost and platform markup.
     */
    calculateSuggestedPrice(productionCost, platformMarkup = 1.35) {
        return Number((productionCost * platformMarkup).toFixed(4));
    }

    /**
     * Builds a detailed breakdown for audit/inspection.
     */
    buildBreakdown(inputs, profile, productionCost, suggestedPrice) {
        return {
            inputs,
            profile_id: profile.id,
            formula_v: '28.1',
            components: {
                base: Number(profile.base_cost_per_sheet) * (inputs.estimated_sheet_count || 1),
                setup: Number(profile.setup_cost),
                color: (Number(profile.color_multiplier) * (inputs.color_factor || 0)).toFixed(4),
                min_fee_applied: productionCost === Number(profile.minimum_job_fee)
            },
            economic_summary: {
                production_cost: productionCost,
                suggested_price: suggestedPrice,
                estimated_margin: Number((suggestedPrice - productionCost).toFixed(4)),
                margin_pct: Number(((suggestedPrice - productionCost) / suggestedPrice * 100).toFixed(2))
            }
        };
    }
}

module.exports = new PricingIntelligenceService();
