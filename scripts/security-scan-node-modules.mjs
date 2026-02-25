#!/usr/bin/env node
/**
 * Supply chain scanner for node_modules
 * - Flags install scripts (postinstall/preinstall/prepare)
 * - Greps suspicious patterns in JS
 * - Flags obfuscation-like blobs & high-entropy strings
 * - Outputs JSON + Markdown report
 *
 * Usage:
 *   node scripts/security-scan-node-modules.mjs --root . --out security-reports
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";

const args = process.argv.slice(2);
function arg(name, def) {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : def;
}

const ROOT = path.resolve(arg("--root", "."));
const OUTDIR = path.resolve(arg("--out", "security-reports"));
const MAX_FILE_BYTES = Number(arg("--max-file-bytes", String(2 * 1024 * 1024))); // 2MB
const MAX_SCAN_FILES = Number(arg("--max-files", "250000"));

const NODE_MODULES = path.join(ROOT, "node_modules");

const SUSPICIOUS_REGEX = [
    { id: "RCE_child_process", re: /\b(child_process|spawn|exec|execSync|fork)\b/ },
    { id: "Eval_Function", re: /\b(eval|new\s+Function|Function\s*\()\b/ },
    { id: "VM_Run", re: /\bvm\.(runInNewContext|runInThisContext|runInContext)\b/ },
    { id: "Network_Download", re: /\b(curl|wget|powershell|Invoke-WebRequest)\b/i },
    { id: "Base64_Blob", re: /\b(atob|btoa|Buffer\.from\(.+?,\s*['"]base64['"]\))\b/ },
    { id: "Crypto_Minerish", re: /\b(stratum\+tcp|cryptonight|xmrig|minerd|mining)\b/i },
    { id: "DNS_or_Beacon", re: /\b(dns\.resolve|resolve4|resolveTxt|https?:\/\/[^\s'"]+)\b/ },
    { id: "Obfuscationish", re: /\b(_0x[a-f0-9]{4,}|\\x[0-9a-f]{2}|\\u[0-9a-f]{4})\b/i },
];

const SUSPICIOUS_SCRIPTS = ["preinstall", "install", "postinstall", "prepare"];
const JS_EXT = new Set([".js", ".cjs", ".mjs"]);

function ensureDir(p) {
    fs.mkdirSync(p, { recursive: true });
}

function readTextSafe(fp, maxBytes) {
    try {
        const st = fs.statSync(fp);
        if (!st.isFile()) return null;
        if (st.size > maxBytes) return null;
        const buf = fs.readFileSync(fp);
        // quick binary heuristic
        const nul = buf.includes(0);
        if (nul) return null;
        return buf.toString("utf8");
    } catch {
        return null;
    }
}

function sha256File(fp) {
    const h = crypto.createHash("sha256");
    const s = fs.readFileSync(fp);
    h.update(s);
    return h.digest("hex");
}

function walk(dir, onFile) {
    const stack = [dir];
    let count = 0;

    while (stack.length) {
        const d = stack.pop();
        let ents;
        try {
            ents = fs.readdirSync(d, { withFileTypes: true });
        } catch {
            continue;
        }
        for (const e of ents) {
            const p = path.join(d, e.name);
            if (e.isDirectory()) {
                // avoid huge useless dirs
                if (e.name === ".git") continue;
                stack.push(p);
            } else if (e.isFile()) {
                count++;
                if (count > MAX_SCAN_FILES) throw new Error(`Max file limit exceeded (${MAX_SCAN_FILES}).`);
                onFile(p);
            }
        }
    }
}

function isProbablyObfuscated(text) {
    // crude: lots of hex escapes, extremely long lines, very high non-space ratio
    const lines = text.split("\n");
    const longLines = lines.filter(l => l.length > 2000).length;
    const hexEsc = (text.match(/\\x[0-9a-f]{2}/gi) || []).length;
    const uEsc = (text.match(/\\u[0-9a-f]{4}/gi) || []).length;
    return longLines >= 2 || hexEsc + uEsc > 200;
}

function highEntropyStrings(text) {
    // find long base64-ish tokens
    const hits = [];
    const re = /[A-Za-z0-9+/=]{200,}/g;
    let m;
    while ((m = re.exec(text))) {
        hits.push({ tokenPreview: m[0].slice(0, 60) + "…", len: m[0].length });
        if (hits.length >= 10) break;
    }
    return hits;
}

function loadPkgJson(pkgJsonPath) {
    try {
        return JSON.parse(fs.readFileSync(pkgJsonPath, "utf8"));
    } catch {
        return null;
    }
}

function findAllPackages(nodeModulesRoot) {
    const packages = [];
    if (!fs.existsSync(nodeModulesRoot)) return packages;

    // Find package.json inside node_modules/*/package.json and node_modules/@scope/*/package.json
    const lvl1 = fs.readdirSync(nodeModulesRoot, { withFileTypes: true });
    for (const e of lvl1) {
        if (!e.isDirectory()) continue;
        const p = path.join(nodeModulesRoot, e.name);
        if (e.name.startsWith(".")) continue;

        if (e.name.startsWith("@")) {
            const scoped = fs.readdirSync(p, { withFileTypes: true });
            for (const s of scoped) {
                if (!s.isDirectory()) continue;
                const pkgPath = path.join(p, s.name, "package.json");
                if (fs.existsSync(pkgPath)) packages.push(pkgPath);
            }
        } else {
            const pkgPath = path.join(p, "package.json");
            if (fs.existsSync(pkgPath)) packages.push(pkgPath);
        }
    }
    return packages;
}

ensureDir(OUTDIR);

const findings = {
    meta: {
        root: ROOT,
        node_modules: NODE_MODULES,
        scannedAt: new Date().toISOString(),
        maxFileBytes: MAX_FILE_BYTES,
    },
    packagesWithInstallScripts: [],
    suspiciousFiles: [],
    notes: [],
};

if (!fs.existsSync(NODE_MODULES)) {
    console.error(`[!] node_modules not found at ${NODE_MODULES}`);
    process.exit(2);
}

console.log(`[+] Scanning packages for install scripts…`);
const pkgJsonPaths = findAllPackages(NODE_MODULES);

for (const pj of pkgJsonPaths) {
    const pkg = loadPkgJson(pj);
    if (!pkg) continue;

    const scripts = pkg.scripts || {};
    const hitScripts = {};
    for (const k of SUSPICIOUS_SCRIPTS) {
        if (typeof scripts[k] === "string" && scripts[k].trim()) hitScripts[k] = scripts[k];
    }
    if (Object.keys(hitScripts).length) {
        findings.packagesWithInstallScripts.push({
            name: pkg.name || "(unknown)",
            version: pkg.version || "(unknown)",
            path: path.relative(ROOT, path.dirname(pj)),
            scripts: hitScripts,
        });
    }
}

console.log(`[+] Grepping suspicious patterns in node_modules JS files…`);
walk(NODE_MODULES, (fp) => {
    const ext = path.extname(fp);
    if (!JS_EXT.has(ext)) return;

    const text = readTextSafe(fp, MAX_FILE_BYTES);
    if (!text) return;

    const hits = [];
    for (const r of SUSPICIOUS_REGEX) {
        if (r.re.test(text)) hits.push(r.id);
    }

    const obf = isProbablyObfuscated(text);
    const ent = highEntropyStrings(text);

    if (hits.length || obf || ent.length) {
        // keep small-ish report
        const rel = path.relative(ROOT, fp);
        const st = fs.statSync(fp);
        findings.suspiciousFiles.push({
            file: rel,
            bytes: st.size,
            sha256: st.size <= 10 * 1024 * 1024 ? sha256File(fp) : "(skipped>10MB)",
            hits,
            obfuscationSuspected: obf,
            highEntropyTokens: ent,
        });
    }
});

findings.suspiciousFiles.sort((a, b) => (b.hits.length + (b.obfuscationSuspected ? 2 : 0)) - (a.hits.length + (a.obfuscationSuspected ? 2 : 0)));

const outJson = path.join(OUTDIR, "supply-chain-scan.json");
fs.writeFileSync(outJson, JSON.stringify(findings, null, 2), "utf8");

const md = [];
md.push(`# Supply Chain Scan Report`);
md.push(`- Root: \`${findings.meta.root}\``);
md.push(`- node_modules: \`${findings.meta.node_modules}\``);
md.push(`- Scanned at: ${findings.meta.scannedAt}`);
md.push(``);

md.push(`## Packages with install scripts (${findings.packagesWithInstallScripts.length})`);
for (const p of findings.packagesWithInstallScripts.slice(0, 200)) {
    md.push(`- **${p.name}@${p.version}** — \`${p.path}\``);
    for (const [k, v] of Object.entries(p.scripts)) md.push(`  - \`${k}\`: ${v}`);
}
if (findings.packagesWithInstallScripts.length > 200) md.push(`- … truncated`);

md.push(``);
md.push(`## Suspicious JS files (${findings.suspiciousFiles.length})`);
for (const f of findings.suspiciousFiles.slice(0, 300)) {
    md.push(`- \`${f.file}\` (${f.bytes} bytes)`);
    if (f.hits.length) md.push(`  - Hits: ${f.hits.join(", ")}`);
    if (f.obfuscationSuspected) md.push(`  - Obfuscation suspected`);
    if (f.highEntropyTokens?.length) md.push(`  - High-entropy tokens: ${f.highEntropyTokens.map(x => `${x.len}`).join(", ")}`);
    md.push(`  - sha256: \`${f.sha256}\``);
}
if (findings.suspiciousFiles.length > 300) md.push(`- … truncated`);

const outMd = path.join(OUTDIR, "SUPPLY_CHAIN_AUDIT.md");
fs.writeFileSync(outMd, md.join("\n"), "utf8");

console.log(`[✓] Wrote: ${outJson}`);
console.log(`[✓] Wrote: ${outMd}`);
console.log(`[!] Review the top suspicious files first (hits + obfuscation).`);
