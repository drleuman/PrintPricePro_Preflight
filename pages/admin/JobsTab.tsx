// pages/admin/JobsTab.tsx
import React, { useMemo, useState } from "react";
import { getJobs, getAudit, AuditRow } from "../../lib/adminApi";
import { useAdminQuery } from "../../hooks/useAdminData";
import { t } from "../../i18n";
import {
    AdjustmentsHorizontalIcon,
    MagnifyingGlassIcon,
    ChevronLeftIcon,
    ChevronRightIcon,
    XMarkIcon,
    ClockIcon,
    TagIcon,
    QueueListIcon,
    ExclamationCircleIcon,
    CheckBadgeIcon,
    ArrowPathIcon,
    InformationCircleIcon,
    FingerPrintIcon,
    BoltIcon,
    ShieldCheckIcon,
    WrenchScrewdriverIcon
} from "@heroicons/react/24/outline";
import { getErrorArticleLink } from "../../lib/helpSearch";

export const JobsTab: React.FC<{ refreshMs?: number }> = ({ refreshMs = 0 }) => {
    const [status, setStatus] = useState<string>("");
    const [tenant, setTenant] = useState<string>("");
    const [type, setType] = useState<string>("");
    const [page, setPage] = useState(0);
    const [selectedJob, setSelectedJob] = useState<any | null>(null);

    const limit = 50;
    const key = useMemo(
        () => `jobs:${status}:${tenant}:${type}:${page}`,
        [status, tenant, type, page]
    );

    const q = useAdminQuery(key, () =>
        getJobs({ status: status || undefined, tenant: tenant || undefined, type: type || undefined, limit, offset: page * limit }),
        refreshMs
    );

    const auditKey = useMemo(() => `audit-job:${selectedJob?.id}`, [selectedJob?.id]);
    const qAudit = useAdminQuery(auditKey, () =>
        selectedJob ? getAudit({ job_id: selectedJob.id, limit: 10 }) : Promise.resolve([] as AuditRow[])
    );

    return (
        <div className="space-y-6 relative animate-slide-fade">
            {/* Filters Header */}
            <div className="flex flex-col lg:flex-row gap-4 p-4 glass rounded-2xl border border-white">
                <div className="flex-1 relative group">
                    <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-primary transition-colors" />
                    <input
                        className="w-full bg-white/50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all"
                        placeholder={t("admin.jobs.filterTenant" as any)}
                        value={tenant}
                        onChange={(e) => { setTenant(e.target.value); setPage(0); }}
                    />
                </div>
                <div className="flex-1 relative group">
                    <TagIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-primary transition-colors" />
                    <input
                        className="w-full bg-white/50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all"
                        placeholder={t("admin.jobs.filterType" as any)}
                        value={type}
                        onChange={(e) => { setType(e.target.value); setPage(0); }}
                    />
                </div>
                <div className="lg:w-48 relative">
                    <AdjustmentsHorizontalIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    <select
                        className="w-full bg-white/50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none appearance-none cursor-pointer focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all"
                        value={status}
                        onChange={(e) => { setStatus(e.target.value); setPage(0); }}
                    >
                        <option value="">{t("admin.jobs.all" as any)}</option>
                        <option value="QUEUED">QUEUED</option>
                        <option value="RUNNING">RUNNING</option>
                        <option value="SUCCEEDED">SUCCEEDED</option>
                        <option value="FAILED">FAILED</option>
                        <option value="CANCELED">CANCELED</option>
                    </select>
                </div>
            </div>

            {q.status === "loading" && (
                <div className="py-20 flex justify-center">
                    <div className="w-10 h-10 border-4 border-slate-200 border-t-primary rounded-full animate-spin" />
                </div>
            )}

            {q.status === "error" && (
                <div className="p-8 text-center bg-red-50 rounded-2xl border border-red-100 text-red-700 font-bold">
                    {q.error}
                </div>
            )}

            {q.status === "success" && q.data && (
                <>
                    <div className="glass rounded-2xl border border-white overflow-hidden">
                        <table className="w-full text-sm text-left border-collapse">
                            <thead className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-white">
                                <tr>
                                    <th className="py-4 px-6">
                                        <div className="flex items-center gap-2">
                                            <QueueListIcon className="w-3.5 h-3.5" />
                                            <span>Transaction</span>
                                        </div>
                                    </th>
                                    <th className="py-4 px-6">
                                        <div className="flex items-center gap-2">
                                            <FingerPrintIcon className="w-3.5 h-3.5" />
                                            <span>Tenant</span>
                                        </div>
                                    </th>
                                    <th className="py-4 px-6">
                                        <div className="flex items-center gap-2">
                                            <WrenchScrewdriverIcon className="w-3.5 h-3.5" />
                                            <span>Process</span>
                                        </div>
                                    </th>
                                    <th className="py-4 px-6">
                                        <div className="flex items-center gap-2">
                                            <ShieldCheckIcon className="w-3.5 h-3.5" />
                                            <span>Status</span>
                                        </div>
                                    </th>
                                    <th className="py-4 px-6">
                                        <div className="flex items-center gap-2">
                                            <BoltIcon className="w-3.5 h-3.5" />
                                            <span>Pulse</span>
                                        </div>
                                    </th>
                                    <th className="py-4 px-6 text-right">Activity</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {q.data.jobs.map((j) => (
                                    <tr
                                        key={j.id}
                                        className="group hover:bg-slate-50/80 cursor-pointer transition-all duration-150"
                                        onClick={() => setSelectedJob(j)}
                                    >
                                        <td className="py-4 px-6">
                                            <div className="flex items-center gap-2">
                                                <div className="w-2 h-2 rounded-full bg-slate-200 group-hover:bg-primary transition-colors" />
                                                <span className="font-mono text-[10px] font-bold text-primary bg-primary/5 px-2 py-1 rounded">
                                                    {j.id.split('-')[0]}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="py-4 px-6 font-medium text-slate-700">{j.tenant_id}</td>
                                        <td className="py-4 px-6">
                                            <div className="flex flex-col">
                                                <span className="text-xs font-bold text-slate-900 capitalize">{j.type.replace('_', ' ')}</span>
                                                <span className="text-[10px] text-slate-500 font-medium">{j.step || "-"}</span>
                                            </div>
                                        </td>
                                        <td className="py-4 px-6">
                                            <span className={[
                                                "px-2 py-1 rounded-md text-[10px] font-black tracking-widest uppercase",
                                                j.status === "FAILED" ? "bg-red-100 text-red-700" :
                                                    j.status === "SUCCEEDED" ? "bg-emerald-100 text-emerald-700" :
                                                        j.status === "RUNNING" ? "bg-sky-100 text-sky-700 animate-pulse" :
                                                            "bg-slate-100 text-slate-600"
                                            ].join(" ")}>{j.status}</span>
                                        </td>
                                        <td className="py-4 px-6">
                                            <div className="w-24 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full transition-all duration-500 ${j.status === 'FAILED' ? 'bg-red-400' : 'bg-primary'}`}
                                                    style={{ width: `${Math.round((j.progress || 0) * 100)}%` }}
                                                />
                                            </div>
                                        </td>
                                        <td className="py-4 px-6 text-right">
                                            <div className="flex flex-col items-end">
                                                <span className="text-[10px] font-bold text-slate-900">{new Date(j.updated_at).toLocaleTimeString()}</span>
                                                <span className="text-[9px] text-slate-400 font-medium">{new Date(j.updated_at).toLocaleDateString()}</span>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {q.data.jobs.length === 0 && (
                            <div className="py-20 text-center">
                                <QueueListIcon className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                                <div className="text-slate-400 font-bold uppercase tracking-widest text-sm">{t("admin.jobs.empty" as any)}</div>
                            </div>
                        )}
                    </div>

                    <div className="flex items-center justify-between px-2">
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            Total Ledger: <span className="text-slate-900">{q.data.total}</span>
                        </div>
                        <div className="flex gap-2">
                            <button
                                className="p-2 glass rounded-xl border border-white hover:bg-white text-slate-600 disabled:opacity-30 transition-all hover:scale-105 active:scale-95"
                                disabled={page === 0}
                                onClick={() => setPage((p) => Math.max(p - 1, 0))}
                            >
                                <ChevronLeftIcon className="w-5 h-5" />
                            </button>
                            <button
                                className="p-2 glass rounded-xl border border-white hover:bg-white text-slate-600 disabled:opacity-30 transition-all hover:scale-105 active:scale-95"
                                disabled={(page + 1) * limit >= q.data.total}
                                onClick={() => setPage((p) => p + 1)}
                            >
                                <ChevronRightIcon className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    {/* Details Panel - Overlays slightly from the right */}
                    {selectedJob && (
                        <div className="fixed inset-y-0 right-0 w-full sm:w-[450px] bg-white/95 backdrop-blur-xl shadow-[-20px_0_50px_rgba(0,0,0,0.1)] border-l border-white/20 p-8 overflow-y-auto z-[100] animate-slide-fade">
                            <div className="flex justify-between items-center mb-10">
                                <div>
                                    <h2 className="text-xl font-black text-slate-900 tracking-tight">Transmission Details</h2>
                                    <p className="text-[10px] font-bold text-primary uppercase tracking-[0.2em] mt-1">Ref: {selectedJob.id}</p>
                                </div>
                                <button onClick={() => setSelectedJob(null)} className="p-2 rounded-xl bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-slate-900 transition-all">
                                    <XMarkIcon className="w-6 h-6" />
                                </button>
                            </div>

                            <div className="space-y-10">
                                <div className="grid grid-cols-2 gap-6">
                                    <div className="space-y-1">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Operational Space</span>
                                        <span className="text-sm font-bold text-slate-900 flex items-center gap-2">
                                            <InformationCircleIcon className="w-4 h-4 text-sky-500" />
                                            {selectedJob.tenant_id}
                                        </span>
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Sequence Type</span>
                                        <span className="text-sm font-black text-slate-900 capitalize">{selectedJob.type.replace('_', ' ')}</span>
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Vector Progress</span>
                                        <div className="flex items-center gap-3">
                                            <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                                                <div className="h-full bg-primary rounded-full" style={{ width: `${Math.round((selectedJob.progress || 0) * 100)}%` }} />
                                            </div>
                                            <span className="text-xs font-black text-slate-900">{Math.round((selectedJob.progress || 0) * 100)}%</span>
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Transmission State</span>
                                        <span className={[
                                            "px-2 py-0.5 rounded text-[10px] font-black tracking-widest",
                                            selectedJob.status === "FAILED" ? "bg-red-50 text-red-700" :
                                                selectedJob.status === "SUCCEEDED" ? "bg-emerald-50 text-emerald-700" :
                                                    selectedJob.status === "RUNNING" ? "bg-sky-50 text-sky-700" :
                                                        "bg-slate-50 text-slate-600"
                                        ].join(" ")}>{selectedJob.status}</span>
                                    </div>
                                </div>

                                {selectedJob.error && (
                                    <div className="p-5 bg-red-500/[0.03] border border-red-100 rounded-2xl">
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-2 text-red-600">
                                                <ExclamationCircleIcon className="w-5 h-5" />
                                                <span className="text-xs font-black uppercase tracking-widest">Stack Trace / Fault Report</span>
                                            </div>
                                            <a
                                                href={getErrorArticleLink(typeof selectedJob.error === 'string' ? selectedJob.error : (selectedJob.error?.code || 'unknown'))}
                                                className="text-[10px] font-bold bg-white text-red-600 px-2 py-1 rounded shadow-sm border border-red-100 hover:bg-red-50 transition-colors"
                                            >
                                                ℹ Explain this error
                                            </a>
                                        </div>
                                        <pre className="p-4 bg-white/80 border border-red-100 text-red-900 text-[11px] font-mono rounded-xl overflow-auto max-h-60 whitespace-pre-wrap leading-relaxed">
                                            {typeof selectedJob.error === 'string' ? selectedJob.error : JSON.stringify(selectedJob.error, null, 2)}
                                        </pre>
                                    </div>
                                )}

                                <div className="pt-10 border-t border-slate-100">
                                    <h3 className="text-xs font-black text-slate-900 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                                        <CheckBadgeIcon className="w-4 h-4 text-emerald-500" />
                                        Event Stream Timeline
                                    </h3>
                                    {qAudit.status === "loading" && <div className="py-4 text-center text-slate-400 text-xs font-bold animate-pulse">Synchronizing...</div>}
                                    {qAudit.status === "error" && <div className="text-red-500 text-xs font-bold">{qAudit.error}</div>}
                                    {qAudit.status === "success" && qAudit.data && qAudit.data.length === 0 && <div className="text-slate-400 text-xs italic">Chronicle is empty.</div>}
                                    {qAudit.status === "success" && qAudit.data && qAudit.data.length > 0 && (
                                        <div className="relative pl-6 space-y-8 before:absolute before:left-0 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-100">
                                            {qAudit.data.map(a => (
                                                <div key={a.id} className="relative">
                                                    <div className="absolute -left-[27px] top-1 w-3.5 h-3.5 rounded-full border-2 border-white bg-primary shadow-sm" />
                                                    <div className="font-black text-[11px] text-slate-900 uppercase tracking-widest">{a.action.replace('_', ' ')}</div>
                                                    <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400 font-bold">
                                                        <ClockIcon className="w-3 h-3" />
                                                        {new Date(a.created_at).toLocaleString()}
                                                    </div>
                                                    {a.policy_slug && (
                                                        <div className="mt-2 text-[9px] font-mono bg-slate-50 px-2 py-1 rounded text-slate-500 w-fit">
                                                            policy_ref: {a.policy_slug}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};
