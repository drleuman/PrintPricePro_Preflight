# Autonomous Dispatch Engine (Phase 27.3)

The Autonomous Dispatch Engine enables the PrintPrice Pro platform to automatically assign jobs to printers, manage the response lifecycle, and handle failures through intelligent rerouting.

## Dispatch Lifecycle

1.  **Drafting**: A job assignment is created in `PENDING` state after a capacity reservation is secured.
2.  **Dispatching**: The system triggers a notification to the printer (Webhook/Email) and marks the assignment as `DISPATCHED`.
3.  **Printer Response**:
    - **Accept**: Assignment status moves to `ACCEPTED`. The capacity reservation is confirmed.
    - **Reject**: Assignment status moves to `REJECTED`. The reservation is released, and automatic rerouting is triggered.
4.  **Timeout**: If no response is received within 10 minutes, the system marks the assignment as `FAILED` and initiates rerouting.

## Rerouting Strategy

If a dispatch fail (REJECT or TIMEOUT), the engine:
1.  Releases the current capacity lock.
2.  Queries the Routing Engine for the next best candidate (excluding the failed printer).
3.  Repeats the dispatch sequence.
- **Max Attempts**: 3 reroute attempts per job.

## Monitoring & Operations

### Network Control Tower
- **Auto Dispatch**: Displays the total count of active assignments and the network-wide reroute rate.
- **Assignment History**: The Printer Node drawer provides a chronological log of all jobs dispatched to that specific node.

### Admin API
- `GET /api/admin/dispatch/assignments`: Recent assignment overview.
- `GET /api/admin/dispatch/events`: Detailed audit trail of all dispatch events.

## Integration Checklist
- [x] Reservations confirmed on job acceptance.
- [x] Rerouting handles capacity liberation.
- [x] Dispatch events recorded for audit.
- [x] Notification engine bridge implemented.
