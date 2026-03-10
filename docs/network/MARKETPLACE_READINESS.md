# Marketplace Readiness (Phase 29)

Phase 29 introduces the transition from a pure routing engine to a commercial marketplace by enabling structured negotiations and counteroffers.

## Negotiation Lifecycle

The `negotiationService` manages the state of an offer's commercial terms.

1.  **None**: Initial state of a newly created offer.
2.  **Open**: Explicitly opened for negotiation by the platform or printer.
3.  **Countered**: A printer or the platform has proposed new terms (price, lead time).
4.  **Accepted**: Terms have been agreed upon. Committed terms are locked into the offer.
5.  **Rejected**: Negotiation failed.
6.  **Expired**: Timeout reached (24h for negotiations, 12h for counteroffers).

## Counteroffer Model

Printers can propose revisions to any pending offer via the `offer_counteroffers` table.
Each new counteroffer **supersedes** the previous pending one, ensuring only one active proposal exists at a time.

- **Proposed Price**: Revised production cost.
- **Proposed Lead Time**: Revised delivery window.
- **Notes**: Justification for the change.

## Commercial Readiness

A marketplace session reaches `COMMERCIALLY_READY` when:
- An offer is accepted.
- Technical and commercial terms are locked.
- A `commercial_commitment_json` is generated, summarizing the agreement.

This state is the prerequisite for Phase 30's payment and settlement layer.

## Operational Controls

The **Negotiation & Readiness** tab in the Admin Dashboard provides:
- **Negotiation Chain**: Full history of counterproposals.
- **Commitment Status**: Real-time tracking of which jobs are ready for production.
- **Manual Intervention**: Admins can accept printer terms or propose platform-side adjustments.

## Background Automation

The `marketplace-expiry-worker` ensures the network doesn't stall by automatically expiring stale negotiations and counteroffers.
