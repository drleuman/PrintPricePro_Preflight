# Commercial Commitments & Settlement Readiness (Phase 29.1)

Phase 29.1 introduces the bridge between the marketplace negotiation and final financial settlement. It establishes an immutable ledger of agreements.

## The Commercial Commitment

A `commercial_commitment` is an immutable (or append-only) record generated once a marketplace session is marked as commercially ready.

- **Transaction Reference**: Every commitment receives a unique, human-readable reference (format: `PPC-YYYY-NNNNNN`).
- **Financial Snapshot**: Records the committed price, production cost, and platform margin at the moment of agreement.
- **Ledger Reference**: Placeholder for future integration with accounting systems (SAP, NetSuite, etc.).

## Settlement Readiness Lifecycle

The system automatically evaluates whether a commitment is prepared for the next financial step.

1.  **NOT_READY**: Initial state.
2.  **READY_FOR_INVOICE**: Terms are locked, reference generated, but commitment is not yet finalized.
3.  **READY_FOR_PAYOUT**: Commitment is `LOCKED`, financials are validated, and the system is ready to pay the printer.
4.  **SETTLEMENT_PENDING**: Payout has been initiated (Phase 30).
5.  **SETTLED**: Funds have moved.

## Immutability & Locking

- **READY**: The commitment is active but can still be voided if the job fails before production starts.
- **LOCKED**: The agreement is final. Financial values cannot be changed. All subsequent updates must be recorded as metadata events.
- **VOIDED**: The commitment is cancelled. No settlement can occur.

## Placeholder Economic Model

The system computes projected settlement values:
- `gross_value`: The total price committed by the platform.
- `platform_fee`: The margin kept by PrintPrice.
- `payable_to_printer`: The amount to be remitted to the producer.

## Auditability

Every change to a commitment is tracked in the `commercial_commitment_events` table, providing a full audit trail for financial disputes or compliance.
