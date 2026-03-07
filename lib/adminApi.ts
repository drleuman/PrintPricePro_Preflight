// lib/adminApi.ts
type Range = "24h" | "7d" | "30d";

const ADMIN_KEY_STORAGE = "ppp_admin_api_key";

export const getAdminKey = () => {
    // 1. Check local storage (manual login) - support both legacy and new keys
    const stored = localStorage.getItem(ADMIN_KEY_STORAGE) ||
        localStorage.getItem('admin_key') ||
        localStorage.getItem('ppp_admin_api_key');
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

export interface NotificationSettings {
    email: boolean;
    email_to?: string;
    webhooks?: string[];
}

export type TenantDetail = {
    id: string;
    name: string;
    status: 'ACTIVE' | 'SUSPENDED' | 'QUARANTINED';
    plan: 'FREE' | 'PRO' | 'ENTERPRISE';
    rate_limit_rpm: number;
    plan_expires_at: string | null;
    last_active_at: string | null;
    daily_job_limit: number;
    max_batch_size: number;
    created_at: string;
    metadata_json: any;
    keyCount: number;
    dailyUsage: number;
    alerts_state_json?: {
        last_date?: string;
        fired?: string[];
    };
    notification_settings_json?: NotificationSettings;
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

export type CSWorkflow = {
    id: string;
    tenant_id: string;
    tenant_name: string;
    workflow_type: string;
    status: 'ACTIVE' | 'COMPLETED' | 'ABANDONED';
    current_step: number;
    last_action_at: string | null;
    next_action_at: string | null;
    metadata_json: any;
    created_at: string;
    updated_at: string;
};

export async function getOverview(range: Range) {
    return adminFetch<OverviewResponse>(`/api/admin/metrics/overview?range=${range}`);
}
export async function getTenants(range: Range) {
    return adminFetch<TenantRow[]>(`/api/admin/metrics/tenants?range=${range}`);
}
export async function getTenantsList() {
    return adminFetch<TenantDetail[]>(`/api/admin/tenants`);
}
export async function updateTenant(id: string, data: Partial<TenantDetail>) {
    return adminFetch<{ ok: boolean }>(`/api/admin/tenants/${id}`, {
        method: 'POST',
        body: JSON.stringify(data)
    });
}

export type TenantUsageHistory = {
    date: string;
    jobs_count: number;
    batches_count: number;
    value_generated: number;
    hours_saved: number;
};

export interface TimelineEvent {
    type: 'ALERT' | 'PLAN';
    event: string;
    details: any;
    timestamp: string;
}

export async function getTenantUsage(id: string, days: number = 7) {
    return adminFetch<TenantUsageHistory[]>(`/api/admin/tenants/${id}/usage?days=${days}`);
}

export async function getTenantTimeline(tenantId: string): Promise<TimelineEvent[]> {
    return adminFetch<TimelineEvent[]>(`/api/admin/tenants/${tenantId}/timeline`);
}

export async function getBillingData(tenantId: string, year: string, month: string): Promise<any> {
    return adminFetch<any>(`/api/admin/tenants/${tenantId}/billing/${year}/${month}`);
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

export async function getPrinters(filters: string = "") {
    return adminFetch<any[]>(`/api/admin/network/printers${filters ? '?' + filters : ''}`);
}

export async function getNetworkOverview() {
    return adminFetch<any>(`/api/admin/network/overview`);
}

export async function getCapacity() {
    return adminFetch<any[]>(`/api/admin/network/capacity`);
}

export async function getHealth() {
    return adminFetch<any[]>(`/api/admin/network/health`);
}

export async function getRoutingOverview() {
    return adminFetch<any>(`/api/admin/routing/overview`);
}

export async function getCSWorkflows(): Promise<CSWorkflow[]> {
    const res = await adminFetch<{ ok: boolean, workflows: CSWorkflow[] }>(`/api/admin/cs-workflows`);
    return res.workflows;
}

export async function getMarketplaceSessions() {
    return adminFetch<any[]>(`/api/admin/marketplace/sessions`);
}

export async function getMarketplaceSessionDetail(id: string) {
    return adminFetch<any>(`/api/admin/marketplace/sessions/${id}`);
}

export async function selectMarketplaceOffer(sessionId: string, offerId: string) {
    return adminFetch<{ ok: boolean }>(`/api/admin/marketplace/sessions/${sessionId}/select`, {
        method: 'POST',
        body: JSON.stringify({ offer_id: offerId, selection_mode: 'ADMIN_OVERRIDE' })
    });
}

export async function getFinanceTransactions() {
    return adminFetch<any[]>(`/api/admin/finance/transactions`);
}

export async function getFinanceMetrics() {
    return adminFetch<any>(`/api/admin/finance/metrics`);
}

export async function getFinanceTransactionDetail(id: string) {
    return adminFetch<any>(`/api/admin/finance/transactions/${id}`);
}

export async function getNegotiations() {
    return adminFetch<any[]>(`/api/admin/marketplace/ready/negotiations`);
}

export async function getNegotiationChain(offerId: string) {
    return adminFetch<any[]>(`/api/admin/marketplace/ready/negotiations/${offerId}`);
}

export async function acceptCounteroffer(offerId: string, counterofferId: string) {
    return adminFetch<{ ok: boolean }>(`/api/printer-offers/${offerId}/counter/${counterofferId}/accept`, {
        method: 'POST'
    });
}

export async function getOffers() {
    return adminFetch<any[]>(`/api/admin/offers`);
}

export async function getOffersMetrics() {
    return adminFetch<any>(`/api/admin/offers/metrics`);
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

// --- Autonomy API ---
export async function getAutonomyPipelines() {
    return adminFetch<any[]>(`/api/admin/autonomy`);
}

export async function getAutonomyMetrics() {
    return adminFetch<any>(`/api/admin/autonomy/metrics`);
}

export async function getAutonomyPipelineDetail(id: string) {
    return adminFetch<any>(`/api/admin/autonomy/${id}`);
}

export async function pauseAutonomyPipeline(id: string, reason: string) {
    return adminFetch<{ ok: boolean }>(`/api/admin/autonomy/${id}/pause`, {
        method: 'POST',
        body: JSON.stringify({ reason })
    });
}

export async function resumeAutonomyPipeline(id: string) {
    return adminFetch<{ ok: boolean }>(`/api/admin/autonomy/${id}/resume`, {
        method: 'POST'
    });
}

export async function retryAutonomyPipelineStep(id: string) {
    return adminFetch<{ ok: boolean }>(`/api/admin/autonomy/${id}/retry-step`, {
        method: 'POST'
    });
}

// --- Commercial Commitments ---
export async function getCommercialCommitments() {
    return adminFetch<any[]>(`/api/admin/commercial`);
}

export async function getCommercialCommitmentDetail(id: string) {
    return adminFetch<any>(`/api/admin/commercial/${id}`);
}

export async function lockCommercialCommitment(id: string) {
    return adminFetch<{ ok: boolean }>(`/api/admin/commercial/${id}/lock`, {
        method: 'POST'
    });
}

export async function voidCommercialCommitment(id: string) {
    return adminFetch<{ ok: boolean }>(`/api/admin/commercial/${id}/void`, {
        method: 'POST'
    });
}

export async function getSettlementReadiness() {
    return adminFetch<any[]>(`/api/admin/commercial/settlement/readiness`);
}

// --- Pricing (Profiles/Quotes) ---
export async function getPricingProfiles() {
    return adminFetch<any[]>(`/api/admin/pricing/profiles`);
}

export async function getJobQuotes(jobId: string) {
    return adminFetch<any[]>(`/api/admin/pricing/jobs/${jobId}/quotes`);
}

// --- Economic Routing ---
export async function getEconomicRoutingHistory() {
    return adminFetch<any[]>(`/api/admin/routing/economic/history`);
}

export async function getEconomicRoutingConflicts() {
    return adminFetch<any[]>(`/api/admin/routing/economic/conflicts`);
}

// --- Engagement ---
export async function getEngagementSignals() {
    const res = await adminFetch<{ ok: boolean, signals: any[] }>(`/api/admin/engagement-signals`);
    return res.signals || [];
}

export async function getEngagementStats() {
    const res = await adminFetch<{ ok: boolean, stats: any[] }>(`/api/admin/engagement-stats`);
    return res.stats || [];
}
