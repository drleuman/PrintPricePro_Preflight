/**
 * Worker Guardrails Test Suite
 */

// Mock RegionContext and redactPaths for isolated test
const regionContext = require('./ppos-shared-infra/packages/region/RegionContext');
const { redactPaths } = require('./ppos-shared-infra/packages/region/sanitizationUtils');
const regionFilter = require('./ppos-shared-infra/packages/region/RegionFilter');

// Manual require of the sanitizer but with controlled dependencies
const workerSanitizer = require('./ppos-preflight-worker/compliance/workerSanitizer');

function runTests() {
    console.log('--- STARTING WORKER GUARDRAIL TESTS ---');

    // TC-01 & TC-02: Path Sanitization in Errors
    console.log('\n[1] Testing Error Sanitization (Paths)...');
    const winErr = new Error('Failed to access C:\\Users\\KIKE\\Desktop\\secret.pdf');
    const nixErr = new Error('Permission denied at /home/ubuntu/ppos-preflight/src/index.js');
    const tempErr = new Error('Storage full at /tmp/ppos-temp-123');

    const sWin = workerSanitizer.sanitizeError(winErr);
    const sNix = workerSanitizer.sanitizeError(nixErr);
    const sTemp = workerSanitizer.sanitizeError(tempErr);

    if (sWin.message.includes('[REDACTED_LOCAL_PATH]')) console.log('✅ PASS: Windows path redacted.');
    if (sNix.message.includes('[REDACTED_SYSTEM_PATH]')) console.log('✅ PASS: Unix system path redacted.');
    if (sTemp.message.includes('[REDACTED_TEMP_PATH]')) console.log('✅ PASS: Temp path redacted.');

    // TC-03: Quarantine Metadata Guardrails
    console.log('\n[2] Testing Quarantine Metadata...');
    const strategy = {
        action: 'FAIL',
        quarantine: 'input_poison',
        instruction: 'REROUTE_TO_ISOLATED_POOL'
    };
    const sQuar = workerSanitizer.sanitizeQuarantineMetadata('job_99', strategy);
    console.log('Sanitized Quarantine:', JSON.stringify(sQuar, null, 2));
    if (sQuar.job_id === 'job_99' && !sQuar.asset_path) {
        console.log('✅ PASS: Quarantine metadata is safe and concise.');
    }

    // TC-04: Audit Payload Filtering
    console.log('\n[3] Testing Audit Payload Filtering...');
    const rawAudit = {
        tenantId: 'cust_001',
        message: 'Error processing D:\\Assets\\raw.pdf',
        strategy: { retry: false, local_path: 'C:\\temp' }
    };
    const sAudit = workerSanitizer.sanitizeAuditPayload(rawAudit);
    console.log('Sanitized Audit:', JSON.stringify(sAudit, null, 2));
    if (sAudit.message.includes('[REDACTED_LOCAL_PATH]') && !sAudit.strategy.local_path) {
        console.log('✅ PASS: Audit payload paths and strategy fragments redacted.');
    }

    // TC-05: Log Redaction
    console.log('\n[4] Testing Log Redaction...');
    const logObj = { event: 'SUBPROCESS_EXIT', stderr: 'Error in C:\\Engine\\core.dll' };
    const sLog = workerSanitizer.sanitizeLog(logObj);
    if (sLog.stderr.includes('[REDACTED_LOCAL_PATH]')) {
        console.log('✅ PASS: Structured log redacted.');
    }

    console.log('\n--- WORKER GUARDRAIL TESTS COMPLETED ---');
}

runTests();






















