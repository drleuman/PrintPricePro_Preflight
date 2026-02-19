const fs = require('fs');
const path = require('path');

// Helper to perform safe removal (Node versions may support fs.rm)
function safeRm(target, cb) {
    if (fs.rm) {
        fs.rm(target, { recursive: true, force: true }, cb);
    } else {
        fs.rmdir(target, { recursive: true }, cb);
    }
}

/**
 * Starts a cleanup interval to remove old files from the upload directory.
 * @param {string} dirPath - Directory to clean.
 * @param {number} maxAgeMs - Max age of files in milliseconds (default 1 hour).
 * @param {number} intervalMs - Check interval in milliseconds (default 15 mins).
 */
function startCleanupTask(dirPath, maxAgeMs = Number(process.env.PPP_CLEANUP_MAX_AGE_MS) || 60 * 60 * 1000, intervalMs = Number(process.env.PPP_CLEANUP_INTERVAL_MS) || 15 * 60 * 1000) {
    if (!dirPath || typeof dirPath !== 'string') {
        console.warn('startCleanupTask: no dirPath provided - skipping cleanup task');
        return;
    }

    const resolvedDir = path.resolve(dirPath);

    // Basic safety: ensure resolvedDir is an existing directory or try to create it
    try {
        if (!fs.existsSync(resolvedDir)) {
            fs.mkdirSync(resolvedDir, { recursive: true });
            console.log('Created uploadDir for cleanup:', resolvedDir);
        }
    } catch (e) {
        console.error('startCleanupTask: cannot ensure upload directory exists:', e.message);
        return;
    }

    // Initial check
    cleanDir(resolvedDir, maxAgeMs);

    // Interval check
    const interval = setInterval(() => {
        cleanDir(resolvedDir, maxAgeMs);
    }, Math.max(60 * 1000, intervalMs)); // at least 1 minute

    // Allow process to exit even if this interval is running
    interval.unref();
}

function cleanDir(dirPath, maxAgeMs) {
    fs.readdir(dirPath, (err, files) => {
        if (err) return; // Directory might not exist yet or permission denied

        const now = Date.now();
        for (const file of files) {
            const filePath = path.join(dirPath, file);

            // Resolve and ensure filePath is within dirPath (prevent symlink escapes)
            let resolved;
            try {
                resolved = fs.realpathSync(filePath);
            } catch (e) {
                // If realpath fails, skip this entry
                return;
            }
            if (!resolved.startsWith(path.resolve(dirPath))) {
                console.warn('Skipping cleanup of path outside uploadDir:', resolved);
                continue;
            }

            fs.lstat(filePath, (err, stats) => {
                if (err) return;
                // Skip symlinks to avoid accidental deletes outside the dir
                if (stats.isSymbolicLink()) return;

                if (now - stats.mtimeMs > maxAgeMs) {
                    if (stats.isDirectory()) {
                        safeRm(filePath, (err) => {
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
