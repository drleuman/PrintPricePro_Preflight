const db = require('./db');

const SCHEMA_QUERIES = [
    `CREATE TABLE IF NOT EXISTS assets (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(255) NOT NULL DEFAULT 'default',
    filename TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    sha256 VARCHAR(64),
    mime_type VARCHAR(100) DEFAULT 'application/pdf',
    size BIGINT,
    metadata JSON,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);`,
    `CREATE TABLE IF NOT EXISTS jobs (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(255) NOT NULL DEFAULT 'default',
    asset_id VARCHAR(36),
    type VARCHAR(50) DEFAULT 'LEGACY',
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    priority INTEGER DEFAULT 0,
    worker_id VARCHAR(255),
    progress INTEGER DEFAULT 0,
    error JSON,
    original_name TEXT,
    requested_profile VARCHAR(100),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE
);`,
    `CREATE TABLE IF NOT EXISTS job_tasks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    job_id VARCHAR(36) NOT NULL,
    task_type VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    payload_json JSON,
    page_no INTEGER,
    run_after DATETIME,
    locked_by VARCHAR(255),
    locked_at DATETIME,
    started_at DATETIME,
    attempts INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
);`,
    `CREATE TABLE IF NOT EXISTS reports (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    job_id VARCHAR(36),
    asset_id VARCHAR(36),
    version VARCHAR(20) DEFAULT 'v2',
    summary TEXT,
    findings JSON,
    data JSON,
    delta JSON,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE,
    FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE
);`,
    `CREATE TABLE IF NOT EXISTS metrics (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    job_id VARCHAR(36),
    tenant_id VARCHAR(255) NOT NULL DEFAULT 'default',
    policy_slug VARCHAR(255) NOT NULL,
    success BOOLEAN NOT NULL,
    processing_ms BIGINT NOT NULL,
    file_size_bytes BIGINT,
    page_count INTEGER,
    delta_score INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
);`,
    `CREATE TABLE IF NOT EXISTS audit_logs (
    id VARCHAR(36) PRIMARY KEY,
    job_id VARCHAR(36),
    tenant_id VARCHAR(255) NOT NULL DEFAULT 'default',
    action VARCHAR(100) NOT NULL,
    policy_slug VARCHAR(255),
    ip_address VARCHAR(45),
    details JSON,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE SET NULL
    );`,
    `CREATE TABLE IF NOT EXISTS tenant_controls(
        tenant_id VARCHAR(255) PRIMARY KEY,
        quarantined_until DATETIME,
        reason TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    );`
];

/**
 * Initializes the database schema.
 */
async function initSchema() {
    try {
        console.log('[DB-SCHEMA] Initializing V2 MySQL tables...');
        for (const query of SCHEMA_QUERIES) {
            await db.query(query);
        }
        console.log('[DB-SCHEMA] V2 MySQL tables initialized successfully.');
        return true;
    } catch (err) {
        console.error('[DB-SCHEMA] Initialization failed:', err.message);
        return false;
    }
}

module.exports = {
    initSchema,
    SCHEMA_QUERIES
};
