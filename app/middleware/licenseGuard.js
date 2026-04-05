const db = require('../services/db');

/**
 * PrintPrice OS - License & Resource Governance Middleware
 * Enforces the high-value constraints of the Preflight motor:
 * 1. Validates user existence and status.
 * 2. Enforces daily job quotas (Free vs Pro vs Enterprise).
 * 3. Validates file size against deterministic limits.
 * 4. Checks feature authorization (e.g. AI Magic Fix).
 */
module.exports = (options = {}) => {
    return async (req, res, next) => {
        const { action = 'job', increment = false, checkAiFix = false } = options;
        const userId = req.auth?.userId;
        const requestId = req.headers['x-request-id'] || 'system';

        if (!userId) {
            return res.status(401).json({ 
                error: 'AUTH_REQUIRED', 
                message: 'Identity context required for governance.',
                traceId: requestId,
                v2: true
            });
        }

        try {
            // Fetch User + License in a single forensic query
            const users = await db.execute(`
                SELECT u.status, u.role, l.* 
                FROM users u
                LEFT JOIN licenses l ON u.id = l.user_id
                WHERE u.id = ?
            `, [userId]);

            if (users.length === 0) {
                return res.status(404).json({ 
                    error: 'USER_NOT_FOUND', 
                    message: 'Node identity not recognized.',
                    traceId: requestId,
                    v2: true
                });
            }

            const user = users[0];

            if (user.status !== 'ACTIVE') {
                return res.status(403).json({ 
                    error: 'NODE_SUSPENDED', 
                    message: 'Access to Preflight node is currently restricted.',
                    traceId: requestId,
                    v2: true
                });
            }

            // 1. Check Job Quota
            if (user.jobs_used_today >= user.daily_jobs_limit && user.plan !== 'ENTERPRISE') {
                console.warn(`[GOVERNANCE-BLOCKED][${requestId}] User ${userId} exceeded daily quota (${user.jobs_used_today}/${user.daily_jobs_limit})`);
                return res.status(429).json({ 
                    error: 'LICENSE_LIMIT_EXCEEDED', 
                    code: 'DAILY_QUOTA_REACHED',
                    message: `Daily limit of ${user.daily_jobs_limit} jobs reached. Upgrade to PRO for higher volume.`,
                    traceId: requestId,
                    v2: true
                });
            }

            // 2. Check File Size (if file is present)
            if (req.file) {
                const fileSizeMb = req.file.size / (1024 * 1024);
                if (fileSizeMb > user.max_file_size_mb) {
                    return res.status(413).json({ 
                        error: 'LICENSE_LIMIT_EXCEEDED', 
                        code: 'FILE_TOO_LARGE',
                        message: `Plan ${user.plan} supports up to ${user.max_file_size_mb}MB. Current: ${fileSizeMb.toFixed(2)}MB.`,
                        traceId: requestId,
                        v2: true
                    });
                }
            }

            // 3. Check AI Magic Fix Authorization
            if (checkAiFix && req.body.repair === 'true' && !user.ai_magic_fix_enabled && user.plan === 'FREE') {
                return res.status(403).json({ 
                    error: 'FEATURE_NOT_ALLOWED', 
                    code: 'AI_FIX_RESTRICTED',
                    message: 'AI Magic Fix is a PRO feature. Current plan: FREE.',
                    traceId: requestId,
                    v2: true
                });
            }

            // 4. Increment usage if requested (Forensic progression)
            if (increment) {
                await db.execute('UPDATE licenses SET jobs_used_today = jobs_used_today + 1 WHERE id = ?', [user.id]);
                
                // Audit Log (Traceability)
                await db.execute(
                    'INSERT INTO usage_logs (user_id, action, metadata) VALUES (?, ?, ?)',
                    [userId, `PREFLIGHT_${action.toUpperCase()}`, JSON.stringify({ plan: user.plan, status: 'SUCCESS' })]
                );
            }

            // Attach detailed context for downstream consumers
            req.license = user;
            next();
        } catch (err) {
            console.error(`[GOVERNANCE-ERROR][${requestId}]`, err);
            res.status(500).json({ 
                error: 'GOVERNANCE_FAILURE', 
                message: 'Resource check failed in license node.',
                traceId: requestId,
                v2: true
            });
        }
    };
};
