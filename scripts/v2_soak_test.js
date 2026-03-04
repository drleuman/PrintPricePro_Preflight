'use strict';

/**
 * scripts/v2_soak_test.js
 * 
 * V2 Async Queue Soak Test
 * Sends PDFs to /api/v2/preflight, polls for completion, and reports results.
 * 
 * Usage:
 *   node scripts/v2_soak_test.js
 *   STRESS_CONCURRENCY=10 STRESS_COUNT=200 node scripts/v2_soak_test.js
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');

const API_BASE = process.env.API_URL || 'http://localhost:8080';
const ENQUEUE_URL = `${API_BASE}/api/v2/preflight/analyze`;
const JOB_STATUS_URL = (id) => `${API_BASE}/api/v2/preflight/jobs/${id}`;
const STRESS_DIR = path.join(__dirname, '..', 'stress_test_pdfs');
const CONCURRENCY = parseInt(process.env.STRESS_CONCURRENCY || '10');
const COUNT = parseInt(process.env.STRESS_COUNT || '200');
const POLL_INTERVAL_MS = 1000;
const JOB_TIMEOUT_MS = 120000;

async function enqueueJob(filePath) {
    const form = new FormData();
    form.append('pdf', fs.createReadStream(filePath));
    form.append('policy', 'OFFSET_CMYK_STRICT');

    const res = await axios.post(ENQUEUE_URL, form, {
        headers: {
            ...form.getHeaders(),
            'x-ppp-api-key': 'demo-key-123'
        },
        timeout: 30000
    });

    return res.data?.job_id || res.data?.id;
}

async function pollJob(jobId) {
    const start = Date.now();
    while (Date.now() - start < JOB_TIMEOUT_MS) {
        await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
        try {
            const res = await axios.get(JOB_STATUS_URL(jobId), {
                headers: { 'x-ppp-api-key': 'demo-key-123' },
                timeout: 10000
            });
            const status = (res.data.status || '').toLowerCase();
            const result = res.data.result;
            if (status === 'completed' || status === 'done') return { ok: true, status, result };
            if (status === 'failed' || status === 'error' || status === 'canceled') return { ok: false, status, result, error: res.data.error || result };
        } catch (e) {
            // continue polling
        }
    }
    return { ok: false, status: 'timeout' };
}

async function runJob(filePath) {
    const filename = path.basename(filePath);
    const start = Date.now();
    try {
        const jobId = await enqueueJob(filePath);
        if (!jobId) return { filename, status: 'FAILED', error: 'No job_id returned', duration: Date.now() - start };

        console.log(`[V2-SOAK] Enqueued ${filename} -> Job ID: ${jobId}`);

        const result = await pollJob(jobId);
        const duration = Date.now() - start;
        return {
            filename,
            status: result.ok ? 'SUCCESS' : 'FAILED',
            duration,
            jobStatus: result.status,
            error: result.ok ? null : (result.error ? JSON.stringify(result.error) : result.status)
        };
    } catch (err) {
        return {
            filename,
            status: 'FAILED',
            duration: Date.now() - start,
            error: err.response?.data ? JSON.stringify(err.response.data) : err.message,
            code: err.response?.status
        };
    }
}

async function main() {
    if (!fs.existsSync(STRESS_DIR)) {
        console.error('[V2-SOAK] stress_test_pdfs directory missing. Run generator first.');
        process.exit(1);
    }

    const allFiles = fs.readdirSync(STRESS_DIR)
        .filter(f => f.endsWith('.pdf'))
        .map(f => path.join(STRESS_DIR, f))
        .slice(0, COUNT);

    console.log(`[V2-SOAK] Starting V2 async soak test: ${allFiles.length} files, concurrency ${CONCURRENCY}`);
    console.log(`[V2-SOAK] Endpoint: ${ENQUEUE_URL}`);

    const results = [];
    const pool = new Set();
    let completed = 0;

    for (const file of allFiles) {
        while (pool.size >= CONCURRENCY) {
            await Promise.race(pool);
        }

        const promise = runJob(file).then(res => {
            pool.delete(promise);
            completed++;
            results.push(res);
            if (completed % 10 === 0) {
                const ok = results.filter(r => r.status === 'SUCCESS').length;
                console.log(`[V2-SOAK] Progress: ${completed}/${allFiles.length} | successes: ${ok}`);
            }
        });
        pool.add(promise);
    }

    await Promise.all(pool);

    const successes = results.filter(r => r.status === 'SUCCESS').length;
    const failures = results.length - successes;
    const avgLatency = Math.round(results.reduce((a, r) => a + r.duration, 0) / results.length);
    const successRate = ((successes / results.length) * 100).toFixed(1);

    console.log('\n--- V2 SOAK TEST RESULTS ---');
    console.log(`Total Jobs:     ${results.length}`);
    console.log(`Successes:      ${successes}  (${successRate}%)`);
    console.log(`Failures:       ${failures}`);
    console.log(`Avg Queue+Proc: ${avgLatency}ms`);
    console.log('----------------------------\n');

    if (failures > 0) {
        const sample = results.filter(r => r.status === 'FAILED').slice(0, 5);
        console.log('Sample failures:');
        sample.forEach(f => console.log(`  ❌ ${f.filename}: ${f.error || f.jobStatus}`));
    }

    // Write results
    const resultsPath = path.join(__dirname, '..', 'v2_soak_results.jsonl');
    fs.writeFileSync(resultsPath, results.map(r => JSON.stringify(r)).join('\n') + '\n');
    console.log(`[V2-SOAK] Results written to ${resultsPath}`);
}

main();
