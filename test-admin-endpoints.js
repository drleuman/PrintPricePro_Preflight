const http = require('http');

const ADMIN_KEY = 'test_key';

async function test() {
    const endpoints = [
        '/api/admin/tenants',
        '/api/admin/cs-workflows',
        '/api/admin/network/health',
        '/api/admin/network/overview',
        '/api/admin/routing/overview'
    ];

    console.log('Testing Admin Endpoints (HTTP)...\n');

    for (const ep of endpoints) {
        await new Promise((resolve) => {
            const options = {
                hostname: 'localhost',
                port: 3000,
                path: ep,
                method: 'GET',
                headers: { 'X-Admin-Api-Key': ADMIN_KEY }
            };

            const req = http.request(options, (res) => {
                console.log(`[${res.statusCode}] ${ep}`);
                resolve();
            });

            req.on('error', (err) => {
                console.log(`[ERROR] ${ep}: ${err.message}`);
                resolve();
            });

            req.end();
        });
    }
}

test();
