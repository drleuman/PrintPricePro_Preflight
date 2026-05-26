# Phase 39.1 — Preflight BFF Tenant Governance Alignment

**Date:** 2026-05-26 (hotfix applied 2026-05-26)
**Branch:** `feat/monolith-look-elevation-v2.4`
**Depends on:** Phase 39.0 — Tenant Plan Governance (Control Plane)

---

## Hotfix — Endpoint Routing Fix

**Root cause of production 404:**
The initial Phase 39.1 implementation used a placeholder Control Plane path:

```
# WRONG (placeholder — returns 404 in production)
GET http://127.0.0.1:8002/api/control-plane/tenants/:tenantId/governance
```

The real Control Plane Phase 39.0 is deployed on **port 8081** and exposes:

```
# CORRECT (Phase 39.0 canonical routes)
GET  http://127.0.0.1:8081/api/admin/tenant-governance/:tenantId/entitlements
POST http://127.0.0.1:8081/api/admin/tenant-governance/:tenantId/evaluate-action
POST http://127.0.0.1:8081/api/admin/tenant-governance/:tenantId/check-file-limit
POST http://127.0.0.1:8081/api/admin/tenant-governance/:tenantId/check-job-limit
POST http://127.0.0.1:8081/api/admin/tenant-governance/:tenantId/grace/freeze-if-expired
```

**Note:** Port 8002 is NOT used by the Control Plane governance service in production.

---

## Overview

The PrintPrice OS Control Plane (Phase 39.0) is the commercial source of truth for tenant governance. Phase 39.1 aligns the Preflight App / BFF to delegate all plan limits, entitlements and action evaluation to the Control Plane, replacing previously hardcoded local values.

---

## Goals

1. **Remove all hardcoded plan limit tables** from the BFF and frontend.
2. **Delegate to Control Plane** for: `planCode`, `commercialStatus`, `accessLevel`, file/job limits, AI Magic Fix entitlement, and grace period state.
3. **Preserve existing FREE/PRO user flows** — no regressions.
4. **Unblock real ENTERPRISE / FOUNDING_PRINTHOUSE workloads** (inlay-only PDFs up to 780 MB+).
5. **Graceful degradation** — when the Control Plane is unreachable, use conservative fallback limits rather than failing open or closed.

---

## Control Plane Endpoint Reference

Base URL: `http://127.0.0.1:8081` (configurable via `CONTROL_PLANE_URL`)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/admin/tenant-governance/:tenantId/entitlements` | Full governance + limits fetch |
| POST | `/api/admin/tenant-governance/:tenantId/evaluate-action` | Evaluate named action |
| POST | `/api/admin/tenant-governance/:tenantId/check-file-limit` | File size gate |
| POST | `/api/admin/tenant-governance/:tenantId/check-job-limit` | Job size gate |
| POST | `/api/admin/tenant-governance/:tenantId/grace/freeze-if-expired` | Grace period freeze |

### Canonical response shape (GET /entitlements)
```json
{
  "ok": true,
  "tenantId": "ph-demo-123",
  "planCode": "FOUNDING_PRINTHOUSE",
  "commercialStatus": "GRACE",
  "accessLevel": "FULL",
  "grace": { "...": "..." },
  "limits": {
    "maxFileSizeMb": 1024,
    "maxJobSizeMb": 2048,
    "maxJobsPerMonth": null,
    "retentionDays": 90
  },
  "modules": { "...": "..." },
  "actions": { "...": "..." },
  "blockers": [],
  "warnings": []
}
```

**Allowed semantics:** A response is ALLOWED when `ok === true` AND `blockers` array is empty or absent. An explicit `"allowed"` field is not required.

---

## Files Changed

### MODIFIED: `app/services/controlPlaneGovernanceClient.js`
- **Removed:** All `/api/control-plane/tenants/…` paths (old placeholder).
- **Added:** Canonical `GOV_BASE()` helper routing all calls to `/api/admin/tenant-governance/:tenantId/…`.
- **Changed:** Default fallback URL from `http://127.0.0.1:8002` → `http://127.0.0.1:8081`.
- **Changed:** Default timeout from 5000 ms → 8000 ms.
- **Changed:** Auth header now always uses `CONTROL_PLANE_INTERNAL_API_KEY` / `PPOS_CONTROL_TOKEN` (service-to-service key takes priority over forwarded JWT).
- **Added:** `checkFileLimit()`, `checkJobLimit()`, `freezeIfExpired()` functions.
- **Changed:** `evaluateAction()` sends `{ actionCode, context }` (not `{ action, context }`).
- **Changed:** `getTenantGovernance()` is now an alias for `getTenantEntitlements()`.
- **Changed:** `getTenantLimits()` now calls `getTenantEntitlements()` and normalizes the limits object (supports both camelCase and snake_case).

### MODIFIED: `app/services/tenantEntitlementCache.js`
- Updated `getLimits()` to handle Phase 39.0 camelCase fields (`maxFileSizeMb`, `maxJobSizeMb`, `maxJobsPerMonth`).
- Updated `isFeatureEnabled()` to check `governance.modules` and `governance.actions` (Phase 39.0 structure).
- Updated `getPlanCode()` to prefer `planCode` (camelCase) over `plan_code`.
- Updated `getCommercialStatus()` to recognize `GRACE` (short form used by Phase 39.0) in addition to `GRACE_PERIOD`.

