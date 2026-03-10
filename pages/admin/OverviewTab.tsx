// pages/admin/OverviewTab.tsx
import React from "react";
import { getOverview, getQueue } from "../../lib/adminApi";
import { useAdminQuery } from "../../hooks/useAdminData";
import { t } from "../../i18n";
import {
    Square3Stack3DIcon,
    CheckBadgeIcon,
    BoltIcon,
    ArrowTrendingUpIcon,
    BanknotesIcon,
    ScaleIcon,
    QueueListIcon,
    ClockIcon,
    CircleStackIcon
} from "@heroicons/react/24/outline";

type Range = "24h" | "7d" | "30d";

const COLOR_MAP: Record<string, { bg: string; text: string }> = {
    blue: { bg: "bg-blue-600/10", text: "text-blue-600" },
    emerald: { bg: "bg-emerald-600/10", text: "text-emerald-600" },
    amber: { bg: "bg-amber-600/10", text: "text-amber-600" },
    indigo: { bg: "bg-indigo-600/10", text: "text-indigo-600" },
    violet: { bg: "bg-violet-600/10", text: "text-violet-600" },
    pink: { bg: "bg-pink-600/10", text: "text-pink-600" },
    orange: { bg: "bg-orange-600/10", text: "text-orange-600" },
    cyan: { bg: "bg-cyan-600/10", text: "text-cyan-600" },
};

const KpiCard = ({ title, value, sub, Icon, color, helpKey }: { title: string; value: string; sub?: string; Icon: any; color: keyof typeof COLOR_MAP; helpKey?: string }) => {
    const theme = COLOR_MAP[color];
    return (
        <div className="glass rounded-xl p-3.5 border border-white hover-slide flex items-start justify-between gap-2 group relative">
            <div className="flex items-center gap-4">
                <div className={`p-2.5 rounded-lg ${theme.bg} shrink-0`}>
                    <Icon className={`w-5 h-5 ${theme.text}`} />
                </div>
                <div className="min-w-0">
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5 truncate flex items-center gap-1">
                        {title}
                    </div>
                    <div className="flex items-baseline gap-2">
                        <div className="text-xl font-black text-slate-900 tracking-tight">{value}</div>
                        {sub && <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest truncate">{sub}</span>}
                    </div>
                </div>
            </div>
            {helpKey && (
                <a
                    href={`/admin/help?doc=${helpKey}`}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] flex items-center gap-1 bg-white border border-slate-200 text-slate-500 hover:text-blue-600 hover:border-blue-200 px-2 py-1 rounded-md shadow-sm"
                >
                    <div title="Explain this metric">ℹ Explain</div>
                </a>
            )}
        </div>
    );
};

export const OverviewTab: React.FC<{ range: Range; refreshMs?: number }> = ({ range, refreshMs = 0 }) => {
    const o = useAdminQuery(`overview:${range}`, () => getOverview(range), refreshMs);
    const q = useAdminQuery(`queue`, () => getQueue(), refreshMs);

    if (o.status === "loading") return (
        <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                <span className="text-sm font-bold text-slate-400 uppercase tracking-widest">{t("common.loading" as any)}</span>
            </div>
        </div>
    );

    if (o.status === "error") return (
        <div className="p-8 rounded-2xl bg-red-50 border border-red-100 text-center">
            <ExclamationTriangleIcon className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <div className="text-red-700 font-bold mb-1">Telemetry Error</div>
            <div className="text-red-500 text-sm">{o.error}</div>
        </div>
    );

    if (!o.data) return null;

    const d = o.data;

    return (
        <div className="space-y-6 animate-slide-fade">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8 gap-4">
                <KpiCard Icon={Square3Stack3DIcon} color="blue" title="Ledger Total (DB)" value={String(d.totalJobs)} helpKey="metric-total-jobs" />
                <KpiCard Icon={CheckBadgeIcon} color="emerald" title="SLA Success Rate" value={`${d.successRate.toFixed(1)}%`} helpKey="metric-success-rate" />
                <KpiCard Icon={BanknotesIcon} color="emerald" title="AutoFix Value" value={`$${Math.round(d.totalValueGenerated).toLocaleString()}`} sub="USD Generated" />
                <KpiCard Icon={ClockIcon} color="blue" title="Prepress Saved" value={`${d.totalHoursSaved.toFixed(1)} h`} sub="Time ROI" />
                <KpiCard Icon={ArrowTrendingUpIcon} color="indigo" title="Optimization Delta" value={`${d.deltaImprovementRate.toFixed(1)}%`} />
                <KpiCard Icon={ScaleIcon} color="violet" title="Risk Reduction" value={`${(d.avgRiskBefore - d.avgRiskAfter).toFixed(1)} pts`} sub={`${d.avgRiskBefore.toFixed(0)} → ${d.avgRiskAfter.toFixed(0)}`} />
                <KpiCard Icon={BoltIcon} color="amber" title="Mean Latency" value={`${d.avgLatencyMs} ms`} />
                <KpiCard Icon={QueueListIcon} color="orange" title="Live Buffer (Queue)" value={String(d.queueBacklog || 0)} helpKey="metric-queue-backlog" />
            </div>

            <div className="glass rounded-2xl border border-white overflow-hidden shadow-sm hover-slide">
                <div className="px-6 py-4 bg-slate-50/50 border-b border-white flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <CircleStackIcon className="w-5 h-5 text-slate-400" />
                        <div className="font-bold text-slate-800 text-sm tracking-tight">{t("admin.queue.title" as any)}</div>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Live Buffer Trace</span>
                    </div>
                </div>
                <div className="p-0">
                    {q.status === "loading" && <div className="p-10 text-center text-slate-400 text-xs font-bold uppercase tracking-widest">Attaching to stream...</div>}
                    {q.status === "error" && <div className="p-10 text-center text-red-500 text-sm font-bold">{q.error}</div>}
                    {q.status === "success" && (
                        <pre className="text-[11px] font-mono leading-relaxed bg-slate-900 text-emerald-400 p-6 overflow-auto max-h-[300px] scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                            {JSON.stringify(q.data, null, 2)}
                        </pre>
                    )}
                </div>
            </div>
        </div>
    );
};

// Placeholder for ExclamationTriangleIcon if not imported from heroicons
const ExclamationTriangleIcon = (props: any) => (
    <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
    </svg>
);
