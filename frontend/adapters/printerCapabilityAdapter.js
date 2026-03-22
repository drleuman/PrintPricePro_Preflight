const registryAdapter = require('../services/registryAdapter');
const machineBaselines = registryAdapter.getMachineCapabilities();

/**
 * Printer Capability Adapter
 * 
 * Transforms DB printer/machine records into normalized V3 PrinterCapabilityProfile.
 */
class PrinterCapabilityAdapter {
    /**
     * Transforms a machine record (joined with profile) into a PrinterCapabilityProfile.
     * @param {Object} printer 
     * @param {Object} machine 
     * @returns {Object} PrinterCapabilityProfile
     */
    toProfile(printer, machine) {
        if (!printer || !machine) return null;

        const type = machine.type || 'digital_toner';
        const baseline = machineBaselines.types[type] || machineBaselines.types['digital_toner'];

        return {
            printerId: printer.id,
            machineId: machine.id,
            capabilities: {
                bindingConstraints: baseline.binding || {},
                paperUsageLimits: this.getDefaultPaperUsageLimits(type),
                format: baseline.format,
                colorCapabilities: {
                    supportedProfiles: ['FOGRA39', 'FOGRA51', 'GRACol2006'],
                    rgbTolerance: type.includes('digital') ? 'conditional' : 'none'
                }
            },
            constraints: {
                maxTac: machine.max_tac || baseline.constraints.maxTac,
                minDpi: machine.min_res_dpi || baseline.constraints.minDpi,
                requiresBleed: machine.requires_bleed !== undefined ? !!machine.requires_bleed : baseline.constraints.requiresBleed
            },
            sourceTrace: ['printer_profile', 'fallback_heuristic']
        };
    }

    getDefaultPaperUsageLimits(machineType) {
        // Standard industrial capabilities
        return {
            interior: { supported: true, minGsm: 60, maxGsm: 200 },
            cover: { supported: true, minGsm: 170, maxGsm: 350 },
            hardcover_wrap: { supported: true, minGsm: 115, maxGsm: 150 },
            endpaper: { supported: true, minGsm: 120, maxGsm: 170 }
        };
    }
}

module.exports = new PrinterCapabilityAdapter();
