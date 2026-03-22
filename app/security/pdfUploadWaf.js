const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { spawn } = require("child_process");
const { safeMoveSync } = require("../utils-server/fileUtil");

function sha256File(fp) {
    return new Promise((resolve, reject) => {
        const stats = fs.statSync(fp);
        const hash = crypto.createHash('sha256');

        // Optimization: For files > 10MB, use a "fast hash" of first and last chunks 
        // to prevent 502 timeouts during WAF check. The full hash is calculated 
        // later by the background worker if needed.
        if (stats.size > 10 * 1024 * 1024) {
            try {
                const fd = fs.openSync(fp, 'r');
                const headBuf = Buffer.alloc(5 * 1024 * 1024);
                const tailBuf = Buffer.alloc(5 * 1024 * 1024);

                fs.readSync(fd, headBuf, 0, headBuf.length, 0);
                fs.readSync(fd, tailBuf, 0, tailBuf.length, Math.max(0, stats.size - tailBuf.length));
                fs.closeSync(fd);

                hash.update(headBuf);
                hash.update(tailBuf);
                return resolve(`fast-${hash.digest('hex')}`);
            } catch (e) {
                console.warn('[WAF] Fast hash failed, falling back to full stream', e.message);
            }
        }

        const stream = fs.createReadStream(fp);
        stream.on('data', (data) => hash.update(data));
        stream.on('end', () => resolve(hash.digest('hex')));
        stream.on('error', (err) => reject(err));
    });
}

function readHead(fp, n = 4096) {
    try {
        const fd = fs.openSync(fp, "r");
        const buf = Buffer.alloc(n);
        const bytes = fs.readSync(fd, buf, 0, n, 0);
        fs.closeSync(fd);
        return buf.slice(0, bytes);
    } catch (e) {
        return Buffer.alloc(0);
    }
}

function fileSize(fp) {
    try {
        return fs.statSync(fp).size;
    } catch (e) {
        return 0;
    }
}

function safeBasename(name) {
    return String(name || "upload.pdf")
        .replace(/[^a-zA-Z0-9._-]/g, "_")
        .slice(0, 120);
}

function runCmd(bin, args, timeoutMs = 8000) {
    return new Promise((resolve) => {
        const p = spawn(bin, args, { shell: false });
        let out = "";
        let err = "";
        const t = setTimeout(() => {
            try { p.kill("SIGKILL"); } catch { }
            resolve({ code: 124, out, err: err + "\nTIMEOUT" });
        }, timeoutMs);

        p.stdout.on("data", (d) => (out += d.toString()));
        p.stderr.on("data", (d) => (err += d.toString()));
        p.on("close", (code) => {
            clearTimeout(t);
            resolve({ code: code ?? 1, out, err });
        });
    });
}

const binCache = {};
async function hasBin(bin) {
    if (binCache[bin] !== undefined) return binCache[bin];
    const isWin = process.platform === 'win32';
    const result = await new Promise((resolve) => {
        if (isWin) {
            const check = spawn('cmd', ['/c', `where ${bin}`], { shell: false });
            check.on("close", (code) => resolve(code === 0));
        } else {
            const check = spawn('which', [bin], { shell: false });
            check.on("close", (code) => resolve(code === 0));
        }
    });
    binCache[bin] = result;
    return result;
}

