// pages/admin/TenantsTab.tsx
import React from "react";
import { getTenants } from "../../lib/adminApi";
import { useAdminQuery } from "../../hooks/useAdminData";
import { t } from "../../i18n";
import {
    UsersIcon,
    ClockIcon,
    ChatBubbleBottomCenterTextIcon,
    CircleStackIcon,
    GlobeAltIcon,
    BoltIcon,
    CheckBadgeIcon,
    BanknotesIcon
} from "@heroicons/react/24/outline";

type Range = "24h" | "7d" | "30d";

export const TenantsTab: React.FC<{ range: Range; refreshMs?: number }> = ({ range, refreshMs = 0 }) => {
    const q = useAdminQuery(`tenants:${range}`, () => getTenants(range), refreshMs);

    if (q.status === "loading") return (
        <div className="flex items-center justify-center py-20">
            <div className="w-10 h-10 border-4 border-slate-200 border-t-primary rounded-full animate-spin" />
        </div>
    );

    if (q.status === "error") return (
        <div className="p-8 text-center bg-red-50 rounded-2xl border border-red-100">
            <div className="text-red-700 font-bold">{q.error}</div>
        </div>
    );

    if (!q.data) return null;

    return (
        <div className="animate-slide-fade overflow-hidden">
            <div className="flex items-center gap-3 mb-6 px-2">
                <UsersIcon className="w-5 h-5 text-slate-400" />
                <h2 className="text-lg font-bold text-slate-800 tracking-tight">Active Ingestion Sources</h2>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-100">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] border-b border-slate-100">
                        <tr>
                            <th className="py-4 px-6 flex items-center gap-2">
                                <GlobeAltIcon className="w-3.5 h-3.5" />
                                {t("admin.tenants.tenant" as any)}
                            </th>
                            <th className="py-4 px-6">
                                <div className="flex items-center gap-2">
                                    <CircleStackIcon className="w-3.5 h-3.5" />
                                    {t("admin.tenants.total" as any)}
                                </div>
                            </th>
                            <th className="py-4 px-6">
                                <div className="flex items-center gap-2">
                                    <CheckBadgeIcon className="w-3.5 h-3.5" />
                                    {t("admin.tenants.success" as any)}
                                </div>
                            </th>
                            <th className="py-4 px-6">
                                <div className="flex items-center gap-2">
                                    <BoltIcon className="w-3.5 h-3.5" />
                                    {t("admin.tenants.latency" as any)}
                                </div>
                            </th>
                            <th className="py-4 px-6 text-right">
                                <div className="flex items-center justify-end gap-2 text-emerald-600">
                                    <BanknotesIcon className="w-3.5 h-3.5" />
                                    Value ($)
                                </div>
                            </th>
                            <th className="py-4 px-6 text-right">
                                <div className="flex items-center justify-end gap-2 text-blue-600">
                                    <ClockIcon className="w-3.5 h-3.5" />
                                    Saved (h)
                                </div>
                            </th>
                            <th className="py-4 px-6 text-right">
                                <div className="flex items-center justify-end gap-2">
                                    <BoltIcon className="w-3.5 h-3.5" />
                                    {t("admin.tenants.last" as any)}
                                </div>
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {q.data.map((r) => (
                            <tr key={r.tenant_id} className="group hover:bg-slate-50 transition-all duration-200">
                                <td className="py-4 px-6">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center group-hover:bg-white transition-colors">
                                            <GlobeAltIcon className="w-4 h-4 text-slate-400" />
                                        </div>
                                        <span className="font-bold text-slate-900 font-mono tracking-tight">{r.tenant_id}</span>
                                    </div>
                                </td>
                                <td className="py-4 px-6">
                                    <div className="flex items-center gap-2">
                                        <CircleStackIcon className="w-4 h-4 text-slate-300" />
                                        <span className="font-semibold text-slate-700">{r.totalJobs}</span>
                                    </div>
                                </td>
                                <td className="py-4 px-6">
                                    <div className="flex items-center gap-2">
                                        <div className="w-12 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                            <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min(100, r.successRate)}%` }} />
                                        </div>
                                        <span className="font-bold text-slate-600 text-xs">{r.successRate.toFixed(1)}%</span>
                                    </div>
                                </td>
                                <td className="py-4 px-6">
                                    <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded-md font-bold text-xs">
                                        {r.avgLatencyMs} ms
                                    </span>
                                </td>
                                <td className="py-4 px-6 text-right">
                                    <span className="font-bold text-emerald-600">
                                        ${Math.round(r.totalValueGenerated).toLocaleString()}
                                    </span>
                                </td>
                                <td className="py-4 px-6 text-right">
                                    <span className="font-bold text-blue-600">
                                        {r.totalHoursSaved.toFixed(1)}h
                                    </span>
                                </td>
                                <td className="py-4 px-4 text-right">
                                    <div className="flex items-center justify-end gap-2 text-slate-500 text-xs">
                                        <ClockIcon className="w-3.5 h-3.5" />
                                        <span className="font-medium">{new Date(r.lastActivity).toLocaleTimeString()}</span>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {q.data.length === 0 && (
                <div className="py-20 text-center">
                    <div className="text-slate-400 font-medium">No activity detected in this range</div>
                </div>
            )}
        </div>
    );
};
