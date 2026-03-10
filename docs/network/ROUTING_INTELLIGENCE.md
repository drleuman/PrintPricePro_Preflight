# Routing Intelligence & Quality (Phase 26.2)

The PrintPrice Routing Engine has been upgraded to a multi-dimensional scoring model. Decisions are now driven by compatibility, quality, capacity, regional proximity, and price.

## Scoring Model

The `routing_score` (0-100) is calculated as a weighted average of five factors:

| Factor | Weight | Source |
| --- | --- | --- |
| **Compatibility** | 35% | `intelligenceService` (PDF features vs Machine) |
| **Quality** | 25% | `printerQualityService` (Historical outcomes) |
| **Capacity** | 20% | `printer_capacity` (Available units today) |
| **Price Index** | 10% | `printer_nodes` (Node's base price multiplier) |
| **Distance** | 10% | Geolocation logic (Regional proximity) |

### Weighted Formula
`score = (comp * 0.35 + qual * 0.25 + cap * 0.20 + price * 0.10 + dist * 0.10) * 100`

## Quality Feedback Loop

Every time a job outcome is recorded (`SUCCESS`, `REPRINT`, `FAILED`), the system:
1. Updates `job_outcomes`.
2. Triggers `printerQualityService` to recompute the node's `quality_score`.
3. Updates `printer_performance` for historical trend analysis.

### Quality Score Calculation
`quality_score = (success_rate * 0.5) + (on_time_delivery_rate * 0.3) + ((1 - reprint_rate) * 0.2)`

## Database Governance

- **`routing_history`**: Tracks every evaluation (even if not selected) to audit the engine's bias and conflicts.
- **`printer_performance`**: Snapshots of printer reliability over time.
- **`job_outcomes`**: The ground truth for closing the Loop.

## Administration

Global routing stats and individual printer performance are visible in the **Network Operations** dashboard.
- **Routing Intelligence Panel**: High-level metrics and conflict detection.
- **Node Drawer > Performance**: Deep-dive into success rates and delivery speed.
