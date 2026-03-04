const { runGs, resolveGsCmd } = require('./ghostscript');
const path = require('path');
const fs = require('fs');

const GS_CMD = resolveGsCmd();

class ColorService {
    /**
     * Probes ink coverage per page using Ghostscript's inkcov device.
     * Fastest way to detect if a page is grayscale or CMYK.
     */
    async getInkCoverage(filePath) {
        try {
            const args = [
                '-dNOPAUSE', '-dBATCH', '-dQUIET',
                '-sDEVICE=inkcov',
                filePath
            ];

            const { stdout } = await runGs(args);
            const lines = stdout.split('\n');
            const coverage = [];

            // Example line: 0.00000  0.00000  0.00000  0.05243 CMYK OK
            lines.forEach(line => {
                const match = line.match(/([\d\.]+)\s+([\d\.]+)\s+([\d\.]+)\s+([\d\.]+)\s+CMYK/);
                if (match) {
                    coverage.push({
                        c: parseFloat(match[1]),
                        m: parseFloat(match[2]),
                        y: parseFloat(match[3]),
                        k: parseFloat(match[4]),
                        isColor: parseFloat(match[1]) > 0 || parseFloat(match[2]) > 0 || parseFloat(match[3]) > 0
                    });
                }
            });

            return coverage;
        } catch (err) {
            console.error('[COLOR-SERVICE] inkcov failed:', err.message);
            return [];
        }
    }

    /**
     * Probes separations using Ghostscript's tiffsep device.
     * Robust way to detect Spot Colors (Pantone, etc.) and DeviceN.
     */
    async getSeparations(filePath, tmpDir) {
        try {
            const outputBase = path.join(tmpDir, 'sep_probe');
            const args = [
                '-dNOPAUSE', '-dBATCH', '-dQUIET',
                '-sDEVICE=tiffsep',
                '-dFirstPage=1', '-dLastPage=1', // Probe only first page for performance in v1
                `-sOutputFile=${outputBase}`,
                filePath
            ];

            // tiffsep outputs to stderr a list of the spot colors it found
            const { stderr } = await runGs(args);

            // Clean up the TIFF files tiffsep creates (we only want the separation list)
            try {
                const files = fs.readdirSync(tmpDir);
                files.forEach(f => {
                    if (f.startsWith('sep_probe') && f.endsWith('.tif')) {
                        fs.unlinkSync(path.join(tmpDir, f));
                    }
                });
            } catch (cleanupErr) {
                console.warn('[COLOR-SERVICE] Cleanup failed:', cleanupErr.message);
            }

            const spotColors = [];
            const lines = stderr.split('\n');
            lines.forEach(line => {
                // Example: %%SeparationName: "PANTONE 185 C"
                const match = line.match(/%%SeparationName:\s+"([^"]+)"/);
                if (match) {
                    const name = match[1];
                    const stdColors = ['Cyan', 'Magenta', 'Yellow', 'Black'];
                    if (!stdColors.includes(name)) {
                        spotColors.push(name);
                    }
                }
            });

            return {
                spotColors,
                hasSpots: spotColors.length > 0
            };
        } catch (err) {
            console.error('[COLOR-SERVICE] tiffsep failed:', err.message);
            return { spotColors: [], hasSpots: false, error: err.message };
        }
    }
}

module.exports = new ColorService();
