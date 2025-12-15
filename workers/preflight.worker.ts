/// <reference lib="webworker" />

import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { PDFDocument } from 'pdf-lib';

import {
  Severity,
  ISSUE_CATEGORY,
  type Issue,
  type PreflightResult,
  type FileMeta,
  type PreflightWorkerMessage,
  type CategorySummary,
} from '../types';

// Array con todos los valores del enum ISSUE_CATEGORY
const ISSUE_CATEGORYValues: ISSUE_CATEGORY[] =
  Object.values(ISSUE_CATEGORY) as ISSUE_CATEGORY[];

// Usamos el mismo worker de pdfjs que el visor
// Polfill for PDF.js requiring document.createElement for canvas
if (typeof self !== 'undefined' && !self.document) {
  (self as any).document = {
    createElement: (tagName: string) => {
      if (tagName === 'canvas') {
        return new OffscreenCanvas(1, 1);
      }
      return {};
    },
    createElementNS: (_ns: string, tagName: string) => {
      if (tagName === 'canvas') {
        return new OffscreenCanvas(1, 1);
      }
      return {};
    },
  };
}

(pdfjsLib as any).GlobalWorkerOptions.workerSrc = pdfWorker;

type AnalyzeCmd = {
  type: 'analyze';
  fileMeta: FileMeta;
  buffer: ArrayBuffer;
};

type ConvertToGrayscaleCmd = {
  type: 'convertToGrayscale';
  fileMeta: FileMeta;
  buffer: ArrayBuffer;
};

type UpscaleLowResImagesCmd = {
  type: 'upscaleLowResImages';
  fileMeta: FileMeta;
  buffer: ArrayBuffer;
  minDpi?: number;
};

type FixBleedCmd = {
  type: 'fixBleed';
  fileMeta: FileMeta;
  buffer: ArrayBuffer;
};

type Inbound = AnalyzeCmd | ConvertToGrayscaleCmd | UpscaleLowResImagesCmd | FixBleedCmd;

type Outbound =
  | { type: 'analysisProgress'; progress: number; note?: string }
  | { type: 'analysisResult'; result: PreflightResult }
  | { type: 'analysisError'; message: string }
  | {
    type: 'transformResult';
    operation: 'grayscale' | 'upscaleImages' | 'fixBleed';
    buffer: ArrayBuffer;
    fileMeta: FileMeta;
  }
  | {
    type: 'transformError';
    operation: 'grayscale' | 'upscaleImages' | 'fixBleed';
    message: string;
  };

function post(msg: Outbound) {
  (self as unknown as Worker).postMessage(msg as PreflightWorkerMessage);
}

/* =========================
   Utils de tamaño / severidad
   ========================= */

function mmFromPt(pt: number): number {
  return (pt * 25.4) / 72;
}

function classifySize(widthPt: number, heightPt: number): string {
  const w = mmFromPt(Math.min(widthPt, heightPt));
  const h = mmFromPt(Math.max(widthPt, heightPt));
  const isClose = (a: number, b: number) => Math.abs(a - b) < 3;

  if (isClose(w, 148) && isClose(h, 210)) return 'A5';
  if (isClose(w, 170) && isClose(h, 240)) return '170 × 240 mm';
  if (isClose(w, 210) && isClose(h, 297)) return 'A4';
  if (isClose(w, 210) && isClose(h, 280)) return 'US Letter-ish';
  return `${w.toFixed(1)} × ${h.toFixed(1)} mm`;
}

function getSeverity(issue: Issue): Severity {
  if (issue.severity != null) return issue.severity;

  const tags = issue.tags || [];
  if (tags.some((t) => /error|fatal|critical/i.test(t))) return Severity.ERROR;
  if (tags.some((t) => /warn/i.test(t))) return Severity.WARNING;
  return Severity.INFO;
}

/* ==========================================================
   Helpers NUEVOS para renderizar y transformar el PDF
   ========================================================== */

async function renderPageToCanvas(page: any, scale: number) {
  const viewport = page.getViewport({ scale });
  if (typeof OffscreenCanvas === 'undefined') {
    throw new Error('OffscreenCanvas is not supported in this environment.');
  }
  const canvas = new OffscreenCanvas(viewport.width, viewport.height);
  const context = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D;
  await page.render({ canvasContext: context as any, viewport }).promise;
  return { canvas, viewport };
}

async function canvasToPngBytes(canvas: OffscreenCanvas): Promise<Uint8Array> {
  const blob = await canvas.convertToBlob({ type: 'image/png' });
  const buf = await blob.arrayBuffer();
  return new Uint8Array(buf);
}

function convertCanvasToGrayscale(canvas: OffscreenCanvas) {
  const ctx = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D;
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i];
    const g = d[i + 1];
    const b = d[i + 2];
    const gray = 0.299 * r + 0.587 * g + 0.114 * b;
    d[i] = d[i + 1] = d[i + 2] = gray;
  }
  ctx.putImageData(img, 0, 0);
}

