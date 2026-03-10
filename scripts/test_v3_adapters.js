const printerAdapter = require('../adapters/printerCapabilityAdapter');
const paperAdapter = require('../adapters/paperCapabilityAdapter');

// 1. Test Paper Adapter
const mockPaperDB = {
    id: 'paper_123',
    name: 'Silk Coated 150g',
    weight: 150,
    absorption_coefficient: 0.15,
    icc_profile: 'FOGRA39'
};

console.log('--- V3 Capability Adapters Verification ---\n');

console.log('1. Testing PaperCapabilityAdapter...');
const paperProfile = paperAdapter.toProfile(mockPaperDB);
console.log(JSON.stringify(paperProfile, null, 2));

const paperOk = paperProfile.finish === 'coated' &&
    paperProfile.caliperMmPerSheet === 0.115 &&
    paperProfile.usageCompatibility.hardcover_wrap === true;

console.log(paperOk ? '✅ Paper Adapter OK' : '❌ Paper Adapter FAILED');

// 2. Test Printer Adapter
const mockPrinterDB = {
    id: 'printer_abc',
    name: 'PrintHouse Alpha'
};

const mockMachineDB = {
    id: 'machine_jet',
    type: 'digital_inkjet',
    max_tac: 220,
    min_res_dpi: 600
};

console.log('\n2. Testing PrinterCapabilityAdapter...');
const printerProfile = printerAdapter.toProfile(mockPrinterDB, mockMachineDB);
console.log(JSON.stringify(printerProfile, null, 2));

const printerOk = printerProfile.constraints.maxTac === 220 &&
    printerProfile.capabilities.format.maxWidthMm === 500 &&
    printerProfile.capabilities.bindingConstraints.perfect.maxPages === 1000;

console.log(printerOk ? '✅ Printer Adapter OK' : '❌ Printer Adapter FAILED');

console.log(`\nFinal Adapters Status: ${(paperOk && printerOk) ? '✅ PASS' : '❌ FAIL'}`);
