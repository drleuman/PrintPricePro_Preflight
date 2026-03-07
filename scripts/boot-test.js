/**
 * boot-test.js
 * Tries to require all major modules to identify if any are crashing the process.
 */
console.log('[BOOT-TEST] Starting module resolution check...');

const modules = [
    'dotenv',
    'express',
    'path',
    'fs',
    'ws',
    'cors',
    'helmet',
    'compression',
    'pino-http',
    'express-rate-limit',
    './routes/proxy',
    './routes/pdf',
    './routes/preflightV2',
    './routes/apiV2',
    './routes/batchV2',
    './routes/analyticsV2',
    './routes/admin',
    './routes/adminControl',
    './services/cleanup',
    './services/dependencyChecker',
    './services/dbSchema',
    './services/db'
];

for (const mod of modules) {
    try {
        console.log(`[BOOT-TEST] Attempting to require: ${mod}`);
        require(mod);
        console.log(`[BOOT-TEST] SUCCESS: ${mod}`);
    } catch (err) {
        console.error(`[BOOT-TEST] FAILED: ${mod}`);
        console.error(err);
        // Continue anyway to see if others fail
    }
}

console.log('[BOOT-TEST] Check complete.');
