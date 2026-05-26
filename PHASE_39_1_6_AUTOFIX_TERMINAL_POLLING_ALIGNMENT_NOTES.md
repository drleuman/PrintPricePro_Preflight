# Phase 39.1.6 — Autofix Terminal Polling Alignment Notes

## Overview
Phase 39.1.5 successfully normalized the AUTOFIX report results before download. However, after triggering Autofix, the UI was polling indefinitely because `COMPLETED_WITH_REVIEW` was not registered as a terminal diagnostic status on the frontend, and the polling loop kept waiting.

Phase 39.1.6 aligns terminal status checking on the frontend, ensuring `COMPLETED_WITH_REVIEW` immediately stops polling and advances to Step 4 / review state without requiring `hasReport: true` as long as valid Autofix evidence exists.

## Changes Implemented

### 1. Terminal Status Expansion
- **`frontend/utils/statusHelpers.ts`**: Expanded `TERMINAL_DIAGNOSTIC_STATUSES` to include:
  - `COMPLETED_WITH_REVIEW`
  - `FIXED_WITH_REVIEW_REQUIRED`
  - `AUTOFIX_COMPLETED`
  - `AUTOFIX_PARTIAL`
  - `AUTOFIX_DEGRADED`
- Expanded `TERMINAL_FAILURE_STATUSES` to include:
  - `AUTOFIX_FAILED`

### 2. Polling Completion & Timeout Safeguard
- **`frontend/hooks/usepdftools.ts`**:
  - The `pollJob` loop now stops and resolves the job payload upon receiving `COMPLETED_WITH_REVIEW` (or any other newly added terminal diagnostic status).
  - Added a timeout safeguard: if max attempts (300) are exceeded but the current status is terminal, it resolves with the latest payload rather than raising an error.

### 3. Step 4 Review Transition
- By resolving the poll promise immediately on `COMPLETED_WITH_REVIEW`, `handleV2JobComplete` executes, triggering the callback `onComplete(normalizedResult)` and transitioning step state to Step 4/Review in the UI.

### 4. Non-Requirement of `hasReport`
- Polling completion now operates purely on terminal statuses (`isTerminalDiagnosticStatus`), meaning the presence or absence of a `hasReport === true` flag does not block completion.
