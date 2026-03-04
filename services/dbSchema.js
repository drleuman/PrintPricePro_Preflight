const db = require('./db');

const SCHEMA_SQL = `
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table: assets
CREATE TABLE IF NOT EXISTS assets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id TEXT NOT NULL DEFAULT 'default',
    filename TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    sha256 TEXT,
    mime_type TEXT DEFAULT 'application/pdf',
    size BIGINT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table: jobs
CREATE TABLE IF NOT EXISTS jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id TEXT NOT NULL DEFAULT 'default',
    asset_id UUID REFERENCES assets(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('PREFLIGHT', 'AUTOFIX', 'ARTIFACT')),
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED')),
    priority INTEGER DEFAULT 0,
    worker_id TEXT,
    progress INTEGER DEFAULT 0,
    error JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for job polling/queueing
CREATE INDEX IF NOT EXISTS idx_jobs_status_priority ON jobs(status, priority DESC, created_at ASC) WHERE status = 'PENDING';

-- Table: reports
CREATE TABLE IF NOT EXISTS reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
    asset_id UUID REFERENCES assets(id) ON DELETE CASCADE,
    version TEXT DEFAULT 'v2',
    summary TEXT,
    findings JSONB NOT NULL DEFAULT '[]',
    data JSONB,
    delta JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table: metrics
CREATE TABLE IF NOT EXISTS metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
    tenant_id TEXT NOT NULL DEFAULT 'default',
    policy_slug TEXT NOT NULL,
    success BOOLEAN NOT NULL,
    processing_ms BIGINT NOT NULL,
    file_size_bytes BIGINT,
    page_count INTEGER,
    delta_score INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for jobs updated_at
DROP TRIGGER IF EXISTS update_jobs_updated_at ON jobs;
CREATE TRIGGER update_jobs_updated_at
    BEFORE UPDATE ON jobs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
`;

/**
 * Initializes the database schema.
 */
async function initSchema() {
    try {
        console.log('[DB-SCHEMA] Initializing V2 tables...');
        await db.query(SCHEMA_SQL);
        console.log('[DB-SCHEMA] V2 tables initialized successfully.');
        return true;
    } catch (err) {
        console.error('[DB-SCHEMA] Initialization failed:', err.message);
        // We don't crash the server here, as db.js already warns about failing features.
        return false;
    }
}

module.exports = {
    initSchema,
    SCHEMA_SQL
};
