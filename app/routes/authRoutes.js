const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { generateToken } = require('../auth/generateToken');
const db = require('../services/db');
const requireAuth = require('../middleware/requireAuth');
const entitlementCache = require('../services/tenantEntitlementCache');
const { resolveCanonicalTenantContext } = require('../services/tenantResolver');

/**
 * Phase 39.1: Enrich a local user record with Control Plane governance data.
 * Returns the enriched user object; falls back to local values on CP failure.
 *
 * @param {object} user       - Local DB user row
 * @param {string} bearerToken - JWT to forward to Control Plane
 * @returns {Promise<object>}
 */
async function enrichWithGovernance(user, bearerToken) {
    try {
        const mockReq = { 
            auth: user, 
            headers: { authorization: bearerToken } 
        };
        const tenantContext = await resolveCanonicalTenantContext(mockReq);

        const grace = tenantContext.rawGovernance?.grace || {};
        const inGracePeriod = grace.active ?? tenantContext.rawGovernance?.grace_period ?? (tenantContext.commercialStatus === 'GRACE_PERIOD' || tenantContext.commercialStatus === 'GRACE');
        const graceExpired = grace.expired ?? false;
        const graceEndsAt = grace.endsAt ?? grace.ends_at ?? null;

        const modules = tenantContext.rawGovernance?.modules || {};
        const actions = tenantContext.rawGovernance?.actions || {};
        const entitlements = tenantContext.rawGovernance?.entitlements || tenantContext.rawGovernance?.features || {};
        const aiMagicFix = modules.ai_magic_fix ?? modules.aiMagicFix ?? actions.ai_magic_fix ?? actions.aiMagicFix ?? entitlements.ai_magic_fix ?? !!user.ai_magic_fix_enabled;

        const enrichedUser = {
            ...user,
            tenantId: tenantContext.canonicalTenantId,
            canonicalTenantId: tenantContext.canonicalTenantId,
            jwtTenantId: tenantContext.jwtTenantId,
            executionTenantId: tenantContext.executionTenantId,
            governanceTenantId: tenantContext.governanceTenantId,
            plan: tenantContext.planCode,
            planCode: tenantContext.planCode,
            plan_code: tenantContext.planCode,
            commercial_status: tenantContext.commercialStatus,
            access_level: tenantContext.accessLevel,
            in_grace_period: !!inGracePeriod,
            grace_expired: !!graceExpired,
            grace_ends_at: graceEndsAt,
            max_file_size_mb: tenantContext.limits.max_file_size_mb ?? null,
            maxFileSizeMb: tenantContext.limits.max_file_size_mb ?? null,
            max_job_size_mb: tenantContext.limits.max_job_size_mb ?? null,
            maxJobSizeMb: tenantContext.limits.max_job_size_mb ?? null,
            daily_jobs_limit: tenantContext.limits.daily_jobs_limit ?? null,
            dailyJobsLimit: tenantContext.limits.daily_jobs_limit ?? null,
            monthly_jobs_limit: tenantContext.limits.monthly_jobs_limit ?? null,
            monthlyJobsLimit: tenantContext.limits.monthly_jobs_limit ?? null,
            ai_magic_fix_enabled: !!aiMagicFix,
            _governance_source: tenantContext.source || 'CONTROL_PLANE',
            governance_source: tenantContext.source || 'CONTROL_PLANE'
        };

        console.log('[AUTH-ME-GOVERNANCE-RESOLVED]', {
            userId: user.id,
            email: user.email,
            jwtTenantId: tenantContext.jwtTenantId,
            canonicalTenantId: tenantContext.canonicalTenantId,
            governanceTenantId: tenantContext.governanceTenantId,
            planCode: tenantContext.planCode,
            max_file_size_mb: enrichedUser.max_file_size_mb,
            source: tenantContext.source
        });

        return enrichedUser;
    } catch (err) {
        console.warn('[AUTH][CP-ENRICH-FAIL] Governance enrichment failed, using local values:', err.message);
        return { ...user, _governance_source: 'LOCAL_FALLBACK' };
    }
}

