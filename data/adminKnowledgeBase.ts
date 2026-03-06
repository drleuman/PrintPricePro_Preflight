export type HelpDocType =
    | 'metric'
    | 'control'
    | 'error'
    | 'runbook'
    | 'component';

export interface HelpDoc {
    id: string;
    type: HelpDocType;
    title: string;
    category: string;
    summary: string;
    keywords: string[];
    dashboardPath?: string;
    appliesTo?: string[];
    normal?: string;
    warning?: string;
    critical?: string;
    action?: string[];
    body: string;
    relatedIds?: string[];
    lastUpdated?: string;
    relatedActions?: {
        label: string;
        url: string;
        type: 'dashboard' | 'control' | 'runbook';
    }[];
}

export const adminHelpDocs: HelpDoc[] = [
    // --- METRICS ---
    {
        id: 'metric-queue-backlog',
        type: 'metric',
        title: 'Queue Backlog',
        category: 'Metrics',
        summary: 'Number of jobs waiting to be processed by worker nodes.',
        keywords: ['queue', 'backlog', 'waiting jobs', 'bullmq', 'redis', 'scale'],
        dashboardPath: '/admin?tab=overview',
        normal: '< 20',
        warning: '> 100',
        critical: '> 1000',
        action: [
            'Inspect active workers',
            'Check oldest waiting job age',
            'Scale workers or pause queue if needed'
        ],
        body: `
Queue Backlog measures how many jobs are waiting in the processing queue.

**Why it matters:**
A growing backlog indicates that ingestion is outpacing processing capacity. If it remains high, customer SLA will be breached.

**Typical causes:**
- Worker nodes are unavailable or restarting
- Redis latency issues
- A batch of unusually large PDFs is slowing down the pipeline
- A tenant is experiencing a job storm

**Recommended operator workflow:**
1. Check queue status (is it paused?)
2. Inspect active jobs to see if they are stuck
3. Review top errors for crash loops
4. Scale workers or quarantine abusive tenant if necessary
    `,
        relatedIds: ['runbook-queue-backlog-explosion', 'component-queue-status', 'control-pause-queue'],
        lastUpdated: '2026-03-06'
    },
    {
        id: 'metric-success-rate',
        type: 'metric',
        title: 'Success Rate',
        category: 'Metrics',
        summary: 'Percentage of jobs that completed without fatal errors.',
        keywords: ['success', 'rate', 'kpi', 'health', 'errors'],
        dashboardPath: '/admin?tab=overview',
        normal: '> 98%',
        warning: '< 98%',
        critical: '< 95%',
        action: [
            'Inspect Top Errors panel',
            'Review Ghostscript logs',
            'Check if errors are isolated to one tenant'
        ],
        body: `
The Success Rate KPI measures the overall health of the document processing pipeline.

**Why it matters:**
A drop in success rate means customers are receiving failed conversions. This impacts the core business value.

**Typical causes:**
- Bad deployment containing a Ghostscript version mismatch
- Out of Memory (OOM) kills on worker nodes
- A tenant uploading completely corrupt or encrypted PDFs

**Recommended operator workflow:**
1. Check the Top Errors panel to identify the dominant failure code.
2. Filter the Jobs Monitor by "Failed" status.
3. If failures are isolated, investigate the specific files. If global, consider rolling back the latest deployment.
    `,
        relatedIds: ['component-top-errors', 'runbook-ghostscript-failure-spike'],
        lastUpdated: '2026-03-06'
    },
    // --- CONTROLS ---
    {
        id: 'control-pause-queue',
        type: 'control',
        title: 'Pause Queue',
        category: 'Controls',
        summary: 'Stops assigning new jobs to workers. Active jobs will finish.',
        keywords: ['pause', 'stop', 'halt', 'queue', 'bullmq', 'emergency'],
        dashboardPath: '/admin?tab=controls',
        action: [
            'Click Pause Queue',
            'Monitor active jobs dropping to zero',
            'Investigate underlying issue'
        ],
        body: `
The **Pause Queue** kill switch signals the BullMQ orchestrator to stop distributing new \`waiting\` jobs to worker nodes. 

**What it does internally:**
It pauses the Redis queue. Any job currently in the \`active\` state will be allowed to finish, but no new jobs will transition from \`waiting\` to \`active\`.

**When it should be used:**
- Degradation of downstream services (e.g., MySQL database overloaded).
- Deploying emergency worker patches without dropping jobs.
- Investigating a systemic error spike.

**Potential risks:**
The incoming API ingestion remains open. The \`Queue Backlog\` will grow rapidly. If paused too long, customers will experience extreme latency once resumed.
    `,
        relatedIds: ['control-resume-queue', 'metric-queue-backlog'],
        lastUpdated: '2026-03-06'
    },
    {
        id: 'control-drain-queue',
        type: 'control',
        title: 'Drain Queue',
        category: 'Controls',
        summary: 'Deletes all waiting and delayed jobs from the system.',
        keywords: ['drain', 'delete', 'clear', 'wipe', 'purge', 'queue'],
        dashboardPath: '/admin?tab=controls',
        action: [
            'Ensure this is a true emergency',
            'Click Drain Queue',
            'Verify backlog drops to zero'
        ],
        body: `
The **Drain Queue** kill switch deletes all jobs currently in the \`waiting\` and \`delayed\` states.

**What it does internally:**
It issues a command to BullMQ to empty the queue structures in Redis. It does NOT touch \`active\` jobs.

**When it should be used:**
**Only in extreme situations.** Use when the queue is filled with millions of poison pill jobs or test data that is crashing the cluster.

**Potential risks (HIGH):**
**Permanent Data Loss.** Customers will see their pending jobs disappear and will be forced to re-upload their documents. Use only as a last resort to recover cluster stability.
    `,
        relatedIds: ['control-pause-queue'],
        lastUpdated: '2026-03-06'
    },
    // --- RUNBOOKS ---
    {
        id: 'runbook-queue-backlog-explosion',
        type: 'runbook',
        title: 'Incident: Queue Backlog Explosion',
        category: 'Incident Runbooks',
        summary: 'Steps to take when the queue backlog spikes unexpectedly.',
        keywords: ['incident', 'backlog', 'explosion', 'stuck', 'workers down'],
        dashboardPath: '/admin?tab=overview',
        body: `
This runbook covers the scenario where the \`Queue Backlog\` KPI > 1000 and climbing, and \`Oldest Waiting Job Age\` > 5 minutes.

### 1. Detection
You receive an alert or notice the Overview dashboard showing a massive spike in waiting jobs.

### 2. Diagnosis
- **Check "Active" workers:** If Active == 0, the worker nodes are down or disconnected from Redis.
- **Check Progress:** If Active is full but progress updates are frozen, workers are deadlocked.
- **Check Latency:** Look at P95 Latency. If it's very high, jobs are processing but extremely slowly (e.g. massive PDFs).
- **Check DB:** Verify if MySQL is locked, preventing workers from committing final states.

### 3. Action Steps
1. **Scale Workers:** Provision additional worker pods horizontally.
2. **Identify Poison Pills:** Check if a specific file is causing OOM (Out of Memory) crash loops.
3. **Database Pressure:** If MySQL is the bottleneck, scale DB reads or pause the queue temporarily using \`Pause Queue\`.

### 4. Verification
Observe the "Queue Backlog" decreasing. The "Oldest Waiting Job Age" should trend downwards to < 30s.
    `,
        relatedIds: ['metric-queue-backlog', 'control-pause-queue', 'component-queue-status'],
        lastUpdated: '2026-03-06'
    },
    // --- ERRORS ---
    {
        id: 'error-err-gs-timeout',
        type: 'error',
        title: 'ERR_GS_TIMEOUT',
        category: 'Errors',
        summary: 'Ghostscript processing exceeded the maximum allowed execution time.',
        keywords: ['error', 'timeout', 'ghostscript', 'gs', 'hang'],
        dashboardPath: '/admin?tab=errors',
        body: `
**ERR_GS_TIMEOUT** indicates that the underlying Ghostscript binary took too long to process a PDF and was forcefully killed by the worker orchestrator.

**Why it matters:**
Ghostscript is deterministic but some complex vectors or infinite recursion bugs in bad PDFs can cause it to hang indefinitely. This protects the worker from resource starvation.

**Typical causes:**
- Extremely dense CAD drawings or maps embedded in the PDF.
- Malformed PDFs that trigger a parsing loop in Poppler/Ghostscript.
- Worker node CPU is throttled.

**Operator Action:**
1. Find the specific Job ID in the Jobs Monitor.
2. If it's a specific tenant, advise them on PDF complexity.
3. If it's happening globally, check worker CPU metrics.
    `,
        relatedIds: ['component-top-errors', 'component-jobs-monitor'],
        relatedActions: [
            { label: 'Open Top Errors', url: '/admin?tab=errors', type: 'dashboard' },
            { label: 'Open Jobs filtered by GS errors', url: '/admin?tab=jobs&status=FAILED&type=GHOSTSCRIPT', type: 'dashboard' },
            { label: 'Open runbook "Ghostscript failure spike"', url: '/admin/help?doc=runbook-queue-backlog-explosion', type: 'runbook' }
        ],
        lastUpdated: '2026-03-06'
    },
    {
        id: 'error-generic',
        type: 'error',
        title: 'Unknown System Error',
        category: 'Errors',
        summary: 'A fault occurred that does not have a specific troubleshooting guide yet.',
        keywords: ['error', 'unknown', 'fault', 'exception', 'generic'],
        dashboardPath: '/admin?tab=errors',
        body: `
**What happened?**
The system encountered an error code that has not been specifically documented in this Knowledge Base.

**Basic Troubleshooting Workflow:**
1. Check the Jobs Monitor to inspect the stack trace from the actual worker payload.
2. Filter the Audit Logs for the specific tenant experiencing this issue.
3. If this error is persistently crashing workers, consider pausing the queue or escalating.

_Hint: You can suggest an improvement below to request a dedicated article for this new error code._
        `,
        relatedActions: [
            { label: 'Open Jobs Monitor', url: '/admin?tab=jobs&status=FAILED', type: 'dashboard' }
        ],
        lastUpdated: '2026-03-06'
    }
];
