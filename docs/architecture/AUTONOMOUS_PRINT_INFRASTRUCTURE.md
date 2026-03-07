# Autonomous Print Infrastructure (Phase 30)

The Autonomous Print Infrastructure is the orchestration layer that unifies analysis, routing, pricing, marketplace negotiations, and production dispatch into a seamless, end-to-end pipeline.

## Orchestration Model

The system uses a **Deterministic State Machine** to manage the lifecycle of a print job. Each state represents a specific business or technical milestone.

### Pipeline States

1.  **JOB_RECEIVED**: Initial ingestion.
2.  **FILE_ANALYZED**: Technical analysis complete.
3.  **FILE_AUTOFIXED**: Preflight fixes applied.
4.  **ROUTING_CANDIDATES_GENERATED**: Network nodes identified.
5.  **ECONOMIC_ROUTING_COMPLETE**: Financial scoring achieved.
6.  **OFFERS_CREATED**: Production offers pushed to market.
7.  **NEGOTIATION_ACTIVE**: Marketplace dialogue (optional).
8.  **COMMERCIAL_COMMITMENT_CREATED**: Immutable agreement locked.
9.  **PRODUCTION_ASSIGNED**: Dispatch logic executed.
10. **PRODUCTION_IN_PROGRESS**: Active manufacturing.
11. **PRODUCTION_COMPLETED**: Logistics ready.
12. **JOB_CLOSED**: Financial and data archival.

## Autonomy Modes

### FULL_AUTONOMOUS
The orchestrator advances through all states without human intervention. This is the default mode for standard, low-risk jobs.

### ASSISTED
The pipeline automatically pauses at predefined "Escalation Points" (e.g., high-value orders, zero-margin scenarios) and awaits Admin confirmation.

## Failsafe & Error Handling

- **Retry Policies**: Temporary failures (e.g., network timeout) trigger automated retries.
- **Admin Escalation**: Critical failures move the pipeline to a `FAILED` status, alerting operators via the Autonomous Operations dashboard.
- **Fallback Routing**: If a selected printer fails to accept or goes offline during dispatch, the orchestrator automatically re-enters the Routing state.

## Operational Control

Admins can manage pipelines via the `Autonomous Operations` dashboard:
- **Pause/Resume**: Stop any active pipeline for manual inspection.
- **Retry Step**: Force the re-execution of a failed state after resolving external blockers.
- **Manual Override**: Shift any autonomous job into manual mode at any time.

## Data & Intelligence Feedback

Pipeline results feed back into the **Print Intelligence Graph**:
- Success/Failure rates by printer.
- Accuracy of economic routing estimates versus actual committed prices.
- Effectiveness of auto-fix strategies.
