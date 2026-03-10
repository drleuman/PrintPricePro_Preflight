# Admin Dashboard – SRE Cockpit: Knowledge Base

## 1. Overview

The Admin Dashboard SRE Cockpit is the centralized command and control center for the PrintPrice Preflight V2 platform. It exists to provide full observability and operational control over the core asynchronous document processing pipeline.

**System Health Monitoring:** The dashboard continuously surfaces real-time telemetry from the database, background queues, and processing nodes. It translates raw operational data into actionable health indicators, allowing SREs to instantly assess platform stability.

**Incident Response:** During service degradations or outages, the cockpit serves as the primary diagnostic and intervention tool. It provides deep visibility into error payloads, queue backlogs, and tenant-specific anomalies, alongside powerful "kill switches" for isolating bad actors and managing queue state.

**V2 Async Architecture Connection:** The V2 architecture relies heavily on decoupled, asynchronous processing (Node.js + Redis + BullMQ) and deterministic inspection (Ghostscript + Poppler). The dashboard bridges these distributed components, aggregating states from Redis queues, MySQL audit logs, and the Policy Engine into a single, cohesive view.

### Operational Philosophy

The SRE Cockpit is designed around three operational principles:

1. **Observability First**
   Every job emits measurable signals.
2. **Deterministic Verification**
   Every automated fix is rechecked by a deterministic engine.
3. **Operator Control**
   No automation runs without human override capability.

## 2. Dashboard Architecture

The dashboard aggregates operational state through a combination of synchronous queries and Redis introspection.

*   **MySQL (Internal State & History):** Provides persistent historical data. The dashboard queries `jobs` for historical volume/success rates, `metrics` for system-wide KPIs, and `audit_logs` for compliance and security events.
*   **Redis/BullMQ (Active State):** Serves as the real-time pulse of the system. The dashboard directly interrogates BullMQ to retrieve instantaneous queue depths (waiting, active, delayed, failed) and job-level progress.
*   **Policy Engine:** The dashboard surfaces policy evaluation results, detailing why specific print rules (e.g., minimum DPI, color space) triggered failures or AutoFix actions.
*   **Processing Pipeline:** Real-time telemetry is emitted by the worker nodes during PDF inspection (Ghostscript/Poppler) and AutoFix stages, streaming directly into the dashboard's monitor views.

**Architecture Flow Diagram:**
```text
[ React Admin Dashboard (/admin) ]
        |                 |
    (REST API)       (WebSockets)
        |                 |
[ Node.js Backend Administration Service ]
    |             |               |
[ MySQL v8 ]  [ Redis ]   [ Policy Engine ]
(Metrics,     (BullMQ,    (Print Rules)
 Audit,       Cache)
 Jobs)            |
        [ Worker Nodes (Async) ]
        (Ghostscript, Poppler, AutoFix)
```

## 2.1 Runtime Dependencies

| Component | Role | Command |
| :--- | :--- | :--- |
| **Ghostscript** | Color conversion / rasterization | `gs --version` |
| **Poppler** | PDF structural inspection | `pdfinfo -v` |
| **Redis** | Queue state and job orchestration | `redis-cli ping` |
| **MySQL** | Persistent job metrics and audit logs | `mysql -V` |
| **BullMQ** | Job orchestration layer | Node.js runtime |

**Recommended versions:**
```text
Ghostscript ≥ 10.02
Poppler ≥ 24.x
Redis ≥ 7
MySQL ≥ 8
Node ≥ 20
```

## 3. Dashboard Components (Deep Explanation)

### Overview KPIs
*   **Total Jobs:** Measures the total volume of preflight and AutoFix jobs processed. Derived from MySQL metrics. *Normal:* Steady growth tracking with business hours. *Abnormal:* Sudden drops to zero (pipeline stalled) or massive unnatural spikes (potential DoS).
*   **Success Rate:** The percentage of jobs completing without fatal errors. *Normal:* >98%. *Abnormal:* <95% indicates systemic issues (e.g., bad deployment, storage failure, or Ghostscript version mismatch).
*   **Average Latency:** The mean time to process a job end-to-end. *Normal:* ~2-5 seconds depending on file size. *Abnormal:* >15 seconds indicates worker starvation or database locking.
*   **P95 Latency:** The processing time that 95% of jobs fall below. Crucial for detecting outliers. *Normal:* <10 seconds. *Abnormal:* Spikes indicate large complex files bottlenecking the workers or Redis latency.
*   **Delta Improvement Rate:** Measures the percentage of failed preflights successfully remediated by the AutoFix pipeline. *Normal:* ~60-80%. *Abnormal:* Sudden drops suggest the deterministic recheck is failing post-fix.
*   **Cost Proxy:** An estimated metric of infrastructure utilization cost based on worker CPU/Memory time per job.
*   **Queue Backlog:** The absolute number of jobs waiting to be processed. *Normal:* Near zero during normal load, small bursts <100. *Abnormal:* Sustained growth >1000 indicates workers are dead or processing slower than ingestion.
*   **Oldest Waiting Job Age:** The time the oldest job has been sitting in the queue. *Normal:* <30 seconds. *Abnormal:* Minutes/hours indicate stuck jobs, UI lockups, or dead-letter queue failures.

