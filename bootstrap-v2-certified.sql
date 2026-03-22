-- PrintPrice Pro V2 - Certified Production Schema
-- Compatibility: MySQL 8.0+ / MariaDB 10.4+

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS tenants (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    status ENUM('ACTIVE', 'SUSPENDED', 'QUARANTINED', 'DECOMMISSIONED') DEFAULT 'ACTIVE',
    rate_limit_rpm INT DEFAULT 60,
    daily_job_limit INT DEFAULT 1000,
    plan VARCHAR(50) DEFAULT 'STANDARD',
    plan_expires_at DATETIME NULL,
    alerts_state_json JSON NULL,
    last_active_at DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS api_keys (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    key_hash VARCHAR(64) NOT NULL UNIQUE,
    name VARCHAR(100) NULL,
    revoked BOOLEAN DEFAULT FALSE,
    last_used_at DATETIME NULL,
    last_used_ip VARCHAR(45) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_key_lookup (key_hash, revoked),
    INDEX idx_key_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS assets (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    filename VARCHAR(255) NOT NULL,
    storage_path VARCHAR(512) NOT NULL,
    sha256 VARCHAR(64) NOT NULL,
    size BIGINT NOT NULL,
    mime_type VARCHAR(100) DEFAULT 'application/pdf',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_asset_tenant (tenant_id),
    INDEX idx_asset_sha (sha256)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS jobs (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    asset_id VARCHAR(64) NULL,
    type VARCHAR(50) NOT NULL, -- PREFLIGHT, AUTOFIX
    status VARCHAR(50) DEFAULT 'QUEUED', -- QUEUED, PROCESSING, SUCCEEDED, FAILED
    progress INT DEFAULT 0,
    error JSON NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_job_tenant (tenant_id, created_at),
    INDEX idx_job_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS reports (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    job_id VARCHAR(64) NOT NULL UNIQUE,
    asset_id VARCHAR(64) NULL, -- Fixed/Output asset
    data JSON NOT NULL,
    delta JSON NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS metrics (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    job_id VARCHAR(64) NOT NULL,
    tenant_id VARCHAR(64) NOT NULL,
    success BOOLEAN DEFAULT TRUE,
    processing_ms INT DEFAULT 0,
    file_size_bytes BIGINT DEFAULT 0,
    page_count INT DEFAULT 0,
    delta_score INT DEFAULT 0,
    policy_slug VARCHAR(100) NULL,
    risk_score_before INT NULL,
    risk_score_after INT NULL,
    hours_saved DECIMAL(10,2) DEFAULT 0,
    value_generated DECIMAL(10,2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_metrics_tenant (tenant_id),
    INDEX idx_metrics_policy (policy_slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 7. Governance Policies (Phase 19.C)
CREATE TABLE IF NOT EXISTS governance_policies (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    status ENUM('active', 'inactive', 'draft') DEFAULT 'active',
    scope_type ENUM('global', 'tenant', 'queue', 'service') DEFAULT 'global',
    scope_id VARCHAR(64) NULL, -- tenant_id, queue_name, or service_name
    policy_type VARCHAR(64) NOT NULL,
    action ENUM('allow', 'deny', 'quarantine', 'degrade', 'throttle') DEFAULT 'allow',
    reason VARCHAR(255) NULL,
    config JSON NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 8. Governance Audit (Phase 19.D)
CREATE TABLE IF NOT EXISTS governance_audit (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    operator_id VARCHAR(64) NOT NULL,
    operator_role VARCHAR(50) NOT NULL,
    action_type VARCHAR(100) NOT NULL,
    target_type VARCHAR(50) NOT NULL,
    target_id VARCHAR(64) NOT NULL,
    reason VARCHAR(255) NULL,
    payload JSON NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 9. Tenant Resource Limits (Phase 20.C)
CREATE TABLE IF NOT EXISTS tenant_resource_limits (
    tenant_id VARCHAR(64) PRIMARY KEY,
    max_concurrent_jobs INT DEFAULT 2,
    max_jobs_per_minute INT DEFAULT 30,
    max_jobs_per_hour INT DEFAULT 500,
    max_queue_depth INT DEFAULT 100,
    burst_multiplier DECIMAL(3,2) DEFAULT 1.5,
    is_enabled BOOLEAN DEFAULT TRUE,
    priority_class VARCHAR(50) DEFAULT 'normal',
    plan_tier VARCHAR(50) DEFAULT 'standard'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 10. Tenant Resource Overrides (Phase 20.C)
CREATE TABLE IF NOT EXISTS tenant_resource_overrides (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    config JSON NOT NULL,
    expires_at DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- INITIAL SEED (Tenants and Default API Key)
INSERT IGNORE INTO tenants (id, name, status, plan) VALUES ('demo-tenant', 'Demo Print Shop', 'ACTIVE', 'ENTERPRISE');
INSERT IGNORE INTO tenants (id, name, status, plan) VALUES ('ppos-customer-1', 'Production Customer 1', 'ACTIVE', 'PREMIUM');

-- Baseline Governance Policy (Allows standard operations)
INSERT IGNORE INTO governance_policies (id, name, status, scope_type, policy_type, action, reason) 
VALUES ('p_baseline_001', 'Standard Baseline Permit', 'active', 'global', 'BASELINE_PERMIT', 'allow', 'Auto-generated baseline');

-- Default limits for production tenant
INSERT IGNORE INTO tenant_resource_limits (tenant_id, max_concurrent_jobs, max_jobs_per_minute, max_jobs_per_hour, is_enabled)
VALUES ('ppos-customer-1', 10, 100, 1000, 1);

-- Example API Key: "pp_live_123456789"
-- SHA256 Hash: 866e4a66a7b74f07a6a43b677a8b67a6a6a43... (Just for ref)
INSERT IGNORE INTO api_keys (id, tenant_id, key_hash, name) 
VALUES ('key_demo_001', 'demo-tenant', '866e4a66a7b74f07a6a43b677a8b67a6a6a43b677a8b67a6a6a43b677a8b67a6', 'Demo Key');

SET FOREIGN_KEY_CHECKS = 1;
