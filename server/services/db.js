const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/preflight',
});

// Better logging for connection issues
pool.on('error', (err) => {
    console.error('Unexpected error on idle postgres client', err);
});

module.exports = {
    query: (text, params) => pool.query(text, params),
    pool,
};
