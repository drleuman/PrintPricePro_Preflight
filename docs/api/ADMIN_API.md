# Admin API Documentation

This document describes the administrative API endpoints for PrintPrice Pro, used for platform governance, monitoring, and billing.

## Authentication
All endpoints require the `requireAdmin` middleware, which validates the session permissions.

## Metrics & Analytics

### GET `/api/admin/metrics/overview`
Returns platform-wide metrics.
- **Parameters**: `range` (optional: `24h`, `7d`, `30d`)
- **Example**: `curl -X GET "http://localhost:3000/api/admin/metrics/overview?range=7d" -H "X-Admin-Level: super"`
- **Response**:
  ```json
  {
    "totalJobs": 1250,
    "successRate": 98.5,
    "avgLatencyMs": 450,
    "totalValueGenerated": 15000.0,
    "queueBacklog": 5
  }
  ```

### GET `/api/admin/metrics/tenants`
Tenant-level activity ranking.
- **Parameters**: `range` (optional)

---

## Tenant Management

### GET `/api/admin/tenants`
List all tenants with primary metadata and current usage.
- **Example**: `curl -X GET "http://localhost:3000/api/admin/tenants"`

### POST `/api/admin/tenants/:id`
Update tenant configuration (Plan, Status, Quotas).
- **Example**:
  ```bash
  curl -X POST "http://localhost:3000/api/admin/tenants/123" \
    -H "Content-Type: application/json" \
    -d '{"plan": "ENTERPRISE", "status": "ACTIVE"}'
  ```

---

## Billing Intelligence

### GET `/api/admin/tenants/:id/billing/:year/:month`
Retrieve aggregated usage stats for a specific period.
- **Query Parameters**: `from`, `to` (YYYY-MM-DD) for custom range.
- **Precedence**: `from`/`to` overrides `:year`/`:month`.
- **Example**: `curl -X GET "http://localhost:3000/api/admin/tenants/123/billing/2026/01?from=2026-01-01&to=2026-03-31"`

---

## Error Codes

| Code | Description |
|---|---|
| `401` | Unauthorized (Admin session missing) |
| `404` | Resource not found (Tenant/Job ID invalid) |
| `500` | Internal Server Error (DB Connection issue) |
| `400` | Bad Request (Invalid date format or missing params) |
