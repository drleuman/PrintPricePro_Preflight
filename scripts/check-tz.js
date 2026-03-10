// scripts/check-tz.js
require('dotenv').config();
const db = require('../services/db');

async function check() {
    try {
        const { rows } = await db.query('SELECT @@global.time_zone, @@session.time_zone, NOW(), UTC_TIMESTAMP()');
        console.log('--- Timezone Check ---');
        console.log(JSON.stringify(rows[0], null, 2));

        const now = new Date();
        console.log('Node.js Time:', now.toString());
        console.log('Node.js ISO (UTC):', now.toISOString());
    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        process.exit(0);
    }
}

check();
