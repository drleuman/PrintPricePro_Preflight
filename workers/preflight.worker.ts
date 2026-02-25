/// <reference lib="webworker" />

import * as pdfjsLib from 'pdfjs-dist';
// Use fixed worker path to avoid cache issues after deployments
// import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

import {
  PDFDocument,
  PDFName,
  pushGraphicsState,
  popGraphicsState,
  concatTransformationMatrix,
} from 'pdf-lib';

import {
  Severity,
  ISSUE_CATEGORY,
  type Issue,
  type IssueCategory,
  type PreflightResult,
  type FileMeta,
  type PreflightWorkerMessage,
  type CategorySummary,
} from '../types';

import { validateGeometry } from '../utils/geometry';
import { validateImposition } from '../utils/imposition_validation';
import { validateSubstrate } from '../utils/substrate';
import { analyzeInkOptimization, type PageInkStats } from '../utils/inkOptimization';
import { inferEditionIntent, type EditionSignals } from '../utils/editionIntent';

// Array con todos los valores del enum ISSUE_CATEGORY
const ISSUE_CATEGORYValues: IssueCategory[] =
  Object.values(ISSUE_CATEGORY) as IssueCategory[];

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

(pdfjsLib as any).GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';

type AnalyzeCmd = {
  type: 'analyze';
  fileMeta: FileMeta;
  buffer: ArrayBuffer;
  config?: {
    paperType?: 'coated' | 'uncoated';
    paperGsm?: number;
    trimWidthMm?: number;
    trimHeightMm?: number;
    bleedMm?: number;
  };
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
  mode?: 'safe' | 'aggressive';
};

type TacHeatmapCmd = {
  type: 'tacHeatmap';
  fileMeta: FileMeta;
  buffer: ArrayBuffer;
  pageIndex?: number;
};

type RenderPageAsImageCmd = {
  type: 'renderPageAsImage';
  fileMeta: FileMeta;
  buffer: ArrayBuffer;
  pageIndex: number;
};

type Inbound = AnalyzeCmd | ConvertToGrayscaleCmd | UpscaleLowResImagesCmd | FixBleedCmd | TacHeatmapCmd | RenderPageAsImageCmd;

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
  }
  | { type: 'renderPageResult'; base64: string }
  | { type: 'renderError'; message: string }
  | {
    type: 'tacHeatmapResult';
    pageIndex: number;
    width: number;
    height: number;
    values: Uint8Array;
    maxTac: number;
  }
  | { type: 'tacHeatmapError'; message: string };

function post(msg: Outbound) {
  (self as unknown as Worker).postMessage(msg as PreflightWorkerMessage);
}

// 4) TAC Heatmap Analysis
async function generateTacHeatmap(
  buffer: ArrayBuffer,
  pageIndex: number = 1 // 1-based
): Promise<void> {
  const uint8 = new Uint8Array(buffer);
  const loadingTask = (pdfjsLib as any).getDocument({
    data: uint8,
    disableWorker: true,
    cMapUrl: 'https://unpkg.com/pdfjs-dist@4.6.82/cmaps/',
    cMapPacked: true,
  });
  const pdf = await loadingTask.promise;

  if (pageIndex < 1 || pageIndex > pdf.numPages) {
    throw new Error(`Page ${pageIndex} out of range (1-${pdf.numPages})`);
  }

  const page = await pdf.getPage(pageIndex);
  const viewportRaw = page.getViewport({ scale: 1.0 });
  const scale = 150 / viewportRaw.width;
  const { canvas, viewport } = await renderPageToCanvas(page, scale);

  const ctx = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D;
  const { width, height } = canvas;
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;

  const heatmapValues = new Uint8Array(width * height);
  let maxTacFound = 0;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i] / 255;
    const g = data[i + 1] / 255;
    const b = data[i + 2] / 255;
    const a = data[i + 3] / 255;

    const r_vis = r * a + (1 - a);
    const g_vis = g * a + (1 - a);
    const b_vis = b * a + (1 - a);

    const k = 1 - Math.max(r_vis, g_vis, b_vis);
    let c = 0, m = 0, y = 0;

    if (k < 1) {
      c = (1 - r_vis - k) / (1 - k);
      m = (1 - g_vis - k) / (1 - k);
      y = (1 - b_vis - k) / (1 - k);
    }

    const totalInk = (c + m + y + k) * 400;
    const tac = Math.round(totalInk);
    maxTacFound = Math.max(maxTacFound, tac);
    heatmapValues[i / 4] = Math.min(255, (tac * 255) / 400);
  }

  post({
    type: 'tacHeatmapResult',
    pageIndex,
    width,
    height,
    values: heatmapValues,
    maxTac: maxTacFound,
  });
}

/**
 * Perform raster sampling for ink efficiency analysis
 */
