const mysql = require('mysql2/promise');

let pool;
try {
    const dbUrl = process.env.DATABASE_URL;

    if (!dbUrl && process.env.NODE_ENV === 'production') {
        console.error('[CRITICAL] DATABASE_URL is not defined.');
        // We no longer exit here to allow Resilient Boot to show diagnostics via API
    }

    const fallbackUrl = 'mysql://root@localhost:3306/preflight_dev';
    pool = mysql.createPool({
        uri: dbUrl || fallbackUrl,
        connectionLimit: 20,
        waitForConnections: true,
        enableKeepAlive: true,
        // Ensure character set is correct for special characters in password
        charset: 'utf8mb4',
        // Phase 19.6: Enforce UTC for session to ensure consistent quota resets
        timezone: 'Z'
    });

    pool.getConnection().then((conn) => {
        console.log('[DB-READY] Connected to MySQL');
        conn.release();
    }).catch(err => {
        console.error('[DB-ERROR] MySQL connection failed:', {
            message: err.message,
            code: err.code
        });
        console.warn('[DB-WARN] The app will continue running but database-dependent features will fail.');
    });

} catch (e) {
    console.error('[DB-CRITICAL] Failed to initialize DB Pool:', e.message);
}

module.exports = {
    query: async (text, params) => {
        if (!pool) return Promise.reject(new Error('DB not initialized'));
        const mysqlQuery = text.replace(/\$\d+/g, '?');
        const [rows] = await pool.query(mysqlQuery, params);
        return { rows };
    },
    checkConnection: async () => {
        if (!pool) return false;
        try {
            const [rows] = await pool.query('SELECT 1 as ok');
            return rows && rows[0] && rows[0].ok === 1;
        } catch (e) {
            return false;
        }
    },
    pool,
};
