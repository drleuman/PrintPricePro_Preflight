/**
 * PrintPrice OS - Unified Database Service
 * Standalone implementation for Decoupled App (Phase 10)
 */

const mysql = require('mysql2/promise');
const { URL } = require('url');

let pool;

function buildMysqlConfig() {
  const parsed = new URL(process.env.DATABASE_URL);

  return {
    host: parsed.hostname,
    port: Number(parsed.port || 3306),
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database: parsed.pathname.replace(/^\//, ''),
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
  };
}

const getPool = () => {
  if (pool) return pool;

  if (!process.env.DATABASE_URL) {
    console.error('[DB-ERROR] DATABASE_URL is missing in environment!');
    return null;
  }

  try {
    pool = mysql.createPool(buildMysqlConfig());
    return pool;
  } catch (err) {
    console.error('[DB-ERROR] Failed to create bridge pool:', err.message);
    return null;
  }
};

/**
 * Executes a SQL query using the unified pool.
 * Enhanced with .rows compatibility for Phase 10 bridge.
 */
async function query(sql, params) {
  const p = getPool();
  if (!p) throw new Error('Database pool not initialized');
  const [results] = await p.execute(sql, params);
  
  // Bridge for code expecting .rows (Postgres style) while using MySql
  if (results && Array.isArray(results)) {
    results.rows = results;
  }
  
  return results;
}

/**
 * Verification handler for readiness checks.
 */
async function checkConnection() {
  try {
    const p = getPool();
    if (!p) return false;
    const [rows] = await p.execute('SELECT 1 as ok');
    return rows[0].ok === 1;
  } catch (err) {
    console.error('[DB-HEALTH-CHECK] Failed:', err.message);
    return false;
  }
}

module.exports = {
  query,
  checkConnection,
  execute: query, // Alias for compatibility
  pool: getPool()
};
