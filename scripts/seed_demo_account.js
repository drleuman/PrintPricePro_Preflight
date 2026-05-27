require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mysql = require('mysql2/promise');

async function seedDemoAccount() {
    const email = process.env.DEMO_ACCOUNT_EMAIL || 'demo-printhouse@printprice.pro';
    const password = process.env.DEMO_ACCOUNT_PASSWORD;

    if (!password) {
        console.warn('[DEMO_ACCOUNT_SEED_SKIPPED] DEMO_ACCOUNT_PASSWORD is required');
        return;
    }

    try {
        let connection;
        if (process.env.DATABASE_URL) {
            connection = await mysql.createConnection(process.env.DATABASE_URL);
        } else {
            connection = await mysql.createConnection({
                host: process.env.MYSQL_HOST || '127.0.0.1',
                port: process.env.MYSQL_PORT || 3306,
                user: process.env.MYSQL_USER || 'root',
                password: process.env.MYSQL_PASSWORD || 'ppos_pass',
                database: process.env.MYSQL_DATABASE || 'preflight'
            });
        }

        console.log(`[SEED] Attempting to seed demo account ${email} into local DB...`);

        // Seed default tenant
        const tenantId = 'demo-printhouse-tenant';
        await connection.query(
            `INSERT IGNORE INTO tenants (id, name, service_tier, isolation_mode, status) 
             VALUES (?, ?, ?, ?, ?)`,
            [tenantId, 'Demo Print House', 'enterprise', 'logical', 'active']
        );

        // Seed user
        const userId = 'demo-user-' + Buffer.from(email).toString('hex').substring(0, 10);
        const [result] = await connection.query(
            `INSERT IGNORE INTO users (id, tenant_id, email, role) 
             VALUES (?, ?, ?, ?)`,
            [userId, tenantId, email, 'PRINTHOUSE']
        );

        if (result.affectedRows > 0) {
            console.log(`[SEED_SUCCESS] Demo account ${email} seeded successfully.`);
        } else {
            console.log(`[SEED_SKIPPED] Demo account ${email} already exists.`);
        }

        await connection.end();
    } catch (err) {
        // If MySQL fails to connect, warn but don't crash
        if (err.code === 'ECONNREFUSED') {
            console.warn('[SEED_WARNING] Could not connect to MySQL. Is the database running?');
        } else {
            console.error('[SEED_ERROR] Failed to seed demo account:', err.message);
        }
    }
}

seedDemoAccount();
