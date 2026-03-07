/**
 * Verification script for Network Operations Dashboard MVP.
 * Run this to ensure all backend services and endpoints are correctly configured.
 */
const fetch = require('node-fetch');

async function verifyNetworkOps() {
    console.log('🚀 Starting Network Operations MVP Verification...');
    const adminKey = process.env.PP_ADMIN_KEY || 'my-secret-admin-key';
    const baseUrl = 'http://localhost:8080/api/admin/network';
    const headers = { 'Authorization': `Bearer ${adminKey}` };

    const checks = [
        { name: 'KPIS Overview', path: '/overview' },
        { name: 'Printers List', path: '/printers?limit=5' },
        { name: 'Capacity by Region', path: '/capacity' },
        { name: 'Health Warnings', path: '/health' }
    ];

    let successCount = 0;

    for (const check of checks) {
        try {
            process.stdout.write(`Checking ${check.name}... `);
            const res = await fetch(`${baseUrl}${check.path}`, { headers });

            if (res.ok) {
                const data = await res.json();
                console.log('✅ OK');
                if (check.path === '/overview') {
                    console.log(`   - Total Printers: ${data.total_printers}`);
                    console.log(`   - Regions Covered: ${data.regions_covered}`);
                }
                successCount++;
            } else {
                console.log(`❌ FAILED (${res.status})`);
            }
        } catch (err) {
            console.log(`❌ ERROR: ${err.message}`);
        }
    }

    // Detail check requires a valid ID, we'll try to find one from the list
    try {
        const listRes = await fetch(`${baseUrl}/printers?limit=1`, { headers });
        const list = await listRes.json();
        if (list.length > 0) {
            const id = list[0].id;
            process.stdout.write(`Checking Detail for Node ${id}... `);
            const detailRes = await fetch(`${baseUrl}/printers/${id}`, { headers });
            if (detailRes.ok) {
                console.log('✅ OK');
                successCount++;
            } else {
                console.log('❌ FAILED');
            }
        }
    } catch (err) {
        console.log('❌ Detail check failed');
    }

    console.log('\n--- VERIFICATION SUMMARY ---');
    console.log(`Passed: ${successCount} / ${checks.length + 1}`);
    if (successCount === (checks.length + 1)) {
        console.log('🎉 NETWORK OPS MVP IS FULLY OPERATIONAL');
    } else {
        console.log('⚠️ SOME CHECKS FAILED. Please verify server status and DATABASE_URL.');
    }
}

// verifyNetworkOps();
