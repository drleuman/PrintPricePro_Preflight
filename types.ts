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
 * Unified job statuses for the system.
 */
export enum JobStatus {
  QUEUED = 'QUEUED',
  RUNNING = 'RUNNING',
  SUCCEEDED = 'SUCCEEDED',
  FAILED = 'FAILED',
  CANCELED = 'CANCELED',
  CANCEL_REQUESTED = 'CANCEL_REQUESTED',
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
  PRODUCTION_GEOMETRY: 'production_geometry',
  SUBSTRATE: 'substrate',
  INK_SAVING: 'ink_saving',
  PRINT_EDITION_INTENT: 'print_edition_intent',
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
  [ISSUE_CATEGORY.PRODUCTION_GEOMETRY]: 'Production Geometry',
  [ISSUE_CATEGORY.SUBSTRATE]: 'Paper & Physics',
  [ISSUE_CATEGORY.INK_SAVING]: 'Ink Saving & Efficiency',
  [ISSUE_CATEGORY.PRINT_EDITION_INTENT]: 'Print Edition Intent',
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
  page?: number; // Optional in V2 (can be document-wide)
  bbox?: Bbox;
  severity: Severity | string;
  category?: IssueCategory | string;
  type?: string; // V2 equivalent of category
  title?: string;
  message?: string; // Legacy
  user_message?: string; // V2
  details?: string; // Legacy
  developer_message?: string; // V2
  tags?: string[];
  payload?: any;
  evidence?: any; // V2
  fix?: {
    available: boolean;
    applied: boolean;
    step?: string;
  }; // V2
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

export type AppMode = 'manual' | 'ai' | 'demo' | null;

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
  productionReport?: {
    spine?: any;
    imposition?: any;
    substrate?: any;
    inkOptimization?: {
      score: number;
      inkUsageIndex: number;
      costCategory: 'LOW' | 'MEDIUM' | 'HIGH';
      opportunities: string[];
      totalCoverageAvg: number;
    };
    editionIntent?: {
      intent: 'OFFSET' | 'DIGITAL' | 'MIXED';
      confidence: number;
      offsetScore: number;
      digitalScore: number;
      recommendation: string;
    };
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
    config?: {
      paperType?: 'coated' | 'uncoated';
      paperGsm?: number;
      trimWidthMm?: number;
      trimHeightMm?: number;
      bleedMm?: number;
    };
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
    mode?: 'safe' | 'aggressive';
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

export interface BookConfig {
  pages_interior: number;
  cover_pages: number;
  pms_interior: number;
  pms_cover: number;
  cover_print_rev: number;
  format: string;
  paper_interior: string;
  paper_cover: string;
  quantity: number;
}

export interface QuoteOffer {
  id: string;
  title: string;
  price: string;
  description: string;
}
