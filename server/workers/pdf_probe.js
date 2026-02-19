const fs = require('fs');
const path = require('path');
const { PDFDocument, PDFName, PDFArray, PDFDict } = require('pdf-lib');

async function main() {
    const inputPath = process.argv[2];
    if (!inputPath) {
        console.error(JSON.stringify({ error: 'missing_path' }));
        process.exit(2);
    }

    try {
        const bytes = await fs.promises.readFile(inputPath);
        const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
        const pageCount = doc.getPageCount();

        let sourceOI = { present: false, identifier: null };
        try {
            const catalog = doc.catalog;
            const oi = catalog.get(PDFName.of('OutputIntents'));
            if (oi) {
                const oiArray = doc.context.lookup(oi);
                if (oiArray instanceof PDFArray && oiArray.size() > 0) {
                    const intent = doc.context.lookup(oiArray.get(0));
                    if (intent instanceof PDFDict) {
                        sourceOI.present = true;
                        const ident = intent.get(PDFName.of('OutputConditionIdentifier'));
                        if (ident) sourceOI.identifier = ident.toString().replace(/^\(|\)$/g, '');
                    }
                }
            }
        } catch (e) {
            // ignore
        }

        const out = { ok: true, pageCount, sourceOI };
        console.log(JSON.stringify(out));
        process.exit(0);
    } catch (e) {
        console.error(JSON.stringify({ error: 'probe_failed', message: e.message }));
        process.exit(3);
    }
}

main();
