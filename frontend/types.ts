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
  uuid?: string;
  rule?: string;
  code?: string;
  title?: string;
  summary?: string;
  message?: string;
  description?: string;
  recommendation?: string;
  context?: string;
  source?: string;
  page?: number | null;
  bbox?: Bbox;
  severity: Severity | string;
  category?: IssueCategory | string;
  type?: string; // V2 equivalent of category
  user_message?: string; // V2
  details?: string; // Legacy
  developer_message?: string; // V2
  tags?: string[];
  payload?: any;
  evidence?: any; // V2
  fixable?: boolean;
  fixRequired?: boolean; // V2.5 Minimal Intervention
  safeToAutofix?: boolean; // V2.5 Minimal Intervention
  confidence?: number; // 0.0 - 1.0 (V2.5)
  destructiveFixRisk?: 'LOW' | 'MEDIUM' | 'HIGH'; // V2.5
  repairStrategy?: string; // V2
  fix_method?: string; // V2
  raw?: any;
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

export type AppMode = 'manual' | 'ai' | 'audit' | null;

export interface FixCoverageItem {
  issue_code: string;
  severity: string;
  message: string;
  fix_method: string | null;
  repair_code?: string;
  repair_status?: string;
  repair_reason?: string;
}

export interface FixCoverage {
  total_issues: number;
  fixed_count: number;
  skipped_count: number;
  failed_count: number;
  not_attempted_count: number;
  fixed: FixCoverageItem[];
  skipped: FixCoverageItem[];
  failed: FixCoverageItem[];
  not_attempted: FixCoverageItem[];
}

/**
 * The overall result of a PDF preflight analysis.
 */