### Tenants Report
*   **Tenant ID:** Uniquely identifies the B2B client.
*   **Job Volume:** Number of jobs submitted by the tenant. Used for billing and quota monitoring.
*   **Success Rate:** Tenant-specific success rate. Highlights if a specific customer is uploading incompatible or corrupt PDFs.
*   **Latency Patterns:** Identifies if specific tenants consistently upload abnormally large/complex files that degrade their specific SLA.

### Jobs Monitor (SRE View)
*   **Job Status:** Current state (waiting, active, completed, failed, delayed).
*   **Progress:** 0-100% indicator emitted by the processing pipeline.
*   **Step:** The specific pipeline phase (e.g., "Extracting Fonts", "Ghostscript Flattening", "Evaluating Policy").
*   **Retry Attempts:** Number of times the job has been re-enqueued after a transient failure.
*   **Error Payload:** The raw JSON stack trace or exit code from the underlying binary (e.g., Poppler exit code 1) for immediate debugging.

### Top Errors Panel
*   **Error_code Grouping:** Aggregates failures by root cause (e.g., `ERR_PDF_CORRUPT`, `ERR_GS_TIMEOUT`, `ERR_POLICY_VIOLATION`).
*   **Typical Root Causes:** Allows SREs to quickly distinguish between user errors (bad uploads) and system errors (OOM kills, network drops).

### Audit Logs
Tracks immutable events for compliance.
*   **Upload:** Records when a file is initially ingested.
*   **AutoFix:** Records when the system modifies a user's asset.
*   **Download:** Records retrieval of processed assets via signed URLs.
*   **Policy Execution:** Records which rule sets were evaluated against which tenant ID.
*   **Admin Actions:** Critical operations logged when SREs use the Control Panel (e.g., modifying queues, quarantining tenants).

### Queue Status
Direct view into BullMQ states:
*   **Waiting:** Jobs ready for workers.
*   **Active:** Jobs currently locked by a worker node.
*   **Delayed:** Jobs scheduled for future processing (e.g., scheduled retries).
*   **Failed:** Jobs that exceeded max retries.
*   **Paused:** The queue is administratively halted.

## 3.1 Processing Pipeline Stages

| Step | Component | Description |
| :--- | :--- | :--- |
| **Upload** | API Gateway | The file is received and stored as an asset |
| **Preflight Inspection** | Poppler / Ghostscript | Structural analysis of PDF |
| **Policy Evaluation** | Policy Engine | Determines compliance with printing rules |
| **AutoFix** | Ghostscript Pipeline | Converts colors, flattens transparency, embeds fonts |
| **Deterministic Recheck** | Poppler + Ghostscript | Verifies that the AutoFix result is compliant |
| **Delta Calculation** | Report Engine | Computes measurable improvement |

## 4. Control Panel (Kill Switch Operations)

**WARNING:** These actions directly manipulate production state. Use only during validated incidents.

*   **Queue Pause:**
    *   *What it does:* Signals BullMQ to stop distributing new `waiting` jobs to workers. `active` jobs will finish.
    *   *When to use:* Degradation of downstream services (database overloaded), or when deploying emergency worker patches.
    *   *Risks:* Backlog will grow rapidly. API ingestion remains open but processing stops.
    *   *Scenario:* MySQL is experiencing high CPU locking; pause queue to relieve pressure while DB recovers.
*   **Queue Resume:**
    *   *What it does:* Re-enables job distribution to workers.
    *   *When to use:* After an incident is mitigated and downstream services are healthy.
    *   *Risks:* Thundering herd effect. Resume slowly or scale workers up before resuming massive backlogs.
*   **Queue Drain:**
    *   *What it does:* Deletes all jobs in the `waiting` and `delayed` states.
    *   *When to use:* Extreme situations where the queue is filled with millions of poison pill jobs or test data.
    *   *Risks:* **Permanent Data Loss.** Customers will see their pending jobs disappear and must re-upload.
    *   *Scenario:* A rogue script ingested 100,000 corrupt PDFs that are crashing workers; draining is the only way to recover the cluster.
