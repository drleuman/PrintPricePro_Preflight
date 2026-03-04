const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');

const stressDir = path.join(__dirname, '..', 'stress_test_pdfs');
const API_URL = process.env.API_URL || 'http://localhost:3000/api/convert/autofix';
const CONCURRENCY = process.env.STRESS_CONCURRENCY ? parseInt(process.env.STRESS_CONCURRENCY) : 10;
const resultsLog = path.join(__dirname, '..', 'stress_results.jsonl');

async function runJob(filePath) {
    const filename = path.basename(filePath);
    const form = new FormData();
    form.append('file', fs.createReadStream(filePath));
    form.append('profile', 'iso_coated_v3');

    const start = Date.now();
    try {
        const response = await axios.post(API_URL, form, {
            headers: {
                ...form.getHeaders(),
                'x-ppp-api-key': 'demo-key-123' // Adjust as needed
            }
        });
        const duration = Date.now() - start;
        return { filename, status: 'SUCCESS', duration, code: response.status };
    } catch (err) {
        const duration = Date.now() - start;
        const errorData = err.response?.data?.error || err.message;
        const statusCode = err.response?.status;

        // Diagnostic: Log first 5 failure bodies to see what's happening
        if (global.failureLogCount === undefined) global.failureLogCount = 0;
        if (global.failureLogCount < 5) {
            console.error(`[DIAGNOSTIC] Job ${filename} failed (${statusCode}):`, JSON.stringify(err.response?.data || err.message));
            global.failureLogCount++;
        }

        return {
            filename,
            status: 'FAILED',
            duration,
            error: errorData,
            code: statusCode
        };
    }
}

async function main() {
    if (!fs.existsSync(stressDir)) {
        console.error('Stress directory missing. Run generator first.');
        process.exit(1);
    }

    const files = fs.readdirSync(stressDir).filter(f => f.endsWith('.pdf')).map(f => path.join(stressDir, f));
    console.log(`[STRESS-RUNNER] Starting saturation of ${files.length} files with concurrency ${CONCURRENCY}...`);

    const results = [];
    const pool = new Set();
    let completed = 0;

    for (const file of files) {
        while (pool.size >= CONCURRENCY) {
            await Promise.race(pool);
        }

        const promise = runJob(file).then(res => {
            pool.delete(promise);
            completed++;
            results.push(res);
            fs.appendFileSync(resultsLog, JSON.stringify(res) + '\n');
            if (completed % 10 === 0) {
                console.log(`[STRESS-RUNNER] Completed: ${completed}/${files.length}...`);
            }
        });
        pool.add(promise);
    }

    await Promise.all(pool);
    console.log('[STRESS-RUNNER] All jobs completed.');

    const successes = results.filter(r => r.status === 'SUCCESS').length;
    const failures = results.length - successes;
    const avgLatency = results.reduce((acc, r) => acc + r.duration, 0) / results.length;

    console.log('\n--- FINAL SUMMARY ---');
    console.log(`Total Requests: ${results.length}`);
    console.log(`Successes:      ${successes}`);
    console.log(`Failures:       ${failures}`);
    console.log(`Avg Latency:    ${Math.round(avgLatency)}ms`);
    console.log('---------------------\n');
}

main();
