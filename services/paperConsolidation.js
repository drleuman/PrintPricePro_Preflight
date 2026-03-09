const bindingRules = require('../registry/binding_rules.json');
const paperAdapter = require('../adapters/paperCapabilityAdapter');

/**
 * Paper Consolidation Service
 * 
 * Ensures a single source of truth for paper parameters and syncs with BPE rules.
 */
class PaperConsolidationService {
    /**
     * Consolidates a paper profile with BPE calipers and usage rules.
     */
    consolidate(profile) {
        if (!profile) return null;

        const gsm = profile.gsm;
        const finish = profile.finish || 'uncoated';

        // Enforce BPE calipers
        const bpeCaliper = this.getBPECaliper(finish, gsm);

        return {
            ...profile,
            caliperMmPerSheet: bpeCaliper,
            usageCompatibility: {
                ...profile.usageCompatibility,
                ...this.getBPEUsageLimits(finish, gsm)
            },
            consolidatedAt: new Date().toISOString()
        };
    }

    getBPECaliper(finish, gsm) {
        const family = bindingRules.paper_calipers[finish] || bindingRules.paper_calipers['uncoated'];
        return family[String(gsm)] || family['default'] || 0.1;
    }

    getBPEUsageLimits(finish, gsm) {
        // Enforce standard BPE manufacture limits
        return {
            interior: true,
            cover: gsm >= 170,
            hardcover_wrap: gsm >= 115 && gsm <= 150 && finish === 'coated',
            endpaper: gsm >= 120 && gsm <= 170 && finish === 'uncoated'
        };
    }

    /**
     * Resolves a best-fit paper profile from a list given target parameters.
     */
    resolveBestFit(profiles, targetFinish, targetGsm) {
        if (!profiles || profiles.length === 0) return null;

        return profiles.find(p => p.finish === targetFinish && p.gsm === targetGsm)
            || profiles.find(p => p.finish === targetFinish)
            || profiles[0];
    }
}

module.exports = new PaperConsolidationService();
