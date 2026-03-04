const { spawn } = require('child_process');

/**
 * Executes an external process safely, capturing output and handling timeouts/errors.
 * Prevent server crashes by wrapping everything in a promise that always resolves or 
 * rejects with a structured object.
 */
function spawnSafe(command, args, options = {}) {
    const timeout = options.timeout || 120000; // Default 2 minutes
    const maxBuffer = options.maxBuffer || 1024 * 1024 * 50; // 50MB

    return new Promise((resolve, reject) => {
        let stdout = '';
        let stderr = '';
        let killed = false;
        let stdoutSize = 0;
        let stderrSize = 0;

        const child = spawn(command, args, {
            ...options,
            stdio: ['ignore', 'pipe', 'pipe'], // Ignore stdin, pipe out/err
            shell: false
        });

        const timer = setTimeout(() => {
            killed = true;
            child.kill('SIGKILL');
            reject({
                error: 'TIMEOUT',
                command,
                args,
                message: `Process exceeded timeout of ${timeout}ms`,
                stdout: stdout.slice(-1000), // Return last 1000 chars for context
                stderr: stderr.slice(-1000)
            });
        }, timeout);

        child.stdout.on('data', (data) => {
            stdoutSize += data.length;
            if (stdoutSize < maxBuffer) {
                stdout += data.toString();
            }
        });

        child.stderr.on('data', (data) => {
            stderrSize += data.length;
            if (stderrSize < maxBuffer) {
                stderr += data.toString();
            }
        });

        child.on('error', (err) => {
            clearTimeout(timer);
            if (killed) return;
            reject({
                error: err.code || 'SPAWN_ERROR',
                command,
                args,
                message: err.message,
                stdout,
                stderr
            });
        });

        child.on('close', (code) => {
            clearTimeout(timer);
            if (killed) return;

            if (code === 0) {
                resolve({
                    code,
                    command,
                    args,
                    stdout,
                    stderr
                });
            } else {
                reject({
                    error: 'NON_ZERO_EXIT',
                    code,
                    command,
                    args,
                    stdout,
                    stderr,
                    message: `Process exited with code ${code}`
                });
            }
        });
    });
}

module.exports = {
    spawnSafe
};
