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
    normal?: string;
    warning?: string;
    critical?: string;
    action?: string[];
    body: string;
    relatedIds?: string[];
    lastUpdated?: string;
    appliesTo?: string[];
    relatedActions?: { label: string, url: string }[];
}

export const adminHelpDocs: HelpDoc[] = [
    // ================= METRICS =================
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
A growing backlog indicates that ingestion is outpacing processing capacity. If it remains high, customer SLAs will be breached.

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
        appliesTo: ['Operators', 'SRE'],
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
        appliesTo: ['Operators', 'SRE', 'Support'],
        lastUpdated: '2026-03-06'
    },
    {
        id: 'metric-p95-latency',
        type: 'metric',
        title: 'P95 Latency',
        category: 'Metrics',
        summary: 'Processing time that 95% of jobs fall below. Crucial for detecting outliers.',
        keywords: ['latency', 'p95', 'performance', 'speed', 'slow'],
        dashboardPath: '/admin?tab=overview',
        normal: '< 10s',
        warning: '> 15s',
        critical: '> 30s',
        action: [
            'Review worker CPU and Memory utilization',
            'Check if Redis is experiencing high latency',
            'Look for extremely large or complex PDFs from specific tenants'
        ],
        body: `
P95 Latency indicates the duration within which the fastest 95% of jobs complete. It highlights the experience of your slowest 5% of requests, making it a much more reliable indicator of degradation than Average Latency.

**Why it matters:**
While the average latency might look fine, a high P95 indicates that some users are experiencing severe delays. This often precedes a widespread failure or queue explosion.

**Typical causes:**
- A tenant uploading massive (e.g., 500MB+) catalog PDFs
- Worker nodes running hot on CPU and throttling
- I/O limits hit on temporary storage disks

**Recommended operator workflow:**
1. Check if the average latency is also climbing. If average is flat but P95 is high, a few massive jobs are bogging down specific workers.
2. Check the Jobs tab and sort by duration.
3. Ensure horizontal auto-scaling is functioning.
    `,
        relatedIds: ['runbook-queue-backlog-explosion', 'metric-queue-backlog'],
        appliesTo: ['SRE', 'Enterprise Customer Success'],
        lastUpdated: '2026-03-06'
    },
    {
        id: 'metric-oldest-waiting-job-age',
        type: 'metric',
        title: 'Oldest Waiting Job Age',
        category: 'Metrics',
        summary: 'The time the oldest job has been sitting in the queue without being picked up.',
        keywords: ['queue', 'waiting', 'age', 'stuck', 'starvation'],
        dashboardPath: '/admin?tab=overview',
        normal: '< 30s',
        warning: '> 60s',
        critical: '> 300s',
        action: [
            'Investigate worker availability',
            'Determine if the queue is paused',
            'Check for deadlocked workers'
        ],
        body: `
This metric measures the maximum duration a job has remained in the \`waiting\` state.

**Why it matters:**
High values indicate worker starvation or systemic failure. Even if the backlog is small, an old waiting job means the system is failing to assign work.

**Typical causes:**
- The queue is administratively paused.
- All workers crashed and failed to restart.
- An infrastructure network partition preventing workers from connecting to Redis.

**Recommended operator workflow:**
1. Verify immediately if the workers are alive.
2. Check if the queue state is Paused in the Controls tab.
3. If workers are alive and queue is not paused, restart the worker pods to force reconnect to Redis.
    `,
        relatedIds: ['metric-queue-backlog', 'control-resume-queue'],
        appliesTo: ['Operators', 'SRE'],
        lastUpdated: '2026-03-06'
    },
    {
        id: 'metric-delta-improvement-rate',
        type: 'metric',
        title: 'Delta Improvement Rate',
        category: 'Metrics',
        summary: 'Percentage of failed preflights successfully remediated by the AutoFix pipeline.',
        keywords: ['delta', 'improvement', 'autofix', 'remedy', 'fix rate'],
        dashboardPath: '/admin?tab=overview',
        normal: '> 60%',
        warning: '< 50%',
        critical: '< 40%',
        action: [
            'Review Policy Engine rules',
            'Inspect unfixable errors in the Top Errors panel',
            'Look for new client workflows introducing unsupported PDF structures'
        ],
        body: `
Delta Improvement Rate measures the core value proposition of the system: the percentage of files that natively failed the strict policy check but were automatically fixed and re-certified successfully.

**Why it matters:**
A sudden drop means the AI/AutoFix engine is encountering files it doesn't know how to fix, leading to a higher manual rejection rate for end users.

**Typical causes:**
- New Policy Engine rules were introduced that AutoFix cannot remediate (e.g., minimum font size rules).
- Ghostscript color conversion failures on esoteric color profiles.
- Highly corrupted PDFs.

**Recommended operator workflow:**
1. Review the Top Errors to see what is failing *after* AutoFix.
2. Re-evaluate if any newly introduced print policies are overly aggressive.
    `,
        relatedIds: ['component-policy-engine', 'error-err-policy-violation'],
        appliesTo: ['Enterprise Customer Success', 'Support', 'SRE'],
        lastUpdated: '2026-03-06'
    },

    // ================= CONTROLS =================
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
        appliesTo: ['Operators', 'SRE'],
        lastUpdated: '2026-03-06'
    },
    {
        id: 'control-resume-queue',
        type: 'control',
        title: 'Resume Queue',
        category: 'Controls',
        summary: 'Re-enables job distribution from the queue to the worker nodes.',
        keywords: ['resume', 'start', 'play', 'unpause', 'queue', 'bullmq'],
        dashboardPath: '/admin?tab=controls',
        action: [
            'Ensure the underlying incident is mitigated',
            'Scale workers if backlog is massive',
            'Click Resume Queue'
        ],
        body: `
The **Resume Queue** action tells BullMQ to start distributing \`waiting\` jobs to workers again.

**When it should be used:**
After mitigating an incident that required a queue pause.

**Potential risks:**
**Thundering Herd Effect.** If the queue has been paused for 20 minutes, there may be thousands of jobs waiting. When resumed, workers will instantly pull maximum concurrency, potentially overwhelming storage or DB connections. Scale workers *before* resuming if the backlog is huge.
    `,
        relatedIds: ['control-pause-queue'],
        appliesTo: ['Operators', 'SRE'],
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
            'Document the reason thoroughly in the audit log',
            'Click Execute Drain',
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
        appliesTo: ['SRE'],
        lastUpdated: '2026-03-06'
    },
    {
        id: 'control-tenant-quarantine',
        type: 'control',
        title: 'Tenant Quarantine',
        category: 'Controls',
        summary: 'Blocks API ingestion for a specific tenant ID at the edge level.',
        keywords: ['quarantine', 'block', 'ban', 'tenant', 'isolation', 'dos'],
        dashboardPath: '/admin?tab=controls',
        action: [
            'Enter the offensive Tenant ID',
            'Set an appropriate TTL (Time To Live)',
            'Click Quarantine',
            'Contact the tenant'
        ],
        body: `
**Tenant Quarantine** instantly isolates a specific tenant, returning 403 Forbidden to any new API ingestion attempts from that tenant.

**What it does internally:**
It places the Tenant ID on a Redis blocklist watched by the edge middleware.

**When it should be used:**
A tenant's compromised system or misconfigured automation loop is launching a Denial of Service attack against the preflight API, threatening the stability of the global platform.

**Potential risks:**
Complete service disruption for the targeted customer. Ensure you have the correct Tenant ID.
    `,
        relatedIds: ['runbook-tenant-runaway-storm'],
        appliesTo: ['Operators', 'SRE', 'Support'],
        lastUpdated: '2026-03-06'
    },
    {
        id: 'control-retry-job',
        type: 'control',
        title: 'Retry Job',
        category: 'Controls',
        summary: 'Forces a failed job to return to the waiting queue.',
        keywords: ['retry', 'replay', 'restart', 'job', 'failure'],
        dashboardPath: '/admin?tab=controls',
        action: [
            'Locate the targeted Job ID',
            'Enter justification for audit log',
            'Click Retry'
        ],
        body: `
**Retry Job** takes a job from the \`failed\` state and places it back in the \`waiting\` state in BullMQ.

**When it should be used:**
After resolving a transient infrastructure issue (e.g., S3 storage was temporarily unavailable, causing PDF downloads to fail). 

**Potential risks:**
Low. However, retrying a job that fails deterministically (e.g., a corrupt PDF) will simply fail again, wasting worker CPU time.
    `,
        relatedIds: ['component-jobs-monitor'],
        appliesTo: ['Operators', 'Support'],
        lastUpdated: '2026-03-06'
    },

    // ================= ERRORS =================
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
Ghostscript is deterministic, but some complex vectors or infinite recursion bugs in bad PDFs can cause it to hang indefinitely. This timeout protects the worker from resource starvation.

