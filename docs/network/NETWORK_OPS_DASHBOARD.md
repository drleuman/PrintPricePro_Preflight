# Network Operations Dashboard

The Network Operations Dashboard is the central control tower for the PrintPrice Global Network. It provides internal teams with visibility into node health, capacity available, and routing eligibility.

## Purpose
- **Monitor Health**: Identify nodes that are offline, suspended, or have stale data.
- **Track Capacity**: Visualize regional production availability vs saturation.
- **Audit Routing**: Verify why nodes are or aren't eligible for job recommendations.
- **Operations Control**: Approve new nodes or suspend problematic ones.

## Endpoints Summary
All endpoints require Admin authentication (Bearer Token).

| Endpoint | Method | Description |
| --- | --- | --- |
| `/api/admin/network/overview` | GET | Aggregated Global KPIs. |
| `/api/admin/network/printers` | GET | Paginated list of nodes with filters (country, status, routing). |
| `/api/admin/network/printers/:id` | GET | Full node detail (machines, capacity history, regions). |
| `/api/admin/network/capacity` | GET | Capacity aggregated by region (City/Country). |
| `/api/admin/network/health` | GET | List of all active operational warnings. |

## KPI Definitions
- **Routing Ready**: Nodes with `ACTIVE` status AND `READY` connect status.
- **Stale Sync**: Active nodes that haven't updated capacity in >24h.
- **Utilization %**: (Total Capacity - Available Capacity) / Total Capacity.

## Operational Warning Types
- `PRINTER_OFFLINE`: Node reported offline.
- `PRINTER_SUSPENDED`: Node disabled by operations.
- `NO_MACHINES_REGISTERED`: No hardware profiles found.
- `NO_CAPACITY_DATA`: No capacity declaration for today.
- `CAPACITY_FULL`: Node has 0 units available.

## Usage Instructions
1. Navigate to the **Network Operations** tab in the Admin Dashboard.
2. Review the **Overview Cards** for network-wide health signals.
3. Check the **Operational Risks** panel for immediate issues.
4. Use the **Regional Capacity** table to identify supply gaps.
5. Click any printer in the **Inventory Table** to open the deep-dive drawer for audits or actions.