### MODIFIED: `scripts/smoke_phase_39_1_bff_tenant_governance_alignment.js`
- Tests canonical `/api/admin/tenant-governance/…` endpoints (not old placeholder).
- Live CP tests are SKIPPED (not failed) when `TEST_TENANT_ID` is not set.
- Adds 780 MB inlay file limit check via `/check-file-limit`.
- Produces the required STATUS / RESULT / BLOCKERS summary block.

### MODIFIED: `.env.example`
- Added Phase 39.1 Control Plane governance env vars block.
- `CONTROL_PLANE_URL=http://127.0.0.1:8081` (corrected from placeholder 8002).

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `CONTROL_PLANE_URL` | `http://127.0.0.1:8081` | Control Plane base URL |
| `PPOS_CONTROL_PLANE_URL` | *(same alias)* | Alias for CONTROL_PLANE_URL |
| `CONTROL_PLANE_INTERNAL_API_KEY` | *(none)* | Service-to-service API key (= PPOS_CONTROL_TOKEN) |
| `PPOS_CONTROL_TOKEN` | *(none)* | Alias for CONTROL_PLANE_INTERNAL_API_KEY |
| `CONTROL_PLANE_TIMEOUT_MS` | `8000` | CP request timeout |
| `TENANT_ENTITLEMENT_CACHE_TTL_MS` | `60000` | Cache TTL in milliseconds |
| `INFRA_MAX_FILE_SIZE_MB` | `2048` | Multer infra ceiling |

Add to `.env`:
```
CONTROL_PLANE_URL=http://127.0.0.1:8081
PPOS_CONTROL_PLANE_URL=http://127.0.0.1:8081
CONTROL_PLANE_INTERNAL_API_KEY=<same value as PPOS_CONTROL_TOKEN>
PPOS_CONTROL_TOKEN=<same value>
CONTROL_PLANE_TIMEOUT_MS=8000
TENANT_ENTITLEMENT_CACHE_TTL_MS=60000
INFRA_MAX_FILE_SIZE_MB=2048
```

---

## Governance Fallback Strategy

```
CP Available?
  YES → Use CP limits for all decisions (getTenantEntitlements)
  NO  → Serve stale cache (if < TTL)
      → If no stale entry → use FALLBACK_LIMITS (conservative)
      → Log warning + set req.license.cp_source = false
      → Never block ENTERPRISE/FP at FREE-tier limits
```

Fallback defaults (ONLY when CP is unreachable):

| Plan | Max File | Daily Jobs |
|------|----------|------------|
| FREE | 25 MB | 5 |
| PRO | 150 MB | 50 |
| ENTERPRISE | 1024 MB | ∞ |
| FOUNDING_PRINTHOUSE | 1024 MB | ∞ |
| CUSTOM | 1024 MB | ∞ |
| SYSTEM | 2048 MB | ∞ |

---

## Running the Smoke Test

```bash
# Offline only (no BFF or CP needed):
node scripts/smoke_phase_39_1_bff_tenant_governance_alignment.js

# With live Control Plane:
CONTROL_PLANE_URL=http://127.0.0.1:8081 \
TEST_TENANT_ID=ph-demo-123 \
node scripts/smoke_phase_39_1_bff_tenant_governance_alignment.js

# Full (BFF + CP + 780 MB check):
CONTROL_PLANE_URL=http://127.0.0.1:8081 \
BFF_URL=http://localhost:3000 \
TEST_JWT=<your-jwt> \
TEST_TENANT_ID=ph-demo-123 \
VERBOSE=true \
node scripts/smoke_phase_39_1_bff_tenant_governance_alignment.js
```

---

## What Was NOT Changed

- **Billing provider integration** — not in scope.
- **Control Plane entitlement matrix** — not duplicated here; we delegate 100%.
- **`licenseGuard.js`** — no changes required; fallback limits and logic unchanged.
- **`authRoutes.js`** — no changes required; `enrichWithGovernance()` calls the cache which now resolves correctly.
- **`dbSchema.js`** — no schema migrations required.
- **`enterpriseAuth.js`** — deferred to Phase 39.2.

---

## Phase 39.2 Backlog

- Align `enterpriseAuth.js` API key path to query CP governance (currently reads local `tenants` table).
- Redis-backed distributed cache for multi-node deployments.
- Frontend `commercialStatus` / `in_grace_period` UX messaging.
- CP webhook handler for cache invalidation on governance change events.

---

## Phase 39.1.1 Session Mapping Hotfix

The `/api/auth/me` and `/api/auth/session` endpoints now fully map the Control Plane Phase 39.0 governance structure into the Preflight BFF session payload. 

### Field Mappings Implemented:
- `governance.planCode` ➔ `user.plan`, `user.planCode`, `user.plan_code` (preserves `FOUNDING_PRINTHOUSE`)
- `governance.commercialStatus` ➔ `user.commercial_status`
- `governance.accessLevel` ➔ `user.access_level`
- `governance.grace.active` ➔ `user.in_grace_period`
- `governance.grace.expired` ➔ `user.grace_expired`
- `governance.grace.endsAt` ➔ `user.grace_ends_at`
- `governance.limits.maxFileSizeMb` ➔ `user.max_file_size_mb`
- `governance.limits.maxJobSizeMb` ➔ `user.max_job_size_mb`
- `governance.limits.maxJobsPerMonth` ➔ `user.daily_jobs_limit`
- `governance.source` ➔ `user._governance_source` (defaults to `CONTROL_PLANE`)

This allows the frontend to dynamically read high-resolution limits and grace statuses, enabling rich UX banners and customized onboarding states for Founding Printhouses and Pilot programs without relying on legacy/placeholder enterprise fallbacks.
