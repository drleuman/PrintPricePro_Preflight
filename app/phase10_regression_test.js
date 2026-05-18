'use strict';

const assert = require('assert');
const statusHelpers = require('./services/statusHelpers');
const apiClient = require('./services/apiClient');

let passed = 0;
let failed = 0;

function assertPass(msg, cond, details = {}) {
  if (cond) {
    passed++;
    console.log(`✅ PASS: ${msg}`);
  } else {
    failed++;
    console.error(`❌ FAIL: ${msg}`, details);
  }
}

async function runTests() {
  console.log('--- STARTING PHASE 10 REGRESSION TESTS ---');

  // 1. Status Helpers Tests
  console.log('\n[Test 1] Status Helpers Coverage');
  try {
    assertPass(
      'DEGRADED is terminal diagnostic',
      statusHelpers.isTerminalDiagnosticStatus('DEGRADED') === true
    );
    assertPass(
      'PARTIAL is terminal diagnostic',
      statusHelpers.isTerminalDiagnosticStatus('PARTIAL') === true
    );
    assertPass(
      'PARTIAL_ARTIFACTS is terminal diagnostic',
      statusHelpers.isTerminalDiagnosticStatus('PARTIAL_ARTIFACTS') === true
    );
    assertPass(
      'COMPLETED_WITH_FINDINGS is terminal diagnostic',
      statusHelpers.isTerminalDiagnosticStatus('COMPLETED_WITH_FINDINGS') === true
    );
    assertPass(
      'FAILED_RUNTIME_ENVIRONMENT is terminal failure',
      statusHelpers.isTerminalFailureStatus('FAILED_RUNTIME_ENVIRONMENT') === true
    );
    assertPass(
      'ENGINE_ENVIRONMENT_FAILURE is terminal failure',
      statusHelpers.isTerminalFailureStatus('ENGINE_ENVIRONMENT_FAILURE') === true
    );
    assertPass(
      'DEGRADED is terminal status',
      statusHelpers.isTerminalStatus('DEGRADED') === true
    );
  } catch (err) {
    failed++;
    console.error('❌ Fail status helpers test:', err);
  }

  // 2. Policies Metadata Propagation
  console.log('\n[Test 2] Policies Metadata Propagation');
  // Mock pposRequest for policies
  const originalPposRequest = apiClient.pposRequest;
  
  apiClient.pposRequest = async (url, options) => {
    if (url.includes('/policies')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          source: 'UPSTREAM_SERVER',
          fallbackMode: false,
          policyVersion: 'v10.4',
          loadedAt: '2026-05-18T12:00:00Z',
          policies: [
            { id: 'OFFSET_MODERN_COATED', name: 'Offset Modern Coated' }
          ]
        })
      };
    }
    
    if (url.includes('/artifacts/')) {
      return {
        ok: false,
        status: 404,
        headers: {
          get: (key) => key.toLowerCase() === 'content-type' ? 'application/json' : null
        },
        json: async () => ({
          error: 'ARTIFACT_NOT_FOUND',
          message: 'Spec file fixed.pdf not created.',
          requestedAlias: 'fixed.pdf',
          availableArtifacts: ['report.json', 'trim_spec.json']
        })
      };
    }

    return { ok: true, status: 200, json: async () => ({}) };
  };

  // Force reload apiV2 router to bind the mocked pposRequest
  delete require.cache[require.resolve('./routes/apiV2')];
  const apiV2Router = require('./routes/apiV2');

  // Simulators
  function simulateGetPolicies() {
    return new Promise((resolve) => {
      const req = {
        method: 'GET',
        url: '/policies',
        get: () => 'trace-123'
      };
      const res = {
        status: function(code) {
          this.statusCode = code;
          return this;
        },
        json: function(data) {
          resolve({ status: this.statusCode || 200, data });
        }
      };
      const policiesHandler = apiV2Router.stack.find(layer => layer.route && layer.route.path === '/policies').route.stack[0].handle;
      policiesHandler(req, res);
    });
  }

  function simulateGetArtifact(jobId, artifactId) {
    return new Promise((resolve) => {
      const req = {
        method: 'GET',
        url: `/${jobId}/artifacts/${artifactId}`,
        params: { jobId, artifactId },
        get: () => 'trace-456'
      };
      const res = {
        status: function(code) {
          this.statusCode = code;
          return this;
        },
        json: function(data) {
          resolve({ status: this.statusCode || 200, data });
        }
      };
      const routeStack = apiV2Router.stack.find(layer => layer.route && layer.route.path === '/:jobId/artifacts/:artifactId').route.stack;
      const artifactHandler = routeStack[routeStack.length - 1].handle;
      artifactHandler(req, res);
    });
  }

  try {
    const policiesRes = await simulateGetPolicies();
    assertPass(
      'Policies endpoint returns 200',
      policiesRes.status === 200
    );
    assertPass(
      'Policies endpoint propagates source',
      policiesRes.data.source === 'UPSTREAM_SERVER'
    );
    assertPass(
      'Policies endpoint propagates fallbackMode',
      policiesRes.data.fallbackMode === false
    );
    assertPass(
      'Policies endpoint propagates policyVersion',
      policiesRes.data.policyVersion === 'v10.4'
    );
    assertPass(
      'Policies endpoint propagates loadedAt',
      policiesRes.data.loadedAt === '2026-05-18T12:00:00Z'
    );
    assertPass(
      'Policies endpoint propagates policies list',
      Array.isArray(policiesRes.data.policies) && policiesRes.data.policies.length === 1
    );
  } catch (err) {
    failed++;
    console.error('❌ Fail policies metadata test:', err);
  }

  // 3. Artifact 404 ARTIFACT_NOT_FOUND test
  console.log('\n[Test 3] Artifact 404 Preservation');
  try {
    const artifactRes = await simulateGetArtifact('job_123', 'fixed_pdf');
    assertPass(
      'Artifact proxy returns 404 on missing artifact',
      artifactRes.status === 404
    );
    assertPass(
      'Artifact proxy preserves exact error code',
      artifactRes.data.error === 'ARTIFACT_NOT_FOUND'
    );
    assertPass(
      'Artifact proxy preserves requestedAlias',
      artifactRes.data.requestedAlias === 'fixed.pdf'
    );
    assertPass(
      'Artifact proxy preserves availableArtifacts list',
      Array.isArray(artifactRes.data.availableArtifacts) && artifactRes.data.availableArtifacts.includes('report.json')
    );
  } catch (err) {
    failed++;
    console.error('❌ Fail artifact 404 preservation test:', err);
  }

  // Restore pposRequest
  apiClient.pposRequest = originalPposRequest;

  console.log('\n--- REGRESSION SUITE EXECUTION SUMMARY ---');
  console.log(`Total Passed: ${passed}`);
  console.log(`Total Failed: ${failed}`);

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
