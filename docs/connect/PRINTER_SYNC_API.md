# Printer Capacity Sync API (Phase 26.3)

Enable real-time production synchronization between printer production systems (MIS/ERP) and the PrintPrice Network.

## Authentication

All requests must include a Bearer token in the `Authorization` header.

```text
Authorization: Bearer ppk_printer_xxx
```

Tokens are hashed using **SHA-256** on the server.

## Endpoints

### 1. Update Capacity
`POST /api/printer-sync/capacity`

Updates the production availability for a specific date.

**Payload:**
```json
{
  "date": "2026-03-10",
  "capacity_total": 120,
  "capacity_available": 65,
  "lead_time_days": 2
}
```

### 2. Update Machines
`POST /api/printer-sync/machines`

Updates health and status for specific production hardware.

**Payload:**
```json
{
  "machines": [
    {
      "machine_id": "uuid",
      "status": "ACTIVE",
      "machine_health": "OK"
    }
  ]
}
```

## Sync Health & Routing Logic

The platform monitors the frequency of updates. If a node stops syncing:
- **> 6 hours**: Status becomes `STALE` (Warning in Dashboard).
- **> 24 hours**: Status becomes `OFFLINE`. **The node is automatically removed from active routing.**

### Machine Health
Machines marked as `MAINTENANCE` or `OFFLINE` are excluded from compatibility discovery regardless of printer node status.

## Best Practices
1. **Frequency**: Sync at least once every hour.
2. **Idempotency**: Requests are naturally idempotent based on the `date` or `machine_id`.
3. **Error Handling**: Monitor for `401 Unauthorized` responses, which indicate key rotation may be required.