**Typical causes:**
- Extremely dense CAD drawings or maps embedded in the PDF.
- Malformed PDFs that trigger a parsing loop in Poppler/Ghostscript.
- Worker node CPU is heavily throttled or overloaded by neighbors.

**Operator Action:**
1. Find the specific Job ID in the Jobs Monitor.
2. If it's a specific tenant, advise them on PDF complexity.
3. If it's happening globally, check worker CPU metrics.
    `,
        relatedIds: ['runbook-ghostscript-failure-spike', 'component-jobs-monitor'],
        appliesTo: ['Operators', 'Support'],
        lastUpdated: '2026-03-06'
    },
    {
        id: 'error-err-pdf-corrupt',
        type: 'error',
        title: 'ERR_PDF_CORRUPT',
        category: 'Errors',
        summary: 'The uploaded file is not a valid PDF or is fatally corrupted.',
        keywords: ['error', 'corrupt', 'invalid', 'file', 'poppler', 'parse'],
        dashboardPath: '/admin?tab=errors',
        body: `
**ERR_PDF_CORRUPT** means Poppler or the initial buffer parser failed to read the file structure entirely.

**Why it matters:**
The file cannot be processed. This is almost always a user-side issue, not a platform issue.

**Typical causes:**
- User uploaded an image (JPG/PNG) disguised with a .pdf extension.
- File upload was interrupted mid-stream.
- PDF is encrypted or password-protected.
- 0-byte file uploaded.