// 1) Convertir todo el PDF a ESCALA DE GRISES rasterizando cada página
async function convertPdfToGrayscale(
  buffer: ArrayBuffer,
  fileMeta: FileMeta
): Promise<{ buffer: ArrayBuffer; fileMeta: FileMeta }> {
  const uint8 = new Uint8Array(buffer);
  const loadingTask = (pdfjsLib as any).getDocument({
    data: uint8,
    disableWorker: true,
    cMapUrl: 'https://unpkg.com/pdfjs-dist@4.6.82/cmaps/',
    cMapPacked: true,
  });
  const pdf = await loadingTask.promise;
  const pageCount = pdf.numPages;

  const outDoc = await PDFDocument.create();

  // 72 * 2.1 ≈ 150 dpi
  const scale = 2.1;

  for (let pageIndex = 1; pageIndex <= pageCount; pageIndex++) {
    const page = await pdf.getPage(pageIndex);
    const { canvas, viewport } = await renderPageToCanvas(page, scale);

    convertCanvasToGrayscale(canvas);
    const pngBytes = await canvasToPngBytes(canvas);
    const embedded = await outDoc.embedPng(pngBytes);

    const newPage = outDoc.addPage([viewport.width, viewport.height]);
    newPage.drawImage(embedded, {
      x: 0,
      y: 0,
      width: viewport.width,
      height: viewport.height,
    });

    post({
      type: 'analysisProgress',
      progress: (pageIndex / pageCount) * 100,
      note: `Rendering grayscale page ${pageIndex}/${pageCount}`,
    });
  }

  const outBytes = await outDoc.save();
  const sliced = outBytes.buffer.slice(
    outBytes.byteOffset,
    outBytes.byteOffset + outBytes.byteLength
  );
  const newMeta: FileMeta = {
    ...fileMeta,
    name: fileMeta.name.replace(/\.pdf$/i, '') + '_grayscale.pdf',
    size: outBytes.byteLength,
  };

  return { buffer: sliced, fileMeta: newMeta };
}

// 2) Rasterizar el PDF completo a una resolución mínima (dpi) – “reconstruir ≥150 dpi”
async function upscalePdf(
  buffer: ArrayBuffer,
  fileMeta: FileMeta,
  minDpi = 150
): Promise<{ buffer: ArrayBuffer; fileMeta: FileMeta }> {
  const uint8 = new Uint8Array(buffer);
  const loadingTask = (pdfjsLib as any).getDocument({
    data: uint8,
    disableWorker: true,
    cMapUrl: 'https://unpkg.com/pdfjs-dist@4.6.82/cmaps/',
    cMapPacked: true,
  });
  const pdf = await loadingTask.promise;
  const pageCount = pdf.numPages;

  const outDoc = await PDFDocument.create();

  // Aproximación: 1pt = 1/72 inch → dpi ≈ 72 * scale
  const scale = minDpi / 72;

  for (let pageIndex = 1; pageIndex <= pageCount; pageIndex++) {
    const page = await pdf.getPage(pageIndex);
    const { canvas, viewport } = await renderPageToCanvas(page, scale);

    const pngBytes = await canvasToPngBytes(canvas);
    const embedded = await outDoc.embedPng(pngBytes);

    const newPage = outDoc.addPage([viewport.width, viewport.height]);
    newPage.drawImage(embedded, {
      x: 0,
      y: 0,
      width: viewport.width,
      height: viewport.height,
    });

    post({
      type: 'analysisProgress',
      progress: (pageIndex / pageCount) * 100,
      note: `Upscaling page ${pageIndex}/${pageCount}`,
    });
  }

  const outBytes = await outDoc.save();
  const sliced = outBytes.buffer.slice(
    outBytes.byteOffset,
    outBytes.byteOffset + outBytes.byteLength
  );
  const newMeta: FileMeta = {
    ...fileMeta,
    name:
      fileMeta.name.replace(/\.pdf$/i, '') +
      `_upscaled_${Math.round(minDpi)}dpi.pdf`,
    size: outBytes.byteLength,
  };

  return { buffer: sliced, fileMeta: newMeta };
}

// 3) Añadir sangrado (bleed) a un PDF
async function addBleed(
  buffer: ArrayBuffer,
  fileMeta: FileMeta,
  bleedMm: number = 3
): Promise<{ buffer: ArrayBuffer; fileMeta: FileMeta }> {
  const originalPdfDoc = await PDFDocument.load(buffer);
  const outDoc = await PDFDocument.create();

  const pageCount = originalPdfDoc.getPageCount();
  const bleedPt = (bleedMm * 72) / 25.4; // Convert mm to points

  for (let i = 0; i < pageCount; i++) {
    const [originalPage] = await outDoc.copyPages(originalPdfDoc, [i]);
    const { width, height } = originalPage.getSize();

    const newWidth = width + 2 * bleedPt;
    const newHeight = height + 2 * bleedPt;

    const newPage = outDoc.addPage([newWidth, newHeight]);
    newPage.drawPage(originalPage, {
      x: bleedPt,
      y: bleedPt,
      width: width,
      height: height,
    });

    post({
      type: 'analysisProgress',
      progress: ((i + 1) / pageCount) * 100,
      note: `Adding bleed to page ${i + 1}/${pageCount}`,
    });
  }

  const outBytes = await outDoc.save();
  const sliced = outBytes.buffer.slice(
    outBytes.byteOffset,
    outBytes.byteOffset + outBytes.byteLength
  );
  const newMeta: FileMeta = {
    ...fileMeta,
    name: fileMeta.name.replace(/\.pdf$/i, '') + `_bleed_${bleedMm}mm.pdf`,
    size: outBytes.byteLength,
  };

  return { buffer: sliced, fileMeta: newMeta };
}

/* =========================
   Construcción de resultado (ORIGINAL)
   ========================= */

