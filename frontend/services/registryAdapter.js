/**
 * Frontend capability registry stub.
 *
 * Provides paper caliper and machine capability lookup data for use by the
 * capability adapters (paperCapabilityAdapter, printerCapabilityAdapter).
 *
 * NOTE: This is a frontend-side stub. The canonical issue registry lives in
 * app/services/registryAdapter.js. The import path in the adapters (currently
 * pointing here) needs to be reviewed once a shared module boundary is defined.
 */

function getBindingRules() {
  return {
    paper_calipers: {
      coated: {
        '60': 0.06, '70': 0.07, '80': 0.07, '90': 0.08, '100': 0.09,
        '115': 0.10, '135': 0.11, '150': 0.12, '170': 0.14, '200': 0.17,
        '250': 0.22, '300': 0.25, 'default': 0.10,
      },
      uncoated: {
        '50': 0.06, '60': 0.07, '70': 0.08, '80': 0.09, '90': 0.10,
        '100': 0.11, '120': 0.12, '140': 0.14, '170': 0.17, 'default': 0.10,
      },
    },
  };
}

function getMachineCapabilities() {
  return {
    types: {
      digital_toner: {
        binding: { saddle_stitch: true, perfect_bind: true, wire_o: false },
        format: { maxWidthMm: 330, maxHeightMm: 487 },
        constraints: { maxTac: 280, minDpi: 300, requiresBleed: false },
      },
      digital_inkjet: {
        binding: { saddle_stitch: true, perfect_bind: true, wire_o: true },
        format: { maxWidthMm: 420, maxHeightMm: 594 },
        constraints: { maxTac: 260, minDpi: 150, requiresBleed: true },
      },
      offset_litho: {
        binding: { saddle_stitch: true, perfect_bind: true, wire_o: true, hardcover: true },
        format: { maxWidthMm: 700, maxHeightMm: 1000 },
        constraints: { maxTac: 340, minDpi: 300, requiresBleed: true },
      },
    },
  };
}

module.exports = { getBindingRules, getMachineCapabilities };
