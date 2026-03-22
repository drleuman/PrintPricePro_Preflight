const registryAdapter = require('../services/registryAdapter');
const bindingRules = registryAdapter.getBindingRules();

/**
 * Paper Capability Adapter
 * 
 * Transforms DB paper records and BPE calipers into V3 PaperStockProfile.
 */
class PaperCapabilityAdapter {
    /**
     * Transforms a DB row from 'paper_profiles' into a PaperStockProfile.
     * @param {Object} dbRecord 
     * @returns {Object} PaperStockProfile
     */
    toProfile(dbRecord) {
        if (!dbRecord) return null;

        const gsm = dbRecord.weight || 90;
        const finish = this.inferFinish(dbRecord.name);

        // Lookup caliper from binding_rules mapping
        const caliper = this.lookupCaliper(finish, gsm);

        return {
            paperId: dbRecord.id,
            name: dbRecord.name,
            gsm: gsm,
            caliperMmPerSheet: caliper,
            tacLimit: this.inferTacLimit(finish, dbRecord.absorption_coefficient),
            finish: finish,
            usageCompatibility: this.inferUsageCompatibility(finish, gsm),
            sourceTrace: ['paper_registry', 'bpe_profile']
        };
    }

    inferFinish(name) {
        const n = String(name || '').toLowerCase();
        if (n.includes('offset') || n.includes('uncoated') || n.includes('bond')) return 'uncoated';
        if (n.includes('silk') || n.includes('gloss') || n.includes('matte') || n.includes('coated')) return 'coated';
        return 'uncoated'; // Balanced default
    }

    lookupCaliper(finish, gsm) {
        const family = bindingRules.paper_calipers[finish] || bindingRules.paper_calipers['uncoated'];
        return family[String(gsm)] || family['default'] || 0.1;
    }

    inferTacLimit(finish, absorption) {
        // Basic heuristic: uncoated usually handles less TAC without issues
        if (finish === 'uncoated') return 240;
        return 300;
    }

    inferUsageCompatibility(finish, gsm) {
        // Real-world printing logic for standard papers
        return {
            interior: true,
            cover: gsm >= 170,
            hardcover_wrap: gsm >= 115 && gsm <= 150 && finish === 'coated',
            endpaper: gsm >= 120 && gsm <= 170 && finish === 'uncoated'
        };
    }
}

module.exports = new PaperCapabilityAdapter();