function buildResult(
  issues: Issue[],
  pageCount: number,
  fileMeta: FileMeta
): PreflightResult {
  // Score simple
  let score = 100;
  for (const it of issues) {
    const sev = getSeverity(it);
    if (sev === Severity.ERROR) score -= 15;
    else if (sev === Severity.WARNING) score -= 7;
  }
  score = Math.min(100, Math.max(0, Math.round(score)));

  const errorCount = issues.filter((i) => getSeverity(i) === Severity.ERROR)
    .length;
  const warnCount = issues.filter((i) => getSeverity(i) === Severity.WARNING)
    .length;
  const infoCount = issues.filter((i) => getSeverity(i) === Severity.INFO)
    .length;

  let summary: string;
  if (!issues.length) {
    summary = 'No issues found on the sampled pages.';
  } else {
    summary = `Found ${errorCount} errors, ${warnCount} warnings and ${infoCount} info issues on the sampled pages.`;
  }

  // Resumen por categoría
  const catMap = new Map<
    ISSUE_CATEGORY,
    { errors: number; warnings: number; info: number }
  >();

  for (const it of issues) {
    const cat = it.category ?? ISSUE_CATEGORYValues.metadata;
    const sev = getSeverity(it);
    let entry = catMap.get(cat);
    if (!entry) {
      entry = { errors: 0, warnings: 0, info: 0 };
      catMap.set(cat, entry);
    }
    if (sev === Severity.ERROR) entry.errors++;
    else if (sev === Severity.WARNING) entry.warnings++;
    else entry.info++;
  }

  const categorySummaries: CategorySummary[] = Array.from(catMap.entries()).map(
    ([category, counts]) => ({
      category,
      errors: counts.errors,
      warnings: counts.warnings,
      info: counts.info,
    })
  );

  // Issues por página
  const issuesPerPage = new Map<number, number>();
  for (const it of issues) {
    if (typeof it.page !== 'number') continue;
    issuesPerPage.set(it.page, (issuesPerPage.get(it.page) || 0) + 1);
  }

  const pages = Array.from({ length: pageCount }, (_, idx) => {
    const pageNumber = idx + 1;
    return {
      pageNumber,
      issuesCount: issuesPerPage.get(pageNumber) || 0,
    };
  });

  return {
    score,
    summary,
    issues,
    pages,
    categorySummaries,
    meta: {
      fileName: fileMeta.name,
      fileSize: fileMeta.size,
      pageCount,
    },
  };
}

/* =========================
   Análisis real con pdfjs (PACK A + B + TODOS) – ORIGINAL
   ========================= */

