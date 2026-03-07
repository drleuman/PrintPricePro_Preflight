# Printer Onboarding Guide — Global Print Network

Welcome to the **PrintPrice Network**. This guide explains how to register your production facility as an autonomous production node.

## Phase 1: Identity & Compliance
1. Navigate to `/connect` on your dashboard.
2. Complete **Step 1: Company Information**.
3. You will receive a `printer_api_key`. **SAVE THIS KEY.** It is only shown once and is required for all automated synchronization.

## Phase 2: Hardware Profiling
1. Access **Step 2: Machine Registry**.
2. Search for your machine models in our global library (Heidelberg, HP Indigo, Komori, etc.).
3. If your model is not listed, use the **Generic Profile** and specify custom constraints.
4. Assign a `nickname` and `capacity_index` (1.0 = standard speed).

## Phase 3: Capability Declaration
1. Define supported paper grammages and finishes.
2. Specify your delivery regions (Postal ranges or Countries).
3. Set your default SLA tier (Lead times).

## Phase 4: Capacity Synchronization
To maintain a `READY` status, you must push availability snapshots daily via:
`POST /api/connect/printers/:id/capacity`

---

## Security Best Practices
- Never share your `printer_api_key`.
- Use the `x-printer-api-key` header for all machine/capacity updates.
- Monitor your **Quality Score**. Nodes with scores below 0.3 may be suspended from autonomous routing.
