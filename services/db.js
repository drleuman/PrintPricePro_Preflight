const mysql = require('mysql2/promise');

let pool;
try {
    pool = mysql.createPool({
        uri: process.env.DATABASE_URL || 'mysql://Kike:L8YwOuq0i4$v&dql@localhost:3306/preflight_',
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
