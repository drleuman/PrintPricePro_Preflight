require('dotenv').config();
const { initSchema } = require('./services/dbSchema');

async function run() {
    console.log('Running manual schema migration for Phase 16.5...');
    const ok = await initSchema();
    if (ok) {
        console.log('Schema migration successful.');
        process.exit(0);
    } else {
        console.error('Schema migration failed.');
        process.exit(1);
    }
}

run();
