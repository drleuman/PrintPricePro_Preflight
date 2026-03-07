# Production Offers Layer (Phase 28.3)

The Production Offers Layer transforms internal technical routing decisions into formal, time-bound business proposals for printer nodes.

## Offer Lifecycle

| Status | Description |
| :--- | :--- |
| **PENDING** | Offer generated but not yet dispatched to printer. |
| **SENT** | Offer notified to printer. |
| **VIEWED** | Printer has opened the offer details. |
| **ACCEPTED** | Printer committed to the production cost and lead time. |
| **REJECTED** | Printer declined the offer. |
| **EXPIRED** | No response received within the 10-minute window. |
| **CANCELLED** | Admin or system manually withdrew the offer. |

## Interaction Logic

- **Default Expiry**: 10 minutes from creation.
- **Worker**: `offer-expiry-worker.js` runs every 60 seconds to clean up stale offers.
- **Rerouting**: Expiry or Rejection should trigger a release of capacity reservations and signal the routing engine to try the next best candidate.

## Printer API

Endpoints available under `/api/printer-offers/`:

- `GET /`: List active offers (`PENDING`, `SENT`, `VIEWED`).
- `POST /:id/view`: Acknowledge viewing (client-side trigger).
- `POST /:id/accept`: Formal commitment.
- `POST /:id/reject`: Rejection with payload `reason`.

## Operational Insights

Administrators can monitor health via the **Production Offers** tab:
- **Acceptance Rate**: Percentage of offers converted to assignments.
- **Avg Response Time**: Latency between creation and acceptance.
- **Expiry Rate**: High rates indicate printer inactivity or insufficient time windows.
