# Phase 39.1 — Preflight BFF Tenant Governance Alignment

**Date:** 2026-05-26  
**Branch:** `feat/monolith-look-elevation-v2.4`  
**Depends on:** Phase 39.0 — Tenant Plan Governance (Control Plane)

---

## Overview

The PrintPrice OS Control Plane (Phase 39.0) is now the commercial source of truth for tenant governance. Phase 39.1 aligns the Preflight App / BFF to delegate all plan limits, entitlements and action evaluation to the Control Plane, replacing previously hardcoded local values.

---

## Goals

1. **Remove all hardcoded plan limit tables** from the BFF and frontend.
2. **Delegate to Control Plane** for: `plan_code`, `commercial_status`, `access_level`, file/job limits, AI Magic Fix entitlement, and grace period state.
3. **Preserve existing FREE/PRO user flows** — no regressions.
4. **Unblock real ENTERPRISE / FOUNDING_PRINTHOUSE workloads** (inlay-only PDFs up to 780 MB+).
5. **Graceful degradation** — when the Control Plane is unreachable, use conservative fallback limits rather than failing open or closed.

---

## Files Changed

### NEW: `app/services/controlPlaneGovernanceClient.js`
Thin HTTP adapter for the Control Plane Governance API.  
Exposes: `getTenantGovernance()`, `evaluateAction()`, `getTenantLimits()`, `getTenantEntitlements()`.  
Reads: `CONTROL_PLANE_URL`, `CONTROL_PLANE_INTERNAL_API_KEY`, `CONTROL_PLANE_TIMEOUT_MS`.

### NEW: `app/services/tenantEntitlementCache.js`
In-memory TTL cache (default 60 s) wrapping the Control Plane client.  
Prevents per-request CP round-trips on hot paths (upload, job submission).  
Includes stale-serve fallback on CP unavailability.  
Reads: `TENANT_ENTITLEMENT_CACHE_TTL_MS`.

### MODIFIED: `app/middleware/licenseGuard.js`
- **Removed:** Hardcoded `max_file_size_mb` comparisons and `plan !== 'ENTERPRISE'` exemptions.
- **Added:** Fetches effective limits from `tenantEntitlementCache.getLimits()` (CP-sourced).
- **Added:** Fetches AI Magic Fix entitlement from `tenantEntitlementCache.isFeatureEnabled()`.
- **Preserved:** Local DB identity check (status, role) and usage counter increment.
- **Fallback limits** (only when CP unavailable):
  | Plan | Max File | Daily Jobs |
  |------|----------|------------|
  | FREE | 25 MB | 5 |
  | PRO | 150 MB | 50 |
  | ENTERPRISE | 1024 MB | ∞ |
  | FOUNDING_PRINTHOUSE | 1024 MB | ∞ |
  | CUSTOM | 1024 MB | ∞ |
  | SYSTEM | 2048 MB | ∞ |

### MODIFIED: `app/routes/authRoutes.js`
- **Added:** `enrichWithGovernance()` helper — queries CP (via cache) and merges `plan_code`, `commercial_status`, `access_level`, `in_grace_period`, effective limits, and `ai_magic_fix_enabled` into the session/me response.
- **Preserved:** All existing response shape fields (no breaking changes to frontend consumers).
- **Added fields to `/api/auth/me` response:** `commercial_status`, `access_level`, `in_grace_period`, `max_file_size_mb`, `max_job_size_mb`, `_governance_source`.

### MODIFIED: `app/routes/apiV2.js`
- **Changed:** Multer infrastructure ceiling from hardcoded `500 MB` to `INFRA_MAX_FILE_SIZE_MB` (default `2048 MB`, configurable via env).
- Per-plan enforcement remains in `licenseGuard` (CP-sourced); Multer is now only the infrastructure upper bound.

### MODIFIED: `frontend/hooks/useAuth.tsx`
- **Extended `User` interface** to include Phase 39.0 plan codes: `FOUNDING_PRINTHOUSE`, `CUSTOM`, `SYSTEM`.
- **Added optional fields:** `commercial_status`, `access_level`, `in_grace_period`, `max_file_size_mb`, `max_job_size_mb`, `_governance_source`.
- `daily_jobs_limit` now typed as `number | null` (null = unlimited for ENTERPRISE+).

