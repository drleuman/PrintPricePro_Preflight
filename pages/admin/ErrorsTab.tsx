// pages/admin/ErrorsTab.tsx
import React from "react";
import { getTopErrors } from "../../lib/adminApi";
import { useAdminQuery } from "../../hooks/useAdminData";
import { t, useLocale } from "../../i18n";
import {
    BugAntIcon,
    ExclamationTriangleIcon,
    ClockIcon,
    ExclamationCircleIcon
} from "@heroicons/react/24/outline";
import { getErrorArticleLink } from "../../lib/helpSearch";

type Range = "24h" | "7d" | "30d";

export const ErrorsTab: React.FC<{ range: Range; refreshMs?: number }> = ({ range, refreshMs = 0 }) => {
    useLocale(); // Enforce context
    const q = useAdminQuery(`errors:${range}`, () => getTopErrors(range), refreshMs);

    if (q.status === "loading") return (
        <div className="flex items-center justify-center py-20">
            <div className="w-10 h-10 border-4 border-slate-200 border-t-red-500 rounded-full animate-spin" />
        </div>
    );

    if (q.status === "error") return (
        <div className="p-8 text-center bg-red-50 rounded-2xl border border-red-100 text-red-700 font-bold">
            {q.error}
        </div>
    );

    if (!q.data) return null;

    return (
        <div className="animate-slide-fade overflow-hidden">
            <div className="flex items-center gap-3 mb-6 px-2">
                <BugAntIcon className="w-5 h-5 text-red-400" />
                <h2 className="text-lg font-bold text-slate-800 tracking-tight">System Fault Log</h2>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-100">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                        <tr>
                            <th className="py-4 px-6">{t("admin.errors.code" as any)}</th>
                            <th className="py-4 px-6">{t("admin.errors.count" as any)}</th>
                            <th className="py-4 px-6 text-right">{t("admin.errors.lastSeen" as any)}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {q.data.map((r) => (
                            <tr key={r.errorCode} className="group hover:bg-red-50/30 transition-all duration-200">
                                <td className="py-4 px-6">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center group-hover:bg-white transition-colors">
                                            <ExclamationTriangleIcon className="w-4 h-4 text-red-400" />
                                        </div>
                                        <span className="font-bold text-red-900 font-mono tracking-tighter text-xs bg-red-50/50 px-2 py-1 rounded">
                                            {r.errorCode}
                                        </span>
                                        <a
                                            href={getErrorArticleLink(r.errorCode)}
                                            className="opacity-0 group-hover:opacity-100 transition-opacity ml-2 text-[10px] font-bold bg-white text-red-600 px-2 py-1 rounded shadow-sm border border-red-100 hover:bg-red-50"
                                        >
                                            ℹ Explain
                                        </a>
                                    </div>
                                </td>
                                <td className="py-4 px-6">
                                    <div className="flex items-center gap-2">
                                        <span className="font-black text-slate-700">{r.count}</span>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Occurrences</span>
                                    </div>
                                </td>
                                <td className="py-4 px-6 text-right">
                                    <div className="flex items-center justify-end gap-2 text-slate-500 text-xs">
                                        <ClockIcon className="w-3.5 h-3.5" />
                                        <span className="font-medium">{new Date(r.lastSeen).toLocaleString()}</span>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {q.data.length === 0 && (
                <div className="py-20 text-center glass rounded-2xl border border-white">
                    <div className="flex flex-col items-center gap-3">
                        <div className="p-3 rounded-full bg-emerald-50 text-emerald-500">
                            <ExclamationCircleIcon className="w-6 h-6" />
                        </div>
                        <div className="text-slate-400 font-bold uppercase tracking-widest text-xs">No errors detected in this interval</div>
                    </div>
                </div>
            )}
        </div>
    );
};
