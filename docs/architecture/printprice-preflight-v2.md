# PrintPrice Preflight V2: Two-Engine Architecture Redesign

## Task 1 — Inventory and Classification
Every current finding has been classified into either **DETERMINISTIC** (must be evaluated server-side using RIP-grade tools) or **HEURISTIC** (can be evaluated client-side via statistical or visual means).

| Finding ID              | Human Title                    | Type          | Evidence Source  | Confidence | Fixable | Fix Step | Notes |
|:------------------------|:-------------------------------|:--------------|:-----------------|:-----------|:--------|:---------|:------|
| `non-standard-size`     | Non-standard page size         | DETERMINISTIC | `pdf_struct`     | 1.0        | N       | N/A      | Extracted directly from MediaBox/TrimBox geometry. |
| `missing-bleed-info`    | Missing BleedBox definition    | DETERMINISTIC | `pdf_struct`     | 1.0        | Y       | `add_bleed_canvas` | Absence of BleedBox key in page dictionary. |
| `insufficient-bleed`    | Insufficient bleed margin      | DETERMINISTIC | `pdf_struct`     | 1.0        | Y       | `add_bleed_canvas` | Compare BleedBox vs TrimBox. |
| `rgb-only-content`      | RGB objects used               | DETERMINISTIC | `rip_probe`      | 1.0        | Y       | `convert_cmyk` | Requires server-side separation check. Current canvas_signal is highly inaccurate. |
| `color-content-detected`| Color content detected         | DETERMINISTIC | `rip_probe`      | 1.0        | Y       | `convert_cmyk` | If file is intended to be Grayscale. Must check actual separations. |
| `ink-heavy-bg-1`        | Heavy ink background           | HEURISTIC     | `canvas_signal`  | 0.7        | N       | N/A      | Warns layout issues. Not a substitute for real TAC calculation. |
| `ink-photo-1`           | Photo-heavy content            | HEURISTIC     | `canvas_signal`  | 0.7        | N       | N/A      | Classification aid. |
| `ink-rich-black-1`      | Rich black text                | DETERMINISTIC | `rip_probe`      | 1.0        | Y       | `convert_cmyk` | Must check if 100K+C/M/Y is used on text objects. |
| `print-edition-intent`  | Print intent (Book/Mag/Cover)  | HEURISTIC     | `canvas_signal`  | 0.6        | N       | N/A      | Layout pattern matching. Highly valuable as a UX feature. |
| `fonts-used-summary`    | Fonts used                     | DETERMINISTIC | `pdf_struct`     | 1.0        | N       | N/A      | Extract from PDF dictionaries. |
| `fonts-not-embedded`    | Fonts not embedded             | DETERMINISTIC | `pdf_struct`     | 1.0        | N       | N/A      | Fatal print error. |
| `type3-fonts-present`   | Type 3 (bitmap) fonts present  | DETERMINISTIC | `pdf_struct`     | 1.0        | N       | N/A      | Often vector degradation. |
| `imposition-*`          | Suspected imposition issues    | HEURISTIC     | `canvas_signal`  | 0.6        | N       | N/A      | Marks detection, repeated pages, layout patterns. |
| *(New)* `overprint-*`   | Bad overprint configuration    | DETERMINISTIC | `rip_probe`      | 1.0        | Y       | `flatten` | Checks knockout vs overprint flags. |
| *(New)* `tac-exceeded`  | Total Area Coverage exceeded   | DETERMINISTIC | `rip_probe`      | 1.0        | Y       | `convert_cmyk` | Actual CMYK pixel values via `tiffsep`. |

---

## Task 2 — Unified Findings Schema (JSON)

