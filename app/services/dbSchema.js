const db = require('./db');

/**
 * PrintPrice OS - Unified Identity & Governance Schema
 * Establishes the structural foundation for:
 * 1. Role-based Authentication (Users)
 * 2. Resource Governance (Licenses)
 * 3. Machine-to-Machine Integration (API Keys)
 * 4. Forensic Audit Trails (Usage Logs)
 */
module.exports = {
    initSchema: async () => {
        console.log('[SCHEMA-INIT] Synchronizing system tables to PrintPrice OS spec...');
        
        try {
            // 1. Users table (Central ID Layer)
            await db.execute(`
                CREATE TABLE IF NOT EXISTS users (
                    id VARCHAR(64) PRIMARY KEY,
                    email VARCHAR(255) UNIQUE NOT NULL,
                    password_hash VARCHAR(255) NOT NULL,
                    role ENUM('AUTHOR', 'PUBLISHER', 'PRINT_HOUSE', 'DEVELOPER') DEFAULT 'AUTHOR',
                    organization_name VARCHAR(255),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    last_login TIMESTAMP NULL,
                    status ENUM('ACTIVE', 'SUSPENDED', 'PENDING') DEFAULT 'ACTIVE'
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            `);

            // 2. Licenses table (Resource Access Control)
            await db.execute(`
                CREATE TABLE IF NOT EXISTS licenses (
                    id VARCHAR(64) PRIMARY KEY,
                    user_id VARCHAR(64) NOT NULL,
                    plan ENUM('FREE', 'PRO', 'ENTERPRISE') DEFAULT 'FREE',
                    max_file_size_mb BIGINT DEFAULT 50,
                    daily_jobs_limit INT DEFAULT 5,
                    jobs_used_today INT DEFAULT 0,
                    ai_magic_fix_enabled BOOLEAN DEFAULT FALSE,
                    priority_processing BOOLEAN DEFAULT FALSE,
                    expires_at TIMESTAMP NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            `);

            // 3. API Keys (Machine Connectivity)
            await db.execute(`
                CREATE TABLE IF NOT EXISTS api_keys (
                    id VARCHAR(64) PRIMARY KEY,
                    user_id VARCHAR(64) NOT NULL,
                    api_key VARCHAR(128) UNIQUE NOT NULL,
                    label VARCHAR(255),
                    last_used TIMESTAMP NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                    INDEX (api_key)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            `);

            // 4. Usage Logs (Forensic Auditing)
            await db.execute(`
                CREATE TABLE IF NOT EXISTS usage_logs (
                    id BIGINT AUTO_INCREMENT PRIMARY KEY,
                    user_id VARCHAR(64) NOT NULL,
                    action VARCHAR(128) NOT NULL,
                    metadata JSON,
                    status ENUM('SUCCESS', 'FAILURE', 'BLOCKED') DEFAULT 'SUCCESS',
                    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                    INDEX (user_id),
                    INDEX (timestamp)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            `);

            // 5. Jobs table (Literal V2 Patch)
            await db.execute(`
  CREATE TABLE IF NOT EXISTS jobs (
    id VARCHAR(191) PRIMARY KEY,
    tenant_id VARCHAR(191) NOT NULL,
    status VARCHAR(64) NOT NULL DEFAULT 'QUEUED',
    policy VARCHAR(191) NULL,
    input_data JSON NULL,
    payload JSON NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )
`);

            // 6. Batches table (Bulk execution support)
            await db.execute(`
                CREATE TABLE IF NOT EXISTS batches (
                    id VARCHAR(64) PRIMARY KEY,
                    tenant_id VARCHAR(64) NOT NULL,
                    status ENUM('QUEUED', 'RUNNING', 'SUCCEEDED', 'PARTIAL', 'FAILED') DEFAULT 'QUEUED',
                    policy_slug VARCHAR(128),
                    total_jobs INT DEFAULT 0,
                    completed_jobs INT DEFAULT 0,
                    failed_jobs INT DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    finished_at TIMESTAMP NULL,
                    INDEX (tenant_id),
                    INDEX (status)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            `);

            // 7. Job Evidence (Literal V2 Patch)
            await db.execute(`
  CREATE TABLE IF NOT EXISTS job_evidence (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    job_id VARCHAR(191) NOT NULL,
    tenant_id VARCHAR(191) NOT NULL,
    evidence JSON NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    KEY idx_job_evidence_job_id (job_id),
    KEY idx_job_evidence_tenant_id (tenant_id)
  )
`);

            // 8. Assets table (Literal V2 Patch)
            await db.execute(`
  CREATE TABLE IF NOT EXISTS assets (
    id VARCHAR(191) PRIMARY KEY,
    tenant_id VARCHAR(191) NOT NULL,
    filename VARCHAR(512) NOT NULL,
    file_path TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    KEY idx_assets_tenant_id (tenant_id)
  )
`);

            console.log('[SCHEMA-INIT] OK: Job orchestration, Evidence & Asset tables synchronized.');

            // Seed initial identities if empty
            const [rows] = await db.execute('SELECT COUNT(*) as count FROM users');
            if (rows && rows.count === 0) {
                console.log('[SCHEMA-SEED] System identities empty. Seeding tactical test nodes...');
                const bcrypt = require('bcryptjs');
                const { v4: uuidv4 } = require('uuid');

                const testUsers = [
                    { email: 'author@printprice.pro', role: 'AUTHOR', plan: 'FREE' },
                    { email: 'admin@printprice.pro', role: 'DEVELOPER', plan: 'PRO' },
                    { email: 'publisher@printprice.pro', role: 'PUBLISHER', plan: 'PRO' }
                ];

                const passHash = await bcrypt.hash('password123', 10);

                for (const u of testUsers) {
                    const userId = uuidv4();
                    const licenseId = uuidv4();

                    await db.execute(
                        'INSERT INTO users (id, email, password_hash, role, status) VALUES (?, ?, ?, ?, ?)',
                        [userId, u.email, passHash, u.role, 'ACTIVE']
                    );

                    await db.execute(
                        'INSERT INTO licenses (id, user_id, plan, max_file_size_mb, daily_jobs_limit, ai_magic_fix_enabled) VALUES (?, ?, ?, ?, ?, ?)',
                        [licenseId, userId, u.plan, u.plan === 'PRO' ? 500 : 50, u.plan === 'PRO' ? 50 : 5, u.plan === 'PRO']
                    );
                }
                console.log('[SCHEMA-SEED] OK: 3 identities initialized.');
            }

            return true;
        } catch (err) {
            console.error('[SCHEMA-INIT] FATAL: Failed to synchronize tables:', err);
            return false;
        }
    }
};

