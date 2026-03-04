const { spawnSync } = require('child_process');
const os = require('os');

const IS_WINDOWS = os.platform() === 'win32';

/**
 * Checks if a specific command executes successfully and returns part of its output.
 */
function checkCommand(commandName, args = ['--version']) {
    try {
        const result = spawnSync(commandName, args, { encoding: 'utf8', timeout: 5000 });
        if (result.error) {
            if (result.error.code === 'ENOENT') {
                return { installed: false, command: commandName, error: 'ENOENT - Executable not found' };
            }
            return { installed: false, command: commandName, error: result.error.message };
        }
        // Return the first line of stdout or stderr as a version/status string
        let output = (result.stdout || result.stderr || '').split('\n')[0].trim();
        return { installed: true, command: commandName, output };
    } catch (err) {
        return { installed: false, command: commandName, error: err.message };
    }
}

/**
 * Iterates over a list of alternative command names (e.g., gs, gswin64c) to find the first installed one.
 */
function findWorkingCommand(commands, args = ['--version']) {
    for (const cmd of commands) {
        const res = checkCommand(cmd, args);
        if (res.installed) {
            return res;
        }
    }
    return { installed: false, attempted: commands, error: 'None of the provided commands were found' };
}

/**
 * Main orchestrator to check all required and optional external dependencies.
 */
function checkAllDependencies() {
    const gsCommands = IS_WINDOWS ? ['gswin64c', 'gswin32c', 'gs'] : ['gs', 'gswin64c'];
    if (process.env.GS_PATH) {
        gsCommands.unshift(process.env.GS_PATH);
    }

    const deps = {
        ghostscript: findWorkingCommand(gsCommands, ['--version']),
        poppler_pdffonts: findWorkingCommand(['pdffonts'], ['-v']),
        poppler_pdfinfo: findWorkingCommand(['pdfinfo'], ['-v']),
        poppler_pdfimages: findWorkingCommand(['pdfimages'], ['-v']),
        qpdf: findWorkingCommand(['qpdf'], ['--version'])
    };

    // Ghostscript is an absolute hard requirement for PrintPrice Preflight V2 backend.
    // Poppler and qpdf are currently flagged as optional/graceful degradation if missing, 
    // though strongly recommended for the deterministic worker.
    const ok = deps.ghostscript.installed;

    return { ok, deps };
}

module.exports = {
    checkCommand,
    findWorkingCommand,
    checkAllDependencies
};