async function samplePageInk(page: any): Promise<PageInkStats> {
  const viewportRaw = page.getViewport({ scale: 1.0 });
  // Sampling at a fixed width for performance (approx 150px)
  const scale = 150 / viewportRaw.width;
  const { canvas } = await renderPageToCanvas(page, scale);
  const ctx = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D;
  const { width, height } = canvas;
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;

  let totalTac = 0;
  let peakTac = 0;
  let heavyBgPixels = 0;
  let colorPixels = 0;
  let richBlackPixels = 0;
  const totalPixels = width * height;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i] / 255;
    const g = data[i + 1] / 255;
    const b = data[i + 2] / 255;
    const a = data[i + 3] / 255;

    // Blend with white background
    const r_vis = r * a + (1 - a);
    const g_vis = g * a + (1 - a);
    const b_vis = b * a + (1 - a);

    // Naive CMYK conversion
    const k = 1 - Math.max(r_vis, g_vis, b_vis);
    let c = 0, m = 0, y = 0;
    if (k < 1) {
      c = (1 - r_vis - k) / (1 - k);
      m = (1 - g_vis - k) / (1 - k);
      y = (1 - b_vis - k) / (1 - k);
    }

    const tac = (c + m + y + k) * 400;
    totalTac += tac;
    if (tac > peakTac) peakTac = tac;
    if (tac > 180) heavyBgPixels++;

    // Color detection
    const chroma = Math.max(c, m, y) - Math.min(c, m, y);
    if (chroma > 0.1) colorPixels++;

    // Rich Black detection: C+M+Y significant and K > 0.8
    if (k > 0.8 && (c + m + y) > 0.3) richBlackPixels++;
  }

  const avgCoverage = totalTac / totalPixels;

  return {
    pageIndex: page.pageNumber,
    avgCoverage,
    peakTac,
    heavyBackgroundArea: (heavyBgPixels / totalPixels) * 100,
    isGrayscale: (colorPixels / totalPixels) < 0.01,
    richBlackArea: (richBlackPixels / totalPixels) * 100,
    isPhotoHeavy: avgCoverage > 80 && (heavyBgPixels / totalPixels) > 0.4,
    isLowInk: avgCoverage < 5,
  };
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
  const isClose = (a: number, b: number, tol = 3) => Math.abs(a - b) < tol;

  if (isClose(w, 148) && isClose(h, 210)) return 'A5';
  if (isClose(w, 170) && isClose(h, 240)) return '170 × 240 mm';
  if (w >= 168 && w <= 190 && h >= 238 && h <= 265)
    return '170 × 240 mm (detected w/ crops)';

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

  return { buffer: sliced as ArrayBuffer, fileMeta: newMeta };
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

  return { buffer: sliced as ArrayBuffer, fileMeta: newMeta };
}

// 3) Añadir sangrado (bleed) a un PDF (V3 Non-Destructive RIP-style)
async function addBleed(
  buffer: ArrayBuffer,
  fileMeta: FileMeta,
  bleedMm: number = 3,
  mode: 'safe' | 'aggressive' = 'safe'
): Promise<{ buffer: ArrayBuffer; fileMeta: FileMeta }> {
  const srcDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
  const pages = srcDoc.getPages();
  const bleedPt = (bleedMm * 72) / 25.4;

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    const { width, height } = page.getSize();

    const sx = (width + 2 * bleedPt) / width;
    const sy = (height + 2 * bleedPt) / height;
    const s = Math.max(sx, sy);

    const tx = ((1 - s) * width) / 2;
    const ty = ((1 - s) * height) / 2;

    // Safe prepending of operators for RIP-style scaling (Industrial V3)
    // In pdf-lib v1.17+, prependOperators IS a method.
    // We check for it and if missing (weird builds), we use a robust manual approach.
    const ops = [
      pushGraphicsState(),
      concatTransformationMatrix(s, 0, 0, s, tx, ty)
    ];

    if (typeof (page as any).prependOperators === 'function') {
      (page as any).prependOperators(...ops);
    } else {
      // Robust fallback: manually insert into content streams
      try {
        const doc = (page as any).doc || srcDoc;
        const contentsKey = PDFName.of('Contents');
        const contents = (page as any).node.get(contentsKey);
        const newStream = doc.context.register(
          doc.context.flateStream(ops.map(o => (o as any).toString()).join(' '))
        );

        if (Array.isArray(contents)) {
          (page as any).node.set(contentsKey, doc.context.obj([newStream, ...contents]));
        } else if (contents) {
          (page as any).node.set(contentsKey, doc.context.obj([newStream, contents]));
        } else {
          // Absolute fallback
          (page as any).pushOperators(...ops);
        }
      } catch (e) {
        // Last resort
        (page as any).pushOperators(...ops);
      }
    }
    page.pushOperators(popGraphicsState());

    page.setTrimBox(0, 0, width, height);

    const newX = -bleedPt;
    const newY = -bleedPt;
    const newW = width + 2 * bleedPt;
    const newH = height + 2 * bleedPt;

    page.setBleedBox(newX, newY, newW, newH);
    page.setMediaBox(newX, newY, newW, newH);
    page.setCropBox(newX, newY, newW, newH);

    post({
      type: 'analysisProgress',
      progress: ((i + 1) / pages.length) * 100,
      note: `Applying RIP-style bleed P${i + 1} (s:${s.toFixed(4)})`,
    });
  }

  const outBytes = await srcDoc.save();
  const sliced = outBytes.buffer.slice(
    outBytes.byteOffset,
    outBytes.byteOffset + outBytes.byteLength
  );

  const newMeta: FileMeta = {
    ...fileMeta,
    name:
      fileMeta.name.replace(/\.pdf$/i, '') + `_bleed_${bleedMm}mm_v3.pdf`,
    size: outBytes.byteLength,
  };

  return { buffer: sliced as ArrayBuffer, fileMeta: newMeta };
}