**Operator Action:**
Usually no action is required unless a single tenant is generating hundreds of these errors per minute (potential broken automation on their end).
    `,
        relatedIds: ['component-top-errors'],
        appliesTo: ['Support'],
        lastUpdated: '2026-03-06'
    },
    {
        id: 'error-err-policy-violation',
        type: 'error',
        title: 'ERR_POLICY_VIOLATION',
        category: 'Errors',
        summary: 'The parsed PDF violates the active print specification rules.',
        keywords: ['error', 'policy', 'rules', 'violation', 'reject'],
        dashboardPath: '/admin?tab=errors',
        body: `
**ERR_POLICY_VIOLATION** is a logical failure, not a technical one. The PDF was processed successfully but failed the deterministic recheck or the initial policy evaluation.

**Why it matters:**
This is the system working as intended—preventing bad files from reaching the physical printers.

**Typical causes:**
- Resolution (DPI) too low and AutoFix could not upscale further.
- Vector paths contain un-flattened transparencies that AutoFix was forbidden to rasterize due to 'Strict Vector' rules.
- Missing required fonts that could not be embedded or outlined.

**Operator Action:**
If a tenant complains, use the Jobs Monitor to extract the specific policy violation JSON payload and share it with them.
    `,
        relatedIds: ['component-policy-engine'],
        appliesTo: ['Enterprise Customer Success', 'Support'],
        lastUpdated: '2026-03-06'
    },
    {
        id: 'error-err-redis-unavailable',
        type: 'error',
        title: 'ERR_REDIS_UNAVAILABLE',
        category: 'Errors',
        summary: 'The backend could not communicate with the Redis cluster orchestrating BullMQ.',
        keywords: ['error', 'redis', 'bullmq', 'connection', 'timeout', 'database'],
        dashboardPath: '/admin?tab=errors',
        body: `
**ERR_REDIS_UNAVAILABLE** is a critical infrastructure fault.

