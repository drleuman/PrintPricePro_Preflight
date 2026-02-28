const { Pool } = require('pg');

let pool;
try {
    pool = new Pool({
        connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/preflight',
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
    });

    pool.on('error', (err) => {
        console.error('[DB-POOL] Unexpected error on idle client:', err.message);
    });

    // Test connection at startup without crashing the process
    pool.query('SELECT NOW()').then(() => {
        console.log('[DB-READY] Connected to PostgreSQL');
    }).catch(err => {
        console.error('[DB-ERROR] Connection failed at startup:', err.message);
        console.warn('[DB-WARN] The app will continue running but database-dependent features will fail.');
    });

} catch (e) {
    console.error('[DB-CRITICAL] Failed to initialize DB Pool:', e.message);
}

module.exports = {
    query: (text, params) => pool ? pool.query(text, params) : Promise.reject(new Error('DB not initialized')),
    pool,
};
