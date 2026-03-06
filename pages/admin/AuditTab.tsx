// pages/admin/AuditTab.tsx
import React, { useMemo, useState, useDeferredValue } from "react";
import { getAudit } from "../../lib/adminApi";
import { useAdminQuery } from "../../hooks/useAdminData";
import { t } from "../../i18n";
import {
    ShieldCheckIcon,
    MagnifyingGlassIcon,
    ClockIcon,
    FingerPrintIcon,
    DocumentTextIcon,
    GlobeAltIcon,
    BoltIcon
} from "@heroicons/react/24/outline";

export const AuditTab: React.FC<{ refreshMs?: number }> = ({ refreshMs = 0 }) => {
    const [tenant, setTenant] = useState("");
    const deferredTenant = useDeferredValue(tenant);

    const q = useAdminQuery(`audit:${deferredTenant}`, () => getAudit({ tenant_id: deferredTenant || undefined, limit: 200 }), refreshMs);

    return (
        <div className="space-y-6 animate-slide-fade">
            <div className="flex flex-col lg:flex-row gap-4 p-4 glass rounded-2xl border border-white">
                <div className="flex-1 relative group">
                    <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-primary transition-colors" />
                    <input
                        className="w-full bg-white/50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all"
                        placeholder={t("admin.audit.filterTenant" as any)}
                        value={tenant}
                        onChange={(e) => setTenant(e.target.value)}
                    />
                </div>
                <div className="lg:w-auto px-4 py-2 flex items-center gap-2">
                    <ShieldCheckIcon className="w-4 h-4 text-emerald-500" />
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Immutable Ledger</span>
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
                <div className="glass rounded-2xl border border-white overflow-hidden shadow-sm">
                    <table className="w-full text-sm text-left border-collapse">
                        <thead className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-white">
                            <tr>
                                <th className="py-4 px-6 flex items-center gap-2">
                                    <ClockIcon className="w-3.5 h-3.5" />
                                    <span>Timestamp</span>
                                </th>
                                <th className="py-4 px-6">
                                    <div className="flex items-center gap-2">
                                        <FingerPrintIcon className="w-3.5 h-3.5" />
                                        <span>Source</span>
                                    </div>
                                </th>
                                <th className="py-4 px-6">
                                    <div className="flex items-center gap-2">
                                        <BoltIcon className="w-3.5 h-3.5" />
                                        <span>Operation</span>
                                    </div>
                                </th>
                                <th className="py-4 px-6">
                                    <div className="flex items-center gap-2">
                                        <ShieldCheckIcon className="w-3.5 h-3.5" />
                                        <span>Policy</span>
                                    </div>
                                </th>
                                <th className="py-4 px-6">
                                    <div className="flex items-center gap-2">
                                        <GlobeAltIcon className="w-3.5 h-3.5" />
                                        <span>Endpoint</span>
                                    </div>
                                </th>
                                <th className="py-4 px-6 text-right">Job Ref</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {q.data.map((r: any) => (
                                <tr key={r.id} className="group hover:bg-slate-50/80 transition-all duration-150">
                                    <td className="py-4 px-6">
                                        <div className="flex items-center gap-2 text-slate-500 text-xs">
                                            <ClockIcon className="w-3.5 h-3.5" />
                                            <span className="font-medium">{new Date(r.created_at).toLocaleString()}</span>
                                        </div>
                                    </td>
                                    <td className="py-4 px-6 font-bold text-slate-900 font-mono tracking-tight text-xs uppercase">{r.tenant_id}</td>
                                    <td className="py-4 px-6 relative group/action">
                                        <div className="flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 rounded-full bg-primary/40" />
                                            <span className="font-bold text-slate-700">{r.action.replace('_', ' ')}</span>
                                            <a
                                                href={`/admin/help?q=${r.action.toLowerCase()}`}
                                                className="opacity-0 group-hover/action:opacity-100 transition-opacity ml-2 text-[10px] font-bold bg-white text-blue-600 px-2 py-1 rounded shadow-sm border border-blue-100 hover:bg-blue-50"
                                            >
                                                ℹ What is this?
                                            </a>
                                        </div>
                                    </td>
                                    <td className="py-4 px-6">
                                        {r.policy_slug ? (
                                            <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-bold font-mono">
                                                {r.policy_slug}
                                            </span>
                                        ) : <span className="text-slate-300">-</span>}
                                    </td>
                                    <td className="py-4 px-6 text-slate-500 text-xs flex items-center gap-2">
                                        <GlobeAltIcon className="w-3.5 h-3.5" />
                                        {r.ip_address}
                                    </td>
                                    <td className="py-4 px-6 text-right">
                                        {r.job_id ? (
                                            <span className="font-mono text-[10px] text-primary font-bold bg-primary/5 px-2 py-1 rounded">
                                                {r.job_id.split('-')[0]}
                                            </span>
                                        ) : <span className="text-slate-300">-</span>}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {q.data.length === 0 && (
                        <div className="py-20 text-center">
                            <DocumentTextIcon className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                            <div className="text-slate-400 font-bold uppercase tracking-widest text-xs">{t("admin.audit.empty" as any)}</div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
