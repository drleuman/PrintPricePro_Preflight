/**
 * PrintPrice API v2 — Node.js Client Example
 * 
 * Usage: 
 * 1. Install axios: npm install axios form-data
 * 2. Set your API Key
 * 3. Run node node-client.js
 */

const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

const API_KEY = 'ppk_live_xxx'; // Replace with your real key
const BASE_URL = 'https://api.printprice.pro/api/v2';

async function processFile(filePath) {
    console.log(`[1/3] Uploading file: ${filePath}...`);

    const form = new FormData();
    form.append('file', fs.createReadStream(filePath));
    form.append('policy', 'OFFSET_CMYK_STRICT');

    try {
        const response = await axios.post(`${BASE_URL}/jobs`, form, {
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                ...form.getHeaders()
            }
        });

        const jobId = response.data.job_id;
        console.log(`[2/3] Job accepted. ID: ${jobId}. Polling for status...`);

        // Simple polling mechanism
        let jobSucceeded = false;
        while (!jobSucceeded) {
            const statusRes = await axios.get(`${BASE_URL}/jobs/${jobId}`, {
                headers: { 'Authorization': `Bearer ${API_KEY}` }
            });

            const status = statusRes.data.status;
            console.log(`      Status: ${status}...`);

            if (status === 'SUCCEEDED') {
                console.log(`[3/3] Success! Detailed Metrics:`);
                console.log(`      Risk Before: ${statusRes.data.metrics.risk_score_before}`);
                console.log(`      Risk After:  ${statusRes.data.metrics.risk_score_after}`);
                console.log(`      Download corrected file: ${statusRes.data.links.download_url}`);
                jobSucceeded = true;
            } else if (status === 'FAILED') {
                console.error(`      Job failed:`, statusRes.data.error);
                break;
            }

            // Wait 2 seconds before next poll
            await new Promise(r => setTimeout(r, 2000));
        }

    } catch (error) {
        console.error('API Error:', error.response ? error.response.data : error.message);
    }
}

// Example invocation
// processFile('./my-print-file.pdf');
