# Phase 39.1.2 — Autofix Report Finalization / After-State Normalization

**Date:** 2026-05-26
**Branch:** `feat/monolith-look-elevation-v2.4`
**Status:** ✅ IMPLEMENTED & VERIFIED

---

## Overview

When the Preflight App / BFF executes an automatic fix (autofix) pipeline, the engine may perform the repairs successfully. However, previous reports left the `summary.after` object as `null` and lacked explicit classification on whether the resulting PDF was ready to go straight to print. 

This update introduces **Phase 39.1.2 — Autofix Report Finalization**, ensuring the BFF and frontend can cleanly interpret and present the post-fix status of every document.

---

## Why `summary.after` Must Not Remain Null

Leaving `summary.after` as `null` creates a bad user experience because:
1. The user/system does not get an immediate summary of the final state after repairs.
2. The UI has to guess if the file was actually fixed, or if it failed, or if it is ready.
3. High-risk operations (e.g. CMYK shift risk) and human validation requirements are not explicitly bubbled up.

By generating/normalizing `summary.after`, the frontend can dynamically build warning blocks and status tags with precision.

---

## Status Classification Semantics

We classify autofix outcomes into these distinct terminal states:

### 1. `AUTOFIX_COMPLETED`
- **Definition:** All fixes applied successfully. No unresolved issues remain, no failed fixes, and **no applied repair requires human review** or carries `HIGH` destructive risk.
- **Flags:** `technicallyFixed = true`, `productionCertified = true`.
- **UI Label:** "Production-ready" or "Certified".

### 2. `COMPLETED_WITH_REVIEW` / `FIXED_WITH_REVIEW_REQUIRED`
- **Definition:** All fixes applied and no unresolved findings exist. However, at least one applied fix is marked with `requires_human_review = true`, has limited industrial quality (`LIMITED`), or has a `HIGH` destructive risk (e.g. CMYK conversion).
- **Flags:** `technicallyFixed = true`, `productionCertified = false`, `requiresHumanReview = true`.
- **UI Label:** "Fixed — review required" or "Technically repaired".
- **Risk Score:** Set to `20` (as compared to 100) to flag that it is not a clean, unreviewed certified file.

### 3. `AUTOFIX_PARTIAL`
- **Definition:** Some repairs were applied but unresolved findings still remain or some fixes were skipped.
- **Flags:** `technicallyFixed = false`, `productionCertified = false`.

### 4. `AUTOFIX_FAILED`
- **Definition:** Critical errors occurred, or failed fixes were returned.
- **Flags:** `technicallyFixed = false`, `productionCertified = false`.

### 5. `AUTOFIX_DEGRADED`
- **Definition:** The report was marked as degraded (`_isDegraded = true` or `degraded_reasons` present).

---

## Difference between `technicallyFixed` and `productionCertified`

| Parameter | `technicallyFixed` | `productionCertified` |
|---|---|---|
| **Meaning** | All targeted errors were addressed by the code / tools without runtime failures. | The document is guaranteed print-safe and does not require operator validation. |
| **Review Required** | Can be `true` (if a high-risk conversion or manual bleed review is pending). | Must be `false`. |
| **Destructive Risk** | Can be `HIGH`. | Must be `LOW` or `MEDIUM`. |
| **Downstream Implication** | Indicates the file is ready for technical review. | Indicates the file is ready to go directly to the press. |

---

## Real-World Example: `APPLY_BLEED` and `CONVERT_CMYK`
- **`APPLY_BLEED`:** Even when applied, bleed generation involves edge-mirroring or scaling which can introduce visual anomalies. It is flagged as `requires_human_review = true`, triggering a **COMPLETED_WITH_REVIEW** status.
- **`CONVERT_CMYK`:** Color space conversion from RGB to CMYK carries `destructiveFixRisk = HIGH` due to possible gamut compression and shift in brand colors. It triggers a human review warning block on the frontend.