### MODIFIED: `frontend/components/steps/Step1UploadV2_4.tsx`
- **Removed:** `user?.plan === 'PRO' ? 500 : 50` hardcoded limit switch.
- **Reads:** `user.max_file_size_mb` (CP-sourced) with conservative FREE fallback (25 MB).
- **Reads:** `user.ai_magic_fix_enabled` directly (boolean from CP entitlements).
- **Reads:** `user.jobs_used_today` from session object (was always 0 before).
- **Added:** `isInGrace` derived from `user.in_grace_period` (for future UX display).

### NEW: `scripts/smoke_phase_39_1_bff_tenant_governance_alignment.js`
Offline + online smoke test. Validates module loading, cache contract, licenseGuard factory, Multer ceiling change, frontend type updates. Optionally runs live endpoint tests when `TEST_JWT` and `TEST_TENANT_ID` are set.

---

## Environment Variables Added

| Variable | Default | Description |
|---|---|---|
| `CONTROL_PLANE_URL` | `http://127.0.0.1:8002` | Control Plane base URL |
| `PPOS_CONTROL_PLANE_URL` | *(same alias)* | Alias |
| `CONTROL_PLANE_INTERNAL_API_KEY` | *(none)* | Service-to-service API key |
| `CONTROL_PLANE_TIMEOUT_MS` | `5000` | CP request timeout |
| `TENANT_ENTITLEMENT_CACHE_TTL_MS` | `60000` | Cache TTL in milliseconds |
| `INFRA_MAX_FILE_SIZE_MB` | `2048` | Multer infra ceiling |

Add to `.env`:
```
CONTROL_PLANE_URL=http://127.0.0.1:8002
CONTROL_PLANE_INTERNAL_API_KEY=your-internal-key-here
TENANT_ENTITLEMENT_CACHE_TTL_MS=60000
INFRA_MAX_FILE_SIZE_MB=2048
```

---

## Governance Fallback Strategy

```
CP Available?
  YES → Use CP limits for all decisions
  NO  → Serve stale cache (if <TTL)
      → If no stale entry → use FALLBACK_LIMITS (conservative)
      → Log warning + set req.license.cp_source = false
      → Never fail open, never block ENTERPRISE/FP unexpectedly
```

---

## What Was NOT Changed

- **Billing provider integration** — not in scope (Phase 39.1 is governance alignment only).
- **Control Plane entitlement matrix** — not duplicated here; we delegate 100%.
- **Existing FREE/PRO user flows** — unchanged; fallback defaults match previous behavior.
- **`enterpriseAuth.js`** — uses API key authentication path (tenants table). Annotated for Phase 39.2 alignment; not modified in 39.1 to avoid scope creep.
- **`dbSchema.js`** — no schema migrations required for Phase 39.1.

---

## Running the Smoke Test

```bash
# Offline only (no BFF or CP needed):
node scripts/smoke_phase_39_1_bff_tenant_governance_alignment.js

# With live BFF:
BFF_URL=http://localhost:3000 TEST_JWT=<your-jwt> node scripts/smoke_phase_39_1_bff_tenant_governance_alignment.js

# With live BFF + CP:
CONTROL_PLANE_URL=http://localhost:8002 BFF_URL=http://localhost:3000 TEST_JWT=<your-jwt> TEST_TENANT_ID=<tenant-id> VERBOSE=true node scripts/smoke_phase_39_1_bff_tenant_governance_alignment.js
```

---

## Next Steps (Phase 39.2)

- Align `enterpriseAuth.js` API key path to also query CP governance (currently reads from local `tenants` table).
- Add Redis-backed distributed cache for `tenantEntitlementCache` (currently in-memory per node).
- Surface `commercial_status` / `in_grace_period` in the frontend shell with appropriate UX messaging.
- Add Control Plane webhook handler to invalidate cache on governance change events.
