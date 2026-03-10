# Economic Routing Engine (Phase 28.2)

The Economic Routing Engine acts as a strategic decision layer that balances technical production capabilities with financial objectives.

## Scoring Model

The `final_routing_score` is calculated using a weighted average of technical and economic factors:

| Factor | Weight | Description |
| :--- | :--- | :--- |
| **Technical** | 40% | Base `routing_score` from Print Intelligence Graph. |
| **Margin** | 25% | Normalized margin percentage relative to the candidate set. |
| **Cost** | 15% | Inverse normalization of production cost (cheapest = 1.0). |
| **Quality** | 10% | Historical quality score of the printer node. |
| **Lead Time** | 10% | Inverse normalization of lead time (fastest = 1.0). |

## Normalization Logic

To ensure fair comparison across diverse candidate sets, the engine uses relative normalization:

- **Margin Signal**: `margin_pct / max_margin_in_set`
- **Cost Signal**: `min_cost_in_set / production_cost`
- **Lead Time Signal**: `min_lead_time_in_set / lead_time_days`

## Conflict Detection

The engine identifies potential risks before recommending a route:

- **NEGATIVE_MARGIN**: Production cost > Suggested price (Severity: HIGH).
- **LOW_MARGIN**: Margin below configured threshold (Severity: MEDIUM).
- **HIGH_COST_OUTLIER**: Candidate cost is >150% of the cheapest option (Severity: LOW).
- **NO_ECONOMICALLY_VIABLE_ROUTE**: No candidates meet the minimum final score (Severity: HIGH).

## Audit & Transparency

All economic decisions are logged in `economic_routing_audit`. Administrators can view the JSON breakdown of normalized factors for every recommendation in the Admin Dashboard.

## Configuration

Thresholds can be adjusted in `services/economicRoutingService.js`:
- `minimum_margin_pct`: Default 15%
- `minimum_final_score`: Default 50
