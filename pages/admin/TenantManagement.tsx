import React, { useState, useEffect } from 'react';
import {
    UsersIcon,
    KeyIcon,
    CalendarIcon,
    ShieldCheckIcon,
    ChartBarIcon,
    PencilSquareIcon,
    CheckCircleIcon,
    XCircleIcon,
    ClockIcon,
    GlobeAltIcon,
    ArrowPathIcon,
    ExclamationTriangleIcon,
    ArrowRightIcon,
    TagIcon,
    UserCircleIcon,
    EnvelopeIcon,
    CurrencyEuroIcon
} from '@heroicons/react/24/outline';
import {
    getTenantsList,
    updateTenant,
    getTenantUsage,
    TenantDetail,
    TenantUsageHistory,
    getTenantTimeline,
    TimelineEvent,
    getBillingData
} from '../../lib/adminApi';

const BillingViewer = ({ tenantId, onClose }: { tenantId: string; onClose: () => void }) => {
    const [billingData, setBillingData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const now = new Date();
    const [year, setYear] = useState(now.getFullYear().toString());
    const [month, setMonth] = useState((now.getMonth() + 1).toString().padStart(2, '0'));

    useEffect(() => {
        setLoading(true);
        getBillingData(tenantId, year, month)
            .then(setBillingData)
            .catch(err => console.error('Failed to load billing', err))
            .finally(() => setLoading(false));
    }, [tenantId, year, month]);

    return (
        <div className="mt-4 p-5 bg-indigo-50/50 rounded-2xl border border-indigo-100 animate-in slide-in-from-top duration-300 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4">
                <button onClick={onClose} className="text-indigo-400 hover:text-indigo-600 transition-colors">
                    <XCircleIcon className="w-5 h-5" />
                </button>
            </div>

            <div className="flex items-center gap-4 mb-6">
                <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-200">
                    <CurrencyEuroIcon className="w-5 h-5" />
                </div>
                <div>
                    <h4 className="font-bold text-slate-900 leading-none">Billing Intelligence</h4>
                    <p className="text-[10px] text-indigo-600 mt-1 font-black uppercase tracking-widest">Usage-Based Financial Insights</p>
                </div>

                <div className="flex gap-2 ml-auto mr-8">
                    <select
                        value={year}
                        onChange={(e) => setYear(e.target.value)}
                        className="text-[10px] font-bold bg-white border border-indigo-100 rounded-lg px-2 py-1 outline-none"
                    >
                        <option value="2024">2024</option>
                        <option value="2025">2025</option>
                        <option value="2026">2026</option>
                    </select>
                    <select
                        value={month}
                        onChange={(e) => setMonth(e.target.value)}
                        className="text-[10px] font-bold bg-white border border-indigo-100 rounded-lg px-2 py-1 outline-none"
                    >
                        {Array.from({ length: 12 }).map((_, i) => (
                            <option key={i} value={(i + 1).toString().padStart(2, '0')}>
                                {new Date(2000, i).toLocaleString('default', { month: 'short' })}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {loading ? (
                <div className="py-8 text-center text-indigo-400 font-medium text-sm">Aggregating cycle data...</div>
            ) : billingData && billingData.ok ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <BillingStat label="Total Jobs" value={billingData.usage.total_jobs || 0} />
                    <BillingStat label="Value Generated" value={`€${(billingData.usage.total_value || 0).toFixed(2)}`} />
                    <BillingStat label="Hours Saved" value={`${(billingData.usage.total_hours || 0).toFixed(1)}h`} />
                    <BillingStat label="Peak Day" value={billingData.usage.peak_day ? new Date(billingData.usage.peak_day).toLocaleDateString() : 'N/A'} />
                </div>
            ) : (
                <div className="py-8 text-center text-slate-400 text-sm">No billing data for this period.</div>
            )}

            <div className="mt-4 flex justify-end">
                <button
                    className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-indigo-600 hover:text-indigo-800 transition-colors"
                    onClick={() => window.open(`/api/admin/tenants/${tenantId}/billing/${year}/${month}?format=csv`, '_blank')}
                >
                    <ArrowPathIcon className="w-3 h-3" />
                    Download CSV Report
                </button>
            </div>
        </div>
    );
};

const BillingStat = ({ label, value }: { label: string; value: any }) => (
    <div className="bg-white p-3 rounded-xl border border-indigo-100/50 shadow-sm">
        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</div>
        <div className="text-sm font-bold text-slate-900">{value}</div>
    </div>
);

const TimelineViewer = ({ tenantId, onClose }: { tenantId: string; onClose: () => void }) => {
    const [events, setEvents] = useState<TimelineEvent[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        getTenantTimeline(tenantId)
            .then(setEvents)
            .finally(() => setLoading(false));
    }, [tenantId]);

    return (
        <div className="bg-slate-50 border-t border-slate-200 p-4 animate-in slide-in-from-top duration-200">
            <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                    <ClockIcon className="w-4 h-4" />
                    Activity Timeline
                </h4>
                <button onClick={onClose} className="text-xs text-slate-400 hover:text-slate-600">Close</button>
            </div>

            {loading ? (
                <div className="text-center py-4 text-xs text-slate-400">Loading history...</div>
            ) : events.length === 0 ? (
                <div className="text-center py-4 text-xs text-slate-400 italic">No history events found yet.</div>
            ) : (
                <div className="space-y-4 relative before:absolute before:left-2 before:top-2 before:bottom-2 before:w-px before:bg-slate-200">
                    {events.map((event, idx) => (
                        <div key={idx} className="relative pl-7 group">
                            <div className={`absolute left-0 top-1.5 w-4 h-4 rounded-full border-2 border-white shadow-sm z-10 ${event.type === 'PLAN' ? 'bg-amber-500' :
                                event.event.includes('100') ? 'bg-rose-500' : 'bg-blue-500'
                                }`} />
                            <div className="flex flex-col">
                                <span className="text-[11px] font-bold text-slate-700 flex items-center gap-2">
                                    {event.event}
                                    <span className="font-normal text-slate-400 text-[10px]">
                                        {new Date(event.timestamp).toLocaleString()}
                                    </span>
                                </span>
                                {event.details && (
                                    <span className="text-[10px] text-slate-500 italic mt-0.5">
                                        {event.details.reason || JSON.stringify(event.details)}
                                    </span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default function TenantManagement() {
    const [tenants, setTenants] = useState<TenantDetail[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingTenant, setEditingTenant] = useState<TenantDetail | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [expandedTenant, setExpandedTenant] = useState<string | null>(null);
    const [billingTenant, setBillingTenant] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'general' | 'notifications'>('general');

    useEffect(() => {
        loadTenants();
    }, []);

    async function loadTenants() {
        try {
            setLoading(true);
            const data = await getTenantsList();
            setTenants(data);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    async function handleSave() {
        if (!editingTenant) return;
        try {
            setIsSaving(true);
            await updateTenant(editingTenant.id, editingTenant);
            await loadTenants();
            setEditingTenant(null);
        } catch (err: any) {
            alert('Failed to save tenant: ' + err.message);
        } finally {
            setIsSaving(false);
        }
    }

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'ACTIVE': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
            case 'SUSPENDED': return 'bg-amber-100 text-amber-800 border-amber-200';
            case 'QUARANTINED': return 'bg-rose-100 text-rose-800 border-rose-200';
            default: return 'bg-slate-100 text-slate-800 border-slate-200';
        }
    };

    const getPlanColor = (plan: string) => {
        switch (plan) {
            case 'ENTERPRISE': return 'bg-indigo-100 text-indigo-800 border-indigo-200';
            case 'PRO': return 'bg-blue-100 text-blue-800 border-blue-200';
            default: return 'bg-slate-100 text-slate-800 border-slate-200';
        }
    };

    const Sparkline = ({ data }: { data: number[] }) => {
        if (!data || data.length < 2) return <div className="h-8 w-24 bg-slate-50 rounded flex items-center justify-center text-[10px] text-slate-300">No trend data</div>;

        const max = Math.max(...data, 1);
        const height = 32;
        const width = 100;
        const pts = data.map((v, i) => ({
            x: (i / (data.length - 1)) * width,
            y: height - (v / max) * height
        }));

        const d = `M ${pts[0].x} ${pts[0].y} ` + pts.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ');

        return (
            <svg width={width} height={height} className="overflow-visible">
                <path
                    d={d}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-primary/40"
                />
            </svg>
        );
    };

    const [histories, setHistories] = useState<Record<string, number[]>>({});

    useEffect(() => {
        if (tenants.length > 0) {
            tenants.forEach(t => {
                if (!histories[t.id]) {
                    getTenantUsage(t.id, 7).then(data => {
                        setHistories(prev => ({
                            ...prev,
                            [t.id]: data.map(d => d.jobs_count)
                        }));
                    }).catch(() => { });
                }
            });
        }
    }, [tenants]);

    const formatLastActive = (dateStr: string | null) => {
        if (!dateStr) return 'Never';
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
        return date.toLocaleDateString();
    };

    const isExpiringSoon = (dateStr: string | null) => {
        if (!dateStr) return false;
        const diff = new Date(dateStr).getTime() - new Date().getTime();
        return diff > 0 && diff < 7 * 24 * 60 * 60 * 1000;
    };

    const isNearLimit = (usage: number, limit: number) => {
        if (!limit) return false;
        return (usage / limit) >= 0.8;
    };

    if (loading && tenants.length === 0) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-slate-900">Tenant & Subscription Management</h2>
                    <p className="text-slate-500">Control client connections, plans, and API quotas.</p>
                </div>
                <button
                    onClick={() => loadTenants()}
                    className="p-2 text-slate-400 hover:text-primary transition-colors flex items-center gap-2"
                >
                    <ArrowPathIcon className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                    <span className="text-xs font-bold uppercase tracking-widest">{loading ? 'Syncing...' : 'Sync Now'}</span>
                </button>
            </div>

            {error && (
                <div className="p-4 bg-rose-50 text-rose-700 rounded-xl border border-rose-100 flex items-center gap-3">
                    <XCircleIcon className="w-5 h-5 shrink-0" />
                    <p>{error}</p>
                </div>
            )}

            <div className="grid grid-cols-1 gap-6">
                {tenants.map(tenant => {
                    const usagePercent = Math.min(Math.round((tenant.dailyUsage / (tenant.daily_job_limit || 1000)) * 100), 100);
                    const usageWarning = isNearLimit(tenant.dailyUsage, tenant.daily_job_limit);
                    const expiryWarning = isExpiringSoon(tenant.plan_expires_at);

                    const tenantHistory = histories[tenant.id] || [];
                    const totalJobs7d = tenantHistory.reduce((a, b) => a + b, 0);
                    const isChurnRisk = tenant.plan === 'FREE' && totalJobs7d === 0 && expiryWarning;
                    const isHighUsageRisk = usagePercent >= 90;

                    return (
                        <div
                            key={tenant.id}
                            className={`bg-white rounded-2xl border ${usagePercent >= 100 ? 'border-rose-200' : 'border-slate-200'} overflow-hidden hover:shadow-xl transition-all relative`}
                        >
                            {(usagePercent >= 100 || expiryWarning) && (
                                <div className="absolute top-0 left-0 w-1 h-full bg-rose-500" />
                            )}

                            <div className="p-6">
                                <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                                    <div className="space-y-3 flex-1">
                                        <div className="flex items-center gap-3 flex-wrap">
                                            <h3 className="font-bold text-lg text-slate-900">{tenant.name}</h3>
                                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${getStatusColor(tenant.status)}`}>
                                                {tenant.status}
                                            </span>
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${getPlanColor(tenant.plan)}`}>
                                                {tenant.plan}
                                            </span>
                                            {isChurnRisk && (
                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-200 animate-pulse">
                                                    CHURN RISK
                                                </span>
                                            )}
                                            {isHighUsageRisk && (
                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200">
                                                    HIGH USAGE
                                                </span>
                                            )}
                                            {expiryWarning && (
                                                <span className="flex items-center gap-1 text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full text-[10px] font-black border border-amber-200 uppercase animate-pulse">
                                                    <ExclamationTriangleIcon className="w-3 h-3" />
                                                    Expiring Soon
                                                </span>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-6 text-sm text-slate-500">
                                            <span className="flex items-center gap-1.5">
                                                <KeyIcon className="w-4 h-4" />
                                                <strong>{tenant.keyCount}</strong> Keys
                                            </span>
                                            <span className="flex items-center gap-1.5">
                                                <GlobeAltIcon className="w-4 h-4" />
                                                Seen {formatLastActive(tenant.last_active_at)}
                                            </span>
                                        </div>

                                        {/* Usage & Trend (Phase 19.6) */}
                                        <div className="flex items-end gap-6 pt-2">
                                            <div className="flex-1 space-y-1.5">
                                                <div className="flex items-center justify-between text-xs font-bold">
                                                    <span className={`${usageWarning ? 'text-rose-600' : 'text-slate-600'} uppercase tracking-wider`}>Daily Quota Consumption</span>
                                                    <span className={usageWarning ? 'text-rose-600' : 'text-slate-400'}>
                                                        {tenant.dailyUsage} / {tenant.daily_job_limit} ({usagePercent}%)
                                                    </span>
                                                </div>
                                                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200/50">
                                                    <div
                                                        className={`h-full transition-all duration-1000 rounded-full ${usagePercent >= 100 ? 'bg-rose-500' :
                                                            usagePercent >= 80 ? 'bg-amber-500' :
                                                                'bg-emerald-500'
                                                            }`}
                                                        style={{ width: `${usagePercent}%` }}
                                                    />
                                                </div>
                                            </div>
                                            <div className="shrink-0 flex flex-col items-center">
                                                <Sparkline data={histories[tenant.id]} />
                                                <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest mt-1">7D Volume Trend</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex flex-col items-end gap-3 min-w-[140px]">
                                        <button
                                            onClick={() => setEditingTenant(tenant)}
                                            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-all shadow-lg shadow-slate-200 active:scale-95"
                                        >
                                            <PencilSquareIcon className="w-4 h-4" />
                                            Manage Plan
                                        </button>
                                        <div className="text-right">
                                            <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Client Since</p>
                                            <p className="text-xs font-bold text-slate-600">{new Date(tenant.created_at).toLocaleDateString()}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Plan Health & Alerts (Phase 19.6) */}
                                {tenant.alerts_state_json?.fired?.length ? (
                                    <div className="mt-4 p-3 bg-rose-50 rounded-xl border border-rose-100 flex items-center gap-3">
                                        <ExclamationTriangleIcon className="w-5 h-5 text-rose-600" />
                                        <div className="text-xs">
                                            <p className="font-bold text-rose-900 uppercase tracking-tighter">Threshold Alerts Fired Today</p>
                                            <div className="flex gap-2 mt-1">
                                                {tenant.alerts_state_json.fired.map(lvl => (
                                                    <span key={lvl} className="bg-rose-600 text-white px-1.5 py-0.5 rounded text-[10px] font-black">
                                                        {lvl}% REACHED
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                ) : null}
                            </div>

                            {/* Limits & Health Footer */}
                            <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs font-medium text-slate-500">
                                <div className="flex items-center gap-6">
                                    <span className={`flex items-center gap-1.5 ${expiryWarning ? 'text-amber-700 font-bold' : ''}`}>
                                        <CalendarIcon className="w-3.5 h-3.5" />
                                        Exp: {tenant.plan_expires_at ? new Date(tenant.plan_expires_at).toLocaleDateString() : 'Lifetime'}
                                    </span>
                                    <span className="flex items-center gap-1.5">
                                        <ChartBarIcon className="w-3.5 h-3.5" />
                                        Max Batch: {tenant.max_batch_size} PDFs
                                    </span>
                                    <span className={`flex items-center gap-1.5 font-bold ${(usagePercent >= 100 || (tenant.plan_expires_at && new Date(tenant.plan_expires_at) < new Date())) ? 'text-rose-600' :
                                        (usageWarning || expiryWarning) ? 'text-amber-600' :
                                            'text-emerald-600'
                                        }`}>
                                        <ShieldCheckIcon className="w-3.5 h-3.5" />
                                        {(usagePercent >= 100 || (tenant.plan_expires_at && new Date(tenant.plan_expires_at) < new Date())) ? 'Interrupted' :
                                            (usageWarning || expiryWarning) ? 'At Risk' :
                                                'Healthy'}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setExpandedTenant(expandedTenant === tenant.id ? null : tenant.id)}
                                        className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded transition-colors ${expandedTenant === tenant.id ? 'bg-primary text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                            }`}
                                    >
                                        <ClockIcon className="w-3 h-3" />
                                        History
                                    </button>
                                    <button
                                        onClick={() => setBillingTenant(billingTenant === tenant.id ? null : tenant.id)}
                                        className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded transition-colors ${billingTenant === tenant.id ? 'bg-indigo-600 text-white' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
                                            }`}
                                    >
                                        <CurrencyEuroIcon className="w-3 h-3" />
                                        Billing
                                    </button>
                                    <span className="flex items-center gap-1.5 font-mono text-[10px] bg-white border border-slate-200 px-2 py-0.5 rounded shadow-sm hover:text-primary transition-colors cursor-help" title={`Full ID: ${tenant.id}`}>
                                        ID: {tenant.id.substring(0, 8)}...
                                    </span>
                                </div>
                            </div>

                            {/* Phase 20 Timeline View */}
                            {expandedTenant === tenant.id && (
                                <TimelineViewer
                                    tenantId={tenant.id}
                                    onClose={() => setExpandedTenant(null)}
                                />
                            )}
                            {billingTenant === tenant.id && (
                                <BillingViewer
                                    tenantId={tenant.id}
                                    onClose={() => setBillingTenant(null)}
                                />
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Edit Modal */}
            {editingTenant && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                            <h3 className="text-xl font-bold text-slate-900">Manage Tenant</h3>
                            <button onClick={() => setEditingTenant(null)} className="p-2 text-slate-400 hover:text-slate-600 transition-colors">
                                <XCircleIcon className="w-7 h-7" />
                            </button>
                        </div>

                        <div className="flex border-b border-slate-100">
                            {['General', 'Notifications'].map(tab => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab.toLowerCase() as any)}
                                    className={`flex-1 py-3 text-sm font-bold transition-all border-b-2 ${activeTab === tab.toLowerCase()
                                        ? 'border-primary text-primary'
                                        : 'border-transparent text-slate-400 hover:text-slate-600'
                                        }`}
                                >
                                    {tab}
                                </button>
                            ))}
                        </div>

                        <div className="p-8 space-y-6 max-h-[60vh] overflow-y-auto">
                            {activeTab === 'general' ? (
                                <div className="space-y-4">
                                    <label className="block">
                                        <span className="text-sm font-bold text-slate-700">Client Name</span>
                                        <input
                                            type="text"
                                            value={editingTenant.name}
                                            onChange={e => setEditingTenant({ ...editingTenant, name: e.target.value })}
                                            className="mt-1 block w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-medium"
                                        />
                                    </label>

                                    <div className="grid grid-cols-2 gap-4">
                                        <label className="block">
                                            <span className="text-sm font-bold text-slate-700">Plan</span>
                                            <select
                                                value={editingTenant.plan}
                                                onChange={e => setEditingTenant({ ...editingTenant, plan: e.target.value as any })}
                                                className="mt-1 block w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-medium"
                                            >
                                                <option value="FREE">FREE</option>
                                                <option value="PRO">PRO</option>
                                                <option value="ENTERPRISE">ENTERPRISE</option>
                                            </select>
                                        </label>
                                        <label className="block">
                                            <span className="text-sm font-bold text-slate-700">Status</span>
                                            <select
                                                value={editingTenant.status}
                                                onChange={e => setEditingTenant({ ...editingTenant, status: e.target.value as any })}
                                                className="mt-1 block w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-medium"
                                            >
                                                <option value="ACTIVE">ACTIVE</option>
                                                <option value="SUSPENDED">SUSPENDED</option>
                                                <option value="QUARANTINED">QUARANTINED</option>
                                            </select>
                                        </label>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <label className="block">
                                            <span className="text-sm font-bold text-slate-700">Daily Quota</span>
                                            <input
                                                type="number"
                                                value={editingTenant.daily_job_limit}
                                                onChange={e => setEditingTenant({ ...editingTenant, daily_job_limit: parseInt(e.target.value) })}
                                                className="mt-1 block w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-medium"
                                            />
                                        </label>
                                        <label className="block">
                                            <span className="text-sm font-bold text-slate-700">Max ZIP Size</span>
                                            <input
                                                type="number"
                                                value={editingTenant.max_batch_size}
                                                onChange={e => setEditingTenant({ ...editingTenant, max_batch_size: parseInt(e.target.value) })}
                                                className="mt-1 block w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-medium"
                                            />
                                        </label>
                                    </div>

                                    <label className="block">
                                        <span className="text-sm font-bold text-slate-700">Expiration Date</span>
                                        <input
                                            type="date"
                                            value={editingTenant.plan_expires_at ? editingTenant.plan_expires_at.split('T')[0] : ''}
                                            onChange={e => setEditingTenant({ ...editingTenant, plan_expires_at: e.target.value })}
                                            className="mt-1 block w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-medium"
                                        />
                                        <p className="mt-1 text-xs text-slate-400">Leave blank for no expiration.</p>
                                    </label>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100">
                                        <div className="flex items-center gap-3 text-blue-700 mb-2">
                                            <EnvelopeIcon className="w-5 h-5" />
                                            <span className="text-sm font-bold">Email Alerts</span>
                                        </div>
                                        <div className="flex items-center justify-between mb-4">
                                            <span className="text-xs text-slate-600 font-medium">Enable for critical events</span>
                                            <input
                                                type="checkbox"
                                                checked={editingTenant.notification_settings_json?.email}
                                                onChange={e => setEditingTenant({
                                                    ...editingTenant,
                                                    notification_settings_json: {
                                                        ...editingTenant.notification_settings_json,
                                                        email: e.target.checked
                                                    }
                                                })}
                                                className="w-5 h-5 rounded border-slate-300 text-primary focus:ring-primary"
                                            />
                                        </div>
                                        <input
                                            type="email"
                                            placeholder="Admin Email (e.g. notifications@client.com)"
                                            value={editingTenant.notification_settings_json?.email_to || ''}
                                            onChange={e => setEditingTenant({
                                                ...editingTenant,
                                                notification_settings_json: {
                                                    ...editingTenant.notification_settings_json,
                                                    email_to: e.target.value
                                                }
                                            })}
                                            className="w-full px-4 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-primary-light transition-all"
                                        />
                                    </div>

                                    <div className="p-4 bg-purple-50 rounded-2xl border border-purple-100">
                                        <div className="flex items-center gap-3 text-purple-700 mb-2">
                                            <GlobeAltIcon className="w-5 h-5" />
                                            <span className="text-sm font-bold">Webhook Events</span>
                                        </div>
                                        <p className="text-[10px] text-slate-500 mb-3 uppercase tracking-wider font-bold">Select events to dispatch</p>
                                        <div className="grid grid-cols-1 gap-2">
                                            {['quota.80', 'quota.100', 'plan.expiring', 'plan.expired', 'churn.risk'].map(evt => (
                                                <label key={evt} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/50 transition-colors cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={editingTenant.notification_settings_json?.webhooks?.includes(evt)}
                                                        onChange={e => {
                                                            const current = editingTenant.notification_settings_json?.webhooks || [];
                                                            const next = e.target.checked
                                                                ? [...current, evt]
                                                                : current.filter(x => x !== evt);
                                                            setEditingTenant({
                                                                ...editingTenant,
                                                                notification_settings_json: {
                                                                    ...editingTenant.notification_settings_json,
                                                                    webhooks: next
                                                                }
                                                            });
                                                        }}
                                                        className="w-4 h-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                                                    />
                                                    <span className="text-xs font-mono text-slate-600">{evt}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="p-6 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
                            <button
                                onClick={() => setEditingTenant(null)}
                                className="px-6 py-2 text-slate-600 font-bold hover:bg-slate-200 transition-colors rounded-xl"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={isSaving}
                                className="px-8 py-2 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/30 hover:bg-primary-dark transition-all flex items-center gap-2"
                            >
                                {isSaving ? (
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                ) : (
                                    <CheckCircleIcon className="w-5 h-5" />
                                )}
                                Save Changes
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
