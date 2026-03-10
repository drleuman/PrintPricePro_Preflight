/**
 * Verification script for Phase 26.2: Routing Intelligence & Quality.
 */
const fetch = require('node-fetch');

async function verifyRoutingIntelligence() {
    console.log('🚀 Starting Routing Intelligence Verification...');
    const adminKey = process.env.PP_ADMIN_KEY || 'my-secret-admin-key';
    const baseUrl = 'http://localhost:8080/api/admin/routing';
    const headers = {
        'Authorization': `Bearer ${adminKey}`,
        'Content-Type': 'application/json'
    };

    let successCount = 0;

    // 1. Check Routing Overview
    try {
        process.stdout.write('Checking Routing Overview... ');
        const overviewRes = await fetch(`${baseUrl}/overview`, { headers });
        if (overviewRes.ok) {
            const data = await overviewRes.json();
            console.log('✅ OK');
            successCount++;
        } else {
            console.log('❌ FAILED');
        }
    } catch (err) {
        console.log('❌ ERROR');
    }

    // 2. Check Routing History
    try {
        process.stdout.write('Checking Routing History... ');
        const historyRes = await fetch(`${baseUrl}/history`, { headers });
        if (historyRes.ok) {
            console.log('✅ OK');
            successCount++;
        } else {
            console.log('❌ FAILED');
        }
    } catch (err) {
        console.log('❌ ERROR');
    }

    // 3. Test Quality Loop (Record Outcome)
    try {
        process.stdout.write('Testing Quality Feedback Loop (Mock Outcome)... ');
        const mockPrinterId = 'node-123'; // Replace with real ID if available
        const outcomeBody = {
            jobId: 'job-' + Date.now(),
            printerId: mockPrinterId,
            status: 'SUCCESS',
            completionTime: 4.5,
            rating: 5.0
        };

        const outcomeRes = await fetch(`${baseUrl}/outcome`, {
            method: 'POST',
            headers,
            body: JSON.stringify(outcomeBody)
        });

        if (outcomeRes.ok) {
            console.log('✅ OK');
            successCount++;

            // Verify performance update
            process.stdout.write('Verifying Performance Record... ');
            const perfRes = await fetch(`${baseUrl}/performance/${mockPrinterId}`, { headers });
            if (perfRes.ok) {
                const perf = await perfRes.json();
                console.log('✅ OK (Quality Score: ' + perf.quality_score + ')');
                successCount++;
            } else {
                console.log('❌ FAILED');
            }
        } else {
            console.log('❌ FEEDBACK FAILED');
        }
    } catch (err) {
        console.log('❌ Loop check error: ' + err.message);
    }

    console.log('\n--- VERIFICATION SUMMARY ---');
    console.log(`Passed: ${successCount} checks.`);
    if (successCount >= 3) {
        console.log('🎉 ROUTING INTELLIGENCE IS OPERATIONAL');
    }
}

// verifyRoutingIntelligence();