**Why it matters:**
Without Redis, the V2 async architecture cannot enqueue or process jobs. Ingestion API routes will return 500s or 503s.

**Typical causes:**
- Redis memory exhaustion (OOM eviction failure).
- Cloud provider network partition.
- IORedis connection limit reached on the server pods.

**Operator Action:**
Initiate the Redis Outage Runbook immediately.
    `,
        relatedIds: ['runbook-redis-outage'],
        appliesTo: ['SRE'],
        lastUpdated: '2026-03-06'
    },

    // ================= RUNBOOKS =================
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
- **Check Latency:** Look at P95 Latency. If it's very high, jobs are processing but extremely slowly (e.g., massive PDFs).
- **Check DB:** Verify if MySQL is locked, preventing workers from committing final states.

### 3. Action Steps
1. **Scale Workers:** Provision additional worker pods horizontally.
2. **Identify Poison Pills:** Check if a specific file is causing OOM (Out of Memory) crash loops. Use the Jobs tab.
3. **Quarantine:** If a single tenant is causing the storm, use **Tenant Quarantine**.
4. **Database Pressure:** If MySQL is the bottleneck, scale DB reads or pause the queue temporarily using **Pause Queue**.

### 4. Verification
Observe the "Queue Backlog" decreasing. The "Oldest Waiting Job Age" should trend downwards to < 30s.
    `,
        relatedIds: ['metric-queue-backlog', 'control-pause-queue', 'control-tenant-quarantine'],
        appliesTo: ['SRE', 'Operators'],
        lastUpdated: '2026-03-06'
    },
    {
        id: 'runbook-tenant-runaway-storm',
        type: 'runbook',
        title: 'Incident: Tenant Runaway Storm',
        category: 'Incident Runbooks',
        summary: 'Steps to take when a single tenant submits a massive, unintended volume of jobs.',
        keywords: ['incident', 'tenant', 'storm', 'dos', 'quarantine', 'runaway'],
        dashboardPath: '/admin?tab=tenants',
        body: `
This occurs when a B2B client's automation goes rogue (e.g., an infinite \`while\` loop in their ingest script) submitting hundreds of jobs per second.

### 1. Detection
The Tenants Tab shows a single Tenant ID commanding 90%+ of the current job volume. P95 latency for other tenants begins to climb.

### 2. Diagnosis
Verify in the Jobs Monitor that the payload/files are highly repetitive or arriving at an unnatural cadence.

### 3. Action Steps
1. Navigate to the **Controls** tab.
2. Use **Tenant Quarantine** on the offensive Tenant ID. Set a TTL of 60 minutes.
3. Gather the Tenant ID and escalate to the Customer Success team to contact the client.
4. *Optional*: If the queue backlog threatens platform stability, you may need to use a targeted script (or Bulk Cancel) to remove their pending jobs from Redis.

### 4. Verification
Observe the ingestion rate dropping to normal levels. Ensure other tenants' P95 latency recovers.
    `,
        relatedIds: ['control-tenant-quarantine', 'metric-p95-latency'],
        appliesTo: ['SRE', 'Operators'],
        lastUpdated: '2026-03-06'
    },
    {
        id: 'runbook-ghostscript-failure-spike',
        type: 'runbook',
        title: 'Incident: Ghostscript Failure Spike',
        category: 'Incident Runbooks',
        summary: 'Steps to take when Ghostscript processing starts failing globally.',
        keywords: ['incident', 'ghostscript', 'gs', 'failure', 'segfault', 'spike'],
        dashboardPath: '/admin?tab=errors',
        body: `
### 1. Detection
The **Success Rate** plummets below 95%. The **Top Errors** panel floods with \`ERR_GS_*\` codes or segmentation faults.

### 2. Diagnosis
1. View specific "Error Payload" in the Jobs Monitor.
2. Look for exit code 1 or memory allocation faults.
3. Determine if the errors started exactly after a recent deployment of worker nodes.

### 3. Action Steps
1. **Rollback**: If a deployment occurred recently, rollback the worker node image to the previous stable version immediately.
2. **Identify Poison Pills**: If localized, check if a specific edge-case PDF feature (like a highly recursive Type3 font) is crashing the binary.
3. Update the Preflight Policy Engine to reject that specific PDF feature before it reaches the worker.

### 4. Verification
Monitor the "Success Rate" metric. It should immediately climb back to > 98%.
    `,
        relatedIds: ['error-err-gs-timeout', 'metric-success-rate'],
        appliesTo: ['SRE'],
        lastUpdated: '2026-03-06'
    },
    {
        id: 'runbook-redis-outage',
        type: 'runbook',
        title: 'Incident: Redis Outage',
        category: 'Incident Runbooks',
        summary: 'Steps to take when the Redis cluster becomes unavailable.',
        keywords: ['incident', 'redis', 'outage', 'network', 'connection', 'down'],
        dashboardPath: '/admin',
        body: `
### 1. Detection
The SRE Cockpit UI displays "Redis disconnected" warnings. API requests fail with 500s. Backends log \`ECONNREFUSED\`.

### 2. Diagnosis
1. Confirm if the issue is Application-to-Redis network connectivity, or if the Redis instance itself is down via your cloud provider's console.
2. Check if Redis entered a read-only state due to disk space issues.

### 3. Action Steps
1. Scale up the Redis instance or trigger a failover to the read-replica.
2. **Critical:** Once Redis is back online, you *must* restart the backend Node.js pods. Sometimes IORedis connection pools fail to self-heal cleanly after profound network drops.
3. If jobs were lost, you may need to advise clients to re-trigger uploads for jobs submitted during the outage window.

### 4. Verification
Dashboard connection indicators turn green. Jobs begin transitioning normally.
    `,
        relatedIds: ['error-err-redis-unavailable'],
        appliesTo: ['SRE'],
        lastUpdated: '2026-03-06'
    },

    // ================= COMPONENTS =================
    {
        id: 'component-jobs-monitor',
        type: 'component',
        title: 'Jobs Monitor',
        category: 'Components',
        summary: 'The real-time view of individual job executions and their current states.',
        keywords: ['jobs', 'monitor', 'state', 'trace', 'payload', 'progress'],
        dashboardPath: '/admin?tab=jobs',
        body: `
The **Jobs Monitor** provides the deepest level of observability into the asynchronous pipeline.

**Key Data Points:**
- **Status:** waiting, active, completed, failed, delayed.
- **Progress:** A 0-100% indicator emitted by the processing pipeline.
- **Step:** The specific pipeline phase (e.g., "Extracting Fonts", "Evaluating Policy").
- **Retry Attempts:** How many times the orchestration layer has re-attempted the job.
- **Error Payload:** Raw JSON stack trace or exit code from the underlying binary.

**Operator Usage:**
Use this view to drill down into specific failures. When an operator needs to determine *why* a file failed, finding the Job ID here and reading the Error Payload is the primary diagnostic step.
    `,
        relatedIds: ['control-retry-job', 'metric-queue-backlog'],
        appliesTo: ['Operators', 'Support'],
        lastUpdated: '2026-03-06'
    },
    {
        id: 'component-queue-status',
        type: 'component',
        title: 'Queue Status (Live Buffer Trace)',
        category: 'Components',
        summary: 'Direct introspection into BullMQ Redis states.',
        keywords: ['queue', 'status', 'buffer', 'bullmq', 'states'],
        dashboardPath: '/admin?tab=overview',
        body: `
The **Queue Status** view provides raw, unfiltered metrics directly from BullMQ's Redis structures.

**Understanding the States:**
- **Waiting:** Jobs ready and waiting for workers to pick them up.
- **Active:** Jobs currently locked by a worker node and actively processing.
- **Delayed:** Jobs scheduled for future processing (typically automated retries with exponential backoff).
- **Failed:** Jobs that exceeded max retry attempts and are parked permanently.
- **Paused:** The queue is administratively halted.

**Why it matters:**
This view bypasses MySQL entirely. If MySQL is down, this view will still show you exactly what the worker cluster is doing.
    `,
        relatedIds: ['metric-queue-backlog', 'control-drain-queue'],
        appliesTo: ['SRE', 'Operators'],
        lastUpdated: '2026-03-06'
    }
];
