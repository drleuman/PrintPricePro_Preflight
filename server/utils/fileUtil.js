const fs = require('fs');
const path = require('path');

/**
 * Safely moves a file from src to dest.
 * Handles the 'EXDEV' error when moving between different file systems.
 */
async function safeMove(src, dest) {
    try {
        await fs.promises.rename(src, dest);
    } catch (err) {
        if (err.code === 'EXDEV') {
            // Fallback: Copy and then delete the original
            await fs.promises.copyFile(src, dest);
            await fs.promises.unlink(src);
        } else {
            throw err;
        }
    }
}

/**
 * Synchronous version (use sparingly)
 */
function safeMoveSync(src, dest) {
    try {
        fs.renameSync(src, dest);
    } catch (err) {
        if (err.code === 'EXDEV') {
            fs.copyFileSync(src, dest);
            fs.unlinkSync(src);
        } else {
            throw err;
        }
    }
}

module.exports = {
    safeMove,
    safeMoveSync
};
