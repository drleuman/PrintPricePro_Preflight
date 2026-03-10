# Pricing Intelligence Engine (Phase 28.1)

The Pricing Intelligence Engine introduces systematic economic modeling to the PrintPrice platform. It allows for deterministic estimation of production costs and suggested prices based on job features and printer profiles.

## Economic Model

The engine uses a tiered formula to calculate production costs:

```text
production_cost = 
  max(
    minimum_job_fee, 
    (base_cost * sheets + setup_cost + color_adj + tac_adj + bleed_adj)
  ) * multipliers (rush/lead_time)
```

### Profile Precedence
1.  **Machine Profile**: If specific pricing exists for a `machine_id`, it is used.
2.  **Printer Profile**: Fallback to general printer parameters if no machine-specific profile exists.

## Database Components

- `printer_pricing_profiles`: Stores the economic parameters (base cost, setup, etc.) per printer/machine.
- `job_quotes`: Persists the calculated results for a specific job/candidate route.
- `pricing_events`: Audit trail for economic calculations.

## Integration Points

### Routing Engine
The `RoutingRecommendationService` now calls `QuoteService` for every candidate. Candidates are enriched with:
- `production_cost`
- `suggested_price`
- `estimated_margin`
- `margin_pct`

### Admin Dashboard
A new **Pricing Intelligence** tab allows administrators to:
- Monitor and manage pricing profiles.
- Inspectavg markups and economic health across the network.
- (Coming in Phase 28.2) Compare route economics live.

## Usage

Quotes are generated automatically during the routing flow. They start in `ESTIMATED` status and can be used to inform autonomous dispatch decisions based on profitability.
