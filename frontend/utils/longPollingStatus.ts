/**
 * Phase APP-40.7 — Heavy File / Long Polling UX Alignment.
 *
 * PPOS reports raw job/stage statuses that vary by job type and engine version
 * (ANALYZING, QUEUED, FIX_RUNNING, COMPLETED, SUCCEEDED, ...). The plan requires
 * the BFF/UI layer to present a single normalized vocabulary to the user and to
 * logs, so heavy-file long-polling sessions read consistently regardless of the
 * raw upstream status string.
 */

export type LongPollingStatus =
    | 'UPLOAD_STARTED'
    | 'UPLOAD_COMPLETE'
    | 'ANALYSIS_QUEUED'
    | 'ANALYSIS_RUNNING'
    | 'ANALYSIS_COMPLETED'
    | 'FIX_REQUESTED'
    | 'FIX_RUNNING'
    | 'FIX_COMPLETED_REVIEW_REQUIRED'
    | 'FIX_COMPLETED_CERTIFIED'
    | 'ARTIFACTS_AVAILABLE'
    | 'ARTIFACTS_PARTIAL'
    | 'ARTIFACTS_UNAVAILABLE';

export type LongPollingStage = 'upload' | 'preflight' | 'fix' | 'artifacts';

export interface LongPollingStatusInput {
    /** Raw status string from PPOS/BFF (any case). */
    rawStatus?: string | null;
    /** Which pipeline stage this poll belongs to — disambiguates QUEUED/RUNNING/COMPLETED. */
    stage: LongPollingStage;
    /** Set when the job/result indicates the output still needs human review. */
    requiresHumanReview?: boolean;
    /** Set when the job/result is production-certified (no review pending). */
    productionCertified?: boolean;
    /** Set when at least one — but not all — expected artifacts are present. */
    artifactsPartial?: boolean;
    /** Set when no usable artifact was produced at all. */
    artifactsUnavailable?: boolean;
}

const QUEUED_PATTERN = /QUEUE|PENDING|WAITING|SUBMITTED|ACCEPTED/;
const RUNNING_PATTERN = /RUN|PROCESS|ANALYZ|SCAN|PROGRESS|IN_PROGRESS|EXECUT/;
const COMPLETED_PATTERN = /COMPLET|SUCCEED|SUCCESS|DONE|FINISH|CERTIF|READY/;
const REQUESTED_PATTERN = /REQUEST|CREATED|INIT/;

/**
 * Maps a raw PPOS/BFF status (plus stage + trust context) to one of the plan's
 * twelve canonical long-polling status strings. Falls back to the most sensible
 * "in-flight" status for the given stage when the raw value is unrecognized —
 * heavy files frequently report engine-specific strings mid-flight.
 */
export function normalizeLongPollingStatus(input: LongPollingStatusInput): LongPollingStatus {
    const raw = (input.rawStatus || '').toUpperCase();

    switch (input.stage) {
        case 'upload':
            return COMPLETED_PATTERN.test(raw) ? 'UPLOAD_COMPLETE' : 'UPLOAD_STARTED';

        case 'preflight':
            if (COMPLETED_PATTERN.test(raw)) return 'ANALYSIS_COMPLETED';
            if (QUEUED_PATTERN.test(raw)) return 'ANALYSIS_QUEUED';
            return 'ANALYSIS_RUNNING';

        case 'fix':
            if (COMPLETED_PATTERN.test(raw)) {
                return input.productionCertified === true && input.requiresHumanReview !== true
                    ? 'FIX_COMPLETED_CERTIFIED'
                    : 'FIX_COMPLETED_REVIEW_REQUIRED';
            }
            if (REQUESTED_PATTERN.test(raw)) return 'FIX_REQUESTED';
            return 'FIX_RUNNING';

        case 'artifacts':
            if (input.artifactsUnavailable) return 'ARTIFACTS_UNAVAILABLE';
            if (input.artifactsPartial) return 'ARTIFACTS_PARTIAL';
            return 'ARTIFACTS_AVAILABLE';

        default:
            return RUNNING_PATTERN.test(raw) ? 'ANALYSIS_RUNNING' : 'ANALYSIS_QUEUED';
    }
}

/** Human-facing copy for each normalized status (English source; route through i18n where displayed). */
export const LONG_POLLING_STATUS_COPY: Record<LongPollingStatus, string> = {
    UPLOAD_STARTED: 'Uploading file to the engine…',
    UPLOAD_COMPLETE: 'Upload complete — handing off to the analysis engine.',
    ANALYSIS_QUEUED: 'Queued for forensic analysis…',
    ANALYSIS_RUNNING: 'Running forensic analysis (CMYK, geometry, fonts, images)…',
    ANALYSIS_COMPLETED: 'Forensic analysis complete.',
    FIX_REQUESTED: 'Repair request received — preparing the engine job…',
    FIX_RUNNING: 'Applying deterministic corrections…',
    FIX_COMPLETED_REVIEW_REQUIRED: 'Repair finished — output requires human review before production.',
    FIX_COMPLETED_CERTIFIED: 'Repair finished — output is production-certified.',
    ARTIFACTS_AVAILABLE: 'All expected output files are available.',
    ARTIFACTS_PARTIAL: 'Some output files are available; others are still being generated or were not produced.',
    ARTIFACTS_UNAVAILABLE: 'No usable output file was produced for this job.',
};

/** Emits the consistent `[APP][LONG-POLL-STATUS]` trace line the plan specifies for heavy-file diagnostics. */
export function logLongPollingStatus(jobId: string | null | undefined, normalized: LongPollingStatus, raw?: string | null): void {
    console.log('[APP][LONG-POLL-STATUS]', { jobId, normalized, raw: raw || null });
}
