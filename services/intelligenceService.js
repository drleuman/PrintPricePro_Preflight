// services/intelligenceService.js
const db = require('./db');

class IntelligenceService {
    /**
     * Match technical features of a job against production constraints.
     * formalized penalty-based scoring.
     */
    async calculateCompatibilityScore(featureId, machineId, paperId, policyId) {
        try {
            const { rows: [feature] } = await db.query('SELECT * FROM print_features WHERE id = ?', [featureId]);
            const { rows: [machine] } = await db.query('SELECT * FROM machine_profiles WHERE id = ?', [machineId]);
            const { rows: [paper] } = await db.query('SELECT * FROM paper_profiles WHERE id = ?', [paperId]);

            // Policy is optional for base hardware compatibility
            const { rows: [policy] } = policyId ? await db.query('SELECT * FROM policy_constraints WHERE id = ?', [policyId]) : { rows: [null] };

            if (!feature || !machine) return 0;

            let score = 100;
            const penalties = [];

            // 1. TAC Penalty (-30 points if over limit)
            const tacLimit = Math.min(machine.max_tac || 400, policy?.tac_limit || 400);
            if (feature.max_tac > tacLimit) {
                score -= 30;
                penalties.push(`TAC ${feature.max_tac}% exceeds limit ${tacLimit}%`);
            }

            // 2. Resolution Penalty (-25 points if too low)
            const resRequired = Math.max(machine.min_res_dpi || 0, policy?.min_dpi || 0);
            if (feature.min_dpi < resRequired) {
                score -= 25;
                penalties.push(`Resolution ${feature.min_dpi} DPI below required ${resRequired}`);
            }

            // 3. Bleed Penalty (-40 points if required but missing)
            const bleedRequired = machine.requires_bleed || policy?.bleed_required;
            if (bleedRequired && !feature.has_bleed) {
                score -= 40;
                penalties.push('Bleed required but not detected in file');
            }

            // 4. Color Profile Mismatch (-20 points)
            if (paper?.icc_profile && feature.color_profile !== paper.icc_profile) {
                score -= 20;
                penalties.push(`Color profile mismatch: ${feature.color_profile} vs ${paper.icc_profile}`);
            }

            return {
                score: Math.max(0, score),
                penalties,
                timestamp: new Date()
            };
        } catch (err) {
            console.error('[INTEL-SERVICE] Compatibility calculation failed:', err.message);
            return { score: 0, error: err.message };
        }
    }

    /**
     * Log a new technical signature for a job (Refined Schema).
     */
    async logJobFeatures(jobId, tenantId, features) {
        try {
            const { v4: uuidv4 } = require('uuid');
            const id = uuidv4();
            await db.query(`
                INSERT INTO print_features (id, job_id, tenant_id, max_tac, min_dpi, has_bleed, color_profile, fonts_json)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                id,
                jobId,
                tenantId,
                features.max_tac,
                features.min_dpi,
                features.has_bleed,
                features.color_profile,
                JSON.stringify(features.fonts)
            ]);
            console.log(`[INTEL-SERVICE] Logged features for job ${jobId}`);
        } catch (err) {
            console.error('[INTEL-SERVICE] Failed to log job features:', err.message);
        }
    }
    /**
     * Get a consolidated intelligence report for a tenant's history.
     */
    async getTenantIntelligence(tenantId) {
        try {
            const { rows } = await db.query(`
                SELECT id, max_tac, min_dpi, has_bleed, color_profile, fonts_json, created_at 
                FROM print_features 
                WHERE tenant_id = ? 
                ORDER BY created_at DESC 
                LIMIT 100
            `, [tenantId]);

            return {
                totalAnalyses: rows.length,
                recentTrends: rows.map(r => ({
                    max_tac: r.max_tac,
                    min_dpi: r.min_dpi,
                    has_bleed: !!r.has_bleed,
                    color_profile: r.color_profile
                }))
            };
        } catch (err) {
            console.error('[INTEL-SERVICE] Fetch tenant intelligence failed:', err.message);
            return { totalAnalyses: 0, recentTrends: [] };
        }
    }
}

module.exports = new IntelligenceService();