*   **Queue Obliterate:**
    *   *What it does:* Drops the entire queue structure from Redis (all states).
    *   *When to use:* Redis corruption or when BullMQ metadata is irreparably desynchronized.
    *   *Risks:* Destroys all active processing and state. Requires application restart.
*   **Retry Job:**
    *   *What it does:* Moves a `failed` job back to the `waiting` queue.
    *   *When to use:* After fixing a transient infrastructure issue (e.g., restoring a downed S3 bucket).
    *   *Risks:* Low.
*   **Cancel Job:**
    *   *What it does:* Removes a specific job from the queue.
    *   *When to use:* A specific excessively large job is starving a worker.
*   **Bulk Cancel:**
    *   *What it does:* Cancels multiple jobs based on a filter.
    *   *When to use:* Clearing out a batch of known-bad jobs from a specific failed batch upload.
*   **Tenant Quarantine:**
    *   *What it does:* Blocks API ingestion for a specific `tenant_id` at the edge/middleware level.
    *   *When to use:* A tenant's compromised system is launching a Denial of Service attack against the preflight API.
    *   *Risks:* Service disruption for that specific customer.
    *   *Scenario:* A tenant's misconfigured automation loops, sending 500 requests per second. Quarantine them to protect the global platform.

## 5. Incident Response Runbook

### Incident: Queue backlog explosion
*   **Detection:** "Queue Backlog" KPI > 1000 and climbing. "Oldest Waiting Job Age" > 5 minutes.
*   **Diagnosis:** Check "Active" workers. If Active == 0, workers are down. If Active is full but progressing slowly, look at P95 Latency and Top Errors.
*   **Action steps:**
    1.  Provision additional worker nodes.
    2.  Check for poison pill jobs causing OOM loops.
    3.  If MySQL is the bottleneck, scale DB reads or pause the queue temporarily.
*   **Verification:** Observe "Queue Backlog" decreasing. "Oldest Waiting Job Age" should trend downwards.

### Incident: Ghostscript failure spike
*   **Detection:** "Success Rate" plummets; "Top Errors" panel floods with `ERR_GS_*` codes.
*   **Diagnosis:** View specific "Error Payload" in Jobs Monitor. Look for segfaults or specific missing font errors.
*   **Action steps:**
    1.  Identify if failures are tenant-specific (bad batch) or global.
    2.  If global, rollback recent worker image deployments.
    3.  If related to a specific file type, update the Policy Engine to reject them earlier in the pipeline.
*   **Verification:** Monitor "Success Rate" metric recovery post-deployment.

### Incident: Tenant runaway job storm
*   **Detection:** High ingestion rate, localized latency spikes, specific Tenant ID dominating the "Tenants Report" volume.
*   **Diagnosis:** Confirm the traffic is illegitimate or exceeding SLA via the Tenants Report.
*   **Action steps:**
    1.  Communicate with the tenant if possible.
    2.  Use the **Tenant Quarantine** kill switch to drop their ingest.
    3.  Optionally use **Bulk Cancel** to clear their pending jobs from the queue to free up workers.
*   **Verification:** Global "Queue Backlog" drops, P95 latency normalizes for other tenants.

### Incident: High latency across jobs
*   **Detection:** Average Latency > 15s; P95 Latency > 30s.
*   **Diagnosis:** Check CPU/Memory of worker nodes. Check Redis latency.
*   **Action steps:**
    1.  If CPU bound: Scale worker count horizontally.
    2.  If Redis bound: Check network link or upgrade Redis instance size.
*   **Verification:** Ensure P95 returns to < 10s.

### Incident: Redis connection failure
*   **Detection:** Dashboard cannot load Worker Status. API requests fail with 500s.
*   **Diagnosis:** SRE Cockpit UI shows Redis disconnected state. Backend logs show `ECONNREFUSED`.
*   **Action steps:**
    1.  Verify Redis instance health via cloud provider console.
    2.  Restart Redis or failover to read-replica.
    3.  Restart backend Node.js pods to re-establish connection pools.
*   **Verification:** Dashboard connection indicators turn green; Jobs begin transitioning states.

### Incident: Database lock or timeout
*   **Detection:** High API latency, dashboard "Overview KPIs" fail to load or load very slowly.
*   **Diagnosis:** Inspect MySQL process list for long-running queries or deadlocks.
*   **Action steps:**
    1.  Identify offending query.
    2.  If it's an analytical query from the dash, kill the query.
    3.  **Queue Pause** if the DB must be restarted to clear locks.
