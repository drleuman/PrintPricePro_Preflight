'use strict';

/**
 * Unit regression tests for AUTOFIX server-side idempotency controls.
 * Verifies that duplicate requests sharing the same canonical options return
 * the same pending execution Promise/result, while distinct requests proceed independently.
 */

const assert = require('assert');
const apiClient = require('./services/apiClient');

// Override the API client to intercept PPOS engine calls deterministically
let pposCallCount = 0;
let mockServiceDelay = 100;
let shouldFailUpstream = false;

apiClient.pposRequest = async (url, options) => {
  if (url.includes('/actions/fix')) {
    pposCallCount++;
    if (shouldFailUpstream) {
      return {
        ok: false,
        status: 400,
        json: async () => ({ error: 'BAD_REQUEST', message: 'Simulated upstream rejection' })
      };
    }

    // Simulate async processing time to test pending Promise storage
    await new Promise(resolve => setTimeout(resolve, mockServiceDelay));

    const body = JSON.parse(options.body || '{}');
    const sourceJobId = url.split('/')[4];
    const fixJobId = `fix_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    return {
      ok: true,
      status: 200,
      json: async () => ({
        jobId: fixJobId,
        type: 'AUTOFIX',
        status: 'COMPLETED',
        requested_fixes: body.fixes || [],
        repairs: (body.fixes || []).map(code => ({
          code: typeof code === 'string' ? code : code.repairStrategy,
          status: 'APPLIED'
        }))
      })
    };
  }

  // Pre-fetch source job context mock
  if (url.includes('/status')) {
    return {
      ok: true,
      status: 200,
      json: async () => ({
        jobId: url.split('/').pop(),
        type: 'ANALYZE',
        status: 'COMPLETED',
        findings: [{ id: 'f1', severity: 'error', category: 'BLEED' }]
      })
    };
  }

  return { ok: true, status: 200, json: async () => ({}) };
};

// Force reload apiV2 router to bind the mocked pposRequest
delete require.cache[require.resolve('./routes/apiV2')];
const apiV2Router = require('./routes/apiV2');

// Helper to simulate router invocation
function simulatePostRequest(jobId, body, headers = {}) {
  return new Promise((resolve) => {
    const req = {
      method: 'POST',
      url: `/${jobId}/actions/fix`,
      params: { jobId },
      body,
      get: (header) => headers[header] || `req_${Date.now()}`,
      auth: { tenantId: 'tenant_test' }
    };

    const res = {
      statusCode: 200,
      responseData: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(data) {
        this.responseData = data;
        resolve({ status: this.statusCode, data });
        return this;
      }
    };

    // Find the POST handler in the stack
    const layer = apiV2Router.stack.find(
      l => l.route && l.route.path === '/:jobId/actions/fix' && l.route.methods.post
    );

    if (!layer) {
      resolve({ status: 404, data: { error: 'ROUTE_NOT_FOUND' } });
      return;
    }

    layer.route.stack[0].handle(req, res, () => {});
  });
}

async function runRegressionTests() {
  console.log('--- STARTING AUTOFIX IDEMPOTENCY REGRESSION TESTS ---\n');

  let passed = 0;
  let failed = 0;

  function assertPass(testName, cond, details) {
    if (cond) {
      console.log(`✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${testName}`, details || '');
      failed++;
    }
  }

  // Intercept logs to verify observability markers
  const originalLog = console.log;
  const capturedLogs = [];
  console.log = (...args) => {
    capturedLogs.push(args.map(a => (typeof a === 'object' ? JSON.stringify(a) : a)).join(' '));
    originalLog.apply(console, args);
  };

  try {
    // Ensure map starts clean
    apiV2Router.autofixIdempotencyMap.clear();

    // --- TEST 1: Identical concurrent requests deduplicated while pending ---
    console.log('[Test 1] Identical concurrent requests return the same pending Promise');
    pposCallCount = 0;
    mockServiceDelay = 150;

    const reqBody1 = {
      fixes: ['APPLY_BLEED', 'REBUILD_TRIMBOX'],
      forceBleed: true,
      targetProfile: 'FOGRA51'
    };

    // Fire two identical requests simultaneously
    const p1 = simulatePostRequest('job_src_100', reqBody1);
    const p2 = simulatePostRequest('job_src_100', reqBody1);

    const [res1, res2] = await Promise.all([p1, p2]);

    assertPass(
      'Both requests succeeded with 200 OK',
      res1.status === 200 && res2.status === 200,
      { res1Status: res1.status, res2Status: res2.status }
    );

    assertPass(
      'Both requests share the identical output fixJobId',
      res1.data.jobId === res2.data.jobId,
      { id1: res1.data.jobId, id2: res2.data.jobId }
    );

    assertPass(
      'Upstream PPOS engine was called exactly ONCE due to lock deduplication',
      pposCallCount === 1,
      { actualCalls: pposCallCount }
    );

    const hitLogFound = capturedLogs.some(l => l.includes('[BFF][AUTOFIX][IDEMPOTENT-HIT]'));
    assertPass(
      'Observability log [BFF][AUTOFIX][IDEMPOTENT-HIT] emitted correctly',
      hitLogFound,
      { logs: capturedLogs.filter(l => l.includes('IDEMPOTENT')) }
    );

    // --- TEST 2: Duplicate request on already completed fix returns cached result ---
    console.log('\n[Test 2] Duplicate request on cached success returns preserved outcome');
    const res3 = await simulatePostRequest('job_src_100', reqBody1);
    
    assertPass(
      'Subsequent request resolves immediately with cached result',
      res3.status === 200 && res3.data.jobId === res1.data.jobId,
      { expectedId: res1.data.jobId, gotId: res3.data.jobId }
    );
    assertPass(
      'PPOS engine call count remains exactly 1',
      pposCallCount === 1,
      { actualCalls: pposCallCount }
    );

    // --- TEST 3: Distinct request (different requested fixes) proceeds uniquely ---
    console.log('\n[Test 3] Distinct request proceeds independently');
    const reqBodyUnique = {
      fixes: ['CONVERT_CMYK'],
      forceBleed: false,
      targetProfile: 'FOGRA39'
    };

    const resUnique = await simulatePostRequest('job_src_100', reqBodyUnique);

    assertPass(
      'Unique request succeeds with new target fixJobId',
      resUnique.status === 200 && resUnique.data.jobId !== res1.data.jobId,
      { prevId: res1.data.jobId, newId: resUnique.data.jobId }
    );
    assertPass(
      'PPOS engine call count increments to 2',
      pposCallCount === 2,
      { actualCalls: pposCallCount }
    );

    // --- TEST 4: Upstream error clears the idempotency map ---
    console.log('\n[Test 4] Upstream failure clears idempotency key to permit retries');
    shouldFailUpstream = true;
    const reqBodyError = { fixes: ['FLATTEN_PDF'] };
    
    const resErr = await simulatePostRequest('job_fail_999', reqBodyError);
    
    assertPass(
      'Failing request returns failure status',
      resErr.status === 400,
      { status: resErr.status }
    );

    const clearLogFound = capturedLogs.some(l => l.includes('[BFF][AUTOFIX][IDEMPOTENT-CLEAR-ON-ERROR]'));
    assertPass(
      'Observability log [BFF][AUTOFIX][IDEMPOTENT-CLEAR-ON-ERROR] emitted successfully',
      clearLogFound,
      { logs: capturedLogs.filter(l => l.includes('CLEAR')) }
    );

    // Ensure map key was removed
    const mapKeys = Array.from(apiV2Router.autofixIdempotencyMap.keys());
    const errKeyStillPresent = mapKeys.some(k => k.includes('job_fail_999'));
    assertPass(
      'Idempotency key for failing job is fully cleared from map',
      !errKeyStillPresent,
      { currentKeys: mapKeys }
    );

  } finally {
    // Restore console.log
    console.log = originalLog;
  }

  console.log('\n--- REGRESSION SUITE EXECUTION SUMMARY ---');
  console.log(`Total Passed: ${passed}`);
  console.log(`Total Failed: ${failed}`);

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runRegressionTests();
