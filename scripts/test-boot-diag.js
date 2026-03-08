const path = require('path');
require('dotenv').config();

console.log('--- DIAGNOSTIC START ---');
console.log('CWD:', process.cwd());
console.log('Node Version:', process.version);
console.log('DB_URL set:', !!process.env.DATABASE_URL);

try {
    console.log('Attempting to require server.js...');
    const app = require('./server');
    console.log('server.js required successfully.');

    const port = process.env.TEST_PORT || 3999;
    console.log(`Starting test listener on port ${port}...`);
    const server = app.listen(port, '0.0.0.0', () => {
        console.log(`SUCCESS: Server is listening on port ${port}`);
        console.log('Waiting 2 seconds for background init...');
        setTimeout(() => {
            console.log('Diagnostic finished. Closing server.');
            process.exit(0);
        }, 2000);
    });

    server.on('error', (err) => {
        console.error('SERVER ERROR during listen:', err);
        process.exit(1);
    });

} catch (err) {
    console.error('FATAL ERROR during requirement or boot:');
    console.error(err);
    process.exit(1);
}