*   **Verification:** Dashboard loads normally; no slow queries in DB logs.

## 6. Metrics Interpretation Guide

*   **Healthy System Pattern:** Total Jobs match business diurnal cycles. Success Rate > 99%. P95 Latency < 5s. Backlog < 20. Queue smoothly transitions Waiting -> Active -> Completed.
*   **Early Degradation Signals:** P95 Latency begins climbing steadily while Average Latency remains flat (indicates specific large files are starting to bog down a few workers). Queue Backlog slowly creeping up (ingest is slightly outpacing processing).
*   **Critical Failure Signals:** Success Rate drops < 90%. Backlog spikes vertically. Active jobs stay stuck at MAX_WORKERS with 0 progress updates (Workers are deadlocked or frozen).

## 6.1 Metric → Action Map

| Metric | Warning Threshold | Critical Threshold | Recommended Action |
| :--- | :--- | :--- | :--- |
| **Success Rate** | <98% | <95% | Inspect Top Errors panel and review Ghostscript failures |
| **Queue Backlog** | >100 | >1000 | Scale worker nodes or pause queue |
| **Oldest Waiting Job Age** | >60s | >300s | Investigate worker availability |
| **P95 Latency** | >10s | >30s | Check CPU usage and Redis latency |
| **Delta Improvement Rate** | <60% | <40% | Review Policy Engine rules or AutoFix pipeline |
| **Failed Jobs** | >20/hour | >100/hour | Inspect error payloads and isolate failing step |

## 7. Security & Audit Model

*   **Signed URLs:** Original and processed PDF assets are never directly accessible. The pipeline generates time-bound (e.g., 15-minute), cryptographically signed URLs. The dashboard utilizes these to allow SREs to preview files securely without risking permanent public exposure.
*   **Audit Trail Design:** Every significant action (upload, processing result, autofix modification) is written to the immutable `audit_logs` MySQL table. This provides a cryptographically verifiable chain of custody for enterprise clients.
*   **Admin Access Protection:** The `/admin` dashboard routes must be protected by robust authentication (e.g., SSO/SAML integrations) and Role-Based Access Control (RBAC). A standard user cannot access the SRE Cockpit.
*   **Evidence Sanitization:** When SREs view payloads or logs, sensitive PII extracted from PDFs (if any) should be masked. Downloaded debug assets must be automatically purged from local analyst machines per compliance policies.

## 8. Operational Best Practices

*   **Daily Monitoring Routine:** SREs should check the Dashboard at the start of shift. Review the "Top Errors" from the previous 24 hours to identify new edge cases in Ghostscript processing. Check the "Tenants Report" for usage anomalies.
*   **Capacity Planning:** Monitor "Cost Proxy" and specific worker CPU metrics to establish baselines. Scale horizontal workers *before* marketing campaigns or known high-volume client onboarding.
*   **Queue Scaling:** Utilize auto-scaling groups based on the "Queue Backlog" metric. E.g., if Backlog > 100 for 2 minutes, add 5 pods.
*   **Tenant Isolation:** Consider routing massive, complex tenants to dedicated BullMQ queues with dedicated worker pools to prevent noisy neighbor problems affecting smaller tenants.
*   **Incident Documentation:** Every time a Control Panel "Kill Switch" is used, an incident ticket must be generated detailing the reason, duration, and outcome, linking to the relevant `audit_logs`.

## 9. Future Improvements

To further enhance the SRE Cockpit, the following roadmap is recommended:

*   **Alerting Integration:** Native integration with PagerDuty/OpsGenie directly from the dashboard, triggered by KPI thresholds (e.g., Success Rate < 95% for 5 mins).
*   **SLO Dashboards:** Dedicated views tracking Service Level Objectives (e.g., 99.9% availability, 95% jobs processed < 10s) to provide instant business-level reporting.
*   **Performance Heatmaps:** Visual representations of processing times across the day, helping to identify micro-bursts of traffic.
*   **Automated Anomaly Detection:** Machine learning applied to job volume and latency to automatically detect unusual patterns (e.g., "Tenant X usually uploads 10 files an hour, but just uploaded 500") and suggest preemptive Quarantine.
*   **Self-Documenting UI:** Adding inline "ℹ Explain" buttons next to every dashboard metric and control that open the corresponding fragment from this Knowledge Base. This converts the dashboard into an integrated SRE Operating System (similar to Stripe or Datadog style dashboards).
