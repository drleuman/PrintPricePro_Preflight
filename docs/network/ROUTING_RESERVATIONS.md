# Routing Reservation Layer (Phase 27.2)

The Routing Reservation Layer prevents capacity race conditions by implementing soft-locks on printer capacity during the routing decision process.

## Reservation Lifecycle

1.  **Creation**: When the routing engine recommends a printer, it generates an `ACTIVE` reservation for 5 minutes.
2.  **Verification**: Effective capacity is calculated as: `Physical - Sum(Active Reservations)`.
3.  **Confirmation**: When a job is accepted, the reservation is marked as `CONFIRMED`.
4.  **Cancellation**: If a job is rejected or timed out, the reservation is marked as `CANCELLED`.
5.  **Expiration**: The `reservation-expiry-worker` automatically marks stale reservations as `EXPIRED` every minute.

## Database Components

- `capacity_reservations`: Core state table for capacity locks.
- `reservation_events`: Audit trail for every state change in a reservation's life.

## Monitoring

The Network Operations Dashboard provides real-time visibility into:
- **Active Locks**: Total capacity currently reserved.
- **Expiry Rate**: Percentage of reservations that time out without confirmation.
- **Node Specific Detail**: The Printer Node drawer lists all active reservations for a specific printer.

## Integration Details

Reservations are integrated directly into the `RoutingRecommendationService`. A successful routing response now includes:
- `reservation_id`: The ID of the created capacity lock.
- `expires_at`: The timestamp when the lock will be released if not confirmed.
