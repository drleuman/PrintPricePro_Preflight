# Marketplace Interaction Layer (Phase 28.4)

The Marketplace Interaction Layer introduces competitive dynamics to job routing, allowing multiple printer offers to be compared and managed within a decision session.

## Decision Sessions

Every job routed by the engine triggers a `job_marketplace_sessions`.

- **AUTO Selection**: The system automatically selects the offer with the highest `offer_priority_score`.
- **ADMIN Override**: Operators can manually select a different offer from the comparison view, which closes the session and cancels other proposals.
- **Audit Trail**: Every interaction is logged in `marketplace_events` for full accountability.

## Offer Ranking (Marketplace Priority)

Within a session, offers are ranked by an `offer_priority_score` (not to be confused with technical `routing_score`):

- **60% Technical Fitness**: Final routing score from the intelligence graph.
- **20% Profitability**: Normalized margin percentage.
- **20% Speed**: Normalized lead time factor.

## Interaction Workflow

1.  **Generation**: Routing engine produces top N candidates.
2.  **Invitation**: `MarketplaceService` creates structured offers for these candidates.
3.  **Competition**: Offers exist side-by-side in the session.
4.  **Resolution**: One offer is selected (Auto or Manual).
5.  **Clean-up**: Non-selected offers are marked `CANCELLED`, and their capacity reservations are released.

## Administrative Visibility

The **Marketplace** tab provides:
- **Live sessions**: Real-time view of jobs currently in the decision window.
- **Side-by-Side Table**: Direct comparison of printer capabilities, costs, and margins for a specific job.
- **Override Controls**: One-click selection to bypass automated recommendations.
