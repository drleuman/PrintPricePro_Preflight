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
    outcome VARCHAR(20) DEFAULT 'SUCCESS',
    processing_ms BIGINT NOT NULL,
    file_size_bytes BIGINT,
    page_count INTEGER,
    delta_score INTEGER,
    risk_score_before INTEGER,
    risk_score_after INTEGER,
    hours_saved DECIMAL(10,2),
    value_generated DECIMAL(10,2),
    telemetry_json JSON,
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
);`,
    `CREATE TABLE IF NOT EXISTS tenant_usage_stats (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    tenant_id VARCHAR(255) NOT NULL,
    date DATE NOT NULL,
    jobs_count INT DEFAULT 0,
    batches_count INT DEFAULT 0,
    value_generated DECIMAL(10,2) DEFAULT 0,
    hours_saved DECIMAL(10,2) DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY tenant_date (tenant_id, date),
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);`,
    `CREATE TABLE IF NOT EXISTS tenant_plan_history (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    tenant_id VARCHAR(255) NOT NULL,
    old_plan VARCHAR(50),
    new_plan VARCHAR(50) NOT NULL,
    reason TEXT,
    changed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);`,
    `CREATE TABLE IF NOT EXISTS tenant_alerts_history (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    tenant_id VARCHAR(255) NOT NULL,
    alert_type VARCHAR(50) NOT NULL,
    details_json JSON,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);`,
    `CREATE TABLE IF NOT EXISTS tenant_notification_preferences (
    tenant_id VARCHAR(255) PRIMARY KEY,
    quota_80_email BOOLEAN DEFAULT TRUE,
    quota_100_email BOOLEAN DEFAULT TRUE,
    expiry_7d_email BOOLEAN DEFAULT TRUE,
    expiry_1d_email BOOLEAN DEFAULT TRUE,
    expired_email BOOLEAN DEFAULT TRUE,
    high_usage_email BOOLEAN DEFAULT TRUE,
    churn_risk_email BOOLEAN DEFAULT TRUE,
    webhook_enabled BOOLEAN DEFAULT FALSE,
    email_recipients_json JSON,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);`,
    `CREATE TABLE IF NOT EXISTS notifications (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(255) NOT NULL,
    event_type VARCHAR(50) NOT NULL,
    channel ENUM('email', 'webhook', 'in_app') NOT NULL,
    status ENUM('PENDING', 'SENT', 'FAILED', 'SUPPRESSED', 'CANCELED') DEFAULT 'PENDING',
    dedupe_key VARCHAR(255),
    subject VARCHAR(255),
    payload_json JSON,
    attempt_count INT DEFAULT 0,
    last_error TEXT,
    scheduled_at DATETIME,
    sent_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_tenant (tenant_id),
    INDEX idx_status (status),
    INDEX idx_scheduled (scheduled_at),
    INDEX idx_status_scheduled (status, scheduled_at),
    INDEX idx_dedupe (dedupe_key),
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);`,
    `CREATE TABLE IF NOT EXISTS notification_events (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    notification_id VARCHAR(36) NOT NULL,
    event VARCHAR(50) NOT NULL,
    metadata_json JSON,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_notification (notification_id),
    FOREIGN KEY (notification_id) REFERENCES notifications(id) ON DELETE CASCADE
);`,
    `CREATE TABLE IF NOT EXISTS cs_workflows (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(255) NOT NULL,
    workflow_type VARCHAR(50) NOT NULL,
    status ENUM('ACTIVE', 'COMPLETED', 'ABANDONED') DEFAULT 'ACTIVE',
    current_step INT DEFAULT 1,
    last_action_at DATETIME,
    next_action_at DATETIME,
    metadata_json JSON,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_tenant (tenant_id),
    INDEX idx_status (status),
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);`,
    `CREATE TABLE IF NOT EXISTS cs_workflow_events (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    workflow_id VARCHAR(36) NOT NULL,
    event_type VARCHAR(50) NOT NULL,
    metadata_json JSON,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_workflow (workflow_id),
    FOREIGN KEY (workflow_id) REFERENCES cs_workflows(id) ON DELETE CASCADE
);`,
    `CREATE TABLE IF NOT EXISTS print_features (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    job_id VARCHAR(36) NOT NULL,
    tenant_id VARCHAR(255) NOT NULL,
    features_json JSON,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_job (job_id),
    INDEX idx_tenant (tenant_id),
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);`,
    `CREATE TABLE IF NOT EXISTS machine_profiles (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(20) NOT NULL,
    max_tac INT,
    min_res_dpi INT,
    requires_bleed BOOLEAN,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);`,
    `CREATE TABLE IF NOT EXISTS paper_profiles (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    weight INT,
    absorption_coefficient FLOAT,
    icc_profile VARCHAR(50),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);`,
    `CREATE TABLE IF NOT EXISTS policy_constraints (
    id VARCHAR(36) PRIMARY KEY,
    policy_name VARCHAR(50) NOT NULL,
    tac_limit INT,
    min_dpi INT,
    bleed_required BOOLEAN
);`,
    `CREATE TABLE IF NOT EXISTS printer_nodes (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    legal_name VARCHAR(255),
    vat_id VARCHAR(50),
    website VARCHAR(255),
    country VARCHAR(100),
    city VARCHAR(100),
    status ENUM('PENDING_REVIEW', 'ACTIVE', 'SUSPENDED', 'OFFLINE') DEFAULT 'PENDING_REVIEW',
    connect_status ENUM('NOT_CONFIGURED', 'PARTIALLY_CONFIGURED', 'READY') DEFAULT 'NOT_CONFIGURED',
    quality_score FLOAT DEFAULT 0.5,
    price_index FLOAT DEFAULT 1.0,
    sla_tier VARCHAR(50) DEFAULT 'BRONZE',
    printer_api_key_hash VARCHAR(255),
    last_sync_at DATETIME,
    sync_status ENUM('HEALTHY', 'STALE', 'OFFLINE') DEFAULT 'HEALTHY',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);`,
    `CREATE TABLE IF NOT EXISTS printer_contacts (
    id VARCHAR(36) PRIMARY KEY,
    printer_id VARCHAR(36) NOT NULL,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL,
    role VARCHAR(50),
    FOREIGN KEY (printer_id) REFERENCES printer_nodes(id) ON DELETE CASCADE
);`,
    `CREATE TABLE IF NOT EXISTS printer_machines (
    id VARCHAR(36) PRIMARY KEY,
    printer_id VARCHAR(36) NOT NULL,
    machine_profile_id VARCHAR(36) NOT NULL,
    nickname VARCHAR(100),
    capacity_index FLOAT DEFAULT 1.0,
    status ENUM('ACTIVE', 'OFFLINE') DEFAULT 'ACTIVE',
    machine_health ENUM('OK', 'MAINTENANCE', 'OFFLINE') DEFAULT 'OK',
    last_status_update DATETIME,
    FOREIGN KEY (printer_id) REFERENCES printer_nodes(id) ON DELETE CASCADE,
    FOREIGN KEY (machine_profile_id) REFERENCES machine_profiles(id)
);`,
    `CREATE TABLE IF NOT EXISTS printer_papers (
    id VARCHAR(36) PRIMARY KEY,
    printer_id VARCHAR(36) NOT NULL,
    paper_profile_id VARCHAR(36) NOT NULL,
    available BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (printer_id) REFERENCES printer_nodes(id) ON DELETE CASCADE,
    FOREIGN KEY (paper_profile_id) REFERENCES paper_profiles(id)
);`,
    `CREATE TABLE IF NOT EXISTS printer_capacity (
    id VARCHAR(36) PRIMARY KEY,
    printer_id VARCHAR(36) NOT NULL,
    date DATE NOT NULL,
    capacity_total FLOAT DEFAULT 1.0,
    capacity_available FLOAT DEFAULT 1.0,
    lead_time_days INT DEFAULT 3,
    source ENUM('MANUAL', 'SYNC_API') DEFAULT 'MANUAL',
    sync_id VARCHAR(100),
    INDEX idx_printer_date (printer_id, date),
    FOREIGN KEY (printer_id) REFERENCES printer_nodes(id) ON DELETE CASCADE
);`,
    `CREATE TABLE IF NOT EXISTS printer_service_regions (
    id VARCHAR(36) PRIMARY KEY,
    printer_id VARCHAR(36) NOT NULL,
    country VARCHAR(100) NOT NULL,
    region VARCHAR(100),
    postal_range VARCHAR(50),
    FOREIGN KEY (printer_id) REFERENCES printer_nodes(id) ON DELETE CASCADE
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
        { table: 'metrics', column: 'telemetry_json', query: 'ALTER TABLE metrics ADD COLUMN telemetry_json JSON' },
        { table: 'metrics', column: 'outcome', query: 'ALTER TABLE metrics ADD COLUMN outcome VARCHAR(20) DEFAULT \'SUCCESS\'' },

        // Batches table: ROI aggregations (Phase 17.2)
        { table: 'batches', column: 'risk_score_before_avg', query: 'ALTER TABLE batches ADD COLUMN risk_score_before_avg DECIMAL(5,2)' },
        { table: 'batches', column: 'risk_score_after_avg', query: 'ALTER TABLE batches ADD COLUMN risk_score_after_avg DECIMAL(5,2)' },
        { table: 'batches', column: 'hours_saved_total', query: 'ALTER TABLE batches ADD COLUMN hours_saved_total DECIMAL(10,2) DEFAULT 0' },
        { table: 'batches', column: 'value_generated_total', query: 'ALTER TABLE batches ADD COLUMN value_generated_total DECIMAL(10,2) DEFAULT 0' },

        // Jobs table: Batch & Profile integration (Phase 16 & 17.2)
        { table: 'jobs', column: 'batch_id', query: 'ALTER TABLE jobs ADD COLUMN batch_id VARCHAR(36)' },
        { table: 'jobs', column: 'requested_profile', query: 'ALTER TABLE jobs ADD COLUMN requested_profile VARCHAR(100)' },

        // Tenant & Subscription Management (Phase 19)
        { table: 'tenants', column: 'plan_expires_at', query: 'ALTER TABLE tenants ADD COLUMN plan_expires_at DATETIME' },
        { table: 'tenants', column: 'last_active_at', query: 'ALTER TABLE tenants ADD COLUMN last_active_at DATETIME' },
        { table: 'tenants', column: 'daily_job_limit', query: 'ALTER TABLE tenants ADD COLUMN daily_job_limit INT DEFAULT 1000' },
        { table: 'tenants', column: 'max_batch_size', query: 'ALTER TABLE tenants ADD COLUMN max_batch_size INT DEFAULT 50' },
        { table: 'tenants', column: 'metadata_json', query: 'ALTER TABLE tenants ADD COLUMN metadata_json JSON' },

        // API Key status tracking
        { table: 'api_keys', column: 'last_used_ip', query: 'ALTER TABLE api_keys ADD COLUMN last_used_ip VARCHAR(45)' },

        // Billing & Alerts Readiness (Phase 19.6)
        { table: 'tenants', column: 'alerts_state_json', query: 'ALTER TABLE tenants ADD COLUMN alerts_state_json JSON' },

        // Optimizing notification worker (Composite Index)
        { table: 'notifications', column: 'idx_status_scheduled', query: 'CREATE INDEX idx_status_scheduled ON notifications (status, scheduled_at)' },

        { table: 'tenants', column: 'webhook_url', query: 'ALTER TABLE tenants ADD COLUMN webhook_url VARCHAR(512)' },
        { table: 'tenants', column: 'webhook_secret', query: 'ALTER TABLE tenants ADD COLUMN webhook_secret VARCHAR(255)' },

        // Engagement Engine (Phase 21.3)
        { table: 'engagement_events', column: 'id', query: 'CREATE TABLE IF NOT EXISTS engagement_events (id VARCHAR(255) PRIMARY KEY, tenant_id VARCHAR(255) NOT NULL, signal_type VARCHAR(100) NOT NULL, action_taken VARCHAR(100) NOT NULL, metadata_json JSON, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, INDEX idx_tenant (tenant_id), INDEX idx_signal (signal_type), INDEX idx_created (created_at), FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE)' },

        // CS Workflows (Phase 21.4)
        { table: 'cs_workflows', column: 'id', query: "CREATE TABLE IF NOT EXISTS cs_workflows (id VARCHAR(36) PRIMARY KEY, tenant_id VARCHAR(255) NOT NULL, workflow_type VARCHAR(50) NOT NULL, status ENUM('ACTIVE', 'COMPLETED', 'ABANDONED') DEFAULT 'ACTIVE', current_step INT DEFAULT 1, last_action_at DATETIME, next_action_at DATETIME, metadata_json JSON, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, INDEX idx_tenant (tenant_id), INDEX idx_status (status), FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE)" },

        // CS Workflow Events (Phase 21.5)
        { table: 'cs_workflow_events', column: 'id', query: "CREATE TABLE IF NOT EXISTS cs_workflow_events (id BIGINT AUTO_INCREMENT PRIMARY KEY, workflow_id VARCHAR(36) NOT NULL, event_type VARCHAR(50) NOT NULL, metadata_json JSON, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, INDEX idx_workflow (workflow_id), FOREIGN KEY (workflow_id) REFERENCES cs_workflows(id) ON DELETE CASCADE)" },

        // Print Intelligence (Phase 24 Refined)
        { table: 'print_features', column: 'id', query: "CREATE TABLE IF NOT EXISTS print_features (id VARCHAR(36) PRIMARY KEY, job_id VARCHAR(36), max_tac INT, min_dpi INT, has_bleed BOOLEAN, color_profile VARCHAR(50), fonts_json JSON, tenant_id VARCHAR(255), created_at DATETIME DEFAULT CURRENT_TIMESTAMP)" },
        { table: 'machine_profiles', column: 'id', query: "CREATE TABLE IF NOT EXISTS machine_profiles (id VARCHAR(36) PRIMARY KEY, name VARCHAR(100) NOT NULL, type VARCHAR(20) NOT NULL, max_tac INT, min_res_dpi INT, requires_bleed BOOLEAN, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)" },
        { table: 'paper_profiles', column: 'id', query: "CREATE TABLE IF NOT EXISTS paper_profiles (id VARCHAR(36) PRIMARY KEY, name VARCHAR(100) NOT NULL, weight INT, absorption_coefficient FLOAT, icc_profile VARCHAR(50), created_at DATETIME DEFAULT CURRENT_TIMESTAMP)" },
        { table: 'policy_constraints', column: 'id', query: "CREATE TABLE IF NOT EXISTS policy_constraints (id VARCHAR(36) PRIMARY KEY, policy_name VARCHAR(50) NOT NULL, tac_limit INT, min_dpi INT, bleed_required BOOLEAN)" },

        // Global Print Network (Phase 25 & 26.1)
        { table: 'printer_nodes', column: 'id', query: "CREATE TABLE IF NOT EXISTS printer_nodes (id VARCHAR(36) PRIMARY KEY, name VARCHAR(255) NOT NULL, country VARCHAR(100), city VARCHAR(100), status ENUM('PENDING_REVIEW', 'ACTIVE', 'SUSPENDED', 'OFFLINE') DEFAULT 'PENDING_REVIEW', created_at DATETIME DEFAULT CURRENT_TIMESTAMP)" },
        { table: 'printer_nodes', column: 'legal_name', query: "ALTER TABLE printer_nodes ADD COLUMN legal_name VARCHAR(255)" },
        { table: 'printer_nodes', column: 'vat_id', query: "ALTER TABLE printer_nodes ADD COLUMN vat_id VARCHAR(50)" },
        { table: 'printer_nodes', column: 'website', query: "ALTER TABLE printer_nodes ADD COLUMN website VARCHAR(255)" },
        { table: 'printer_nodes', column: 'connect_status', query: "ALTER TABLE printer_nodes ADD COLUMN connect_status ENUM('NOT_CONFIGURED', 'PARTIALLY_CONFIGURED', 'READY') DEFAULT 'NOT_CONFIGURED'" },
        { table: 'printer_nodes', column: 'quality_score', query: "ALTER TABLE printer_nodes ADD COLUMN quality_score FLOAT DEFAULT 0.5" },
        { table: 'printer_nodes', column: 'price_index', query: "ALTER TABLE printer_nodes ADD COLUMN price_index FLOAT DEFAULT 1.0" },
        { table: 'printer_nodes', column: 'sla_tier', query: "ALTER TABLE printer_nodes ADD COLUMN sla_tier VARCHAR(50) DEFAULT 'BRONZE'" },
        { table: 'printer_nodes', column: 'printer_api_key_hash', query: "ALTER TABLE printer_nodes ADD COLUMN printer_api_key_hash VARCHAR(255)" },

        { table: 'printer_contacts', column: 'id', query: "CREATE TABLE IF NOT EXISTS printer_contacts (id VARCHAR(36) PRIMARY KEY, printer_id VARCHAR(36) NOT NULL, name VARCHAR(100) NOT NULL, email VARCHAR(255) NOT NULL, role VARCHAR(50), FOREIGN KEY (printer_id) REFERENCES printer_nodes(id) ON DELETE CASCADE)" },
        { table: 'printer_machines', column: 'id', query: "CREATE TABLE IF NOT EXISTS printer_machines (id VARCHAR(36) PRIMARY KEY, printer_id VARCHAR(36) NOT NULL, machine_profile_id VARCHAR(36) NOT NULL, status ENUM('ACTIVE', 'OFFLINE') DEFAULT 'ACTIVE', FOREIGN KEY (printer_id) REFERENCES printer_nodes(id) ON DELETE CASCADE, FOREIGN KEY (machine_profile_id) REFERENCES machine_profiles(id))" },
        { table: 'printer_machines', column: 'nickname', query: "ALTER TABLE printer_machines ADD COLUMN nickname VARCHAR(100)" },
        { table: 'printer_machines', column: 'capacity_index', query: "ALTER TABLE printer_machines ADD COLUMN capacity_index FLOAT DEFAULT 1.0" },

        { table: 'printer_papers', column: 'id', query: "CREATE TABLE IF NOT EXISTS printer_papers (id VARCHAR(36) PRIMARY KEY, printer_id VARCHAR(36) NOT NULL, paper_profile_id VARCHAR(36) NOT NULL, available BOOLEAN DEFAULT TRUE, FOREIGN KEY (printer_id) REFERENCES printer_nodes(id) ON DELETE CASCADE, FOREIGN KEY (paper_profile_id) REFERENCES paper_profiles(id))" },
        { table: 'printer_capacity', column: 'id', query: "CREATE TABLE IF NOT EXISTS printer_capacity (id VARCHAR(36) PRIMARY KEY, printer_id VARCHAR(36) NOT NULL, date DATE NOT NULL, capacity_total FLOAT DEFAULT 1.0, capacity_available FLOAT DEFAULT 1.0, lead_time_days INT DEFAULT 3, INDEX idx_printer_date (printer_id, date), FOREIGN KEY (printer_id) REFERENCES printer_nodes(id) ON DELETE CASCADE)" },
        { table: 'printer_service_regions', column: 'id', query: "CREATE TABLE IF NOT EXISTS printer_service_regions (id VARCHAR(36) PRIMARY KEY, printer_id VARCHAR(36) NOT NULL, country VARCHAR(100) NOT NULL, region VARCHAR(100), postal_range VARCHAR(50), FOREIGN KEY (printer_id) REFERENCES printer_nodes(id) ON DELETE CASCADE)" },

        // Routing Intelligence & Quality (Phase 26.2)
        { table: 'printer_performance', column: 'id', query: "CREATE TABLE IF NOT EXISTS printer_performance (id VARCHAR(36) PRIMARY KEY, printer_id VARCHAR(36) NOT NULL, period_start DATE, period_end DATE, jobs_processed INT DEFAULT 0, jobs_success INT DEFAULT 0, jobs_failed INT DEFAULT 0, avg_routing_score FLOAT DEFAULT 0, reprint_rate FLOAT DEFAULT 0, on_time_delivery_rate FLOAT DEFAULT 1.0, avg_processing_time FLOAT DEFAULT 0, quality_score FLOAT DEFAULT 1.0, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (printer_id) REFERENCES printer_nodes(id) ON DELETE CASCADE)" },
        { table: 'routing_history', column: 'id', query: "CREATE TABLE IF NOT EXISTS routing_history (id VARCHAR(36) PRIMARY KEY, job_id VARCHAR(36), printer_id VARCHAR(36), routing_score FLOAT, compatibility_score FLOAT, quality_score FLOAT, capacity_score FLOAT, price_score FLOAT, distance_score FLOAT, selected BOOLEAN DEFAULT FALSE, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (printer_id) REFERENCES printer_nodes(id) ON DELETE CASCADE)" },
        { table: 'job_outcomes', column: 'id', query: "CREATE TABLE IF NOT EXISTS job_outcomes (id VARCHAR(36) PRIMARY KEY, job_id VARCHAR(36), printer_id VARCHAR(36), status ENUM('SUCCESS','FAILED','REPRINT','CANCELLED'), completion_time_hours FLOAT, quality_rating FLOAT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (printer_id) REFERENCES printer_nodes(id) ON DELETE CASCADE)" },

        // Routing Hardening (Phase 27.1)
        { table: 'routing_audit_log', column: 'id', query: "CREATE TABLE IF NOT EXISTS routing_audit_log (id VARCHAR(36) PRIMARY KEY, job_id VARCHAR(36), routing_version VARCHAR(20), candidate_printers JSON, selected_candidates JSON, fallback_used BOOLEAN DEFAULT FALSE, decision_explanation JSON, confidence_score FLOAT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, INDEX idx_job (job_id))" },
        { table: 'routing_conflicts', column: 'id', query: "CREATE TABLE IF NOT EXISTS routing_conflicts (id VARCHAR(36) PRIMARY KEY, job_id VARCHAR(36), conflict_type VARCHAR(50), conflict_description TEXT, severity ENUM('LOW','MEDIUM','HIGH'), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, INDEX idx_job (job_id))" },

        // Routing Reservation Layer (Phase 27.2)
        { table: 'capacity_reservations', column: 'id', query: "CREATE TABLE IF NOT EXISTS capacity_reservations (id VARCHAR(36) PRIMARY KEY, job_id VARCHAR(36), printer_id VARCHAR(36), machine_id VARCHAR(36), reserved_units INT, reservation_status ENUM('ACTIVE','EXPIRED','CONFIRMED','CANCELLED') DEFAULT 'ACTIVE', expires_at TIMESTAMP, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, INDEX idx_job (job_id), INDEX idx_printer (printer_id))" },
        { table: 'reservation_events', column: 'id', query: "CREATE TABLE IF NOT EXISTS reservation_events (id VARCHAR(36) PRIMARY KEY, reservation_id VARCHAR(36), event_type VARCHAR(50), metadata_json JSON, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, INDEX idx_res (reservation_id))" },

        // Autonomous Dispatch Engine (Phase 27.3)
        { table: 'job_assignments', column: 'id', query: "CREATE TABLE IF NOT EXISTS job_assignments (id VARCHAR(36) PRIMARY KEY, job_id VARCHAR(36), printer_id VARCHAR(36), machine_id VARCHAR(36), reservation_id VARCHAR(36), assignment_status ENUM('PENDING','DISPATCHED','ACCEPTED','REJECTED','FAILED','COMPLETED') DEFAULT 'PENDING', dispatch_attempt INT DEFAULT 1, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, INDEX idx_job (job_id), INDEX idx_printer (printer_id))" },
        { table: 'dispatch_events', column: 'id', query: "CREATE TABLE IF NOT EXISTS dispatch_events (id VARCHAR(36) PRIMARY KEY, assignment_id VARCHAR(36), event_type VARCHAR(50), metadata_json JSON, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, INDEX idx_assignment (assignment_id))" },

        // Printer Capacity Sync API (Phase 26.3)
        { table: 'printer_nodes', column: 'last_sync_at', query: "ALTER TABLE printer_nodes ADD COLUMN last_sync_at DATETIME" },
        { table: 'printer_nodes', column: 'sync_status', query: "ALTER TABLE printer_nodes ADD COLUMN sync_status ENUM('HEALTHY','STALE','OFFLINE') DEFAULT 'HEALTHY'" },
        { table: 'printer_machines', column: 'machine_health', query: "ALTER TABLE printer_machines ADD COLUMN machine_health ENUM('OK','MAINTENANCE','OFFLINE') DEFAULT 'OK'" },
        { table: 'printer_machines', column: 'last_status_update', query: "ALTER TABLE printer_machines ADD COLUMN last_status_update DATETIME" },
        { table: 'printer_capacity', column: 'source', query: "ALTER TABLE printer_capacity ADD COLUMN source ENUM('MANUAL','SYNC_API') DEFAULT 'MANUAL'" },
        { table: 'printer_capacity', column: 'sync_id', query: "ALTER TABLE printer_capacity ADD COLUMN sync_id VARCHAR(100)" },

        // Phase 28.1: Pricing Intelligence Engine
        { table: 'printer_pricing_profiles', column: 'id', query: "CREATE TABLE IF NOT EXISTS printer_pricing_profiles (id VARCHAR(36) PRIMARY KEY, printer_id VARCHAR(36), machine_id VARCHAR(36), pricing_scope ENUM('PRINTER','MACHINE'), currency VARCHAR(3) DEFAULT 'EUR', base_cost_per_sheet DECIMAL(12,4), setup_cost DECIMAL(12,4), color_multiplier DECIMAL(12,4), tac_penalty_multiplier DECIMAL(12,4), bleed_handling_cost DECIMAL(12,4), rush_multiplier DECIMAL(12,4), lead_time_discount_multiplier DECIMAL(12,4), minimum_job_fee DECIMAL(12,4), active BOOLEAN DEFAULT TRUE, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, INDEX idx_printer (printer_id), INDEX idx_machine (machine_id))" },
        { table: 'job_quotes', column: 'id', query: "CREATE TABLE IF NOT EXISTS job_quotes (id VARCHAR(36) PRIMARY KEY, job_id VARCHAR(36), printer_id VARCHAR(36), machine_id VARCHAR(36), routing_audit_id VARCHAR(36), currency VARCHAR(3) DEFAULT 'EUR', production_cost DECIMAL(12,4), suggested_price DECIMAL(12,4), estimated_margin DECIMAL(12,4), margin_pct DECIMAL(12,4), pricing_version VARCHAR(20), quote_status ENUM('ESTIMATED','CONFIRMED','EXPIRED') DEFAULT 'ESTIMATED', calculation_breakdown_json JSON, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, INDEX idx_job (job_id), INDEX idx_printer (printer_id))" },
        { table: 'pricing_events', column: 'id', query: "CREATE TABLE IF NOT EXISTS pricing_events (id VARCHAR(36) PRIMARY KEY, job_quote_id VARCHAR(36), event_type VARCHAR(50), metadata_json JSON, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, INDEX idx_quote (job_quote_id))" },

        // Phase 28.2: Economic Routing Engine
        { table: 'economic_routing_audit', column: 'id', query: "CREATE TABLE IF NOT EXISTS economic_routing_audit (id VARCHAR(36) PRIMARY KEY, job_id VARCHAR(36), routing_audit_id VARCHAR(36), pricing_version VARCHAR(20), economic_routing_version VARCHAR(20), candidate_summary_json JSON, selected_printer_id VARCHAR(36), selected_machine_id VARCHAR(36), selected_quote_id VARCHAR(36), final_decision_json JSON, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, INDEX idx_job (job_id))" },
        { table: 'economic_routing_conflicts', column: 'id', query: "CREATE TABLE IF NOT EXISTS economic_routing_conflicts (id VARCHAR(36) PRIMARY KEY, job_id VARCHAR(36), printer_id VARCHAR(36), conflict_type VARCHAR(50), conflict_description TEXT, severity ENUM('LOW','MEDIUM','HIGH'), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, INDEX idx_job (job_id))" },

        // Phase 28.3: Production Offers Layer
        { table: 'production_offers', column: 'id', query: "CREATE TABLE IF NOT EXISTS production_offers (id VARCHAR(36) PRIMARY KEY, job_id VARCHAR(36), printer_id VARCHAR(36), machine_id VARCHAR(36), quote_id VARCHAR(36), reservation_id VARCHAR(36), routing_audit_id VARCHAR(36), economic_routing_audit_id VARCHAR(36), currency VARCHAR(3) DEFAULT 'EUR', production_cost DECIMAL(12,4), suggested_price DECIMAL(12,4), estimated_margin DECIMAL(12,4), margin_pct DECIMAL(12,4), lead_time_days INT, offer_expires_at TIMESTAMP, offer_status ENUM('PENDING','SENT','VIEWED','ACCEPTED','REJECTED','EXPIRED','CANCELLED') DEFAULT 'PENDING', offer_source ENUM('AUTO_ROUTING','ADMIN_OVERRIDE') DEFAULT 'AUTO_ROUTING', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, INDEX idx_job (job_id), INDEX idx_printer (printer_id), INDEX idx_status (offer_status))" },
        { table: 'production_offer_events', column: 'id', query: "CREATE TABLE IF NOT EXISTS production_offer_events (id VARCHAR(36) PRIMARY KEY, offer_id VARCHAR(36), event_type VARCHAR(50), metadata_json JSON, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, INDEX idx_offer (offer_id))" },

        // Phase 28.4: Marketplace Interaction Layer
        { table: 'job_marketplace_sessions', column: 'id', query: "CREATE TABLE IF NOT EXISTS job_marketplace_sessions (id VARCHAR(36) PRIMARY KEY, job_id VARCHAR(36), session_status ENUM('OPEN','SELECTED','CLOSED','EXPIRED') DEFAULT 'OPEN', selection_mode ENUM('AUTO','ADMIN_OVERRIDE','MANUAL') DEFAULT 'AUTO', selected_offer_id VARCHAR(36), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, INDEX idx_job (job_id))" },
        { table: 'marketplace_events', column: 'id', query: "CREATE TABLE IF NOT EXISTS marketplace_events (id VARCHAR(36) PRIMARY KEY, job_id VARCHAR(36), marketplace_session_id VARCHAR(36), offer_id VARCHAR(36), event_type VARCHAR(50), metadata_json JSON, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, INDEX idx_job (job_id), INDEX idx_session (marketplace_session_id))" },

        // Extending production_offers for Marketplace context
        { table: 'production_offers', column: 'marketplace_session_id', query: "ALTER TABLE production_offers ADD COLUMN marketplace_session_id VARCHAR(36), ADD COLUMN offer_rank INT, ADD COLUMN offer_selected BOOLEAN DEFAULT FALSE, ADD COLUMN offer_priority_score DECIMAL(12,4)" },

        // Phase 29: Marketplace Readiness
        { table: 'production_offers', column: 'negotiation_status', query: "ALTER TABLE production_offers ADD COLUMN negotiation_status ENUM('NONE','OPEN','COUNTERED','ACCEPTED','REJECTED','EXPIRED','CLOSED') DEFAULT 'NONE', ADD COLUMN committed_price DECIMAL(12,4), ADD COLUMN committed_lead_time_days INT, ADD COLUMN counteroffer_count INT DEFAULT 0, ADD COLUMN commercial_ready BOOLEAN DEFAULT FALSE" },
        { table: 'offer_counteroffers', column: 'id', query: "CREATE TABLE IF NOT EXISTS offer_counteroffers (id VARCHAR(36) PRIMARY KEY, offer_id VARCHAR(36), counterparty ENUM('PRINTER','PLATFORM'), proposed_price DECIMAL(12,4), proposed_lead_time_days INT, proposed_notes TEXT, counteroffer_status ENUM('PENDING','ACCEPTED','REJECTED','SUPERSEDED','EXPIRED') DEFAULT 'PENDING', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, INDEX idx_offer (offer_id))" },
        { table: 'marketplace_session_state', column: 'id', query: "CREATE TABLE IF NOT EXISTS marketplace_session_state (id VARCHAR(36) PRIMARY KEY, marketplace_session_id VARCHAR(36), state ENUM('OPEN','NEGOTIATING','SELECTED','COMMERCIALLY_READY','CLOSED','EXPIRED') DEFAULT 'OPEN', selected_offer_id VARCHAR(36), commercial_commitment_json JSON, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, INDEX idx_session (marketplace_session_id))" },
        { table: 'commercial_events', column: 'id', query: "CREATE TABLE IF NOT EXISTS commercial_events (id VARCHAR(36) PRIMARY KEY, job_id VARCHAR(36), marketplace_session_id VARCHAR(36), offer_id VARCHAR(36), event_type VARCHAR(50), metadata_json JSON, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, INDEX idx_job (job_id), INDEX idx_session (marketplace_session_id))" },

        // Phase 29.1: Commercial Commitments & Settlement Readiness
        { table: 'commercial_commitments', column: 'id', query: "CREATE TABLE IF NOT EXISTS commercial_commitments (id VARCHAR(36) PRIMARY KEY, job_id VARCHAR(36), marketplace_session_id VARCHAR(36), selected_offer_id VARCHAR(36), printer_id VARCHAR(36), machine_id VARCHAR(36), currency VARCHAR(3) DEFAULT 'EUR', committed_price DECIMAL(12,4), committed_production_cost DECIMAL(12,4), committed_margin DECIMAL(12,4), committed_margin_pct DECIMAL(12,4), committed_lead_time_days INT, commercial_commitment_status ENUM('DRAFT','READY','LOCKED','VOIDED') DEFAULT 'DRAFT', settlement_readiness_status ENUM('NOT_READY','READY_FOR_INVOICE','READY_FOR_PAYOUT','SETTLEMENT_PENDING','SETTLED') DEFAULT 'NOT_READY', transaction_reference VARCHAR(50) UNIQUE, ledger_reference VARCHAR(100), metadata_json JSON, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, INDEX idx_job (job_id), INDEX idx_printer (printer_id), INDEX idx_ref (transaction_reference))" },
        { table: 'settlement_placeholders', column: 'id', query: "CREATE TABLE IF NOT EXISTS settlement_placeholders (id VARCHAR(36) PRIMARY KEY, commercial_commitment_id VARCHAR(36), payable_to_printer DECIMAL(12,4), platform_fee DECIMAL(12,4), gross_value DECIMAL(12,4), settlement_currency VARCHAR(3) DEFAULT 'EUR', settlement_status ENUM('PENDING','BLOCKED','READY','SETTLED') DEFAULT 'PENDING', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, INDEX idx_commitment (commercial_commitment_id))" },
        { table: 'commercial_commitment_events', column: 'id', query: "CREATE TABLE IF NOT EXISTS commercial_commitment_events (id VARCHAR(36) PRIMARY KEY, commercial_commitment_id VARCHAR(36), event_type VARCHAR(50), metadata_json JSON, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, INDEX idx_commitment (commercial_commitment_id))" },

        // Phase 30: Autonomous Print Infrastructure
        { table: 'autonomous_job_pipelines', column: 'id', query: "CREATE TABLE IF NOT EXISTS autonomous_job_pipelines (id VARCHAR(36) PRIMARY KEY, job_id VARCHAR(36), pipeline_state VARCHAR(50), pipeline_status ENUM('RUNNING','PAUSED','FAILED','COMPLETED') DEFAULT 'RUNNING', current_step VARCHAR(50), error_reason TEXT, autonomous_mode BOOLEAN DEFAULT TRUE, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, INDEX idx_job (job_id), INDEX idx_state (pipeline_state))" },
        { table: 'pipeline_events', column: 'id', query: "CREATE TABLE IF NOT EXISTS pipeline_events (id VARCHAR(36) PRIMARY KEY, pipeline_id VARCHAR(36), event_type VARCHAR(50), step_name VARCHAR(50), metadata_json JSON, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, INDEX idx_pipeline (pipeline_id))" },

        // Phase 31: Autonomous Settlement & Global Payout
        { table: 'financial_transactions', column: 'id', query: "CREATE TABLE IF NOT EXISTS financial_transactions (id VARCHAR(36) PRIMARY KEY, transaction_reference VARCHAR(50) UNIQUE, commercial_commitment_id VARCHAR(36), job_id VARCHAR(36), printer_id VARCHAR(36), currency VARCHAR(3) DEFAULT 'EUR', gross_amount DECIMAL(12,4), production_cost DECIMAL(12,4), platform_fee DECIMAL(12,4), printer_payout DECIMAL(12,4), transaction_status ENUM('CREATED','INVOICED','SETTLEMENT_PENDING','SETTLEMENT_SCHEDULED','SETTLED','FAILED') DEFAULT 'CREATED', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, INDEX idx_commitment (commercial_commitment_id), INDEX idx_job (job_id), INDEX idx_printer (printer_id))" },
        { table: 'financial_ledger_entries', column: 'id', query: "CREATE TABLE IF NOT EXISTS financial_ledger_entries (id VARCHAR(36) PRIMARY KEY, transaction_id VARCHAR(36), entry_type ENUM('DEBIT','CREDIT'), account_type ENUM('CUSTOMER','PRINTER','PLATFORM_REVENUE','ESCROW'), amount DECIMAL(12,4), currency VARCHAR(3) DEFAULT 'EUR', metadata_json JSON, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, INDEX idx_transaction (transaction_id))" },
        { table: 'invoices', column: 'id', query: "CREATE TABLE IF NOT EXISTS invoices (id VARCHAR(36) PRIMARY KEY, transaction_id VARCHAR(36), invoice_number VARCHAR(50) UNIQUE, invoice_type ENUM('CUSTOMER','PRINTER'), currency VARCHAR(3) DEFAULT 'EUR', amount DECIMAL(12,4), invoice_status ENUM('DRAFT','ISSUED','PAID','CANCELLED') DEFAULT 'DRAFT', pdf_url VARCHAR(255), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, INDEX idx_transaction (transaction_id))" },
        { table: 'payouts', column: 'id', query: "CREATE TABLE IF NOT EXISTS payouts (id VARCHAR(36) PRIMARY KEY, transaction_id VARCHAR(36), printer_id VARCHAR(36), currency VARCHAR(3), payout_amount DECIMAL(12,4), payout_status ENUM('PENDING','SCHEDULED','PROCESSING','COMPLETED','FAILED') DEFAULT 'PENDING', payout_provider VARCHAR(50), external_reference VARCHAR(100), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, INDEX idx_transaction (transaction_id), INDEX idx_printer (printer_id))" },
        { table: 'settlement_events', column: 'id', query: "CREATE TABLE IF NOT EXISTS settlement_events (id VARCHAR(36) PRIMARY KEY, transaction_id VARCHAR(36), event_type VARCHAR(50), metadata_json JSON, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, INDEX idx_transaction (transaction_id))" }
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
