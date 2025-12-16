import { PDFDocument, PageSizes, RotationTypes } from 'pdf-lib';

/**
 * Creates a saddle-stitch booklet (2-up) from the input PDF.
 * Pages are reordered: [Last, First], [Second, Second-Last], etc.
 * The output is 2 pages per sheet (Landscape).
 */
export async function createBooklet(inputBytes: ArrayBuffer): Promise<Uint8Array> {
    const srcDoc = await PDFDocument.load(inputBytes);
    const srcPages = srcDoc.getPages();
    const totalPages = srcPages.length;

    // 1. Calculate needed pages (must be multiple of 4)
    const pagesToAdd = (4 - (totalPages % 4)) % 4;
    const signatureSize = totalPages + pagesToAdd;

    // 2. Create output document (Landscape, 2x width of A4 roughly, or A3)
    // Let's assume standard A4 Portrait inputs -> A3 Landscape output
    // Or A4 Landscape output containing 2x A5?
    // Usual "booklet" on standard printer is: Output sheet = Letter/A4 Landscape. Input pages scaled to fit half.
    // Let's assume output is A4 Landscape (Width: 841.89, Height: 595.28)
    // And we place two A5-ish pages on it.

    const outDoc = await PDFDocument.create();

    // Standard A4 dimensions
    const A4_WIDTH = PageSizes.A4[0];
    const A4_HEIGHT = PageSizes.A4[1];

    // Output sheet: Landscape A4
    const sheetWidth = A4_HEIGHT; // 842
    const sheetHeight = A4_WIDTH; // 595

    // Half sheet dimensions (where we put the page)
    const halfWidth = sheetWidth / 2;

    // 3. Generate imposition order
    // e.g. 8 pages: [8, 1], [2, 7], [6, 3], [4, 5]
    // Pairs: (N, 1), (2, N-1), (N-2, 3)...

    // Copy all pages first to new doc to handle them easily?
    // We need to embed them to draw them scaled.
    // embedPages accepts PDFPages from another document? 
    // Actually, embedPages exists in recent pdf-lib versions and takes (pages: PDFPage[]).
    const embeddedPages = await outDoc.embedPages(srcPages);

    // Create an array mapping logical index to embedded page
    // If index >= totalPages, it's a blank page
    const pagesMap: any[] = [];
    for (let i = 0; i < signatureSize; i++) {
        if (i < totalPages) {
            pagesMap[i] = embeddedPages[i];
        } else {
            pagesMap[i] = null; // Blank
        }
    }

    const sheetsCount = signatureSize / 2; // 2 pages per side? No, 2 pages per VIEW.
    // Actually, for a folded booklet:
    // Sheet 1 Front: [N, 1]
    // Sheet 1 Back:  [2, N-1]
    // Sheet 2 Front: [N-2, 3]
    // Sheet 2 Back:  [4, N-3]
    // ...

    for (let i = 0; i < sheetsCount; i++) {
        // Left Page Index, Right Page Index
        let leftIdx, rightIdx;

        // Front side logic?
        // Actually simplicity: Just stream them 2 per page in correct order.
        // The visual order for reading is 1, 2, 3...
        // The imposed order for printing:
        // Sheet 1: [N, 1]
        // Sheet 2: [2, N-1]
        // Sheet 3: [N-2, 3]
        // Sheet 4: [4, N-3]
        // Wait, typical printer does duplex.
        // If we just output a PDF with pages [N, 1], [2, N-1]... the printer will print them in that order.
        // If it's duplex, Sheet 1 Front = [N, 1], Back = [2, N-1]. Correct.

        // Logic for pairs:
        // k goes from 0 to (total/4 - 1)?
        // Let's trace for 8 pages:
        // i=0 (Sheet 1 Front): Left=8, Right=1
        // i=1 (Sheet 1 Back):  Left=2, Right=7  <- Wait, when you flip, Left becomes Right.
        // If you print duplex flip long edge (standard landscape):
        // Front: [8 | 1]
        // Back:  [2 | 7]
        // So 2 should be on the LEFT of the back? 
        // Visualize:
        // Front: 8 (Left) | 1 (Right)
        // Flip horizontal: Back of 1 is Left, Back of 8 is Right.
        // Page 2 is after Page 1. So Page 2 is on the back of Page 1. 
        // So Page 2 is Left on Back. Page 7 is Right.
        // Correct.

        // General algorithm:
        // Loop k = 0 to (sheetsCount/2) - 1 ??
        // Let's iterate by SHEET (2 output pages per sheet).
        // Total Sheets = signatureSize / 4.

        // Actually, let's just produce a linear list of "Spread" pages.
        // Spread 1: N, 1
        // Spread 2: 2, N-1
        // Spread 3: N-2, 3
        // Spread 4: 4, N-3
        // ...
        // General term for Spread i (0-indexed):
        // if even (0, 2, 4): Front side. Left = N - (i/2), Right = 1 + (i/2)
        // if odd (1, 3, 5): Back side.  Left = 2 + ((i-1)/2), Right = N - 1 - ((i-1)/2)

        // Let's refine.
        // i=0: L=N, R=1
        // i=1: L=2, R=N-1
        // i=2: L=N-2, R=3
        // i=3: L=4, R=N-3

        if (i % 2 === 0) {
            // Front
            // k is the sheet index = i/2
            const k = i / 2;
            leftIdx = signatureSize - 1 - k;
            rightIdx = k;
        } else {
            // Back
            const k = (i - 1) / 2;
            leftIdx = 1 + k;
            rightIdx = signatureSize - 2 - k;
        }

        // Create output page
        const page = outDoc.addPage([sheetWidth, sheetHeight]);

        // Draw content. We need to scale to fit half width or full height.
        // Assume source is Portrait. Fit into A5 Portrait (half of A4 Landscape).

        const drawContent = (pNum: number, xOffset: number) => {
            const srcPage = pagesMap[pNum];
            if (srcPage) {
                const { width, height } = srcPage;
                // Scale to fit halfWidth x sheetHeight
                // Preserve aspect ratio
                const scale = Math.min(
                    (halfWidth - 20) / width, // -20 margin
                    (sheetHeight - 20) / height
                );

                // Center in the half-panel
                const destW = width * scale;
                const destH = height * scale;

                const x = xOffset + (halfWidth - destW) / 2;
                const y = (sheetHeight - destH) / 2;

                page.drawPage(srcPage, {
                    x,
                    y,
                    width: destW,
                    height: destH
                });

                // Add page number (debug/helpful)
                // page.drawText(`${pNum + 1}`, { x: x + destW/2, y: 10, size: 8 });
            }
        };

        drawContent(leftIdx, 0); // Left half
        drawContent(rightIdx, halfWidth); // Right half
    }

    return await outDoc.save();
}
