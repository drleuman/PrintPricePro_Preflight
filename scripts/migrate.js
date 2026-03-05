require('dotenv').config();
const { initSchema } = require('../services/dbSchema');
const db = require('../services/db');

async function runMigration() {
    console.log('[MIGRATE] Starting database schema migration...');
    const success = await initSchema();
    if (success) {
        console.log('[MIGRATE] Migration completed successfully.');
    } else {
        console.error('[MIGRATE] Migration failed.');
        process.exit(1);
    }
    await db.pool.end();
}

runMigration();
