const { pool } = require('../services/db');

const initDb = async () => {
    const client = await pool.connect();
    try {
        console.log('Initializing database schema...');

        await client.query('BEGIN');

        // Jobs Table
        await client.query(`
      CREATE TABLE IF NOT EXISTS jobs (
        id UUID PRIMARY KEY,
        status VARCHAR(20) NOT NULL,
        priority INT NOT NULL DEFAULT 0,
        original_name VARCHAR(255),
        file_path_original TEXT,
        file_sha256 VARCHAR(64),
        file_size_bytes BIGINT,
        page_count INT,
        large_mode BOOLEAN DEFAULT FALSE,
        requested_profile VARCHAR(50),
        progress INT DEFAULT 0,
        stage VARCHAR(50),
        error_code VARCHAR(50),
        error_message TEXT,
        certificate_id VARCHAR(100),
        output_path_final TEXT,
        report_json JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

        // Job Tasks Table
        await client.query(`
      CREATE TABLE IF NOT EXISTS job_tasks (
        id SERIAL PRIMARY KEY,
        job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
        task_type VARCHAR(20) NOT NULL,
        page_no INT,
        status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
        attempts INT NOT NULL DEFAULT 0,
        max_attempts INT NOT NULL DEFAULT 3,
        run_after TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        locked_by VARCHAR(100),
        locked_at TIMESTAMP WITH TIME ZONE,
        started_at TIMESTAMP WITH TIME ZONE,
        finished_at TIMESTAMP WITH TIME ZONE,
        duration_ms INT,
        last_error TEXT,
        payload_json JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

        // Indices
        await client.query('CREATE INDEX IF NOT EXISTS idx_job_tasks_status_run_after ON job_tasks(status, run_after)');
        await client.query('CREATE INDEX IF NOT EXISTS idx_job_tasks_job_id_status ON job_tasks(job_id, status)');
        await client.query('CREATE INDEX IF NOT EXISTS idx_jobs_status_priority ON jobs(status, priority)');

        await client.query('COMMIT');
        console.log('Database initialized successfully.');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Failed to initialize database:', err);
        process.exit(1);
    } finally {
        client.release();
        pool.end();
    }
};

initDb();
