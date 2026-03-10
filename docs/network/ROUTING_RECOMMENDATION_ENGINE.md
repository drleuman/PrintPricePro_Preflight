# Routing Recommendation Engine (Phase 27.1)

The PrintPrice Routing Engine has been hardened for production reliability, introducing explainability, confidence scoring, and fallback mechanisms.

## Core Pillars

### 1. Explainability
Every routing decision now includes a `decision_explanation` JSON field. 
- **Dimensions**: Compatibility, Quality, Capacity, Price, Distance.
- **Traceability**: Decisions can be reviewed in the Admin Audit Log.

### 2. Confidence Scoring
A confidence score (0.0 to 1.0) is assigned to every recommendation.
- **HIGH (> 0.8)**: Strong match with multiple redundant candidates.
- **MEDIUM (0.5 - 0.8)**: Good match, limited redundancy.
- **LOW (< 0.5)**: Single candidate or low routing scores. Triggers a `routing_conflict` alert.

### 3. Fallback Strategies
If no printers match the initial constraints, the engine attempts to recover using:
- **Relaxed TAC**: 10% tolerance increase on ink coverage.
- **Radius Extension**: Expanding regional search boundaries.
- **Date Shift**: Looking for capacity in the 24-48h window.

## Monitoring & Auditing

### Audit Log (`routing_audit_log`)
Captures all candidates, selected winners, routing version, and confidence for every job.

### Conflicts (`routing_conflicts`)
Alerts operations teams when:
- `NO_COMPATIBLE_PRINTERS`: Job cannot be routed.
- `LOW_ROUTING_CONFIDENCE`: Decision risk is high.

## Admin Insights
The Network Operations Dashboard now includes a **Routing Insights** panel showing:
- Average Network Confidence.
- Fallback rate.
- Active conflict count.
