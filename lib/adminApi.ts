// lib/adminApi.ts
type Range = "24h" | "7d" | "30d";

const ADMIN_KEY_STORAGE = "ppp_admin_api_key";

export const getAdminKey = () => {
    // 1. Check local storage (manual login)
    const stored = localStorage.getItem(ADMIN_KEY_STORAGE);
    if (stored) return stored;

    // 2. Check build-time env
    return (import.meta as any)?.env?.VITE_ADMIN_API_KEY || "";
};

export const setAdminKey = (key: string) => {
    localStorage.setItem(ADMIN_KEY_STORAGE, key);
};

export const clearAdminKey = () => {
    localStorage.removeItem(ADMIN_KEY_STORAGE);
};

async function adminFetch<T>(path: string, options?: RequestInit): Promise<T> {
    const key = getAdminKey();

    const res = await fetch(path, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            ...(key ? { "X-Admin-Api-Key": key } : {}),
            ...(options?.headers || {}),
        },
        credentials: "include", // por si luego metes cookie auth
    });

    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Admin API error ${res.status}: ${text || res.statusText}`);
    }
    return res.json() as Promise<T>;
}

export type OverviewResponse = {
    totalJobs: number;
    successRate: number;
    avgLatencyMs: number;
    maxLatencyMs: number;
    p95LatencyMs: number | null;
    deltaImprovementRate: number;
    costProxy: number;
    totalValueGenerated: number;
    totalHoursSaved: number;
    avgRiskBefore: number;
    avgRiskAfter: number;
    queueBacklog: number;
    oldestAgeSeconds: number;
};

export type TenantRow = {
    tenant_id: string;
    totalJobs: number;
    successRate: number;
    avgLatencyMs: number;
    totalValueGenerated: number;
    totalHoursSaved: number;
    topPolicy: string | null;
    lastActivity: string;
};

export type JobsResponse = {
    total: number;
    jobs: Array<{
        id: string;
        tenant_id: string;
        type: string;
        status: string;
        progress: number;
        step?: string | null;
        attempts?: number | null;
        error?: any;
        created_at: string;
        updated_at: string;
    }>;
};

export type TopErrorRow = {
    errorCode: string;
    count: number;
    lastSeen: string;
};

export type AuditRow = {
    id: string;
    job_id: string;
    tenant_id: string;
    action: string;
    policy_slug: string;
    ip_address: string;
    created_at: string;
};

export async function getOverview(range: Range) {
    return adminFetch<OverviewResponse>(`/api/admin/metrics/overview?range=${range}`);
}
export async function getTenants(range: Range) {
    return adminFetch<TenantRow[]>(`/api/admin/metrics/tenants?range=${range}`);
}
export async function getJobs(params: {
    status?: string;
    tenant?: string;
    type?: string;
    limit?: number;
    offset?: number;
}) {
    const qs = new URLSearchParams();
    if (params.status) qs.set("status", params.status);
    if (params.tenant) qs.set("tenant", params.tenant);
    if (params.type) qs.set("type", params.type);
    qs.set("limit", String(params.limit ?? 50));
    qs.set("offset", String(params.offset ?? 0));
    return adminFetch<JobsResponse>(`/api/admin/jobs?${qs.toString()}`);
}
export async function getTopErrors(range: Range) {
    return adminFetch<TopErrorRow[]>(`/api/admin/errors/top?range=${range}`);
}
export async function getAudit(params: { tenant_id?: string; job_id?: string; limit?: number }) {
    const qs = new URLSearchParams();
    if (params.tenant_id) qs.set("tenant_id", params.tenant_id);
    if (params.job_id) qs.set("job_id", params.job_id);
    qs.set("limit", String(params.limit ?? 100));
    return adminFetch<AuditRow[]>(`/api/admin/audit?${qs.toString()}`);
}

// --- Admin Controls API --- //

export async function pauseQueue(queue: 'preflight' | 'autofix', reason: string) {
    return adminFetch<{ ok: boolean, state: string }>(`/api/admin/control/queue/pause`, {
        method: 'POST',
        body: JSON.stringify({ queue, reason })
    });
}

export async function resumeQueue(queue: 'preflight' | 'autofix', reason: string) {
    return adminFetch<{ ok: boolean, state: string }>(`/api/admin/control/queue/resume`, {
        method: 'POST',
        body: JSON.stringify({ queue, reason })
    });
}

export async function drainQueue(queue: 'preflight' | 'autofix', includeDelayed: boolean, reason: string) {
    return adminFetch<{ ok: boolean }>(`/api/admin/control/queue/drain`, {
        method: 'POST',
        body: JSON.stringify({ queue, includeDelayed, reason })
    });
}

export async function obliterateQueue(queue: 'preflight' | 'autofix', reason: string) {
    return adminFetch<{ ok: boolean }>(`/api/admin/control/queue/obliterate`, {
        method: 'POST',
        body: JSON.stringify({ queue, force: true, reason })
    });
}

export async function enableQuarantine(tenantId: string, ttl: number, reason: string) {
    return adminFetch<{ ok: boolean }>(`/api/admin/control/tenants/${tenantId}/quarantine/enable`, {
        method: 'POST',
        body: JSON.stringify({ ttl_minutes: ttl, reason })
    });
}

export async function disableQuarantine(tenantId: string, reason: string) {
    return adminFetch<{ ok: boolean }>(`/api/admin/control/tenants/${tenantId}/quarantine/disable`, {
        method: 'POST',
        body: JSON.stringify({ reason })
    });
}

export async function getQuarantineList() {
    return adminFetch<{ ok: boolean, items: any[] }>(`/api/admin/control/tenants/quarantine`);
}

export async function retryJob(jobId: string, reason: string) {
    return adminFetch<{ ok: boolean, new_job_id: string }>(`/api/admin/control/jobs/${jobId}/retry`, {
        method: 'POST',
        body: JSON.stringify({ reason })
    });
}

export async function cancelJob(jobId: string, reason: string) {
    return adminFetch<{ ok: boolean, status: string }>(`/api/admin/control/jobs/${jobId}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason })
    });
}

export async function getAdminQueueStats() {
    return adminFetch<{ ok: boolean, stats: any }>(`/api/admin/control/queue/stats`);
}
export async function getQueue() {
    return adminFetch<any>(`/api/admin/queue`);
}

export async function postHelpAnalytics(payload: {
    event_type: 'article_viewed' | 'search_query' | 'search_result_clicked' | 'helpful_yes' | 'helpful_no' | 'improvement_suggested';
    article_id?: string;
    search_query?: string;
    tenant_id?: string;
    user_id?: string;
}) {
    // Fire and forget usually, but we return the promise
    return adminFetch<{ ok: boolean, id: number }>(`/api/admin/help/analytics`, {
        method: 'POST',
        body: JSON.stringify(payload)
    });
}
