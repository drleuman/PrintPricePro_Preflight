# PrintPrice Pro — Architecture Overview

This document provides a comprehensive technical and strategic overview of the PrintPrice Pro platform. It is designed for technical onboarding, partner integration, and investor presentations.

## Master Diagram: Print Intelligence Infrastructure

└──────┬────────┘             └──────┬────────┘               └──────┬────────┘             └────────┬───────┘
       │                              │                               │                               │
       └───────────────┬──────────────┴───────────────┬───────────────┴───────────────┬──────────────┘
                       │                              │                               │
                       ▼                              ▼                               ▼

┌──────────────────────────────────────────────────────────────────────────────┐
│                             EXPERIENCE LAYER                                │
├──────────────────────────────────────────────────────────────────────────────┤
│  Production App UI          Public Demo / Demo UX        Tenant Analytics   │
│  Upload → Analyze → Fix     Guided wow-flow             ROI / Usage / Risk  │
│  Verify → Delta             Investor mode               Value generated      │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│                                API LAYER                                    │
├──────────────────────────────────────────────────────────────────────────────┤
│  Public API v2                  Admin API                 Internal Routes    │
│  /jobs                          /admin                    /preflight         │
│  /batches                       /admin/control            /health            │
│  /analytics                     /tenants                  /metrics           │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│                           ORCHESTRATION LAYER                               │
├──────────────────────────────────────────────────────────────────────────────┤
│  Redis + BullMQ Queue Management                                            │
│  States: QUEUED → RUNNING → SUCCEEDED / FAILED / CANCELED                   │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│                              PROCESSING LAYER                               │
├──────────────────────────────────────────────────────────────────────────────┤
│  Deterministic Engine (GS, Poppler, pdf-lib)                                │
│  Flow: Analysis → Policy Evaluation → AutoFix → Recheck → Delta             │
└──────────────────────────────────────────────────────────────────────────────┘

```mermaid
graph TD
    subgraph Layer_1 ["1. EXPERIENCE LAYER"]
        A1["Admin SRE Cockpit"]
        A2["Customer Analytics Portal"]
        A3["Success Workspace"]
        A4["Developer Portal"]
    end

    subgraph Layer_2 ["2. DEVELOPER PLATFORM"]
        B1["SDK Starter Guide"]
        B2["API Cookbook"]
        B3["Official SDKs"]
    end

    subgraph Layer_3 ["3. API LAYER"]
        C1["REST API v2"]
        C2["Job Processing API"]
        C3["Batch Processing API"]
        C4["Webhook Gateway"]
    end

    subgraph Layer_4 ["4. GOVERNANCE LAYER"]
        D1["Multi-tenancy"]
        D2["Plans & Quotas"]
        D3["Billing Intelligence"]
        D4["Audit Logs"]
    end

    subgraph Layer_5 ["5. ENGAGEMENT LAYER"]
        E1["Notification Core"]
        E2["Delivery Channels"]
        E3["CS Workflows"]
        E4["Health Monitoring"]
    end

    subgraph Layer_6 ["6. PROCESSING LAYER"]
        F1["Preflight Engine"]
        F2["AI Autofix (PDF)"]
        F3["Risk Scoring"]
        F4["Policy Engine"]
    end

    subgraph Layer_7 ["7. ORCHESTRATION LAYER"]
        G1["BullMQ Workers"]
        G2["Job Workers"]
        G3["CS Evaluators"]
    end

    subgraph Layer_9 ["9. DATA LAYER"]
        H1["MySQL (Jobs/Billing)"]
        H2["Intelligence Graph"]
        H3["Workflow History"]
    end

    subgraph Layer_10 ["10. NETWORK LAYER (PHASE 25)"]
        J1["Printer Nodes"]
        J2["Routing Engine"]
        J3["Machine Profiles"]
    end

    subgraph Layer_11 ["11. INFRASTRUCTURE"]
        I1["Linux/Plesk"]
        I2["Node.js Cluster"]
        I3["Redis Queues"]
    end

    %% Key Flow
    Layer_1 --> Layer_3
    Layer_2 --> Layer_3
    Layer_3 --> Layer_4
    Layer_4 --> Layer_6
    Layer_6 --> Layer_9
    Layer_9 --> Layer_10
    Layer_10 --> Layer_11
    
    Layer_5 -.-> Layer_3
    Layer_5 -.-> Layer_1
```

## Layer-by-Layer Breakdown

### 1. Experience Layer
The unified entry point for Operations (Admin Cockpit), Customers (Analytics), and Developers (Portal). It focuses on actionable insights and visual validation.

### 2. Developer Platform
The self-service integration suite. Provides the guides and tools necessary for external systems to adopt PrintPrice in hours.

### 3. API Layer
The programmable gateway. Exposes high-performance endpoints for job ingestion, batch management, and real-time status tracking.

### 4. Governance Layer
The platform's business logic foundation. Manages tenant lifecycles, plans, quotas, and granular financial/audit reporting.

### 5. Engagement Layer
The proactive lifecycle engine. Automatically monitors tenant health and manages Customer Success (CS) workflows and notifications.

### 6. Processing Layer
The core "Deterministic Engine." Performs deep structural PDF analysis, risk scoring, and policy-driven repairs (AutoFix).

### 7. Orchestration Layer
Powered by BullMQ and Redis, this layer ensures massive scalability and fault tolerance for background processing.

### 9. Data Layer
The relational and historical brain. Stores jobs, metrics, and the **Print Intelligence Graph (Phase 24)** for technical signature analysis.

### 10. Network Layer (Phase 25/26)
The industrial dispatch layer. Manages **Printer Nodes**, machine capabilities, and the **Autonomous Routing Engine** for global production optimization.

### 11. Infrastructure
The physical and server runtime environment. Built on a resilient Node.js cluster with optimized asset storage.

---

## 💡 Strategic Value Proposition (Investor Deck)

- **One-liner**: PrintPrice is the cloud infrastructure layer that reconciles modern content creation with deterministic print production requirements.
- **Defensibility**: The platform is not just a "PDF fixer"; it is a governed ecosystem combining **Document Intelligence**, **Workflow Policies**, and **ROI Analytics**.
- **Maturity**: Multi-layer stabilization including financial audits, churn simulation, and SRE-grade operational dashboards.
