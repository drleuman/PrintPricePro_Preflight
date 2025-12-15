const fs = require('fs');
const path = require('path');

/**
 * Starts a cleanup interval to remove old files from the upload directory.
 * @param {string} dirPath - Directory to clean.
 * @param {number} maxAgeMs - Max age of files in milliseconds (default 1 hour).
 * @param {number} intervalMs - Check interval in milliseconds (default 15 mins).
 */
function startCleanupTask(dirPath, maxAgeMs = 60 * 60 * 1000, intervalMs = 15 * 60 * 1000) {
    // Initial check
    cleanDir(dirPath, maxAgeMs);

    // Interval check
    const interval = setInterval(() => {
        cleanDir(dirPath, maxAgeMs);
    }, intervalMs);

    // Allow process to exit even if this interval is running
    interval.unref();
}

function cleanDir(dirPath, maxAgeMs) {
    fs.readdir(dirPath, (err, files) => {
        if (err) return; // Directory might not exist yet

        const now = Date.now();
        for (const file of files) {
            const filePath = path.join(dirPath, file);
            fs.stat(filePath, (err, stats) => {
                if (err) return;
                if (now - stats.mtimeMs > maxAgeMs) {
                    if (stats.isDirectory()) {
                        // Node 12 compatible recursive delete
                        fs.rmdir(filePath, { recursive: true }, (err) => {
                            if (err) console.error(`Failed to cleanup dir ${filePath}:`, err.message);
                            else console.log(`Cleaned up old dir: ${file}`);
                        });
                    } else {
                        fs.unlink(filePath, (err) => {
                            if (err) console.error(`Failed to cleanup file ${filePath}:`, err.message);
                            else console.log(`Cleaned up old file: ${file}`);
                        });
                    }
                }
            });
        }
    });
}

module.exports = { startCleanupTask };