/**
 * PrintPrice OS - Identity & Access Node
 * 1. Register (Initialize Access)
 * 2. Login (Authenticate Node)
 * 3. Session (Query Context)
 * 4. Logout (Release Node)
 */

// 1. REGISTER (Initialize Access)
router.post('/register', async (req, res) => {
    const { email, password, role, organization_name } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'INVALID_INPUT', message: 'Email and password are mandatory.' });
    }

    try {
        // Check if user exists
        const existing = await db.execute('SELECT id FROM users WHERE email = ?', [email]);
        if (existing.length > 0) {
            return res.status(409).json({ error: 'USER_EXISTS', message: 'Identity already registered in PrintPrice OS.' });
        }

        const userId = uuidv4();
        const licenseId = uuidv4();
        const passwordHash = await bcrypt.hash(password, 12);
        const userRole = role || 'AUTHOR';

        // Start Transaction
        const pool = db.pool;
        const conn = await pool.getConnection();
        await conn.beginTransaction();

        try {
            // Create User
            await conn.execute(
                'INSERT INTO users (id, email, password_hash, role, organization_name) VALUES (?, ?, ?, ?, ?)',
                [userId, email, passwordHash, userRole, organization_name || null]
            );

            // Create Default FREE License
            // FREE Plan: 50MB max, 5 jobs daily, no AI magic fix
            await conn.execute(
                'INSERT INTO licenses (id, user_id, plan, max_file_size_mb, daily_jobs_limit) VALUES (?, ?, ?, ?, ?)',
                [licenseId, userId, 'FREE', 50, 5]
            );

            await conn.commit();
            console.log(`[AUTH-REGISTER-OK] New ${userRole} node initialized: ${email}`);

            const token = generateToken({ userId, email, role: userRole, appRole: userRole, tenantId: userId, printhouseId: null, plan: 'FREE' });
            res.status(201).json({ 
                status: 'OK', 
                message: 'Access initialized.', 
                token,
                user: { id: userId, email, role: userRole, plan: 'FREE' }
            });
        } catch (err) {
            await conn.rollback();
            throw err;
        } finally {
            conn.release();
        }
    } catch (err) {
        console.error('[AUTH-REGISTER-ERROR]', err);
        res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to initialize access.' });
    }
});

// 2. LOGIN (Authenticate Node)
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'INVALID_INPUT', message: 'Credentials mandatory.' });
    }

    try {
        const users = await db.execute(`
            SELECT u.*, u.printhouse_id, u.tenant_id, l.plan, l.ai_magic_fix_enabled
            FROM users u
            LEFT JOIN licenses l ON u.id = l.user_id
            WHERE u.email = ?
        `, [email]);

        if (users.length === 0) {
            return res.status(401).json({ error: 'AUTH_FAILED', message: 'Identifier not found.' });
        }

        const user = users[0];
        const isValid = await bcrypt.compare(password, user.password_hash);

        if (!isValid) {
            return res.status(401).json({ error: 'AUTH_FAILED', message: 'Access denied.' });
        }

        // Update last login
        await db.execute('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);

        const token = generateToken({
            userId: user.id,
            email: user.email,
            role: user.role,
            appRole: user.role,
            tenantId: user.tenant_id || user.id,
            printhouseId: user.printhouse_id || null,
            plan: user.plan || 'FREE'
        });

        const refreshToken = generateToken({
            userId: user.id,
            email: user.email,
            role: user.role,
            appRole: user.role,
            tenantId: user.tenant_id || user.id,
            printhouseId: user.printhouse_id || null,
            plan: user.plan || 'FREE'
        }, '7d');

        console.log(`[AUTH-LOGIN-OK] Node authenticated: ${email} (${user.role})`);

        res.json({
            token,
            refreshToken,
            user: {
                id: user.id,
                email: user.email,
                role: user.role,
                plan: user.plan,
                tenantId: user.tenant_id || user.id,
                printhouseId: user.printhouse_id || null,
                ai_magic_fix_enabled: !!user.ai_magic_fix_enabled,
                daily_jobs_limit: user.daily_jobs_limit || 0,
                jobs_used_today: user.jobs_used_today || 0
            }
        });
    } catch (err) {
        console.error('[AUTH-LOGIN-ERROR]', err);
        res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Identity check failed.' });
    }
});

