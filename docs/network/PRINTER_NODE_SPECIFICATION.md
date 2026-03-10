# Printer Node Specification — PrintPrice Connect

This document outlines the technical requirements and value proposition for printing facilities joining the **PrintPrice Global Print Network**.

## 1. Value Proposition (Why Join?)
- **Job Flow**: Receive pre-verified, production-ready PDF files optimized for your specific machines.
- **Zero-Touch Prepress**: Files are automatically repaired to match your machine constraints (TAC, Bleed, Profiles).
- **Network Visibility**: Expose your excess capacity to a global network of publishers and agencies.

## 2. Technical Requirements

### A. Machine Exposure
Printers must register their hardware using the **PrintPrice Machine Schema**:
- **id**: Unique identifier.
- **type**: `OFFSET`, `DIGITAL`, `LARGE_FORMAT`.
- **constraints**: `max_tac`, `min_res_dpi`, `requires_bleed`.
- **sheet_size**: Max/Min dimensions supported.

### B. Capacity Telemetry (Phase 28)
Nodes are encouraged to expose their load status:
- **status**: `AVAILABLE`, `BUSY`, `MAINTENANCE`.
- **queue_time**: Current estimated turnaround for new jobs.

### C. Paper Catalog
Nodes must publish their material inventory:
- **standard_stock**: Coated, Uncoated, Silk (Weights and ICC profiles).

## 3. Onboarding Flow (The "Connect" Protocol)

1. **Identity Verification**: Validation of business credentials.
2. **Node Creation**: Initial record created in `printer_nodes`.
3. **Hardware Catalog**: Defining machine profiles in `printer_machines`.
4. **Endpoint Setup**: Configuring the delivery bridge (SFTP, API, or HotFolder).

---
*Standardizing the world's printing capacity.*
