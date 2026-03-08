import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { PreflightResult, FileMeta, Issue, Severity } from '../types';

export async function generatePreflightReport(
    result: PreflightResult,
    fileMeta: FileMeta
): Promise<Uint8Array> {
    const pdfDoc = await PDFDocument.create();
    const timesRoman = await pdfDoc.embedFont(StandardFonts.TimesRoman);
    const timesBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);

    // Constants for layout
    const margin = 50;
    const A4_WIDTH = 595.28;
    const A4_HEIGHT = 841.89;
    let yPosition = A4_HEIGHT - margin;
    const lineHeight = 14;
    const fontSizeNormal = 10;
    const fontSizeHeader = 18;
    const fontSizeSubHeader = 14;

    let page = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT]);

    const addNewPage = () => {
        page = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT]);
        yPosition = A4_HEIGHT - margin;
    };

    const checkY = (needed: number) => {
        if (yPosition - needed < margin) {
            addNewPage();
        }
    };

    /**
     * Splits `text` into lines that fit within `maxWidth` using the given font/size,
     * respecting existing newline characters and performing word-wrap for long lines.
     */
    const wrapText = (text: string, font: any, size: number, maxWidth: number): string[] => {
        const result: string[] = [];
        for (const paragraph of text.split('\n')) {
            const words = paragraph.split(' ');
            let current = '';
            for (const word of words) {
                const candidate = current ? `${current} ${word}` : word;
                if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
                    current = candidate;
                } else {
                    if (current) result.push(current);
                    // If a single word is wider than maxWidth, push it as-is
                    current = word;
                }
            }
            if (current) result.push(current);
        }
        return result.length > 0 ? result : [''];
    };

    const drawText = (
        text: string,
        options: { font?: any; size?: number; color?: any, indent?: number } = {}
    ) => {
        const font = options.font || timesRoman;
        const size = options.size || fontSizeNormal;
        const color = options.color || rgb(0, 0, 0);
        const indent = options.indent || 0;
        const availableWidth = A4_WIDTH - 2 * margin - indent;
        const singleLineHeight = size + 4;

        const lines = wrapText(text, font, size, availableWidth);

        // Ensure the full block fits; if not, start a new page
        checkY(lines.length * singleLineHeight);

        for (const line of lines) {
            page.drawText(line, {
                x: margin + indent,
                y: yPosition,
                size,
                font,
                color,
            });
            yPosition -= singleLineHeight;
        }
    };

    const drawLine = () => {
        checkY(10);
        page.drawLine({
            start: { x: margin, y: yPosition + 5 },
            end: { x: A4_WIDTH - margin, y: yPosition + 5 },
            thickness: 1,
            color: rgb(0.8, 0.8, 0.8),
        });
        yPosition -= 10;
    };

    // --- Header ---
    drawText('Preflight Check Report', { font: timesBold, size: fontSizeHeader });
    yPosition -= 10;
    drawText(`File Name: ${fileMeta.name}`, { size: 12 });
    drawText(`File Size: ${(fileMeta.size / 1024 / 1024).toFixed(2)} MB`, { size: 12 });
    drawText(`Generated on: ${new Date().toLocaleString()}`, { size: 12 });
    yPosition -= 20;

    // --- Score Summary ---
    drawText(`Overall Score: ${result.score}/100`, { font: timesBold, size: fontSizeSubHeader });
    yPosition -= 5;

    const errorCount = result.issues.filter(i => i.severity === 'error').length;
    const warnCount = result.issues.filter(i => i.severity === 'warning').length;
    const infoCount = result.issues.filter(i => i.severity === 'info').length;

    drawText(`Errors: ${errorCount} | Warnings: ${warnCount} | Info: ${infoCount}`);
    yPosition -= 20;
    drawLine();
    yPosition -= 10;

    // --- Issues List ---
    drawText('Detailed Issues:', { font: timesBold, size: fontSizeSubHeader });
    yPosition -= 10;

    if (result.issues.length === 0) {
        drawText('No issues found. Great job!', { color: rgb(0, 0.5, 0) });
    } else {
        // Sort issues by severity then page
        const sortedIssues = [...result.issues].sort((a, b) => {
            const sevOrder = { [Severity.ERROR]: 0, [Severity.WARNING]: 1, [Severity.INFO]: 2 };
            const scoreA = sevOrder[a.severity] ?? 99;
            const scoreB = sevOrder[b.severity] ?? 99;
            if (scoreA !== scoreB) return scoreA - scoreB;
            return (a.page || 0) - (b.page || 0);
        });

        for (const issue of sortedIssues) {
            checkY(60); // Ensure enough space for at least the header of an issue

            const sevColor =
                issue.severity === Severity.ERROR ? rgb(0.8, 0, 0) :
                    issue.severity === Severity.WARNING ? rgb(0.8, 0.5, 0) :
                        rgb(0.3, 0.3, 0.3);

            const sevLabel = issue.severity.toUpperCase();
            const loc = issue.page ? `Page ${issue.page}` : 'Global';

            drawText(`[${sevLabel}] ${loc} - ${issue.message}`, {
                font: timesBold,
                color: sevColor
            });

            if (issue.details) {
                drawText(issue.details, { size: 9, color: rgb(0.3, 0.3, 0.3), indent: 10 });
            }
            yPosition -= 5;
        }
    }

    // --- Ink Efficiency Section ---
    if (result.productionReport?.inkOptimization) {
        checkY(100);
        drawLine();
        const ink = result.productionReport.inkOptimization;
        drawText('Ink saving & Efficiency Report:', { font: timesBold, size: fontSizeSubHeader });
        yPosition -= 5;
        drawText(`Cost Category: ${ink.costCategory}`);
        drawText(`Ink Usage Index: ${ink.inkUsageIndex}/100`);
        drawText(`Avg Page Coverage: ${ink.totalCoverageAvg.toFixed(2)}%`);

        if (ink.opportunities?.length > 0) {
            drawText('Optimization Opportunities:', { font: timesBold, size: 10 });
            ink.opportunities.forEach((opt: string) => {
                drawText(`• ${opt}`, { size: 9, indent: 10 });
            });
        }
        yPosition -= 10;
    }

    // --- Edition Intent Section ---
    if (result.productionReport?.editionIntent) {
        checkY(100);
        drawLine();
        const intent = result.productionReport.editionIntent;
        drawText('Print Edition Intent Detection:', { font: timesBold, size: fontSizeSubHeader });
        yPosition -= 5;
        drawText(`Detected Intent: ${intent.intent} (${Math.round(intent.confidence)}% confidence)`);
        drawText(`Offset Index: ${Math.round(intent.offsetScore)} | Digital Index: ${Math.round(intent.digitalScore)}`);

        if (intent.recommendation) {
            drawText('Recommendation:', { font: timesBold, size: 10 });
            drawText(intent.recommendation, { size: 9, indent: 10 });
        }
        yPosition -= 10;
    }

    // --- Footer ---
    // Add page numbers
    const pages = pdfDoc.getPages();
    for (let i = 0; i < pages.length; i++) {
        const p = pages[i];
        p.drawText(`Page ${i + 1} of ${pages.length}`, {
            x: A4_WIDTH / 2 - 30,
            y: 20,
            size: 9,
            font: timesRoman,
            color: rgb(0.5, 0.5, 0.5),
        });
    }

    return await pdfDoc.save();
}