async function analyzePdf(
  buffer: ArrayBuffer,
  fileMeta: FileMeta
): Promise<PreflightResult> {
  const issues: Issue[] = [];

  const uint8 = new Uint8Array(buffer);
  const loadingTask = (pdfjsLib as any).getDocument({
    data: uint8,
    disableWorker: true,
    cMapUrl: 'https://unpkg.com/pdfjs-dist@4.6.82/cmaps/',
    cMapPacked: true,
  });
  const pdf = await loadingTask.promise;
  const pageCount = pdf.numPages;

  // ---------- Documento vacío ----------
  if (!pageCount || pageCount <= 0) {
    issues.push({
      id: 'empty-document',
      page: 1,
      category: ISSUE_CATEGORY.METADATA,
      severity: Severity.ERROR,
      message: 'The PDF appears to have no pages.',
      details:
        'This file could not be parsed as a multi-page document. ' +
        'Please check that export completed correctly before sending it to print.',
    });
    return buildResult(issues, 0, fileMeta);
  }

  const sampleCount = Math.min(pageCount, 10);

  // --------- Acumuladores PACK A ----------
  let firstWidth = 0;
  let firstHeight = 0;
  let hasMixedSizes = false;

  let anyColorLikeOps = false;
  let firstColorPage: number | null = null;

  let anyTransparencyOps = false;
  let firstTransparencyPage: number | null = null;

  let missingBleedInfo = false;
  let missingBleedPage: number | null = null;

  let insufficientBleed = false;
  let insufficientBleedPage: number | null = null;

  const type3Fonts = new Set<string>();

  // Mapa de fuentes usadas (nombre base -> info)
  const fontsUsed = new Map<
    string,
    { subset: boolean; type3: boolean }
  >();

  let imageCount = 0;
  let firstImagePage: number | null = null;

  // --------- Acumuladores PACK B ----------
  let lowResImages = 0;
  let firstLowResPage: number | null = null;

  // Nuevo: registrar la peor imagen (DPI más bajo)
  let worstImageDpi = Infinity;
  let worstImagePage: number | null = null;

  let hasAnnotations = false;
  let firstAnnotationPage: number | null = null;

  let hasFormFields = false;
  let firstFormPage: number | null = null;

  let hasMultimedia = false;
  let firstMultimediaPage: number | null = null;

  let hasLayers = false;

  // Texto demasiado pequeño (legibilidad)
  let tinyTextChunks = 0;   // < 6 pt
  let smallTextChunks = 0;  // 6–8 pt aprox

  let firstTinyTextPage: number | null = null;
  let firstSmallTextPage: number | null = null;

  let minFontPt = Infinity;
  let minFontPage: number | null = null;

  // --------- PACK TODOS: color avanzado + trazos ----------

  // Color spaces
  let hasRGB = false;
  let hasCMYK = false;
  let hasGray = false;

  // Hairlines (trazos demasiado finos)
  let hairlineStrokes = 0;
  let firstHairlinePage: number | null = null;

  // Overprint
  let overprintOps = 0;
  let firstOverprintPage: number | null = null;

  // Intento detectar capas (OCG) a nivel de documento
  try {
    const ocConfig = await (pdf as any).getOptionalContentConfig?.();
    if (ocConfig) {
      const order =
        typeof ocConfig.getOrder === 'function'
          ? ocConfig.getOrder()
          : (ocConfig as any)._groups;
      if (order && Array.isArray(order) && order.length > 0) {
        hasLayers = true;
      }
    }
  } catch {
    // Si falla, simplemente no marcamos nada
  }

  // ---------- Muestreo de páginas ----------
  for (let pageIndex = 1; pageIndex <= sampleCount; pageIndex++) {
    const page = await pdf.getPage(pageIndex);

    // --- Tamaño de página básico (viewport) ---
    const viewport = page.getViewport({ scale: 1 });
    const width = viewport.width;
    const height = viewport.height;

    if (pageIndex === 1) {
      firstWidth = width;
      firstHeight = height;
    } else if (
      Math.abs(width - firstWidth) > 1 ||
      Math.abs(height - firstHeight) > 1
    ) {
      hasMixedSizes = true;
    }

    // --- Cajas PDF: MediaBox / TrimBox / BleedBox (best-effort) ---
    try {
      const raw = page as any;
      const info = raw.pageInfo || raw._pageInfo;
      const mediaBox = info?.mediaBox || info?.view;
      const trimBox = info?.trimBox;
      const bleedBox = info?.bleedBox;

      if (!trimBox || !bleedBox) {
        // Sin info explícita de trim/bleed
        missingBleedInfo = true;
        if (missingBleedPage === null) missingBleedPage = pageIndex;
      } else if (
        Array.isArray(trimBox) &&
        Array.isArray(bleedBox) &&
        trimBox.length === 4 &&
        bleedBox.length === 4
      ) {
        const [tx0, ty0, tx1, ty1] = trimBox;
        const [bx0, by0, bx1, by1] = bleedBox;

        // Bleed en mm (alrededor del TrimBox)
        const bleedLeftMm = mmFromPt(tx0 - bx0);
        const bleedBottomMm = mmFromPt(ty0 - by0);
        const bleedRightMm = mmFromPt(bx1 - tx1);
        const bleedTopMm = mmFromPt(by1 - ty1); // 🔧 corregido

        const minBleedMm = Math.min(
          bleedLeftMm,
          bleedBottomMm,
          bleedRightMm,
          bleedTopMm
        );

        if (isFinite(minBleedMm) && minBleedMm < 2.9) {
          insufficientBleed = true;
          if (insufficientBleedPage === null) {
            insufficientBleedPage = pageIndex;
          }
        }

        // TrimBox fuera de MediaBox (si tenemos MediaBox)
        if (Array.isArray(mediaBox) && mediaBox.length === 4) {
          const [mx0, my0, mx1, my1] = mediaBox;
          if (
            tx0 < mx0 - 0.1 ||
            ty0 < my0 - 0.1 ||
            tx1 > mx1 + 0.1 ||
            ty1 > my1 + 0.1
          ) {
            issues.push({
              id: 'trim-outside-mediabox',
              page: pageIndex,
              category: ISSUE_CATEGORY.BLEED_MARGINS,
              severity: Severity.WARNING,
              message: 'Trim box lies partially outside the media box.',
              details:
                'The TrimBox coordinates extend beyond the MediaBox. ' +
                'This can cause unexpected cropping or misregistration in imposition.',
              bbox: { x: 0, y: 0, width: 1, height: 1 },
            });
          }
        }
      }
    } catch {
      // No rompemos si la introspección interna falla
    }

    // --- Anotaciones (PACK B: forms, multimedia, comentarios) ---
    try {
      const annots = await page.getAnnotations({ intent: 'display' });
      for (const a of annots as any[]) {
        const subtype = (a as any).subtype || (a as any).annotationType;

        // Formularios
        if (subtype === 'Widget') {
          hasFormFields = true;
          if (firstFormPage === null) firstFormPage = pageIndex;
        }

        // Multimedia / adjuntos pesados
        if (
          subtype === 'Movie' ||
          subtype === 'RichMedia' ||
          subtype === 'Sound' ||
          subtype === 'FileAttachment' ||
          subtype === 'Screen' ||
          subtype === '3D'
        ) {
          hasMultimedia = true;
          if (firstMultimediaPage === null) {
            firstMultimediaPage = pageIndex;
          }
        }

        // Comentarios / marcas de revisión
        if (
          subtype === 'Text' ||
          subtype === 'Highlight' ||
          subtype === 'Underline' ||
          subtype === 'Squiggly' ||
          subtype === 'StrikeOut' ||
          subtype === 'Caret' ||
          subtype === 'Ink' ||
          subtype === 'Popup' ||
          subtype === 'Link'
        ) {
          hasAnnotations = true;
          if (firstAnnotationPage === null) {
            firstAnnotationPage = pageIndex;
          }
        }
      }
    } catch {
      // Si falla, no paramos
    }

    // --- Fuentes: Type3 + resumen de fuentes + tamaño de texto ---
    try {
      const textContent = await page.getTextContent();
      const pageFontNames = new Set<string>();

      for (const item of textContent.items as any[]) {
        const anyItem = item as any;

        // --- Nombre de fuente para el resumen ---
        const name = anyItem.fontName;
        if (name) pageFontNames.add(name);

        // --- Tamaño de fuente aproximado (en puntos) ---
        const tr = (anyItem.transform || []) as number[];
        const fontSizeFromTransform = Array.isArray(tr)
          ? Math.max(Math.abs(tr[0] || 0), Math.abs(tr[3] || 0))
          : 0;

        const fontSizeRaw =
          (typeof anyItem.fontSize === 'number'
            ? anyItem.fontSize
            : 0) || fontSizeFromTransform;

        const fontSizePt = Math.abs(fontSizeRaw);

        if (fontSizePt > 0 && isFinite(fontSizePt)) {
          // Registrar min global
          if (fontSizePt < minFontPt) {
            minFontPt = fontSizePt;
            minFontPage = pageIndex;
          }

          // < 6 pt = "tiny" (muy arriesgado para texto de lectura)
          if (fontSizePt < 6) {
            tinyTextChunks++;
            if (firstTinyTextPage === null) {
              firstTinyTextPage = pageIndex;
            }
          }
          // 6–8 pt = "small" (aceptable solo para notas, pies, etc.)
          else if (fontSizePt < 8) {
            smallTextChunks++;
            if (firstSmallTextPage === null) {
              firstSmallTextPage = pageIndex;
            }
          }
        }
      }

      const commonObjs = (page as any).commonObjs;
      if (commonObjs && typeof commonObjs.get === 'function') {
        for (const name of pageFontNames) {
          const font = commonObjs.get(name);
          if (!font) continue;

          const data = (font as any).data || font;
          const rawName =
            data?.loadedName || data?.name || String(name);

          // Detectar subset: "ABCDEF+NombreFuente"
          let baseName = rawName;
          let subset = false;
          const m = /^([A-Z]{6})\+(.+)$/.exec(rawName);
          if (m) {
            subset = true;
            baseName = m[2];
          }

          const isType3 = (font as any).isType3 || data?.isType3;
          if (isType3) {
            type3Fonts.add(baseName);
          }

          // Guardamos info agregada por fuente
          const existing = fontsUsed.get(baseName) || {
            subset: false,
            type3: false,
          };
          fontsUsed.set(baseName, {
            subset: existing.subset || subset,
            type3: existing.type3 || !!isType3,
          });
        }
      }
    } catch {
      // Si falla el análisis de fuentes, no paramos el flujo
    }

    // --- OperatorList: color, transparencias, imágenes (PACK A + B + TODOS) ---
    try {
      const ops = await (page as any).getOperatorList();
      const fnArray = (ops && (ops.fnArray as number[])) || [];
      const argsArray = (ops && (ops.argsArray as any[])) || [];
      const OPS = (pdfjsLib as any).OPS || {};

      // RGB color ops (igual que antes)
      const rgbOps = new Set<number>();
      if (OPS.setFillRGBColor != null) rgbOps.add(OPS.setFillRGBColor);
      if (OPS.setStrokeRGBColor != null) rgbOps.add(OPS.setStrokeRGBColor);
      if (OPS.setFillRGBColorN != null) rgbOps.add(OPS.setFillRGBColorN);
      if (OPS.setStrokeRGBColorN != null) rgbOps.add(OPS.setStrokeRGBColorN);

      // CMYK color ops
      const cmykOps = new Set<number>();
      if (OPS.setFillCMYKColor != null) cmykOps.add(OPS.setFillCMYKColor);
      if (OPS.setStrokeCMYKColor != null) cmykOps.add(OPS.setStrokeCMYKColor);

      // Gray color ops
      const grayOps = new Set<number>();
      if (OPS.setFillGray != null) grayOps.add(OPS.setFillGray);
      if (OPS.setStrokeGray != null) grayOps.add(OPS.setStrokeGray);
      if (OPS.setGray != null) grayOps.add(OPS.setGray);

      const transparencyOps = new Set<number>();
      if (OPS.setAlphaConstant != null) transparencyOps.add(OPS.setAlphaConstant);
      if (OPS.setFillAlpha != null) transparencyOps.add(OPS.setFillAlpha);
      if (OPS.setStrokeAlpha != null) transparencyOps.add(OPS.setStrokeAlpha);
      if (OPS.setGState != null) transparencyOps.add(OPS.setGState);

      const imageOps = new Set<number>();
      if (OPS.paintImageXObject != null) imageOps.add(OPS.paintImageXObject);
      if (OPS.paintInlineImageXObject != null) {
        imageOps.add(OPS.paintInlineImageXObject);
      }
      if (OPS.paintImageXObjectRepeat != null) {
        imageOps.add(OPS.paintImageXObjectRepeat);
      }

      for (let i = 0; i < fnArray.length; i++) {
        const fn = fnArray[i];
        const args = argsArray[i];

        // --- Color spaces ---
        if (rgbOps.has(fn)) {
          anyColorLikeOps = true;
          hasRGB = true;
          if (firstColorPage === null) firstColorPage = pageIndex;
        }

        if (cmykOps.has(fn)) {
          hasCMYK = true;
        }

        if (grayOps.has(fn)) {
          hasGray = true;
        }

        // --- Transparencias ---
        if (transparencyOps.has(fn)) {
          anyTransparencyOps = true;

          // Overprint best-effort (cuando viene por setGState)
          if (fn === OPS.setGState && args && typeof args === 'object') {
            const g = (Array.isArray(args) ? args[0] : args) as any;
            if (g) {
              const opFlag = g.op ?? g.OP ?? g.overprint;
              const opm = g.opm ?? g.overprintMode;
              if (opFlag === true || opm === 1) {
                overprintOps++;
                if (firstOverprintPage === null) {
                  firstOverprintPage = pageIndex;
                }
              }
            }
          }

          if (firstTransparencyPage === null) {
            firstTransparencyPage = pageIndex;
          }
        }

        // --- Imágenes (PACK A + B) ---
        if (imageOps.has(fn)) {
          imageCount++;
          if (firstImagePage === null) firstImagePage = pageIndex;

          // PACK B: heurística de DPI para imágenes (inline o XObject con width/height)
          if (
            args &&
            typeof args === 'object' &&
            ('width' in args || 'w' in args) &&
            ('height' in args || 'h' in args)
          ) {
            const pxWidth =
              Number((args as any).width ?? (args as any).w) || 0;
            const pxHeight =
              Number((args as any).height ?? (args as any).h) || 0;

            if (pxWidth > 0 && pxHeight > 0) {
              // Suponemos que ocupa un área significativa de la página:
              const pageWidthInches = width / 72;
              const pageHeightInches = height / 72;

              const dpiX = pxWidth / pageWidthInches;
              const dpiY = pxHeight / pageHeightInches;
              const minDpi = Math.min(dpiX, dpiY);

              if (isFinite(minDpi)) {
                // Guardamos la peor imagen
                if (minDpi < worstImageDpi) {
                  worstImageDpi = minDpi;
                  worstImagePage = pageIndex;
                }

                // Umbral para marcar como baja resolución
                if (minDpi < 150) {
                  lowResImages++;
                  if (firstLowResPage === null) {
                    firstLowResPage = pageIndex;
                  }
                }
              }
            }
          }
        }

        // --- Hairlines (trazos demasiado finos) ---
        if (fn === OPS.setLineWidth && args && args.length > 0) {
          const lineWidth = args[0];
          if (typeof lineWidth === 'number' && lineWidth > 0 && lineWidth < 0.25) {
            hairlineStrokes++;
            if (firstHairlinePage === null) {
              firstHairlinePage = pageIndex;
            }
          }
        }
      }
    } catch {
      // Si falla, seguimos; no queremos romper el análisis
    }
  } // fin bucle páginas

  // --------- Generación de resultados (PACK A) ---------

  // Tamaños mixtos
  if (hasMixedSizes) {
    issues.push({
      id: 'mixed-page-sizes',
      page: 1,
      category: ISSUE_CATEGORY.PAGE_SETUP,
      severity: Severity.WARNING,
      message: 'Document contains pages with different dimensions.',
      details:
        'Pages in this document have varying dimensions. ' +
        'For consistent printing, consider standardizing page sizes.',
      bbox: { x: 0, y: 0, width: 1, height: 1 },
    });
  }

  // Tamaño no estándar (info)
  if (firstWidth && firstHeight) {
    const sizeLabel = classifySize(firstWidth, firstHeight);
    const isCustom = !/A4|A5|170 × 240|Letter/i.test(sizeLabel);
    if (isCustom) {
      issues.push({
        id: 'non-standard-size',
        page: 1,
        category: ISSUE_CATEGORY.METADATA,
        severity: Severity.INFO,
        message: `Page size detected: ${sizeLabel}`,
        details:
          'The document uses a non-standard size for offset printing. ' +
          'Double-check that chosen print house supports it efficiently.',
        bbox: { x: 0, y: 0, width: 1, height: 1 },
      });
    }
  }

  // Presencia de color
  if (anyColorLikeOps) {
    issues.push({
      id: 'color-content-detected',
      page: firstColorPage || 1,
      category: ISSUE_CATEGORY.COLOR,
      severity: Severity.INFO,
      message: 'Color operations detected in the document.',
      details:
        'This document contains color elements. ' +
        'If you intended to print in grayscale, please review your color settings.',
      bbox: { x: 0, y: 0, width: 1, height: 1 },
    });
  } else {
    issues.push({
      id: 'no-explicit-color-ops',
      page: 1,
      category: ISSUE_CATEGORY.COLOR,
      severity: Severity.INFO,
      message: 'No explicit RGB color operators detected in sampled pages.',
      details:
        'The engine did not detect operators that set RGB colors. ' +
        'This suggests a grayscale / black-only interior, which is good for economical book printing.',
      bbox: { x: 0, y: 0, width: 1, height: 1 },
    });
  }

  // Transparencias
  if (anyTransparencyOps) {
    issues.push({
      id: 'transparency-detected',
      page: firstTransparencyPage || 1,
      category: ISSUE_CATEGORY.TRANSPARENCY,
      severity: Severity.WARNING,
      message: 'Transparency effects detected in the document.',
      details:
        'Transparency can cause unexpected results when printing. ' +
        'Consider flattening document before final output.',
      bbox: { x: 0, y: 0, width: 1, height: 1 },
    });
  }

  // Información de sangrado (bleed)
  if (missingBleedInfo) {
    issues.push({
      id: 'missing-bleed-info',
      page: missingBleedPage || 1,
      category: ISSUE_CATEGORY.BLEED_MARGINS,
      severity: Severity.WARNING,
      message: 'Missing bleed information in the PDF.',
      details:
        'The document lacks explicit bleed box information. ' +
        'For professional printing, ensure proper bleed settings (typically 3mm on all edges).',
      bbox: { x: 0, y: 0, width: 1, height: 1 },
    });
  }

  // Sangrado insuficiente
  if (insufficientBleed) {
    issues.push({
      id: 'insufficient-bleed',
      page: insufficientBleedPage || 1,
      category: ISSUE_CATEGORY.BLEED_MARGINS,
      severity: Severity.WARNING,
      message: 'Insufficient bleed margins detected.',
      details:
        'The document has bleed margins smaller than the recommended 3mm. ' +
        'This may result in white edges after trimming.',
      bbox: { x: 0, y: 0, width: 1, height: 1 },
    });
  }

  // Fuentes Type3
  if (type3Fonts.size > 0) {
    issues.push({
      id: 'type3-fonts-present',
      page: 1,
      category: ISSUE_CATEGORY.FONTS,
      severity: Severity.WARNING,
      message: 'Type 3 fonts detected in the document.',
      details:
        'Type 3 fonts can render unpredictably on some RIPs and are generally discouraged. ' +
        `Fonts: ${Array.from(type3Fonts).join(', ')}.`,
      bbox: { x: 0, y: 0, width: 1, height: 1 },
    });
  }

  // Resumen de fuentes usadas (INFO)
  if (fontsUsed.size > 0) {
    const fontNames = Array.from(fontsUsed.keys());
    const subsetFonts = fontNames.filter(
      (name) => fontsUsed.get(name)?.subset
    );

    issues.push({
      id: 'fonts-used-summary',
      page: 1,
      category: ISSUE_CATEGORY.FONTS,
      severity: Severity.INFO,
      message: `Fonts used in the document: ${fontNames.join(', ')}`,
      details:
        'This is a summary of the font families detected on sampled pages. ' +
        (subsetFonts.length
          ? `Some fonts appear as subsetted: ${subsetFonts.join(
            ', '
          )}. Subsetting is normal for print PDFs but makes later editing harder.`
          : 'No subset prefixes (ABCDEF+FontName) were detected, so these fonts are probably embedded as full fonts.'),
      bbox: { x: 0, y: 0, width: 1, height: 1 },
    });
  }

  // Texto demasiado pequeño (legibilidad)
  if (tinyTextChunks > 0) {
    const minRounded = isFinite(minFontPt) ? Math.round(minFontPt * 10) / 10 : null;

    issues.push({
      id: 'text-too-small',
      page: firstTinyTextPage || minFontPage || 1,
      category: ISSUE_CATEGORY.FONTS,
      severity: Severity.WARNING,
      message: 'Very small text detected (below 6 pt).',
      details:
        `The preflight detected ${tinyTextChunks} text runs with a size below 6 pt on sampled pages. ` +
        (minRounded
          ? `The smallest estimated text size is around ${minRounded} pt (page ${firstTinyTextPage ?? minFontPage
          }). `
          : '') +
        'Text below 6 pt is usually too small for comfortable reading in offset printing; ' +
        'consider increasing font size for body text and critical information.',
      bbox: { x: 0, y: 0, width: 1, height: 1 },
    });
  } else if (smallTextChunks > 0) {
    const minRounded = isFinite(minFontPt) ? Math.round(minFontPt * 10) / 10 : null;

    issues.push({
      id: 'text-small',
      page: firstSmallTextPage || minFontPage || 1,
      category: ISSUE_CATEGORY.FONTS,
      severity: Severity.INFO,
      message: 'Small text detected (around 6–8 pt).',
      details:
        `The preflight detected ${smallTextChunks} text runs between approximately 6 and 8 pt. ` +
        (minRounded
          ? `The smallest estimated text size is around ${minRounded} pt (page ${firstSmallTextPage ?? minFontPage
          }). `
          : '') +
        'This size can work for footnotes or legal text, but may be too small for long reading or low-contrast combinations.',
      bbox: { x: 0, y: 0, width: 1, height: 1 },
    });
  }

  // --------- PACK TODOS: color avanzado + trazos ---------

  // Mezcla de espacios de color (RGB / CMYK / Gray)
  if (hasRGB && hasCMYK) {
    issues.push({
      id: 'mixed-rgb-cmyk',
      page: firstColorPage || 1,
      category: ISSUE_CATEGORY.COLOR,
      severity: Severity.WARNING,
      message: 'Mixed RGB and CMYK content detected.',
      details:
        'The document appears to use both RGB and CMYK color operators. ' +
        'For predictable offset printing, it is recommended to export a CMYK-only PDF or a PDF/X-compliant file.',
      bbox: { x: 0, y: 0, width: 1, height: 1 },
    });
  } else if (hasRGB && !hasCMYK) {
    issues.push({
      id: 'rgb-only-content',
      page: firstColorPage || 1,
      category: ISSUE_CATEGORY.COLOR,
      severity: Severity.INFO,
      message: 'RGB color space detected.',
      details:
        'The document uses RGB color operators. ' +
        'This is usually fine for digital viewing and POD workflows, but traditional offset presses expect CMYK data.',
      bbox: { x: 0, y: 0, width: 1, height: 1 },
    });
  } else if (hasCMYK && !hasRGB && !hasGray) {
    issues.push({
      id: 'cmyk-only-content',
      page: 1,
      category: ISSUE_CATEGORY.COLOR,
      severity: Severity.INFO,
      message: 'CMYK-only content detected in sampled pages.',
      details:
        'Only CMYK color operators were detected on sampled pages. ' +
        'This is ideal for traditional offset printing workflows.',
      bbox: { x: 0, y: 0, width: 1, height: 1 },
    });
  } else if (!hasRGB && !hasCMYK && hasGray) {
    issues.push({
      id: 'grayscale-only-content',
      page: 1,
      category: ISSUE_CATEGORY.COLOR,
      severity: Severity.INFO,
      message: 'Grayscale-only content detected in sampled pages.',
      details:
        'Only grayscale operators were detected. ' +
        'This suggests a purely black & white job, which is optimal for economical book interiors.',
      bbox: { x: 0, y: 0, width: 1, height: 1 },
    });
  }

  // Hairlines (trazos demasiado finos)
  if (hairlineStrokes > 0) {
    issues.push({
      id: 'hairline-strokes',
      page: firstHairlinePage || 1,
      category: ISSUE_CATEGORY.IMAGES,
      severity: Severity.WARNING,
      message: 'Very thin strokes (hairlines) detected.',
      details:
        `${hairlineStrokes} stroke(s) with a width of less than 0.25 points were found. ` +
        'Such thin lines may not print correctly on certain devices or may disappear entirely. ' +
        'Consider increasing stroke width to at least 0.25pt for reliable output.',
      bbox: { x: 0, y: 0, width: 1, height: 1 },
    });
  }

  // Overprint
  if (overprintOps > 0) {
    issues.push({
      id: 'overprint-detected',
      page: firstOverprintPage || 1,
      category: ISSUE_CATEGORY.COLOR,
      severity: Severity.INFO,
      message: 'Overprint settings detected in the document.',
      details:
        'The engine detected graphics state settings with overprint enabled (OP/op). ' +
        'Overprint can be intentional (for registration marks or rich black) but may also hide knockouts. ' +
        'Review critical text and small objects in a separations preview before sending to print.',
      bbox: { x: 0, y: 0, width: 1, height: 1 },
    });
  }

  // --------- Generación de resultados (PACK B) ---------

  // Imágenes de baja resolución
  if (lowResImages > 0) {
    const worstRounded = isFinite(worstImageDpi)
      ? Math.round(worstImageDpi)
      : null;

    issues.push({
      id: 'low-resolution-images',
      page: firstLowResPage || worstImagePage || 1,
      category: ISSUE_CATEGORY.IMAGES,
      severity: Severity.WARNING,
      message: `${lowResImages} low-resolution image(s) detected in sampled pages.`,
      details:
        'Some images in this document appear to have a resolution below 150 DPI at their printed size. ' +
        (worstRounded
          ? `The lowest estimated resolution is around ${worstRounded} DPI (page ${worstImagePage ?? firstLowResPage}). `
          : '') +
        'For professional printing, images should typically be at least 300 DPI at their final printed size.',
      bbox: { x: 0, y: 0, width: 1, height: 1 },
    });
  }

  // Si quieres, añadimos también un INFO cuando no hay imágenes
  if (imageCount === 0) {
    issues.push({
      id: 'no-images-detected',
      page: 1,
      category: ISSUE_CATEGORY.IMAGES,
      severity: Severity.INFO,
      message: 'No bitmap images detected in sampled pages.',
      details:
        'The engine did not detect any painted bitmap images (XObjects) in sampled pages. ' +
        'This is common for text-only interiors.',
      bbox: { x: 0, y: 0, width: 1, height: 1 },
    });
  }

  // Anotaciones y comentarios
  if (hasAnnotations) {
    issues.push({
      id: 'annotations-present',
      page: firstAnnotationPage || 1,
      category: ISSUE_CATEGORY.ANNOTATIONS,
      severity: Severity.WARNING,
      message: 'Annotations or comments detected in the document.',
      details:
        'This document contains annotations that may be visible in the final output. ' +
        'Consider removing or flattening annotations before printing.',
      bbox: { x: 0, y: 0, width: 1, height: 1 },
    });
  }

  // Campos de formulario
  if (hasFormFields) {
    issues.push({
      id: 'form-fields-present',
      page: firstFormPage || 1,
      category: ISSUE_CATEGORY.FORM_FIELDS,
      severity: Severity.WARNING,
      message: 'Form fields detected in the document.',
      details:
        'This document contains form fields that may not print as expected. ' +
        'Consider flattening form fields before printing.',
      bbox: { x: 0, y: 0, width: 1, height: 1 },
    });
  }

  // Contenido multimedia
  if (hasMultimedia) {
    issues.push({
      id: 'multimedia-content',
      page: firstMultimediaPage || 1,
      category: ISSUE_CATEGORY.MULTIMEDIA,
      severity: Severity.ERROR,
      message: 'Multimedia content detected in the document.',
      details:
        'This document contains multimedia elements (video, audio, 3D) that cannot be printed. ' +
        'Remove or replace these elements with static representations.',
      bbox: { x: 0, y: 0, width: 1, height: 1 },
    });
  }

  // Capas (OCG)
  if (hasLayers) {
    issues.push({
      id: 'layers-detected',
      page: 1,
      category: ISSUE_CATEGORY.LAYERS,
      severity: Severity.INFO,
      message: 'Layers (Optional Content Groups) detected in the document.',
      details:
        'This document contains layers that may affect how content is displayed or printed. ' +
        'Ensure that all necessary layers are visible before printing.',
      bbox: { x: 0, y: 0, width: 1, height: 1 },
    });
  }

  // Archivo muy grande
  const sizeMB = fileMeta.size / (1024 * 1024);
  if (sizeMB > 150) {
    issues.push({
      id: 'very-large-file',
      page: 1,
      category: ISSUE_CATEGORY.METADATA,
      severity: Severity.WARNING,
      message: `PDF file size is very large (${sizeMB.toFixed(1)} MB).`,
      details:
        'Very large PDFs can be slow to upload, process and impose. ' +
        'Consider optimizing images and flattening unnecessary layers.',
      bbox: { x: 0, y: 0, width: 1, height: 1 },
    });
  }

  // --------- Resultado final ---------
  return buildResult(issues, pageCount, fileMeta);
}

