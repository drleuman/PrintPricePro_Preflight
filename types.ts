/**
 * Severity levels for preflight issues.
 * 'info': Minor suggestion, good practice.
 * 'warning': Potential problem, might need attention.
 * 'error': Critical issue, must be fixed before printing.
 */
export enum Severity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
}

/**
 * Enum-like object containing all possible IssueCategory values.
 * This provides the runtime values and allows for type derivation.
 * Exported as 'const' to ensure it's available for Vite/Rollup to resolve
 * when imported in contexts like Web Workers.
 */
export const ISSUE_CATEGORY = {
  IMAGES: 'images',
  COLOR: 'color',
  FONTS: 'fonts',
  METADATA: 'metadata',
  TRANSPARENCY: 'transparency',
  BLEED_MARGINS: 'bleed_margins',
  RESOLUTION: 'resolution',
  COMPLIANCE: 'compliance',
  PAGE_SETUP: 'page_setup',
  ANNOTATIONS: 'annotations',
  FORM_FIELDS: 'form_fields',
  MULTIMEDIA: 'multimedia',
  LAYERS: 'layers',
  OTHER: 'other',
} as const;

// type IssueCategory = 'images' | 'color' | ... | 'other'
export type IssueCategory =
  (typeof ISSUE_CATEGORY)[keyof typeof ISSUE_CATEGORY];

/**
 * User-friendly labels for each issue category.
 * Uses the ISSUE_CATEGORY object keys for type safety.
 */
export const ISSUE_CATEGORY_LABELS: Record<IssueCategory, string> = {
  [ISSUE_CATEGORY.IMAGES]: 'Images',
  [ISSUE_CATEGORY.COLOR]: 'Color Spaces',
  [ISSUE_CATEGORY.FONTS]: 'Fonts',
  [ISSUE_CATEGORY.METADATA]: 'Metadata',
  [ISSUE_CATEGORY.TRANSPARENCY]: 'Transparency',
  [ISSUE_CATEGORY.BLEED_MARGINS]: 'Bleed & Margins',
  [ISSUE_CATEGORY.RESOLUTION]: 'Resolution',
  [ISSUE_CATEGORY.COMPLIANCE]: 'Compliance',
  [ISSUE_CATEGORY.PAGE_SETUP]: 'Page setup & size',
  [ISSUE_CATEGORY.ANNOTATIONS]: 'Annotations & comments',
  [ISSUE_CATEGORY.FORM_FIELDS]: 'Form fields',
  [ISSUE_CATEGORY.MULTIMEDIA]: 'Multimedia',
  [ISSUE_CATEGORY.LAYERS]: 'Layers / OCG',
  [ISSUE_CATEGORY.OTHER]: 'Other',
};

/**
 * Bounding box coordinates and dimensions.
 * Values are normalized (0 to 1) relative to page dimensions.
 */
export interface Bbox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Represents a single preflight issue found in the PDF.
 */
export interface Issue {
  id: string;
  page: number; // 1-based page number
  bbox?: Bbox; // Optional bounding box for visual indication
  severity: Severity;
  category: IssueCategory;
  message: string;
  details?: string; // More detailed explanation of the issue
  /**
   * Optional tags used internally to infer severity or classify issues.
   * Ej: ['critical', 'warn', 'low-res', 'font-embedding']
   */
  tags?: string[];
}

/**
 * Summary of a preflight check for a specific category.
 */
export interface CategorySummary {
  category: IssueCategory;
  errors: number;
  warnings: number;
  info: number;
}

/**
 * The overall result of a PDF preflight analysis.
 */
export interface PreflightResult {
  score: number; // Overall score (0-100), higher is better
  summary: string; // A brief overall summary of findings
  issues: Issue[];
  pages: Array<{ pageNumber: number; issuesCount: number }>;
  categorySummaries: CategorySummary[];
  meta: {
    fileName: string;
    fileSize: number;
    pageCount: number;
  };
}

/**
 * Metadata about the analyzed file.
 */
export interface FileMeta {
  name: string;
  size: number;
  type: string;
}

/**
 * Messages sent from the main thread to the worker.
 */
export type PreflightWorkerCommand =
  | {
    type: 'analyze';
    fileMeta: FileMeta;
    buffer: ArrayBuffer;
  }
  | {
    type: 'convertToGrayscale';
    fileMeta: FileMeta;
    buffer: ArrayBuffer;
  }
  | {
    type: 'upscaleLowResImages';
    fileMeta: FileMeta;
    buffer: ArrayBuffer;
    minDpi?: number;
  }
  | {
    type: 'fixBleed';
    fileMeta: FileMeta;
    buffer: ArrayBuffer;
  }
  | {
    type: 'tacHeatmap';
    fileMeta: FileMeta;
    buffer: ArrayBuffer;
    pageIndex?: number;
  }
  | {
    type: 'renderPageAsImage';
    fileMeta: FileMeta;
    buffer: ArrayBuffer;
    pageIndex: number;
  };

/**
 * Messages sent from the worker to the main thread.
 */
export type PreflightWorkerMessage =
  | { type: 'analysisResult'; result: PreflightResult }
  | { type: 'analysisError'; message: string }
  | { type: 'analysisProgress'; progress: number; note?: string }
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

/**
 * Props for a modal component.
 */
export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
}
export interface HeatmapData {
  values: Uint8Array;
  width: number; // Grid width
  height: number; // Grid height
  maxTac: number;
}
