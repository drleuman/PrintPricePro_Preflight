require('dotenv').config();
const db = require('./services/db');

async function fix() {
    try {
        await db.query('ALTER TABLE reports MODIFY id VARCHAR(36) DEFAULT (UUID())');
        await db.query('ALTER TABLE metrics MODIFY id VARCHAR(36) DEFAULT (UUID())');
        console.log('[+] Schema fixed successfully.');
    } catch (err) {
        console.error('Failed to alter tables:', err.message);
    } finally {
        process.exit(0);
    }
}

fix();