/**
 * 3. SESSION & IDENTITY (Shared Handler)
 * Returns the direct user JSON object with license context.
 */
async function handleSession(req, res) {
    try {
        const userId = req.auth.userId;
        const users = await db.execute(`
            SELECT u.id, u.email, u.role, u.organization_name, u.tenant_id,
                   l.plan, l.daily_jobs_limit, l.jobs_used_today, l.ai_magic_fix_enabled, l.max_file_size_mb
            FROM users u
            LEFT JOIN licenses l ON u.id = l.user_id
            WHERE u.id = ?
        `, [userId]);

        if (users.length === 0) {
            return res.status(404).json({ error: 'NOT_FOUND', message: 'User context lost.' });
        }

        const rawUser = {
            ...users[0],
            ai_magic_fix_enabled: !!users[0].ai_magic_fix_enabled
        };

        // Phase 39.1: Enrich with Control Plane governance
        const bearerToken = req.headers['authorization'];
        const enriched = await enrichWithGovernance(rawUser, bearerToken);

        // Return direct user object (No { user: ... } wrapper) — backwards compatible
        res.json(enriched);
    } catch (err) {
        console.error('[AUTH-SESSION-ERROR]', err);
        res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to retrieve context.' });
    }
}

router.get('/session', requireAuth, handleSession);
router.get('/me', requireAuth, handleSession);

// 4. REFRESH (Rotate Identity)
router.post('/refresh', async (req, res) => {
    const { refreshToken } = req.body;
    if (!refreshToken) {
        return res.status(400).json({ error: 'MISSING_TOKEN', message: 'Refresh token mandatory.' });
    }

    try {
        const { verifyJwt } = require('../auth/verifyJwt');
        const decoded = verifyJwt(refreshToken);
        const userId = decoded.userId || decoded.sub;

        // Phase 2 Hardening: Verify identity still exists in high-trust node registry
        const users = await db.execute(`
            SELECT u.id, u.email, u.role, u.printhouse_id, u.tenant_id, l.plan
            FROM users u
            LEFT JOIN licenses l ON u.id = l.user_id
            WHERE u.id = ?
        `, [userId]);
        if (users.length === 0) {
            console.error(`[AUTH-REFRESH-DENIED] Refresh attempted for non-existent user: ${userId}`);
            return res.status(401).json({ error: 'INVALID_SESSION', message: 'Identity context lost.' });
        }

        const user = users[0];
        const newToken = generateToken({
            userId: user.id,
            email: user.email,
            role: user.role,
            appRole: user.role,
            tenantId: user.tenant_id || user.id,
            printhouseId: user.printhouse_id || null,
            plan: user.plan || 'FREE'
        }, '24h');

        /**
         * SECURITY NOTE: REFRESH TOKEN ROTATION
         * Currently, the refresh token itself is not rotated. 
         * In a future hardening phase, a new refreshToken should be generated 
         * and the old one revoked (Refresh Token Rotation pattern).
         */
        res.json({ token: newToken });
    } catch (err) {
        console.error('[AUTH-REFRESH-ERROR]', err.message);
        res.status(401).json({ error: 'INVALID_REFRESH_TOKEN', message: 'Session could not be recovered.' });
    }
});

// 5. LOGOUT (Release Node)
router.post('/logout', (req, res) => {
    // Client should clear the token
    res.json({ status: 'OK', message: 'Node released.' });
});

module.exports = router;
