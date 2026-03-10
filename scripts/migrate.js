require('dotenv').config();
const { initSchema } = require('../services/dbSchema');

async function runMigration() {
    console.log('--- Manual Schema Migration ---');
    const success = await initSchema();
    if (success) {
        console.log('Migration completed successfully.');
        process.exit(0);
    } else {
        console.error('Migration failed.');
        process.exit(1);
    }
}

runMigration();