### `preflight_report_v2.json`
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "PrintPrice Preflight Report V2",
  "type": "object",
  "properties": {
    "document": {
      "type": "object",
      "properties": {
        "fileName": { "type": "string" },
        "fileSize": { "type": "integer" },
        "pageCount": { "type": "integer" },
        "pdfVersion": { "type": "string" }
      }
    },
    "engines": {
      "type": "object",
      "properties": {
        "client_engine_version": { "type": "string" },
        "server_engine_version": { "type": "string" }
      }
    },
    "findings": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": { "type": "string" },
          "title": { "type": "string" },
          "type": { "enum": ["deterministic", "heuristic"] },
          "severity": { "enum": ["info", "warning", "error", "fatal"] },
          "confidence": { "type": "number", "minimum": 0, "maximum": 1 },
          "user_message": { "type": "string" },
          "developer_message": { "type": "string" },
          "tags": { "type": "array", "items": { "type": "string" } },
          "evidence": {
            "type": "object",
            "properties": {
              "source": { "enum": ["pdf_struct", "rip_probe", "canvas_signal", "metadata"] },
              "details": { "type": "string" },
              "page_refs": { "type": "array", "items": { "type": "integer" } }
            }
          },
          "fix": {
            "type": "object",
            "properties": {
              "available": { "type": "boolean" },
              "applied": { "type": "boolean" },
              "step": { "type": "string" },
              "output_asset_id": { "type": "string" }
            }
          },
          "before_after": {
            "type": "object",
            "properties": {
              "before_value": { "type": "string" },
              "after_value": { "type": "string" },
              "delta": { "type": "string" }
            }
          }
        },
        "required": ["id", "title", "type", "severity", "confidence", "evidence", "user_message"]
      }
    }
  }
}
```

**Example JSON Instance**:
```json
{
  "document": {
    "fileName": "brochure_print.pdf",
    "fileSize": 4502100,
    "pageCount": 16,
    "pdfVersion": "1.7"
  },
  "engines": {
    "client_engine_version": "2.1.0",
    "server_engine_version": "1.5.0-ghostscript-10.0"
  },
  "findings": [
    {
      "id": "rgb-objects-found",
      "title": "RGB Objects Detected",
      "type": "deterministic",
      "severity": "error",
      "confidence": 1.0,
      "user_message": "We found colors intended for screens (RGB). These will look different when printed.",
      "developer_message": "DeviceRGB colorspace detected in XObjects on page 3.",
      "tags": ["color", "compliance"],
      "evidence": {
        "source": "rip_probe",
        "details": "Ghostscript tiffsep detected separations beyond CMYK.",
        "page_refs": [3]
      },
      "fix": { "available": true, "applied": false, "step": "convert_cmyk" }
    },
    {
      "id": "print-edition-intent",
      "title": "Book Layout Detected",
      "type": "heuristic",
      "severity": "info",
      "confidence": 0.85,
      "user_message": "This document looks like a book or magazine layout.",
      "developer_message": "Canvas signal matched facing-pages text layout threshold.",
      "tags": ["layout", "intent"],
      "evidence": {
        "source": "canvas_signal",
        "details": "High text density and symmetric margins detected.",
        "page_refs": []
      },
      "fix": { "available": false, "applied": false }
    }
  ]
}
```

---

## Task 3 — Two-Engine Pipeline Design

### A) Endpoint Contracts
- `POST /api/preflight/analyze`
  - Upload PDF. Server runs deterministic checks (GS, Poppler). Client can merge these with its own heuristical canvas findings.
  - Returns: `report_v2` + `asset_id`
- `POST /api/preflight/autofix`
  - Payload: `{ asset_id: "...", fix_policy: ["convert_cmyk", "add_bleed"] }`
  - Server queues the job.
  - Returns: `{ job_id: "uuid" }`
- `GET /api/jobs/:job_id`
  - Returns: `{ status: "processing|completed|failed", progress: 45, result_asset_id: "...", error: null }`
- `GET /api/assets/:asset_id`
  - Returns: The PDF binary.
- `POST /api/preflight/recheck`
  - Payload: `{ fixed_asset_id: "..." }`
  - Runs deterministic analysis again.
  - Returns: `report_v2` + `delta_summary` (Before vs After metrics).

### B) Queue/Worker Design
- **States**: `PENDING` -> `PROCESSING` -> `COMPLETED` | `FAILED`.
- **Infrastructure**: Use BullMQ or a lightweight Redis queue to prevent server lockups.
- **Resilience**: 
  - Wrap any `child_process.spawn` in a robust try-catch-on('error') mechanism.
  - 120s timeout per job. Maximum retries: 1 (in case of isolated I/O hiccup).
  - Check for GS `ENOENT` proactively on node startup.
- **Reporting**: Logs must trace step timings (`[JOBUUID] step convert_cmyk took 3.2s`).

### C) Deterministic Engine Strategy
The server assumes absolute authority using mature compiled binaries:
1. **Separations & TAC (RIP-grade)**: Use Ghostscript with the `tiffsep` device at 72 or 150 DPI. It outputs one TIFF per separation (Cyan, Magenta, Yellow, Black, plus spots). We scan these channels:
   - If a Spot TIFF exists -> Spot objects verified.
   - Sum C+M+Y+K pixels -> Absolute TAC calculation.
2. **Fonts & Embedded Media**: Use Poppler (`pdffonts`, `pdfimages -list`).
3. **Geometry**: Use `pdfinfo -box` to grab precise BleedBox, TrimBox, MediaBox coordinates. No CSS/HTML5 scale factors involved.

### D) Avoiding Dissonance
- **Precedence**: Server Truth > Canvas Signal. If PDF.js says "Color spaces ok" but Ghostscript detects Spot colors, the Server issue is promoted to the UI, overriding PDF.js.
- **UX Separation**: In the report, heuristics are flagged as "Visual Signals" or "Smart Estimates."
- **Contradiction handling**: If PDF.js canvas heuristics generate a warning that Ghostscript contradicts (e.g., ink-heavy warning but TAC is mathematically safe), the UI groups the heuristic under "Visual Warnings (May print safely)" to assure the user.

---

## Task 4 — Product/UI Reframing

| Finding ID              | New UI Title                             | UI Message (Novice-friendly)                                                                 | Severity |
|:------------------------|:-----------------------------------------|:---------------------------------------------------------------------------------------------|:---------|
| `rgb-only-content`      | Web Colors Detected                      | This document uses screen colors. We've detected them and can automatically convert them to print-safe colors. | Error    |
| `ink-heavy-bg-1`        | Heavy Ink Background *(Estimate)*        | Our AI estimates this background might use too much ink, which can cause drying issues.        | Warning  |
| `ink-photo-1`           | Complex Image Area *(Estimate)*          | Looks like there are intense photographs. Make sure they are high quality.                   | Info     |
| `print-edition-intent`  | Document Intent: Book/Mag *(Estimate)*   | We recognized this layout as a book/magazine, which is great for verifying margins.            | Info     |
| `imposition-th11a`      | Possible Layout Issue *(Estimate)*       | We detected an unusual spacing pattern near the edges. Review your margins carefully.          | Warning  |
| `fonts-not-embedded`    | Missing Fonts                            | Some fonts aren't saved inside the PDF. The printer's computers might substitute them.         | Fatal    |
| `tac-exceeded`          | Maximum Ink Limit Exceeded               | The sum of CMYK inks is too high in some areas (e.g. >300%). This will smudge on the press.  | Error    |

---

## Task 5 — Next Version Roadmap (Engineering BackLOG)

| Item | Description | Priority | Impact | Complexity | Acceptance Criteria | Owner |
|:-----|:------------|:---------|:-------|:-----------|:--------------------|:------|
| **P0-1** | **Dependency Orchestrator Check** | P0 | Critical | Low | On startup, server asserts `gs`, `pdffonts` exist in PATH or fails gracefully with clear error indicating missing dependencies. | Backend / DevOps |
| **P0-2** | **Worker-based AutoFix Queue** | P0 | Critical | Medium | AutoFix routes offloaded from Express thread to a queue system (BullMQ) with safe process spawning. | Backend |
| **P1-1** | **Server Deterministic Checks (TAC & Spots)** | P1 | High | High | Implement GS `tiffsep` logic for real separation and TAC calculation. Expose over `/api/preflight/analyze`. | Backend |
| **P1-2** | **Unified Report V2 Schema Adoption** | P1 | High | Low | Refactor frontend state to consume `report_v2` format. Display Before/After deltas natively. | Frontend |
| **P2-1** | **Advanced Heuristics (ML-ready)** | P2 | Medium | High | Send canvas-generated datasets to a dedicated classification model. Improve "print-edition-intent". | Fullstack |

---

## Task 6 — Verification Plan

**15 PDF Test Suite Specification**

| PDF Generator Name          | Core Purpose                                      | Expected Deterministic Check     | Expected Heuristic Check         |
|:----------------------------|:--------------------------------------------------|:---------------------------------|:---------------------------------|
| `T01_bleed_0mm.pdf`         | Geometry missing bleed box                        | `missing-bleed-info`             | `imposition-warning`             |
| `T02_bleed_1mm.pdf`         | Geometry insufficient bleed                       | `insufficient-bleed`             | N/A                              |
| `T03_rgb_images.pdf`        | Image Color Space = DeviceRGB                     | `rgb-only-content`               | `ink-photo-1`                    |
| `T04_rgb_vector.pdf`        | Vector Object Color Space = DeviceRGB             | `rgb-only-content`               | N/A                              |
| `T05_transparency_overlay`  | Transparency groups present                       | Transparency flag active         | N/A                              |
| `T06_spot_color_objects`    | Separation color space (e.g., PANTONE)            | Extracted spot channel name      | Will fail client canvas check    |
| `T07_spot_color_text`       | Spot color applied to fonts                       | Extracted spot channel name      | Will fail client canvas check    |
| `T08_tac_over_limit_350`    | CMYK > 300% TAC                                   | `tac-exceeded` (>300%)           | `ink-heavy-bg-1`                 |
| `T09_overprint_knockout`    | Simulate bad text knockout on background          | `overprint-bad-config`           | N/A                              |
| `T10_rich_black_text.pdf`   | Body text in 4-color black instead of 100K        | `ink-rich-black-1`               | N/A                              |
| `T11_fonts_not_embedded`    | Font dictionary missing /Length /Filter           | `fonts-not-embedded`             | N/A                              |
| `T12_type3_fonts.pdf`       | Type3 subset usage                                | `type3-fonts-present`            | N/A                              |
| `T13_safe_book_layout.pdf`  | Standard CMYK book interior, embedded fonts       | Minimal warnings                 | `print-edition-intent` = Book    |
| `T14_layer_ocg_mismatch`    | Hidden non-printing layers vs visible             | OCG geometry extracted           | Potential client visual mismatch |
| `T15_safe_cmyk_tac_240.pdf` | Fully compliant ISO Coated PDF                    | 100% Deterministic Pass          | 100% Heuristic Pass              |

---

## Appendix: V2 Final Architecture Diagram (SaaS at Scale)

```text
                ┌───────────────────────────────────────────────────┐
                │                    Frontend                        │
                │  Web App (UI) + PDF Preview + Heuristic Signals    │
                │  - PDF.js render (for preview ONLY)                │
                │  - Canvas heuristics (ink risk, edition intent)     │
                │  - Upload + job tracking + report viewer            │
                └───────────────┬───────────────────────────────────┘
                                │ HTTPS
                                ▼
