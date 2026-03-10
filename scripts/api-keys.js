#!/usr/bin/env node
/**
 * PrintPrice Pro — API Key Management CLI
 *
 * Usage:
 *   node scripts/api-keys.js create --tenant <id> [--name <label>] [--plan FREE|PRO|ENTERPRISE]
 *   node scripts/api-keys.js list   --tenant <id>
 *   node scripts/api-keys.js revoke --id <key_id>
 *   node scripts/api-keys.js rotate --id <key_id>
 *   node scripts/api-keys.js tenants
 *
 * Security:
 *   - API keys are displayed ONCE on creation; only the SHA-256 hash is stored.
 *   - Revoke marks revoked=1; the row is never deleted for audit purposes.
 *   - Every operation is written to audit_logs.
 *
 * @license Apache-2.0
 */

require('dotenv').config();
const crypto = require('crypto');

// ---- Argument Parser (no external deps) ----
const args = process.argv.slice(2);
const command = args[0];
const flags = {};
for (let i = 1; i < args.length; i += 2) {
    if (args[i] && args[i].startsWith('--')) {
        flags[args[i].slice(2)] = args[i + 1] || '';
    }
}

// ---- DB ----
let db;
try {
    db = require('../services/db');
} catch (e) {
    fatal('Could not load database service: ' + e.message);
}

// ---- Helpers ----
function fatal(msg) {
    console.error('\n❌ ERROR:', msg);
    process.exit(1);
}

function ok(data) {
    console.log('\n' + JSON.stringify(data, null, 2));
}

function generateKey() {
    const raw = 'ppk_live_' + crypto.randomBytes(24).toString('base64url');
    const hash = crypto.createHash('sha256').update(raw).digest('hex');
    return { raw, hash };
}

async function auditLog(tenantId, action, details = {}) {
    try {
        await db.query(
            `INSERT INTO audit_logs (id, job_id, tenant_id, action, policy_slug, ip_address)
             VALUES (?, NULL, ?, ?, 'N/A', 'CLI')`,
            [crypto.randomUUID(), tenantId, action]
        );
    } catch (e) {
        console.warn('[AUDIT-WARN] Could not write audit log:', e.message);
    }
}

async function ensureTenant(tenantId, name, plan = 'FREE') {
    const { rows } = await db.query('SELECT id FROM tenants WHERE id = ?', [tenantId]);
    if (rows.length === 0) {
        await db.query(
            `INSERT INTO tenants (id, name, plan, status) VALUES (?, ?, ?, 'ACTIVE')`,
            [tenantId, name || tenantId, plan]
        );
        console.log(`  → Tenant "${tenantId}" auto-created.`);
    }
}

// ---- Commands ----
async function cmdCreate() {
    const tenantId = flags.tenant || fatal('--tenant is required');
    const name = flags.name || 'Default Key';
    const plan = flags.plan || 'FREE';

    await ensureTenant(tenantId, tenantId, plan);

    const { raw, hash } = generateKey();
    const keyId = 'ak_' + crypto.randomBytes(8).toString('hex');

    await db.query(
        `INSERT INTO api_keys (id, tenant_id, key_hash, name, revoked) VALUES (?, ?, ?, ?, FALSE)`,
        [keyId, tenantId, hash, name]
    );

    await auditLog(tenantId, 'API_KEY_CREATED');

    ok({
        ok: true,
        tenant_id: tenantId,
        key_id: keyId,
        name: name,
        api_key: raw,
        warning: '⚠️  Store this key now. It will NOT be shown again.'
    });
}

async function cmdList() {
    const tenantId = flags.tenant || fatal('--tenant is required');

    const { rows } = await db.query(
        `SELECT id, name, revoked, last_used_at, created_at 
         FROM api_keys WHERE tenant_id = ? ORDER BY created_at DESC`,
        [tenantId]
    );

    if (rows.length === 0) {
        console.log(`\nNo API keys found for tenant "${tenantId}".`);
        return;
    }

    console.log(`\nAPI Keys for tenant: ${tenantId}\n`);
    console.log('ID'.padEnd(22), 'Name'.padEnd(22), 'Status'.padEnd(10), 'Last Used'.padEnd(22), 'Created');
    console.log('─'.repeat(95));
    rows.forEach(r => {
        const status = r.revoked ? '🔴 REVOKED' : '🟢 ACTIVE ';
        const lastUsed = r.last_used_at ? new Date(r.last_used_at).toLocaleString() : 'Never';
        const created = new Date(r.created_at).toLocaleString();
        console.log(r.id.padEnd(22), (r.name || '').padEnd(22), status.padEnd(10), lastUsed.padEnd(22), created);
    });
    console.log('');
}

