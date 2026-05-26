# Phase 39.1.5 — Autofix Frontend Result-State Download Normalization Notes

## Overview
While Phase 39.1.3 and 39.1.4 successfully normalized JSON report artifacts requested from direct download and proxy routes, the frontend UI was still exporting un-normalized raw JSON when downloading the report directly. This occurred because the frontend UI's "Download Report" feature serialized the local React state variable `result` (polled from job status or completion routes) which remained in its raw PPOS form.

Phase 39.1.5 resolves this by introducing result-state normalization on both the backend routes (polling/status/completion endpoints) and the frontend client-side download logic.

## Changes Implemented

### 1. Central Result-State Normalization Helper
- Extended `preflightNormalizer.js` with `normalizeAutofixResultState(payload)` which scans direct and nested structures (`.result`, `.report`, etc.) to locate AUTOFIX reports and apply canonical normalization.

### 2. Backend Routes Integration
- **`app/routes/apiV2.js`**: Integrates `normalizeAutofixResultState` for status polling `router.get('/:jobId')` and the fix execution `router.post('/:jobId/actions/fix')` endpoint. It injects diagnostic headers (`X-PPOS-Autofix-Result-Normalized: true`) and logs the action under `[AUTOFIX_RESULT_NORMALIZED_FOR_FRONTEND]`.
- **`app/routes/preflightProxy.js`**: Integrates the same helper on job status routes, parsing JSON and applying normalization, maintaining all previously implemented route artifact coverage.

### 3. Frontend Utilities
- **`frontend/utils/payloadNormalization.ts`**: Reimplemented browser-safe TS mirrors of `normalizeAutofixResultState` and `normalizeAutofixFinalState` without Node dependencies. Integrated `normalizeAutofixResultState` directly inside `normalizePreflightResult` to ensure all UI states poll, hydrate, and render fully normalized datasets.

### 4. Client-Side Download Interception
- **`frontend/App.tsx`**: Updated `handleDownloadReport` to call `normalizeAutofixResultState` on the report payload before JSON serialization (`JSON.stringify`), guaranteeing that downloaded reports always reflect the normalized state.

## Safety & Governance Guidelines
- CMYK high-risk conversions remain `requiresHumanReview: true` and are never marked as production-certified.
- Forensic fields and all legacy fields are preserved intact during the normalization process.
