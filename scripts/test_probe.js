const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { PDFDocument } = require('pdf-lib');

async function run() {
    const tmpDir = fs.mkdtempSync(path.join(__dirname, '..', 'tmp-'));
    const pdfPath = path.join(tmpDir, 'test.pdf');

    const pdfDoc = await PDFDocument.create();
    pdfDoc.addPage([200, 200]);
    const bytes = await pdfDoc.save();
    fs.writeFileSync(pdfPath, bytes);

    const workerScript = path.join(__dirname, '..', 'workers', 'pdf_probe.js');
    const nodeExe = process.execPath || 'node';
    const args = [`--max-old-space-size=128`, workerScript, pdfPath];

    console.log('Running worker:', nodeExe, args.join(' '));

    const p = spawn(nodeExe, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    p.stdout.on('data', (d) => (out += d.toString('utf8')));
    p.stderr.on('data', (d) => (err += d.toString('utf8')));

    p.on('close', (code) => {
        console.log('Worker exited', code);
        if (out) {
            try {
                const j = JSON.parse(out);
                console.log('Probe result:', j);
            } catch (e) {
                console.error('Invalid JSON from worker stdout:', out);
            }
        }
        if (err) console.error('Worker stderr:', err);
        process.exit(code === 0 ? 0 : 1);
    });
}

run().catch((e) => { console.error(e); process.exit(2); });
