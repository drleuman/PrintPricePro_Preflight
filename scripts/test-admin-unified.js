/**
 * scripts/test-admin-unified.js
 * Verification script for the Unified Admin API routing.
 */
const http = require('http');

const ADMIN_KEY = process.env.ADMIN_API_KEY || 'test_admin_key'; // Default for local test if not set
const BASE_URL = 'http://localhost:3000';

const endpoints = [
    { path: '/api/admin/metrics/overview', name: 'Metrics Overview (Main)' },
    { path: '/api/admin/tenants', name: 'Tenants List (Main)' },
    { path: '/api/admin/network/overview', name: 'Network Overview (Sub)' },
    { path: '/api/admin/offers', name: 'Offers List (Sub)' },
    { path: '/api/admin/control/queue/stats', name: 'Queue Stats (Sub)' }
];

async function testEndpoint(endpoint) {
    console.log(`Testing ${endpoint.name}: ${endpoint.path}`);

    // 1. Test without Key (should be 401)
    const unauthorizedOk = await new Promise((resolve) => {
        http.get(`${BASE_URL}${endpoint.path}`, (res) => {
            if (res.statusCode === 401) {
                console.log(`  [OK] Unauthorized access blocked (401)`);
                resolve(true);
            } else {
                console.log(`  [FAIL] Expected 401, got ${res.statusCode}`);
                resolve(false);
            }
        }).on('error', (err) => {
            console.log(`  [ERROR] ${err.message}`);
            resolve(false);
        });
    });

    // 2. Test with Key
    const authorizedOk = await new Promise((resolve) => {
        const options = {
            headers: { 'X-Admin-Api-Key': ADMIN_KEY }
        };
        http.get(`${BASE_URL}${endpoint.path}`, options, (res) => {
            if (res.statusCode === 200) {
                console.log(`  [OK] Authorized access successful (200)`);
                resolve(true);
            } else if (res.statusCode === 404) {
                console.log(`  [FAIL] Route not found (404)`);
                resolve(false);
            } else {
                console.log(`  [WARN] Got ${res.statusCode}. Check if service/db is running.`);
                resolve(res.statusCode !== 404 && res.statusCode !== 401);
            }
        }).on('error', (err) => {
            console.log(`  [ERROR] ${err.message}`);
            resolve(false);
        });
    });

    return unauthorizedOk && authorizedOk;
}

async function runTests() {
    let allPassed = true;
    for (const ep of endpoints) {
        const passed = await testEndpoint(ep);
        if (!passed) allPassed = false;
        console.log('---');
    }

    if (allPassed) {
        console.log('ALL TESTS PASSED! Unified routing is working.');
        process.exit(0);
    } else {
        console.log('SOME TESTS FAILED. Check server mount points.');
        process.exit(1);
    }
}

runTests();