┌────────────────────────────────────────────────────────────────────────┐
│                            API Gateway / BFF                            │
│  Auth (JWT) | Rate Limit | Tenant Context | Request Validation           │
│  Routes: /preflight/analyze | /preflight/autofix | /jobs | /assets        │
└───────────────┬─────────────────────────────┬───────────────────────────┘
                │                             │
                │                             │
                ▼                             ▼
┌───────────────────────────────┐     ┌──────────────────────────────────┐
│        Asset Service           │     │          Report Service           │
│  S3/R2/MinIO object storage    │     │  Report v2 builder + registry     │
│  - raw PDFs                    │     │  - issue_registry + i18n mapping  │
│  - fixed PDFs                  │     │  - merge deterministic+heuristic  │
│  - artifacts (heatmaps, thumbs)│     │  - delta before/after             │
└───────────────┬───────────────┘     └───────────────┬──────────────────┘
                │                                       │
                │                                       │
                ▼                                       ▼
         ┌───────────────────┐                  ┌───────────────────┐
         │    Job Queue       │                  │   Metadata DB      │
         │  Redis + BullMQ    │                  │ Postgres (multi-tenant)
         │  - analyze jobs    │                  │ jobs, assets, reports
         │  - autofix jobs    │                  │ billing usage, audit log
         └─────────┬─────────┘                  └─────────┬─────────┘
                   │                                      │
                   ▼                                      ▼
