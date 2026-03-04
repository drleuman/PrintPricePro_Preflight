const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const templateDir = path.join(__dirname, '..', 'test_suite_pdfs');
const stressDir = path.join(__dirname, '..', 'stress_test_pdfs');
const COUNT = process.env.STRESS_COUNT ? parseInt(process.env.STRESS_COUNT) : 500;

async function prepareTemplates() {
    console.log('[STRESS-GEN] Ensuring templates exist...');
    if (!fs.existsSync(templateDir) || fs.readdirSync(templateDir).length === 0) {
        execSync('node scripts/audit_generate_pdfs.js', { stdio: 'inherit' });
    }
}

async function generateStressPool() {
    if (!fs.existsSync(stressDir)) fs.mkdirSync(stressDir, { recursive: true });

    const templates = fs.readdirSync(templateDir).filter(f => f.endsWith('.pdf'));
    console.log(`[STRESS-GEN] Generating ${COUNT} unique PDFs from ${templates.length} templates...`);

    for (let i = 1; i <= COUNT; i++) {
        const template = templates[i % templates.length];
        const sourcePath = path.join(templateDir, template);
        const targetFilename = `STRESS_${String(i).padStart(5, '0')}_${template}`;
        const targetPath = path.join(stressDir, targetFilename);

        // Copy and append a small random buffer to ensure unique hash
        const content = fs.readFileSync(sourcePath);
        const noise = Buffer.from(`\n% STRESS_ID: ${i}_${Math.random().toString(36).slice(2)}\n`);

        fs.writeFileSync(targetPath, Buffer.concat([content, noise]));

        if (i % 100 === 0) console.log(`[STRESS-GEN] Progress: ${i}/${COUNT}...`);
    }
    console.log(`[STRESS-GEN] Done. Pool ready in ${stressDir}`);
}

async function main() {
    try {
        await prepareTemplates();
        await generateStressPool();
    } catch (err) {
        console.error('[STRESS-GEN] Critical failure:', err);
        process.exit(1);
    }
}

main();
