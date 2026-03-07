/**
 * boot-test.js (Final Diagnostic)
 * Use absolute paths to smoke out why server.js crashes on Require.
 */
const path = require('path');
const fs = require('fs');
const os = require('os');

const APP_ROOT = process.cwd();
console.log('');
console.log('╔══════════════════════════════════════════╗');
console.log('║        DIAGNOSTIC BOOT TEST             ║');
console.log('╚══════════════════════════════════════════╝');
console.log(`[BOOT-TEST] Time:  ${new Date().toISOString()}`);
console.log(`[BOOT-TEST] CWD:   ${APP_ROOT}`);
console.log(`[BOOT-TEST] User:  ${os.userInfo().username} (UID: ${os.userInfo().uid})`);
console.log(`[BOOT-TEST] Node:  ${process.version}`);
console.log('---');

const modules = [
    { name: 'dotenv', type: 'pkg' },
    { name: 'express', type: 'pkg' },
    { name: 'ws', type: 'pkg' },
    { name: 'pino-http', type: 'pkg' },
    { name: 'mysql2', type: 'pkg' },
    { name: 'bullmq', type: 'pkg' },
    { name: 'sharp', type: 'optional' }, // Sharp is common for crashes
    { name: './services/db', type: 'local' },
    { name: './services/dependencyChecker', type: 'local' },
    { name: './routes/proxy', type: 'local' },
    { name: './routes/pdf', type: 'local' },
    { name: './server.js', type: 'entry' }
];

let failedCount = 0;

for (const mod of modules) {
    try {
        const target = mod.type === 'local' || mod.type === 'entry'
            ? path.join(APP_ROOT, mod.name)
            : mod.name;

        process.stdout.write(`[BOOT-TEST] Checking ${mod.name}... `);

        // For local files, check existence first
        if (mod.type === 'local' || mod.type === 'entry') {
            if (!fs.existsSync(target) && !fs.existsSync(target + '.js')) {
                console.log('MISSING FILE');
                failedCount++;
                continue;
            }
        }

        require(target);
        console.log('OK ✅');
    } catch (err) {
        console.log('FAILED ❌');
        console.error(`   Error in ${mod.name}:`, err.message);
        if (mod.type !== 'optional') failedCount++;
    }
}

console.log('---');
if (failedCount === 0) {
    console.log('[BOOT-TEST] ALL CRITICAL MODULES LOADED SUCCESSFULLY. No obvious requirement crash.');
} else {
    console.log(`[BOOT-TEST] ${failedCount} CRITICAL MODULE(S) FAILED TO LOAD.`);
}
console.log('---');
