# PrintPrice Connect — Standard Protocol

**PrintPrice Connect** is the infrastructure layer for printer onboarding and operational sync. It transforms physical printing plants into programmable production nodes.

## 1. Status Models

### Printer Node Status (`status`)
- `PENDING_REVIEW`: Initial state after onboarding. Node is in isolation.
- `ACTIVE`: Verified and ready for production routing.
- `SUSPENDED`: Administrative hold due to quality or compliance.
- `OFFLINE`: Temporary downtime initiated by the printer.

### Connect Configuration Status (`connect_status`)
- `NOT_CONFIGURED`: Identity exists but no hardware/capacity declared.
- `PARTIALLY_CONFIGURED`: Machines or materials registered.
- `READY`: Fully configured and eligible for Autonomous Routing.

## 2. Security (Printer API Keys)
Each node is assigned a unique `printer_api_key`.
- Key format: `ppp_pr_<checksum>`.
- Authentication: All sync requests must include `x-printer-id` and `x-printer-api-key`.
- Storage: Keys are stored as SHA-256 hashes.

## 3. Core API Endpoints

### Onboarding
- `POST /api/connect/printers`: Public entry point. Returns the one-time API Key.

### Hardware Registry
- `POST /api/connect/printers/:id/machines`: Add a production machine.
- `PUT /api/connect/printers/:id/machines/:machineId`: Toggle status.

### Operational Sync
- `POST /api/connect/printers/:id/capacity`: Publish daily availability snapshot.

## 4. Routing Eligibility
The **Routing Engine** filters candidates using these strict criteria:
1. `printer_nodes.status = 'ACTIVE'`
2. `printer_nodes.connect_status = 'READY'`
3. `printer_machines.status = 'ACTIVE'`
4. `printer_capacity.capacity_available > 0` for target date.

---
*Building the industrial production brain.*