┌────────────────────────────────────────────────────────────────────────┐
│                           Worker Pool (K8s / Autoscale)                │
│                                                                        │
│  (A) Deterministic Prepress Worker (RIP-grade truth)                   │
│   - Ghostscript probes (separations, CMYK raster TAC)                  │
│   - Poppler tools (pdfinfo, pdffonts, pdfimages)                       │
│   - Structural parser (qpdf/pikepdf) for DeviceN/OCG/OP flags          │
│   - Produces: deterministic findings + metrics                         │
│                                                                        │
│  (B) AutoFix Worker (safe pipeline)                                    │
│   - Color convert (ICC/OutputIntent policy)                            │
│   - Flatten transparency (policy-driven)                               │
│   - Add bleed canvas (geometry step)                                   │
│   - Embed/subset fonts via pdfwrite where safe                          │
│   - Rebuild/cleanup (qpdf linearize/repair)                             │
│   - Produces: fixed PDF + transformation log                            │
│                                                                        │
│  (C) Artifact Worker (optional)                                        │
│   - thumbnails, page previews, TAC heatmaps, separation previews        │
│                                                                        │
└───────────────────────────┬────────────────────────────────────────────┘
                            │
                            ▼
                 ┌────────────────────────────┐
                 │  Post-Fix Re-Preflight     │
                 │  deterministic recheck     │
                 │  + delta computation       │
                 └────────────────────────────┘
