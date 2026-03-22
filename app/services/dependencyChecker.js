'use strict';

/**
 * services/dependencyChecker.js
 * 
 * Verifies that all required services and environment variables are present.
 * Phase 18.C: Lean version for Decoupled Product BFF.
 */

const fs = require('fs');
const path = require('path');

function checkAllDependencies() {
    const deps = {
        env: { ok: true, missing: [] },
        filesystem: { ok: true, missing: [] },
        services: { ok: true, status: {} }
    };

    // 1. Check Required Environment Variables
    const requiredEnv = [
        'DATABASE_URL',
        'PPOS_SERVICE_URL',
        'JWT_SECRET',
        'ADMIN_API_KEY'
    ];

    requiredEnv.forEach(key => {
        if (!process.env[key] || process.env[key].includes('placeholder') || process.env[key].includes('your_')) {
            deps.env.ok = false;
            deps.env.missing.push(key);
        }
    });

    /**
     * System Binaries Check (Disabled in Lean BFF)
     * PDF Processing is delegated to the PPOS Preflight Service.
     */
    /*
    const gsCmd = process.env.GS_PATH || (isWin ? 'gswin64c' : 'gs');
    try {
        const gsTest = spawnSync(gsCmd, ['--version']);
        if (gsTest.status !== 0) throw new Error('GS_NOT_FOUND');
    } catch (e) {
        deps.services.ok = false;
        deps.services.status.ghostscript = 'MISSING';
    }
    */

    // 3. Check Filesystem (Relativized)
    const requiredDirs = [
        'app/uploads-v2-temp', 
        'profiles'
    ];

    requiredDirs.forEach(dir => {
        const fullPath = path.resolve(process.cwd(), dir);
        if (!fs.existsSync(fullPath)) {
            deps.filesystem.ok = false;
            deps.filesystem.missing.push(dir);
        }
    });

    const ok = deps.env.ok && deps.filesystem.ok && deps.services.ok;

    return {
        ok,
        deps
    };
}

module.exports = {
    checkAllDependencies
};






