async function cmdRevoke() {
    const keyId = flags.id || fatal('--id is required');

    const { rows } = await db.query('SELECT tenant_id, revoked FROM api_keys WHERE id = ?', [keyId]);
    if (rows.length === 0) fatal(`Key "${keyId}" not found.`);
    if (rows[0].revoked) fatal(`Key "${keyId}" is already revoked.`);

    await db.query('UPDATE api_keys SET revoked = TRUE WHERE id = ?', [keyId]);
    await auditLog(rows[0].tenant_id, 'API_KEY_REVOKED');

    ok({ ok: true, key_id: keyId, status: 'REVOKED' });
}

async function cmdRotate() {
    const keyId = flags.id || fatal('--id is required');

    const { rows } = await db.query('SELECT tenant_id, name, revoked FROM api_keys WHERE id = ?', [keyId]);
    if (rows.length === 0) fatal(`Key "${keyId}" not found.`);

    const { tenant_id, name } = rows[0];

    // 1. Revoke old key
    await db.query('UPDATE api_keys SET revoked = TRUE WHERE id = ?', [keyId]);

    // 2. Generate new key
    const { raw, hash } = generateKey();
    const newKeyId = 'ak_' + crypto.randomBytes(8).toString('hex');

    await db.query(
        `INSERT INTO api_keys (id, tenant_id, key_hash, name, revoked) VALUES (?, ?, ?, ?, FALSE)`,
        [newKeyId, tenant_id, hash, name + ' (rotated)']
    );

    await auditLog(tenant_id, 'API_KEY_ROTATED');

    ok({
        ok: true,
        old_key_id: keyId,
        new_key_id: newKeyId,
        tenant_id: tenant_id,
        api_key: raw,
        warning: '⚠️  Store this key now. It will NOT be shown again.'
    });
}

async function cmdTenants() {
    const { rows } = await db.query(
        `SELECT t.id, t.name, t.plan, t.status, t.created_at,
                COUNT(k.id) as key_count
         FROM tenants t
         LEFT JOIN api_keys k ON k.tenant_id = t.id AND k.revoked = FALSE
         GROUP BY t.id
         ORDER BY t.created_at DESC`,
        []
    );

    if (rows.length === 0) {
        console.log('\nNo tenants found.');
        return;
    }

    console.log(`\nTenants (${rows.length} total)\n`);
    console.log('ID'.padEnd(25), 'Name'.padEnd(22), 'Plan'.padEnd(12), 'Status'.padEnd(10), 'Active Keys', 'Created');
    console.log('─'.repeat(100));
    rows.forEach(r => {
        const statusIcon = r.status === 'ACTIVE' ? '🟢' : '🔴';
        console.log(
            r.id.padEnd(25),
            (r.name || '').padEnd(22),
            (r.plan || 'FREE').padEnd(12),
            `${statusIcon} ${r.status}`.padEnd(10),
            String(r.key_count).padStart(10),
            ' ',
            new Date(r.created_at).toLocaleString()
        );
    });
    console.log('');
}

// ---- Help ----
function showHelp() {
    console.log(`
PrintPrice API Key Manager

Commands:
  create   --tenant <id> [--name <label>] [--plan FREE|PRO|ENTERPRISE]
  list     --tenant <id>
  revoke   --id <key_id>
  rotate   --id <key_id>
  tenants

Examples:
  node scripts/api-keys.js create --tenant tenant_demo --name "Local testing"
  node scripts/api-keys.js list --tenant tenant_demo
  node scripts/api-keys.js revoke --id ak_abc123
  node scripts/api-keys.js rotate --id ak_abc123
  node scripts/api-keys.js tenants
`);
}

// ---- Main ----
async function main() {
    try {
        switch (command) {
            case 'create': await cmdCreate(); break;
            case 'list': await cmdList(); break;
            case 'revoke': await cmdRevoke(); break;
            case 'rotate': await cmdRotate(); break;
            case 'tenants': await cmdTenants(); break;
            default: showHelp();
        }
    } catch (err) {
        console.error('\n❌ Fatal error:', err.message);
        if (process.env.DEBUG) console.error(err.stack);
    } finally {
        // Allow DB pool to drain and close cleanly
        setTimeout(() => process.exit(0), 500);
    }
}

main();
