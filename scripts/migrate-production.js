const { initSchema } = require('../services/dbSchema');
const db = require('../services/db');

async function run() {
    console.log('--- PRODUCTION DATABASE MIGRATION START ---');
    try {
        const success = await initSchema();
        if (success) {
            console.log('✅ Migration completed successfully.');
        } else {
            console.error('❌ Migration failed (check logs above).');
            process.exit(1);
        }
    } catch (err) {
        console.error('FATAL ERROR during migration:', err);
        process.exit(1);
    } finally {
        // Ensure the process ends
        setTimeout(() => process.exit(0), 1000);
    }
}

run();