export interface PreflightResult {
  type?: 'ANALYZE' | 'AUTOFIX';
  sourceJobId?: string;
  artifacts?: Record<string, string>;
  score: number; // Overall score (0-100), higher is better
  summary: string | any; // A brief overall summary of findings or enriched summary object
  issues: Issue[];
  fixes?: any[]; // Repairs/Applied fixes
  repairs?: any[];
  requested_fixes?: string[];
  applied_fixes?: any[];
  skipped_fixes?: any[];
  failed_fixes?: any[];
  fix_coverage?: FixCoverage | null;
  pages: Array<{ pageNumber: number; issuesCount: number }>;
  categorySummaries: CategorySummary[];
  meta: {
    fileName: string;
    fileSize: number;
    pageCount: number;
    jobId?: string;
    sourceJobId?: string;
    primary_artifact_type?: string;
    autofix_effective?: boolean;
    no_effective_changes?: boolean;
    noopFix?: boolean; // V2.5
    rewritten?: boolean; // V2.5
    certificationMode?: string; // V2.5 e.g. "CERTIFIED_WITHOUT_MODIFICATION"
  };
  artifact_delta?: {
    original_size_bytes: number;
    fixed_size_bytes: number;
    size_delta_percent: number;
    page_count_before: number;
    page_count_after: number;
    image_count_before?: number;
    image_count_after?: number;
    image_encoding_changes?: boolean;
    image_colorspace_changes?: boolean;
    resolution_changes?: boolean;
    detected_lossy_recompression?: boolean;
    detected_downsampling?: boolean;
    certification_blockers?: string[];
  };
  certification_blockers?: string[];
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

export interface WorkflowAnalysis {
    isAutofix: boolean;
    isAnalyzeOnly: boolean;
    hasResult: boolean;
    issueCount: number;
    errorCount: number;
    warningCount: number;
    hasIssues: boolean;
    hasErrors: boolean;
    isCompliant: boolean;
    isFixed: boolean;
    isNoOpFix: boolean; // Computed or from meta.noopFix
    isRealFix: boolean;
    isDegraded: boolean;
    analysisFailed: boolean;
    isFailedFix: boolean;
    isUnsupportedFix: boolean;
    hasCertified: boolean;
  hasFixedArtifact: boolean;
  hasDiagnosticArtifact: boolean;
  showComparison: boolean;
  bestArtifactKey: string | null;
  /** Phase APP-40.3 — trust-aware artifact keys (never substitute one for another) */
  reviewArtifactKey: string | null;
  fixedArtifactKey: string | null;
  certifiedArtifactKey: string | null;
  hasEffectiveFix: boolean;
  rewritten: boolean; // V2.5
  certificationMode: string | null; // V2.5
  isReviewRequiredOnly: boolean;
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

export type ClientChangeItem = {
  title: string;
  plainLanguage: string;
  technicalCode?: string;
  severity?: string;
  impact?: string;
  status?: 'applied' | 'skipped' | 'review' | 'detected';
};

export type ClientChangeReport = {
  headline: string;
  statusLabel: string;
  statusTone: 'success' | 'warning' | 'danger' | 'neutral';
  executiveSummary: string;
  productionReadiness: {
    certified: boolean;
    label: string;
    explanation: string;
  };
  changesApplied: ClientChangeItem[];
  itemsSkipped: ClientChangeItem[];
  stillNeedsReview: ClientChangeItem[];
  detectedBefore: ClientChangeItem[];
  customerMessage: string;
  operatorNotes: string[];
};

// ─── APP-60: PrintPrice OS Governance Contracts ──────────────────────────────
// These interfaces mirror the OS governance domains from Phase 55 onward.
// The BFF preserves them verbatim; UI components consume them to determine
// what labels, buttons, and messaging are safe to show.

/** Artifact-level trust object. False flags always override legacy computed values. */
export interface ArtifactTrust {
  trust_level?: 'CERTIFIED_SAFE' | 'REVIEW_REQUIRED' | 'FIXED_UNCERTIFIED' | 'NEEDS_ATTENTION' | 'DIAGNOSTIC_ONLY';
  production_certified?: boolean;
  standard_certified?: boolean;
  certified_pdf_allowed?: boolean;
  customer_visible?: boolean;
  compliance_claim_allowed?: boolean;
  pdfx_compliance_claimed?: boolean;
  pdfa_compliance_claimed?: boolean;
  review_required?: boolean;
  primary_artifact_type?: string;
  blocked_by_governance_domains?: string[];
  warnings?: string[];
  evidence?: Record<string, unknown>;
}

/** Backend-provided labels/buttons/tooltips for a specific artifact and audience. */
export interface ArtifactUxContract {
  button_label?: string;
  display_label?: string;
  status_badge?: string;
  tooltip?: string;
  customer_labels?: {
    button_label?: string;
    display_label?: string;
    status_badge?: string;
    tooltip?: string;
  };
  operator_labels?: {
    button_label?: string;
    display_label?: string;
    status_badge?: string;
    tooltip?: string;
  };
}

/** Standards validation governance (PDF/X, PDF/A, etc.). */
export interface StandardsCertificationGovernance {
  standard?: string;
  version?: string;
  validator?: string;
  validated?: boolean;
  standard_certified?: boolean;
  compliance_claim_allowed?: boolean;
  pdfx_compliance_claimed?: boolean;
  pdfa_compliance_claimed?: boolean;
  review_required?: boolean;
  blocked_by_governance_domains?: string[];
  warnings?: string[];
  evidence?: Record<string, unknown>;
}

/** Structural metadata (XMP, DocInfo, ICC profiles) governance. */
export interface StructuralMetadataGovernance {
  metadata_cleaned?: boolean;
  icc_profiles_normalized?: boolean;
  review_required?: boolean;
  warnings?: string[];
  evidence?: Record<string, unknown>;
}

/** Page marks (crop marks, registration marks, bleed box) governance. */
export interface PageMarksGovernance {
  crop_marks_added?: boolean;
  registration_marks_removed?: boolean;
  trim_box_rebuilt?: boolean;
  bleed_applied?: boolean;
  review_required?: boolean;
  warnings?: string[];
  evidence?: Record<string, unknown>;
}

/** Security and interactive content governance. */
export interface SecurityInteractivityGovernance {
  javascript_removed?: boolean;
  launch_actions_removed?: boolean;
  embedded_files_removed?: boolean;
  forms_flattened?: boolean;
  annotations_flattened?: boolean;
  flattening_skipped?: boolean;
  interactive_content_remaining?: boolean;
  active_content_removed?: boolean;
  review_required?: boolean;
  warnings?: string[];
  evidence?: Record<string, unknown>;
}

/** Visual diff comparison between original and fixed renderings. */
export interface VisualDiffGovernance {
  visual_diff_required?: boolean;
  visual_diff_performed?: boolean;
  visual_change_detected?: boolean;
  visual_change_expected?: boolean;
  diff_metrics?: Record<string, unknown>;
  review_required?: boolean;
  warnings?: string[];
  evidence?: Record<string, unknown>;
}

/** Customer/operator proof approval state. */
export interface ProofApprovalGovernance {
  proof_required?: boolean;
  proof_status?: 'PROOF_NOT_REQUIRED' | 'PROOF_REQUIRED' | 'PROOF_PENDING_CUSTOMER' | 'PROOF_APPROVED' | 'PROOF_REJECTED_REUPLOAD_REQUIRED';
  proof_id?: string;
  review_required?: boolean;
  warnings?: string[];
}

/** Operator review decision UX contract (from Phase 58). */
export interface ReviewDecisionUx {
  decision?: 'NO_DECISION' | 'APPROVED_WITH_WARNINGS' | 'APPROVED_FOR_PRODUCTION' | 'REJECTED_REQUIRES_REUPLOAD' | 'REQUEST_CUSTOMER_REUPLOAD' | 'NEEDS_MORE_INFORMATION';
  decision_label?: string;
  allows_progression?: boolean;
  requires_reupload?: boolean;
  customer_message?: string;
  operator_notes?: string[];
}

/** Customer remediation UX contract (from Phase 59). */
export interface RemediationUx {
  remediation_state?: 'REUPLOAD_REQUIRED' | 'WAITING_FOR_UPLOAD' | 'PREFLIGHT_REQUIRED' | 'REVIEW_REQUIRED' | 'APPROVED_WITH_WARNINGS' | 'RESOLVED';
  requires_reupload?: boolean;
  next_action?: string;
  customer_message?: string;
  operator_notes?: string[];
}
