const express = require('express');
const router = require('../app/routes/apiV2');

function runTest() {
  console.log('--- PHASE 39.1.18b ROUTE ORDER SMOKE TEST ---');

  const stack = router.stack;
  const routes = stack.filter(r => r.route).map(r => ({
    path: r.route.path,
    method: Object.keys(r.route.methods)[0].toUpperCase()
  }));

  console.log('Current Router Stack:');
  routes.forEach((r, idx) => console.log(`${idx} ${r.method} ${r.path}`));

  const findIndex = (method, path) => routes.findIndex(r => r.method === method && r.path === path);

  const meIndex = findIndex('GET', '/me');
  const meHistoryIndex = findIndex('GET', '/me/file-history');
  const meRotationIndex = findIndex('POST', '/me/api-key/rotation-request');
  const jobIdIndex = findIndex('GET', '/:jobId');
  const jobIdFixIndex = findIndex('POST', '/:jobId/actions/fix');

  let failed = false;

  console.log('\nValidating assertions:');

  if (meIndex < jobIdIndex && meIndex !== -1 && jobIdIndex !== -1) {
    console.log('✅ GET /me index < GET /:jobId index');
  } else {
    console.error('❌ GET /me index < GET /:jobId index');
    failed = true;
  }

  if (meHistoryIndex < jobIdIndex && meHistoryIndex !== -1 && jobIdIndex !== -1) {
    console.log('✅ GET /me/file-history index < GET /:jobId index');
  } else {
    console.error('❌ GET /me/file-history index < GET /:jobId index');
    failed = true;
  }

  if (meRotationIndex < jobIdFixIndex && meRotationIndex !== -1 && jobIdFixIndex !== -1) {
    console.log('✅ POST /me/api-key/rotation-request index < POST /:jobId/actions/fix index');
  } else {
    console.error('❌ POST /me/api-key/rotation-request index < POST /:jobId/actions/fix index');
    failed = true;
  }

  if (failed) {
    console.error('\n--- SMOKE TEST FAILED ---');
    process.exit(1);
  } else {
    console.log('\n--- SMOKE TEST PASSED ---');
    process.exit(0);
  }
}

runTest();