function buildResult(
  issues: Issue[],
  pageCount: number,
  fileMeta: FileMeta,
  productionReport?: any
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
    IssueCategory,
    { errors: number; warnings: number; info: number }
  >();

  for (const it of issues) {
    const cat = it.category ?? ISSUE_CATEGORY.METADATA;
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
    productionReport
  };
}

/* =========================
   Análisis real con pdfjs (PACK A + B + TODOS) – ORIGINAL
   ========================= */

async function analyzePdf(
  buffer: ArrayBuffer,
  fileMeta: FileMeta,
  config?: AnalyzeCmd['config']
): Promise<PreflightResult> {
  const issues: Issue[] = [];

  // Clone buffer to avoid "detached ArrayBuffer" if pdfjs consumes it
  const bufferCopy = buffer.slice(0);
  const uint8 = new Uint8Array(buffer);
  const loadingTask = (pdfjsLib as any).getDocument({
    data: uint8,
    disableWorker: true,
    cMapUrl: 'https://unpkg.com/pdfjs-dist@4.6.82/cmaps/',
    cMapPacked: true,
  });
  const pdf = await loadingTask.promise;

  const pageCount = pdf.numPages;

  // Carga paralela con pdf-lib para metadatos fiables (Cajas)
  let pdfLibDoc: PDFDocument | null = null;
  try {
    // Use the copy here
    pdfLibDoc = await PDFDocument.load(bufferCopy, { ignoreEncryption: true });
  } catch (e) {
    console.warn('pdf-lib load failed in analyze', e);
  }

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
  let hasAsymmetricBleed = false;

  let firstRotation = 0;
  let hasMixedRotations = false;
  let portraitPages = 0;
  let landscapePages = 0;

  const type3Fonts = new Set<string>();

  const fontsUsed = new Map<
    string,
    { subset: boolean; type3: boolean; embedded: boolean }
  >();
  let missingEmbeds = 0;

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

  // Black Overprint Detectors
  let blackTextKnockoutCount = 0;
  let firstBlackTextKnockoutPage: number | null = null;
  let registrationUsageCount = 0;
  let firstRegistrationPage: number | null = null;
  let richBlackTextCount = 0;
  let firstRichBlackTextPage: number | null = null;

  // Spot Color Detectors
  const spotNamesUsed = new Set<string>();
  const pageSpotsMap = new Map<number, Set<string>>();
  let spotsInTextDetected = false;

  // Overprint
  let overprintOps = 0;
  let firstOverprintPage: number | null = null;

  const pdfPageSizes: { widthMm: number; heightMm: number }[] = [];
  // --------- Acumuladores PACK C (Edition Intent) ---------
  let totalRichBlackPages = 0;
  let totalGrayscalePages = 0;
  let totalPhotoHeavyPages = 0;
  let totalLowInkPages = 0;
  let totalHeavyBgPages = 0;
  let totalMarksDetected = 0;
  let totalDpiValues: number[] = [];
  let imageFilters = new Set<string>();
  let hasSmallReversedTextOverall = false;
  let hasKnockoutBlackTextOverall = false;

  const allPageInkStats: PageInkStats[] = [];


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

    // --- Ink Savings measurement (Raster sampling) ---
    try {
      const inkStat = await samplePageInk(page);
      allPageInkStats.push(inkStat);
    } catch (e) {
      console.warn(`Ink sampling failed for page ${pageIndex}`, e);
    }

    // --- Tamaño de página básico (viewport) ---
    const viewport = page.getViewport({ scale: 1 });
    const width = viewport.width;
    const height = viewport.height;
    const rotation = viewport.rotation;

    pdfPageSizes.push({ widthMm: mmFromPt(width), heightMm: mmFromPt(height) });

    if (pageIndex === 1) {
      firstWidth = width;
      firstHeight = height;
      firstRotation = rotation;
    } else {
      if (Math.abs(width - firstWidth) > 1 || Math.abs(height - firstHeight) > 1) {
        hasMixedSizes = true;
      }
      if (rotation !== firstRotation) {
        hasMixedRotations = true;
      }
    }

    if (width > height) landscapePages++;
    else portraitPages++;

    // --- Cajas PDF: MediaBox / TrimBox / BleedBox ---
    const libPage = pdfLibDoc ? pdfLibDoc.getPage(pageIndex - 1) : null;

    if (libPage) {
      // --- Checks con PDF-LIB (Robusto) ---
      try {
        const mediaBox = libPage.getMediaBox();
        const trimBox = libPage.getTrimBox();
        const bleedBox = libPage.getBleedBox();

        // Lógica: Si la diferencia entre BleedBox y TrimBox es ~0, falta bleed definido.
        const bleedLeft = trimBox.x - bleedBox.x;
        const bleedBottom = trimBox.y - bleedBox.y;
        const bleedRight = (bleedBox.x + bleedBox.width) - (trimBox.x + trimBox.width);
        const bleedTop = (bleedBox.y + bleedBox.height) - (trimBox.y + trimBox.height);

        // Detect asymmetry
        const bleedVals = [bleedLeft, bleedBottom, bleedRight, bleedTop];
        const minB = Math.min(...bleedVals);
        const maxB = Math.max(...bleedVals);
        if (maxB - minB > 1) { // More than 1pt difference
          hasAsymmetricBleed = true;
        }

        const isZero = (n: number) => Math.abs(n) < 0.1;
        const noBleedDefined = isZero(bleedLeft) && isZero(bleedBottom) && isZero(bleedRight) && isZero(bleedTop);

        if (noBleedDefined) {
          missingBleedInfo = true;
          if (missingBleedPage === null) missingBleedPage = pageIndex;
        } else {
          // Check if bleed is insufficient (< 3mm)
          // Nota: TrimBox y BleedBox en pdf-lib ya están normalizados en puntos? Si.
          const minBleedMm = Math.min(
            mmFromPt(bleedLeft),
            mmFromPt(bleedBottom),
            mmFromPt(bleedRight),
            mmFromPt(bleedTop)
          );
          if (minBleedMm < 2.9) {
            insufficientBleed = true;
            if (insufficientBleedPage === null) insufficientBleedPage = pageIndex;
          }
        }
      } catch (e) {
        console.warn('pdf-lib box check error', e);
      }

    } else {
      // --- Checks con PDF.JS (Fallback legacy) ---
      try {
        const raw = page as any;
        const info = raw.pageInfo || raw._pageInfo;
        // pdfjs usually doesn't expose clean trimBox/bleedBox here
        const trimBox = info?.trimBox;
        const bleedBox = info?.bleedBox;

        if (!trimBox || !bleedBox) {
          missingBleedInfo = true;
          if (missingBleedPage === null) missingBleedPage = pageIndex;
        }
      } catch { }
    }
    // No rompemos si la introspección interna falla


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

          const isEmbedded = !!(data?.fileHeader || (font as any).isEmbedded);
          if (!isEmbedded) missingEmbeds++;

          // Guardamos info agregada por fuente
          const existing = fontsUsed.get(baseName) || {
            subset: false,
            type3: false,
            embedded: true,
          };
          fontsUsed.set(baseName, {
            subset: existing.subset || subset,
            type3: existing.type3 || !!isType3,
            embedded: existing.embedded && isEmbedded,
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

      let currentFillOverprint = false;
      let currentStrokeOverprint = false;
      let currentFontSize = 0;
      let currentFillIsKOnly = false;
      let currentFillIsRegistration = false;
      let currentFillIsRichBlack = false;
      let currentFillIsSpot = false;
      const currentFillSpotNames: string[] = [];

      const textOps = new Set<number>();
      if (OPS.showText != null) textOps.add(OPS.showText);
      if (OPS.showTextWithPositioning != null) textOps.add(OPS.showTextWithPositioning);
      if (OPS.nextLineShowText != null) textOps.add(OPS.nextLineShowText);
      if (OPS.nextLineSetSpacingShowText != null) textOps.add(OPS.nextLineSetSpacingShowText);

      // Access page resources for ExtGState resolution
      const objs = (page as any).objs;

      for (let i = 0; i < fnArray.length; i++) {
        const fn = fnArray[i];
        const args = argsArray[i];

        // --- Overprint Tracking (with ExtGState resolution) ---
        if (fn === OPS.setGState && args && args.length > 0) {
          const gStateKey = args[0];
          let gState = null;

          if (typeof gStateKey === 'string' && objs) {
            gState = objs.get(gStateKey);
          } else if (typeof gStateKey === 'object') {
            gState = gStateKey;
          }

          if (gState) {
            // Track fill/stroke overprint specifically
            if (gState.op !== undefined) currentFillOverprint = !!gState.op;
            if (gState.OP !== undefined) currentStrokeOverprint = !!gState.OP;
            if (gState.OPM !== undefined && gState.OPM === 1) currentFillOverprint = true;
          }
        }

        // Direct toggle operators (some creators use these instead of ExtGState)
        if (OPS.setOverprint !== undefined && fn === OPS.setOverprint) {
          currentFillOverprint = !!args[0];
          currentStrokeOverprint = !!args[0];
        }

        // --- Font Size Tracking ---
        if (fn === OPS.setFont && args && args.length >= 2) {
          currentFontSize = Math.abs(args[1] || 0);
        }

        // --- Color Tracking: Refined tolerances ---
        if (fn === OPS.setFillCMYKColor && args && args.length >= 4) {
          const [c, m, y, k] = args;
          // K-only tolerance: very low C,M,Y contribution, very high K
          currentFillIsKOnly = (c < 0.02 && m < 0.02 && y < 0.02 && k > 0.98);
          // Rich black: significantly contributes to all channels
          currentFillIsRichBlack = (k > 0.2 && (c > 0.1 || m > 0.1 || y > 0.1));
          currentFillIsRegistration = false;
          currentFillIsSpot = false;
        } else if (fn === OPS.setFillRGBColor && args && args.length >= 3) {
          const [r, g, b] = args;
          currentFillIsKOnly = false;
          currentFillIsRichBlack = (r < 0.05 && g < 0.05 && b < 0.05);
          currentFillIsRegistration = false;
          currentFillIsSpot = false;
        } else if (fn === OPS.setFillGray && args && args.length >= 1) {
          currentFillIsKOnly = (args[0] < 0.02); // Gray 0 is Black
          currentFillIsRichBlack = false;
          currentFillIsRegistration = false;
          currentFillIsSpot = false;
        } else if ((fn === OPS.setFillColorSpace || fn === OPS.setStrokeColorSpace) && args && args.length > 0) {
          // Detect Registration (multi-name aware) and Spots
          const space = Array.isArray(args[0]) ? args[0][0] : args[0];
          if (space === 'Separation' || space === 'DeviceN') {
            const details = Array.isArray(args[0]) ? args[0] : [];

            const detectedNames: string[] = [];
            if (space === 'Separation' && details.length >= 2) {
              detectedNames.push(String(details[1]));
            } else if (space === 'DeviceN' && Array.isArray(details[1])) {
              details[1].forEach((n: any) => detectedNames.push(String(n)));
            }

            const isReg = detectedNames.some((n: string) => {
              const str = n.toLowerCase();
              return str === 'all' || str === 'registration';
            });

            if (fn === OPS.setFillColorSpace) {
              currentFillIsRegistration = isReg;
              currentFillIsSpot = !isReg && detectedNames.length > 0;
              currentFillSpotNames.length = 0;
              if (currentFillIsSpot) {
                detectedNames.forEach(n => currentFillSpotNames.push(n));
              }
            }

            if (isReg) {
              registrationUsageCount++;
              if (firstRegistrationPage === null) firstRegistrationPage = pageIndex;
            } else {
              // Capture normalized spot names
              detectedNames.forEach(n => {
                const normalized = n.trim().replace(/\s+/g, ' ');
                spotNamesUsed.add(normalized);

                if (!pageSpotsMap.has(pageIndex)) pageSpotsMap.set(pageIndex, new Set());
                pageSpotsMap.get(pageIndex)!.add(normalized);
              });
            }
          } else {
            if (fn === OPS.setFillColorSpace) {
              currentFillIsSpot = false;
              currentFillIsRegistration = false;
              currentFillSpotNames.length = 0;
            }
          }
        }

        // --- Text Detection: Scenario Classifiers ---
        if (textOps.has(fn)) {
          // 1. Black Text Knockout: K-only body text, overprint OFF
          if (currentFillIsKOnly && !currentFillOverprint && currentFontSize > 0 && currentFontSize <= 12) {
            blackTextKnockoutCount++;
            if (firstBlackTextKnockoutPage === null) firstBlackTextKnockoutPage = pageIndex;
          }

          // 2. Rich Black Text: Small body text using CMYK builds (misregistration blur risk)
          if (currentFillIsRichBlack && currentFontSize > 0 && currentFontSize <= 12) {
            richBlackTextCount++;
            if (firstRichBlackTextPage === null) firstRichBlackTextPage = pageIndex;
          }

          // 3. Spots in text
          if (currentFillIsSpot) {
            spotsInTextDetected = true;
          }
        }

        // --- Original Transparency / Color analysis logic ---
        // --- Color spaces ---
        if (rgbOps.has(fn)) {
          // Check for Black/Gray masquerading as RGB (R=G=B)
          let isGrayLike = false;
          if (Array.isArray(args) && args.length >= 3) {
            const r = args[0];
            const g = args[1];
            const b = args[2];
            // Allow small floating point diffs? usually exact for generated PDF.
            if (Math.abs(r - g) < 0.001 && Math.abs(g - b) < 0.001) {
              isGrayLike = true;
            }
          }

          if (isGrayLike) {
            hasGray = true;
          } else {
            anyColorLikeOps = true;
            hasRGB = true;
            if (firstColorPage === null) firstColorPage = pageIndex;
          }
        }

        if (cmykOps.has(fn)) {
          hasCMYK = true;
        }

        if (grayOps.has(fn)) {
          hasGray = true;
        }

        // --- Transparencias ---
        if (transparencyOps.has(fn)) {
          // Default: don't flag unless proven transparent
          let isTransparent = false;

          if (fn === OPS.setAlphaConstant || fn === OPS.setFillAlpha || fn === OPS.setStrokeAlpha) {
            // args[0] is alpha usually
            const alpha = (Array.isArray(args) ? args[0] : args);
            if (typeof alpha === 'number' && alpha < 0.999) {
              isTransparent = true;
            }
          } else if (fn === OPS.setGState && args && args.length > 0) {
            // Already resolved gState above, but transparency logic might use different keys
            const gStateKey = args[0];
            let g = null;
            if (typeof gStateKey === 'string' && objs) g = objs.get(gStateKey);
            else if (typeof gStateKey === 'object') g = gStateKey;

            if (g) {
              // Check Alpha
              const ca = g.ca ?? g.CA ?? g.alpha ?? 1;
              const CA = g.CA ?? g.ca ?? 1; // sometimes distinct
              if (ca < 0.999 || CA < 0.999) isTransparent = true;

              // Check Blend Mode
              const bm = g.BM ?? g.bm ?? 'Normal';
              if (bm !== 'Normal' && bm !== 'Compatible') {
                isTransparent = true;
              }

              // Check Overprint (keep existing logic)
              const opFlag = g.op ?? g.OP ?? g.overprint;
              const opm = g.opm ?? g.overprintMode;
              if (opFlag === true || opm === 1) {
                overprintOps++;
                if (firstOverprintPage === null) {
                  firstOverprintPage = pageIndex;
                }
              }
            }
          } else {
            // If opaque op (setGState not resolved) - safer to assume NO transparency impact if hidden
          }

          if (isTransparent) {
            anyTransparencyOps = true;
            if (firstTransparencyPage === null) {
              firstTransparencyPage = pageIndex;
            }
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

        try {
          if (pdfLibDoc) {
            const libPage = pdfLibDoc.getPages()[pageIndex - 1];
            if (libPage) {
              const media = libPage.getMediaBox();
              const trim = libPage.getTrimBox() || libPage.getCropBox();
              // If media box is significantly larger than trim, marks are likely
              if (media.width > trim.width + 40 && media.height > trim.height + 40) {
                totalMarksDetected++;
              }
            }
          }
        } catch (e) { }

        // --- PACK C: DETALLES DE IMAGENES Y TEXTO ---
        if (objs) {
          // Heuristica para filtros de imagen
          objs.forEach((obj: any) => {
            if (obj && obj.filter) {
              const f = Array.isArray(obj.filter) ? obj.filter[0] : obj.filter;
              if (f && typeof f.name === 'string') imageFilters.add(f.name);
              else if (typeof f === 'string') imageFilters.add(f);
            }
          });
        }

        // --- PACK C: REVERSED TEXT HEURISTIC ---
        // (In operator loop, if we see small white text on dark background)
        // Simplified: track white text < 8pt
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
    const nonEmbedded = fontNames.filter(
      (name) => !fontsUsed.get(name)?.embedded
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
          ? `Some fonts appear as subsetted: ${subsetFonts.join(', ')}. `
          : '') +
        (nonEmbedded.length
          ? `WARNING: These fonts are NOT embedded: ${nonEmbedded.join(', ')}. This can lead to substitution errors during print.`
          : 'All fonts appear to be embedded (either full or subset).'),
      bbox: { x: 0, y: 0, width: 1, height: 1 },
    });

    if (nonEmbedded.length > 0) {
      issues.push({
        id: 'fonts-not-embedded',
        page: 1,
        category: ISSUE_CATEGORY.FONTS,
        severity: Severity.ERROR,
        message: 'Non-embedded fonts detected.',
        details: `The following fonts are not embedded in the PDF: ${nonEmbedded.join(', ')}. For professional printing, all fonts MUST be embedded to ensure visual consistency.`,
        tags: ['critical', 'error', 'font-embedding']
      });
    }
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

  // Black Text Knockout
  if (blackTextKnockoutCount > 0) {
    issues.push({
      id: 'black-text-knockout',
      page: firstBlackTextKnockoutPage || 1,
      category: ISSUE_CATEGORY.COLOR,
      severity: Severity.ERROR, // Blocking by default in most prepress
      message: 'Small black text set to knockout.',
      details:
        `Detected ${blackTextKnockoutCount} instance(s) of 100% K-only text (<= 12pt) with overprint OFF. ` +
        'This creates a knockout which can cause visible white halos or misregistration on press. ' +
        'Standard practice is to set small black text to overprint.',
      bbox: { x: 0, y: 0, width: 1, height: 1 },
      tags: ['critical', 'prepress', 'overprint']
    });
  }

  // Registration Color
  if (registrationUsageCount > 0) {
    issues.push({
      id: 'registration-color-used',
      page: firstRegistrationPage || 1,
      category: ISSUE_CATEGORY.COLOR,
      severity: Severity.ERROR,
      message: 'Registration color detected in artwork.',
      details:
        'Separation /All (Registration) was detected on sampled pages. ' +
        'Registration color (100% CMYK) is reserved only for printer marks. ' +
        'Using it in artwork causes extreme ink density and potential printing artifacts.',
      bbox: { x: 0, y: 0, width: 1, height: 1 },
      tags: ['critical', 'ink-limit', 'prepress']
    });
  }

  // Rich Black Text
  if (richBlackTextCount > 0) {
    issues.push({
      id: 'rich-black-text',
      page: firstRichBlackTextPage || 1,
      category: ISSUE_CATEGORY.COLOR,
      severity: Severity.WARNING,
      message: 'Small text using rich black.',
      details:
        `Small text (<= 12pt) was found using a rich black build (C+M+Y+K). ` +
        'While acceptable for larger display text, using rich black for small body text ' +
        'increases the risk of misregistration blurring.',
      bbox: { x: 0, y: 0, width: 1, height: 1 },
      tags: ['prepress', 'legibility']
    });
  }

  // Spot Colors
  if (spotNamesUsed.size > 0) {
    issues.push({
      id: 'spot-colors-detected',
      page: 1,
      category: ISSUE_CATEGORY.COLOR,
      severity: Severity.INFO,
      message: `${spotNamesUsed.size} spot color(s) detected.`,
      details: `Normalized spot names: ${Array.from(spotNamesUsed).join(', ')}.`,
      bbox: { x: 0, y: 0, width: 1, height: 1 },
      payload: {
        spot_names: Array.from(spotNamesUsed),
        page_spots: Object.fromEntries(
          Array.from(pageSpotsMap.entries()).map(([k, v]) => [k, Array.from(v)])
        ),
        spots_in_text: spotsInTextDetected
      }
    });

    if (spotsInTextDetected) {
      issues.push({
        id: 'spot-colors-in-text',
        page: 1,
        category: ISSUE_CATEGORY.COLOR,
        severity: Severity.WARNING, // Attention
        message: 'Spot colors detected in text objects.',
        details: 'Some text objects are using spot colors. If these spots are converted to CMYK, fine text details might become blurry or change appearance.',
        bbox: { x: 0, y: 0, width: 1, height: 1 }
      });
    }
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

  // --------- PRODUCTION GEOMETRY & COMPATIBILITY ---------
  const geometry = validateGeometry({
    pageCount,
    paperType: config?.paperType || 'coated',
    paperGsm: config?.paperGsm,
    trimWidthMm: config?.trimWidthMm || mmFromPt(firstWidth),
    trimHeightMm: config?.trimHeightMm || mmFromPt(firstHeight),
    bleedMm: config?.bleedMm || 3,
    pdfPageSizes
  });

  const imposition = validateImposition({
    hasMixedTrimSizes: hasMixedSizes,
    missingTrimBox: missingBleedInfo,
    hasMixedRotations: hasMixedRotations,
    hasAsymmetricBleed: hasAsymmetricBleed,
    hasZeroBleedPages: missingBleedInfo,
    hasLandscapeInPortrait: (portraitPages > 0 && landscapePages > 0)
  });

  const substrate = validateSubstrate({
    paperType: config?.paperType || 'coated',
    maxTac: worstImageDpi === Infinity ? 0 : 300, // Placeholder or estimate
    hasLargeRichBlacks: richBlackTextCount > 10,
    hasSmallReversedText: tinyTextChunks > 5,
    avgInkCoverage: 15, // Estimate
    hasHeavyOverprint: overprintOps > 20
  });

  // Add module issues to global list
  imposition.issues.forEach(iss => issues.push({
    ...iss,
    id: `imposition-${Math.random().toString(36).substr(2, 5)}`,
    page: 1,
    bbox: { x: 0, y: 0, width: 1, height: 1 }
  } as Issue));

  substrate.warnings.forEach(w => issues.push({
    id: `substrate-${Math.random().toString(36).substr(2, 5)}`,
    page: 1,
    category: ISSUE_CATEGORY.SUBSTRATE,
    severity: w.severity,
    message: w.message,
    tags: [w.type],
    bbox: { x: 0, y: 0, width: 1, height: 1 }
  }));

  // --------- INK SAVING & PRINT COST OPTIMIZATION ---------
  const inkOptimization = analyzeInkOptimization(allPageInkStats);
  inkOptimization.issues.forEach(iss => issues.push(iss));

  // --- EDITION INTENT DETECTION ---
  const editionSignals: EditionSignals = {
    avgTac: inkOptimization.totalCoverageAvg,
    richBlackFrequency: allPageInkStats.filter(s => s.richBlackArea > 5).length / sampleCount,
    grayscalePercentage: allPageInkStats.filter(s => s.isGrayscale).length / sampleCount,
    spotColorsCount: spotNamesUsed.size,
    hasLargeBackgrounds: allPageInkStats.some(s => s.heavyBackgroundArea > 30),
    hasConsistentBleed: !missingBleedInfo && !insufficientBleed,
    hasMarks: totalMarksDetected > 0,
    isPageUniform: !hasMixedSizes && !hasMixedRotations,
    dominantDpi: worstImageDpi === Infinity ? 0 : worstImageDpi, // simplified
    imageCompression: imageFilters.has('DCTDecode') ? 'JPEG' : (imageFilters.has('FlateDecode') ? 'ZIP' : 'MIXED'),
    photoCoverage: allPageInkStats.filter(s => s.isPhotoHeavy).length / sampleCount,
    hasSmallReversedText: hairlineStrokes > 5, // using hairlines as proxy for complex vector detail
    hasHairlines: hairlineStrokes > 0,
    hasKnockoutBlackText: richBlackTextCount > 0 && overprintOps < 5
  };

  const editionResult = inferEditionIntent(editionSignals, (config?.paperType || 'coated') as 'coated' | 'uncoated');

  const productionReport = {
    spine: geometry,
    imposition: {
      score: imposition.score,
      classification: imposition.classification
    },
    substrate: {
      warnings: substrate.warnings.map(w => w.message),
      riskLevel: substrate.riskLevel
    },
    inkOptimization: {
      score: inkOptimization.score,
      inkUsageIndex: inkOptimization.inkUsageIndex,
      costCategory: inkOptimization.costCategory,
      opportunities: inkOptimization.opportunities,
      totalCoverageAvg: inkOptimization.totalCoverageAvg
    },
    editionIntent: editionResult
  };

  // Add edition intent issue
  issues.push({
    id: 'print-edition-intent',
    page: 1,
    category: ISSUE_CATEGORY.PRINT_EDITION_INTENT,
    severity: Severity.INFO,
    message: `Detected Intent: ${editionResult.intent}`,
    details: `${editionResult.recommendation} (Confidence: ${Math.round(editionResult.confidence)}%)`
  });

  // --------- Resultado final ---------
  return buildResult(issues, pageCount, fileMeta, productionReport);
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

      const result = await analyzePdf(msg.buffer, msg.fileMeta, msg.config);
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
      const out = await addBleed(msg.buffer, msg.fileMeta, 3, msg.mode || 'safe');
      post({
        type: 'transformResult',
        operation: 'fixBleed',
        buffer: out.buffer,
        fileMeta: out.fileMeta,
      });
      return;
    }

    if (msg.type === 'tacHeatmap') {
      try {
        await generateTacHeatmap(msg.buffer, msg.pageIndex);
      } catch (e: any) {
        post({
          type: 'tacHeatmapError',
          message: e?.message || String(e),
        });
      }
      return;
    } else if (msg.type === 'renderPageAsImage') {
      try {
        const base64 = await renderPageAsImage(msg.buffer, msg.pageIndex);
        post({ type: 'renderPageResult', base64 });
      } catch (e: any) {
        post({ type: 'renderError', message: e?.message || String(e) });
      }
      return;
    }

  } catch (err: any) {
    console.error('Preflight worker fatal error', err);

    if (msg.type === 'analyze') {
      post({ type: 'analysisError', message: err?.message || String(err) });
    } else if (msg.type === 'tacHeatmap') {
      post({ type: 'tacHeatmapError', message: err?.message || String(err) });
    } else if (msg.type === 'renderPageAsImage') {
      post({ type: 'renderError', message: err?.message || String(err) });
    } else if (msg.type === 'convertToGrayscale') {
      post({ type: 'transformError', operation: 'grayscale', message: err?.message || String(err) });
    } else if (msg.type === 'upscaleLowResImages') {
      post({ type: 'transformError', operation: 'upscaleImages', message: err?.message || String(err) });
    } else if (msg.type === 'fixBleed') {
      post({ type: 'transformError', operation: 'fixBleed', message: err?.message || String(err) });
    }
  }
});

async function renderPageAsImage(buffer: ArrayBuffer, pageIndex: number): Promise<string> {
  const loadingTask = (pdfjsLib as any).getDocument({
    data: new Uint8Array(buffer),
    disableWorker: true,
    cMapUrl: 'https://unpkg.com/pdfjs-dist@4.6.82/cmaps/',
    cMapPacked: true,
  });
  const pdf = await loadingTask.promise;
  const page = await pdf.getPage(pageIndex);

  const viewport = page.getViewport({ scale: 1.5 }); // Good quality for Vision API
  // Use OffscreenCanvas if available, otherwise assume we are in an env where canvas works
  if (typeof OffscreenCanvas === 'undefined') {
    throw new Error('OffscreenCanvas is not available in this environment');
  }
  const canvas = new OffscreenCanvas(viewport.width, viewport.height);
  const ctx = canvas.getContext('2d');

  if (!ctx) throw new Error('Could not get 2D context');

  await page.render({ canvasContext: ctx as any, viewport }).promise;

  const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.8 });
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export { };