```

### Key Considerations for Production
- **Observability**: Structured logs (JSON) + correlation_id per job, OpenTelemetry Tracing, metrics on job latency and GS failures.
- **Tenant Policies**: e.g., `OFFSET_CMYK_STRICT` (strict TAC/color limits) vs. `DIGITAL_POD_CONVERT` (soft warnings, auto-converts RGB).
- **The "Wow" Factor - Delta Computation**: Generating a visual difference of *Before vs After* metrics (e.g., RGB objects: 12 → 0, TAC max: 345% → 288%) adds extreme value over legacy preflight tools.

---

## Appendix B: OpenAPI / Endpoint Contracts (Draft)

These define the robust implementation interfaces connecting the Client, Gateway, and Workers.

### `POST /api/preflight/analyze`
**Input**:
```json
{
  "tenant_id": "printer_123",
  "asset_id": "asset_9f2",
  "policy": "OFFSET_CMYK_STRICT"
}
```
**Output**:
```json
{
  "asset_id": "asset_9f2",
  "report_id": "report_1",
  "report_version": "v2",
  "status": "completed"
}
```

### `POST /api/preflight/autofix`
**Input**:
```json
{
  "asset_id": "asset_9f2",
  "policy": "OFFSET_CMYK_STRICT"
}
```
**Output**:
```json
{
  "job_id": "job_7ac2",
  "status": "queued"
}
```

### `GET /api/jobs/{job_id}`
**Output**:
```json
{
  "job_id": "job_7ac2",
  "status": "running",
  "progress": 0.6,
  "step": "convert_cmyk"
}
```

### `POST /api/preflight/recheck`
**Input**:
```json
{
  "asset_id": "fixed_asset_9f2"
}
```
**Output**:
```json
{
  "report_before": "report_1",
  "report_after": "report_2",
  "delta": {
    "rgb_objects": [12, 0],
    "tac_max": [345, 288],
    "fonts_embedded": [false, true]
  }
}
```

---

## Appendix C: Central Issue Registry

All findings MUST be decoupled from logic and stored in a versioned, localizable JSON file (`issue_registry.json`).

```json
{
  "rgb-only-content": {
    "type": "deterministic",
    "severity": "error",
    "category": "color",
    "fix": "convert_cmyk",
    "user_title": "RGB colors detected",
    "user_message": "This file contains RGB elements not suitable for offset printing."
  },
  "ink-heavy-bg-1": {
    "type": "heuristic",
    "severity": "warning",
    "category": "ink",
    "confidence": 0.7,
    "user_title": "High ink background",
    "user_message": "Large dark areas may cause ink set-off or banding during press."
  }
}
```

*Benefits*: Multi-lingual support (i18n), consistent UI labels, API documentation, and decoupling rule tuning from deployment.

---

## Appendix D: Tenant Policy Engine

Enables the SaaS to serve different physical print types or customers with isolated preflight requirements.

```json
{
  "OFFSET_CMYK_STRICT": {
    "allow_rgb": false,
    "convert_rgb": true,
    "tac_limit": 300,
    "allow_spots": ["cut", "varnish", "diecut"],
    "require_output_intent": true
  },
  "DIGITAL_POD_CONVERT": {
    "allow_rgb": true,
    "convert_rgb": true,
    "tac_limit": 320,
    "allow_spots": [],
    "require_output_intent": false
  }
}
```

---

## Product Differentiation Statement

Traditional preflight tools evaluate **Technical compliance checks** exclusively.

PrintPrice Preflight V2 provides:
- **Technical Compliance** (Determinism)
- **Automated Correction** (Safe AutoFix)
- **Print Risk Prediction** (Heuristics + AI)

> **PrintPrice Preflight is not just a preflight tool — it is a Print Risk Intelligence Engine.**

---

## Appendix E: V2 Implementation Plan (First 6 Weeks)

A rolling implementation plan to build V2 without "big bang" deployments, starting with foundational stability and ending with a highly functional Release Candidate.

### Week 1: Foundations: Stability, Dependencies, Contracts
**Goal**: The system never crashes due to dependencies, establishing the V2 skeleton.
* **Backend**: Implement dependency manager (`checkGhostscript`, `pdffonts`, etc.) that blocks startup or degrades gracefully on `ENOENT`.
* **API**: Scaffold OpenAPI contracts (`/analyze`, `/autofix`, `/jobs`, `/assets`).
* **DB**: Initial job/asset schema migrations (Postgres). 
* **Errors**: Standardized JSON error responses.

### Week 2: Asset Pipeline + Job Queue + MVP Deterministic Worker
**Goal**: End-to-end flow: Upload → Analyze Job → Report V2.
* **Pipeline**: S3/Local asset upload and persistence. Job Queues (BullMQ) active.
* **Worker**: Deterministic Worker MVP uses `pdfinfo` and `pdffonts` for fast, truth-level checks (pages, fonts embedded/Type3).
* **Reporting**: First integration of `issue_registry.yaml` and generation of `report_v2`.

### Week 3: AutoFix Worker v1 + Post-fix Recheck + Delta (The "WOW" Feature)
**Goal**: AutoFix functions safely via queues and generates the Before/After Delta.
* **Worker**: Safe `spawnSafe` pipeline running `convert_cmyk` and `add_bleed`.
* **Recheck**: Worker triggers re-analysis upon autofix completion to compute `delta_summary` (e.g., RGB: 12 → 0).

### Week 4: Deterministic Engine v2: Color & Separations
**Goal**: Move critical checks to RIP-grade server logic.
* **Logic**: Implement `qpdf` structural parsing or GS separation probes to natively detect Spots, DeviceN, and OutputIntents.
* **Policy**: Enforce `OFFSET_CMYK_STRICT` or `DIGITAL_POD_CONVERT` actions on discovered spots/RGB.

### Week 5: TAC Engine + Heatmap Artifacts
**Goal**: Industrial credibility through real Total Area Coverage.
* **Logic**: GS CMYK rastering at 150 DPI for global TAC. Adaptive localized rescan at 300 DPI triggered by thresholds.
* **Artifacts**: Store TAC heatmaps as artifacts and expose via Asset API endpoints.

### Week 6: Unification, Heuristics as "Signals", and Release Candidate
**Goal**: CI/CD testing, merging, and release.
* **Merge Layer**: Frontend submits canvas heuristics (`print-edition-intent`); Backend merges these into the report tagged clearly as `"heuristic"` to preventing contamination of deterministic truths.
* **QA Harness**: Fully automate the 15-PDF test suite inside CI, ensuring no regressions on Deltas.
* **Ops Hardening**: Implement job timeouts, max file sizes, and OpenTelemetry logging.

---

## Appendix F: Definition of Done (DoD)

To prevent misinterpretations, any feature or component in V2 is considered "Done" only if it meets these criteria:

- **API Endpoints**: Input validation complete (Zod/Joi), standard JSON error codes implemented, and fully synced with the OpenAPI specification.
- **Workers (Jobs)**: Handled idempotently. Explicit retry handling, strict job timeouts, and assured cleanup of temporary PDF/TIFF files.
- **Assets**: SHA256 hashing on upload (for potential deduplication), strict retention policy, and secure scoped access permissions.
- **Reports V2**: JSON conforms strictly to schema validation and 100% of reported issues exist in the Central Issue Registry.

---

## Appendix G: Security Baseline & Threat Model

With Ghostscript being a significant attack surface, the system employs mandatory safety isolations:

1. **Upload Limits**: Hard caps on file size and MIME type strict validation. Optional AV scan hooks.
2. **Process Isolation & Sandboxing**: Ghostscript and Poppler run inside isolated containers or profiles with Seccomp/AppArmor to prevent arbitrary command execution vulnerabilities (e.g., `-dSAFER`).
3. **Rate Limiting**: Strictly enforced by the API Gateway per tenant and underlying IP address.
4. **Asset Access Control**: Downloads secured via short-lived signed URLs.
5. **Audit Trails**: Extensive logging of tenant upload, analysis, and download operations via Postgres metadata.

---

## Appendix H: Cost Model & Unit Economics

Understanding the cost topology per PDF document processed:

- **Cost Topology per Job**: CPU time per `gs` separation probe + `poppler` memory use + scalable object storage egress bandwidth.
- **Caching Mechanism**: SHA256 hashing deduplicates re-uploaded files, fetching cached reports immediately without utilizing compute (vital for predictable expenses).
- **Service Limits**: Soft limits imposed on metrics like Max DPI for TAC scans or number of heatmaps generated based on subscription tier.
- **North Star Metrics**: 
  - **Delta-per-job** (Wow effect index)
  - **Success rate** (Resilience percentage)
  - **Cost-per-job** (Financial efficiency index)

---

## Appendix I: Production Runbook (SRE-Lite)

Basic incident response checklists for platform operators:

1. **System Health**: Continuously monitor `/health`, `/health/deps`, and Prometehus/OTel `/metrics`.
2. **High Queue Depth**: Trigger auto-scaling of worker pods. Evaluate isolating heavy tenants to dedicated queue lanes if experiencing noisy neighbor issues.
3. **Ghostscript Failure Spikes**: Check for massive/corrupt PDF flood. Validate `tmp` directory size and prune orphaned nodes. Ensure `-dSAFER` hasn't tripped on newly discovered syntax vulnerabilities.
4. **Data Lifecycle**: Configured cron jobs to sweep and scrub raw `assets/` and `tmp/` past their retention guarantees.
5. **Disaster Recovery**: Nightly streaming backups of the Postgres databases with quarterly restore drills.

---

## Appendix J: ADR Pack (Architecture Decision Records)

To mitigate circular discussions over architectural strategy during development:

1. **ADR-01: Deterministic Truth is Server-Side** - Frontend sets signals. Final PDF/X or color profile verdicts belong to server compilation via GS/Poppler to avoid browser discrepancies.
2. **ADR-02: BullMQ + Redis Chosen** - Asynchronous worker queues selected over fast-CGI or native Express requests to isolate heavy compute (I/O & Spawns) from blocking the HTTP loop.
3. **ADR-03: Report V2 Schema and Registry** - Issues decoupled from business logic and centralized in `issue_registry.json` to enable i18n, seamless updates, and UI stability.
4. **ADR-04: Tenant Policy Engine Model** - Conversion behaviors configured per tenant (`OFFSET_CMYK` vs `DIGITAL_POD`) allowing customized strictness levels under the same infrastructure APIs.
5. **ADR-05: TAC Method and DPI Strategy** - Ghostscript selected to perform low-DPI initial sweeps, performing dynamic 300 DPI rescans exclusively on identified threshold-breaking areas to optimize CPU spend.
6. **ADR-06: Asset Storage Strategy** - Utilization of S3/R2 object storage enabling secure, scalable decoupled blobs without bloating application servers or the relational database.

---

## Appendix K: Week-1 Kickoff Board

The immediate execution tickets for Backend Engineering to start V2 construction:

| Ticket | Description                                       | Owner   | Priority |
| ------ | ------------------------------------------------- | ------- | -------- |
| BE-001 | Implement dependency check (gs, poppler, qpdf)    | Backend | P0       |
| BE-002 | Implement `spawnSafe` wrapper                     | Backend | P0       |
| BE-003 | Create DB tables: assets, jobs, reports           | Backend | P0       |
| BE-004 | Implement `/api/preflight/autofix` queue endpoint | Backend | P0       |
| BE-005 | BullMQ worker skeleton                            | Backend | P0       |
| BE-006 | Implement `/health/deps` endpoint                 | Backend | P1       |

---

## Appendix L: Recommended Repository Structure

A standardized directory layout to eliminate early structural friction:

```text
printprice-preflight-v2
│
├── api
│   ├── routes
│   │   ├── preflight.js
│   │   ├── jobs.js
│   │   └── assets.js
│   ├── controllers
│   └── middleware
│
├── workers
│   ├── deterministic-worker
│   ├── autofix-worker
│   └── artifact-worker
│
├── services
│   ├── ghostscript
│   ├── poppler
│   ├── tac-engine
│   └── pdf-parser
│
├── registry
│   └── issue_registry.json
│
├── policies
│   └── policies.json
│
├── schemas
│   └── report_v2.schema.json
│
├── tests
│   └── pdf_test_suite
│
└── infrastructure
    ├── docker
    ├── redis
    └── storage
```

---

## Appendix M: North Star Metrics

The four operational metrics determining the success and adoption velocity of the new Print Risk Intelligence Engine:

| Metric                       | Target Goal          |
| ---------------------------- | -------------------- |
| Preflight Detection Accuracy | >95% (on test suite) |
| AutoFix Success Rate         | >90%                 |
| Mean Job Processing Time     | <15s                 |
| **Delta Improvement Rate**   | **>70% of jobs improve** |

*Note: The Delta Improvement Rate is the ultimate proof of value presented to the end customer.*
