# PrintPrice Global Print Network — Phase 25

This document defines the architectural structure of the **Global Print Network**, transforming PrintPrice from a technical tool into a global production marketplace.

## The 3-Actor Model

1. **Client Ecosystem (Demand)**: Publishers, Agencies, SaaS Platforms.
2. **PrintPrice Core (Platform)**: Intelligence Graph, Routing Engine, API Gateway.
3. **Printer Network (Supply)**: Global network of production nodes (Offset, Digital, Large Format).

---

## Network Layers

### 1. Printer Node Layer (`printer_nodes`)
The entry point for production facilities.
- **Metadata**: Name, Region, Reliability Index, Trust Score.
- **Status**: Real-time availability status.

### 2. Machine Layer (`printer_machines`)
Detailed capabilities of the hardware in each node.
- **Specifications**: Max TAC, Min DPI, Sheet Size, Ink Support.
- **Link**: Connected to `machine_profiles` for standardization.

### 3. Material Layer (`material_inventory`)
Standardized paper and substrate catalog available at each node.
- **Link**: Connected to `paper_profiles`.

---

## Routing & Dispatch Logic
The **Global Dispatcher** resolves orders using a multi-vector index:
- **Compatibility (50%)**: Based on Phase 24 Intelligence Graph.
- **Distance (20%)**: Geographical proximity to delivery point.
- **Economic (20%)**: Price per unit for the specific configuration.
- **Capacity (10%)**: Real-time load/queue at the printer node.

---
*PrintPrice: The Operating System of Print Production.*