// Heuristic token scan (reduced to 2MB for speed, still effective for most exploits)
function scanTokens(fp, maxBytes = 2 * 1024 * 1024) {
    const size = fileSize(fp);
    const cap = Math.min(size, maxBytes);
    const fd = fs.openSync(fp, "r");
    const buf = Buffer.alloc(cap);
    fs.readSync(fd, buf, 0, cap, 0);
    fs.closeSync(fd);

    const tokens = [
        "/JavaScript",
        "/JS",
        "/OpenAction",
        "/AA",
        "/Launch",
        "/EmbeddedFile",
        "/RichMedia",
        "/XFA",
        "/AcroForm",
        "/URI",
        "/GoToR",
        "/SubmitForm",
    ];

    const found = [];
    const text = buf.toString("latin1");
    for (const t of tokens) {
        if (text.includes(t)) found.push(t);
    }

    const urlFound = /https?:\/\/[^\s<>()"']{8,}/i.test(text);
    const objCount = (text.match(/\b\d+\s+\d+\s+obj\b/g) || []).length;
    const streamCount = (text.match(/\bstream\b/g) || []).length;

    return {
        foundTokens: found,
        urlFound,
        objCount,
        streamCount,
        scannedBytes: cap,
    };
}

/**
 * Main WAF decision
 */
async function pdfUploadWafCheck({
    filePath,
    originalName,
    config,
}) {
    const cfg = {
        maxBytes: Number(process.env.PDF_MAX_BYTES || 200 * 1024 * 1024),
        maxPages: Number(process.env.PDF_MAX_PAGES || 1200),
        maxObjects: Number(process.env.PDF_MAX_OBJECTS || 20000),
        maxStreams: Number(process.env.PDF_MAX_STREAMS || 20000),
        rejectTokens: (process.env.PDF_REJECT_TOKENS ||
            "/JavaScript").split(",").map(s => s.trim()).filter(Boolean),
        quarantineDir: process.env.PDF_QUARANTINE_DIR || path.join(process.cwd(), "uploads-quarantine"),
        ...config,
    };

    fs.mkdirSync(cfg.quarantineDir, { recursive: true });

    const size = fileSize(filePath);
    const base = safeBasename(originalName);
    const hash = await sha256File(filePath);

    // 1) Size gate
    if (size > cfg.maxBytes) {
        return {
            ok: false,
            severity: "HIGH",
            reason: "FILE_TOO_LARGE",
            detail: `Size ${size} > maxBytes ${cfg.maxBytes}`,
            sha256: hash,
            safeName: base,
            size,
        };
    }

    // 2) Magic bytes gate
    const head = readHead(filePath, 8).toString("utf8");
    if (!head.startsWith("%PDF-")) {
        return {
            ok: false,
            severity: "HIGH",
            reason: "NOT_A_PDF",
            detail: `Missing %PDF- header`,
            sha256: hash,
            safeName: base,
            size,
        };
    }

    // 3) Token scan (fast heuristic)
    const tok = scanTokens(filePath);
    const rejectHit = tok.foundTokens.filter(t => cfg.rejectTokens.includes(t));
    if (rejectHit.length) {
        return {
            ok: false,
            severity: "HIGH",
            reason: "DANGEROUS_PDF_TOKENS",
            detail: `Found tokens: ${rejectHit.join(", ")}`,
            sha256: hash,
            safeName: base,
            size,
            meta: tok,
        };
    }

    // 4) PDF bomb heuristics (objects/streams)
    if (tok.objCount > cfg.maxObjects || tok.streamCount > cfg.maxStreams) {
        return {
            ok: false,
            severity: "HIGH",
            reason: "PDF_COMPLEXITY_TOO_HIGH",
            detail: `objCount=${tok.objCount} (max ${cfg.maxObjects}), streamCount=${tok.streamCount} (max ${cfg.maxStreams})`,
            sha256: hash,
            safeName: base,
            size,
            meta: tok,
        };
    }

    // 5) Strong checks if tools exist: pdfinfo + qpdf
    // Optimization: Skip heavy checks if fastMode is requested (e.g. for Stage 2 handoffs)
    if (cfg.fastMode) {
        return {
            ok: true,
            severity: "LOW",
            sha256: hash,
            safeName: base,
            size,
            meta: { ...tok, fastMode: true },
        };
    }

    const canPdfInfo = await hasBin("pdfinfo");
    const canQpdf = await hasBin("qpdf");

    let pages = null;
    if (canPdfInfo) {
        const r = await runCmd("pdfinfo", [filePath], 8000);
        if (r.code === 0) {
            const m = r.out.match(/Pages:\s+(\d+)/i);
            if (m) pages = Number(m[1]);
            if (pages !== null && pages > cfg.maxPages) {
                return {
                    ok: false,
                    severity: "HIGH",
                    reason: "TOO_MANY_PAGES",
                    detail: `Pages ${pages} > maxPages ${cfg.maxPages}`,
                    sha256: hash,
                    safeName: base,
                    size,
                    meta: { pages },
                };
            }
        }
    }

    if (canQpdf) {
        const r = await runCmd("qpdf", ["--check", filePath], 8000);
        // qpdf returns non-zero on structural issues. 
        // In production, we log this but do NOT block (ok: true) to avoid 415 on minor warnings.
        if (r.code !== 0) {
            return {
                ok: true,
                severity: "MEDIUM",
                reason: "QPDF_STRUCTURAL_WARNINGS",
                detail: (r.err || r.out || "").slice(0, 4000),
                sha256: hash,
                safeName: base,
                size,
                meta: { pages, qpdf_code: r.code },
                warning: true
            };
        }
    }

    // OK
    return {
        ok: true,
        severity: "LOW",
        sha256: hash,
        safeName: base,
        size,
        meta: { pages, ...tok, tools: { pdfinfo: canPdfInfo, qpdf: canQpdf } },
    };
}

function quarantineFile(filePath, quarantineDir, safeName, sha256) {
    const dst = path.join(quarantineDir, `${Date.now()}_${sha256}_${safeName}`);
    safeMoveSync(filePath, dst);
    return dst;
}

module.exports = { pdfUploadWafCheck, quarantineFile };






















