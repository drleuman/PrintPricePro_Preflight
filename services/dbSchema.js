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
    batch_id VARCHAR(36),
    type VARCHAR(50) DEFAULT 'LEGACY',
    status VARCHAR(50) NOT NULL DEFAULT 'QUEUED',
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
    `CREATE TABLE IF NOT EXISTS batches (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(255) NOT NULL DEFAULT 'default',
    status VARCHAR(50) NOT NULL DEFAULT 'QUEUED',
    policy_slug VARCHAR(255) NOT NULL DEFAULT 'OFFSET_CMYK_STRICT',
    input_asset_id VARCHAR(36),
    total_jobs INT DEFAULT 0,
    completed_jobs INT DEFAULT 0,
    failed_jobs INT DEFAULT 0,
    canceled_jobs INT DEFAULT 0,
    risk_score_before_avg DECIMAL(5,2),
    risk_score_after_avg DECIMAL(5,2),
    hours_saved_total DECIMAL(10,2) DEFAULT 0,
    value_generated_total DECIMAL(10,2) DEFAULT 0,
    metadata_json JSON,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    finished_at DATETIME
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
    risk_score_before INTEGER,
    risk_score_after INTEGER,
    hours_saved DECIMAL(10,2),
    value_generated DECIMAL(10,2),
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
    );`,
    `CREATE TABLE IF NOT EXISTS audit_help_analytics (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    event_type ENUM('article_viewed', 'search_query', 'search_result_clicked', 'helpful_yes', 'helpful_no', 'improvement_suggested') NOT NULL,
    article_id VARCHAR(255) NULL,
    search_query VARCHAR(255) NULL,
    tenant_id VARCHAR(255) NULL,
    user_id VARCHAR(255) NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );`,
    `CREATE TABLE IF NOT EXISTS tenants (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'ACTIVE',
    plan VARCHAR(50) DEFAULT 'FREE',
    rate_limit_rpm INT DEFAULT 60,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);`,
    `CREATE TABLE IF NOT EXISTS api_keys (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    tenant_id VARCHAR(255) NOT NULL,
    key_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    revoked BOOLEAN DEFAULT FALSE,
    last_used_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);`,
    `CREATE TABLE IF NOT EXISTS webhooks (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    tenant_id VARCHAR(255) NOT NULL,
    url VARCHAR(512) NOT NULL,
    event_type VARCHAR(50) NOT NULL,
    secret_key VARCHAR(255),
    active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);`
];

async function patchSchema() {
    console.log('[DB-SCHEMA] Checking for missing columns (ROI & Infrastructure patches)...');

    const patches = [
        // Metrics table: ROI columns (Phase 16.5)
        { table: 'metrics', column: 'hours_saved', query: 'ALTER TABLE metrics ADD COLUMN hours_saved DECIMAL(10,2)' },
        { table: 'metrics', column: 'value_generated', query: 'ALTER TABLE metrics ADD COLUMN value_generated DECIMAL(10,2)' },
        { table: 'metrics', column: 'risk_score_before', query: 'ALTER TABLE metrics ADD COLUMN risk_score_before INTEGER' },
        { table: 'metrics', column: 'risk_score_after', query: 'ALTER TABLE metrics ADD COLUMN risk_score_after INTEGER' },
        { table: 'metrics', column: 'risk_score_before', query: 'ALTER TABLE metrics ADD COLUMN risk_score_before INTEGER' },
        { table: 'metrics', column: 'risk_score_after', query: 'ALTER TABLE metrics ADD COLUMN risk_score_after INTEGER' },

        // Batches table: ROI aggregations (Phase 17.2)
        { table: 'batches', column: 'risk_score_before_avg', query: 'ALTER TABLE batches ADD COLUMN risk_score_before_avg DECIMAL(5,2)' },
        { table: 'batches', column: 'risk_score_after_avg', query: 'ALTER TABLE batches ADD COLUMN risk_score_after_avg DECIMAL(5,2)' },
        { table: 'batches', column: 'hours_saved_total', query: 'ALTER TABLE batches ADD COLUMN hours_saved_total DECIMAL(10,2) DEFAULT 0' },
        { table: 'batches', column: 'value_generated_total', query: 'ALTER TABLE batches ADD COLUMN value_generated_total DECIMAL(10,2) DEFAULT 0' },

        // Jobs table: Batch & Profile integration (Phase 16 & 17.2)
        { table: 'jobs', column: 'batch_id', query: 'ALTER TABLE jobs ADD COLUMN batch_id VARCHAR(36)' },
        { table: 'jobs', column: 'requested_profile', query: 'ALTER TABLE jobs ADD COLUMN requested_profile VARCHAR(100)' },
    ];

    for (const patch of patches) {
        try {
            await db.query(patch.query);
            console.log(`[DB-PATCH] Added ${patch.column} to ${patch.table}`);
        } catch (err) {
            // Ignore "Duplicate column name" error (1060)
            if (err.code !== 'ER_DUP_FIELDNAME') {
                console.warn(`[DB-PATCH] Failed to add ${patch.column} to ${patch.table}:`, err.message);
            }
        }
    }
}

/**
 * Initializes the database schema.
 */
async function initSchema() {
    try {
        console.log('[DB-SCHEMA] Initializing V2 MySQL tables...');
        for (const query of SCHEMA_QUERIES) {
            await db.query(query);
        }

        // Run patches for existing tables
        await patchSchema();

        // Job Events Timeline
        await db.query(`
            CREATE TABLE IF NOT EXISTS job_events (
                id VARCHAR(36) PRIMARY KEY,
                job_id VARCHAR(36) NOT NULL,
                event VARCHAR(50) NOT NULL,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                metadata JSON
            )
        `);

        console.log('[DB] Schema initialized successfully');
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
