const mysql = require('mysql2/promise');

let pool;
try {
    const dbUrl = process.env.DATABASE_URL;

    if (!dbUrl && process.env.NODE_ENV === 'production') {
        console.error('[CRITICAL] DATABASE_URL is not defined.');
        // We no longer exit here to allow Resilient Boot to show diagnostics via API
    }

    pool = mysql.createPool({
        uri: dbUrl || 'mysql://root@localhost:3306/preflight_dev',
        waitForConnections: true,
        connectionLimit: 20,
        queueLimit: 0,
        enableKeepAlive: true,
        keepAliveInitialDelay: 0
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
    pool,
};