/* =========================
   Listener del worker – ampliado
   ========================= */

self.addEventListener('message', async (event: MessageEvent) => {
  const msg = event.data as Inbound;
  if (!msg) return;

  try {
    if (msg.type === 'analyze') {
      post({
        type: 'analysisProgress',
        progress: 0.05,
        note: 'Loading PDF in worker...',
      });

      const result = await analyzePdf(msg.buffer, msg.fileMeta);
      post({ type: 'analysisResult', result });
      return;
    }

    if (msg.type === 'convertToGrayscale') {
      const out = await convertPdfToGrayscale(msg.buffer, msg.fileMeta);
      post({
        type: 'transformResult',
        operation: 'grayscale',
        buffer: out.buffer,
        fileMeta: out.fileMeta,
      });
      return;
    }

    if (msg.type === 'upscaleLowResImages') {
      const out = await upscalePdf(
        msg.buffer,
        msg.fileMeta,
        msg.minDpi ?? 150
      );
      post({
        type: 'transformResult',
        operation: 'upscaleImages',
        buffer: out.buffer,
        fileMeta: out.fileMeta,
      });
      return;
    }

    if (msg.type === 'fixBleed') {
      const out = await addBleed(msg.buffer, msg.fileMeta);
      post({
        type: 'transformResult',
        operation: 'fixBleed',
        buffer: out.buffer,
        fileMeta: out.fileMeta,
      });
      return;
    }

  } catch (err: any) {
    console.error('Preflight worker fatal error', err);

    if (msg.type === 'analyze') {
      post({
        type: 'analysisError',
        message: err?.message || String(err),
      });
    } else {
      post({
        type: 'transformError',
        operation:
          msg.type === 'convertToGrayscale' ? 'grayscale' :
            msg.type === 'upscaleLowResImages' ? 'upscaleImages' : 'fixBleed',
        message: err?.message || String(err),
      });
    }
  }
});

export { };
