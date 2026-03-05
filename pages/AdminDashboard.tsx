// pages/AdminDashboard.tsx
import React, { useMemo, useState } from "react";
import { t } from "../i18n";
import { OverviewTab } from "./admin/OverviewTab";
import { TenantsTab } from "./admin/TenantsTab";
import { JobsTab } from "./admin/JobsTab";
import { ErrorsTab } from "./admin/ErrorsTab";
import { AuditTab } from "./admin/AuditTab";
import { ControlsTab } from "./admin/ControlsTab";
import {
    ChartBarIcon,
    UsersIcon,
    QueueListIcon,
    ExclamationTriangleIcon,
    ShieldCheckIcon,
    WrenchScrewdriverIcon,
    ArrowPathIcon,
    ClockIcon
} from "@heroicons/react/24/outline";

type Tab = "overview" | "tenants" | "jobs" | "errors" | "audit" | "controls";
type Range = "24h" | "7d" | "30d";

export const AdminDashboard: React.FC = () => {
    const [activeTab, setActiveTab] = useState<Tab>("overview");
    const [range, setRange] = useState<Range>("24h");
    const [refresh, setRefresh] = useState<number>(0);

    const tabs = useMemo(
        () =>
        ([
            ["overview", t("admin.tabs.overview" as any), ChartBarIcon],
            ["tenants", t("admin.tabs.tenants" as any), UsersIcon],
            ["jobs", t("admin.tabs.jobs" as any), QueueListIcon],
            ["errors", t("admin.tabs.errors" as any), ExclamationTriangleIcon],
            ["audit", t("admin.tabs.audit" as any), ShieldCheckIcon],
            ["controls", t("admin.tabs.controls" as any), WrenchScrewdriverIcon],
        ] as Array<[Tab, string, any]>),
        []
    );

    return (
        <div className="min-h-screen bg-slate-50 premium-gradient">
            <header className="sticky top-0 z-50 glass px-6 py-4 mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-white/20">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/20">
                        <ShieldCheckIcon className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-slate-900 tracking-tight leading-none">
                            {t("admin.title" as any)}
                        </h1>
                        <p className="text-xs text-slate-500 mt-1 font-medium uppercase tracking-wider">
                            {t("admin.subtitle" as any)}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 bg-white/50 p-1.5 rounded-lg border border-white">
                        <ClockIcon className="w-4 h-4 text-slate-400 ml-1" />
                        <select
                            className="bg-transparent text-sm font-medium text-slate-700 outline-none pr-4"
                            value={range}
                            onChange={(e) => setRange(e.target.value as Range)}
                        >
                            <option value="24h">{t("admin.range.24h" as any)}</option>
                            <option value="7d">{t("admin.range.7d" as any)}</option>
                            <option value="30d">{t("admin.range.30d" as any)}</option>
                        </select>
                    </div>

                    <div className="flex items-center gap-2 bg-white/50 p-1.5 rounded-lg border border-white">
                        <ArrowPathIcon className={`w-4 h-4 text-slate-400 ml-1 ${refresh > 0 ? "animate-spin" : ""}`} />
                        <select
                            className="bg-transparent text-sm font-medium text-slate-700 outline-none pr-4"
                            value={refresh}
                            onChange={(e) => setRefresh(Number(e.target.value))}
                        >
                            <option value={0}>{t("admin.refresh.off" as any)}</option>
                            <option value={10000}>10s</option>
                            <option value={30000}>30s</option>
                        </select>
                    </div>
                </div>
            </header>

            <div className="max-w-7xl mx-auto px-6 pb-12">
                <div className="overflow-x-auto pb-4 -mb-4 scrollbar-hide">
                    <nav className="flex gap-1 bg-slate-200/40 p-1 rounded-xl mb-8 w-fit border border-slate-200/60 transition-all duration-300 whitespace-nowrap">
                        {tabs.map(([id, label, Icon]) => (
                            <button
                                key={id}
                                className={[
                                    "flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-200",
                                    activeTab === id
                                        ? "bg-white text-slate-900 shadow-sm border border-slate-200/50"
                                        : "text-slate-500 hover:text-slate-800 hover:bg-white/30",
                                ].join(" ")}
                                onClick={() => setActiveTab(id)}
                            >
                                <Icon className={`w-4 h-4 ${activeTab === id ? "text-primary" : "text-slate-400"}`} />
                                {label}
                            </button>
                        ))}
                    </nav>
                </div>

                <main className="bg-white/80 backdrop-blur-md rounded-2xl shadow-xl shadow-slate-200/50 border border-white p-6 relative overflow-hidden animate-slide-fade">
                    {/* Background glass decoration */}
                    <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
                    <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-slate-200 rounded-full blur-3xl pointer-events-none" />

                    <div className="relative z-10">
                        {activeTab === "overview" && <OverviewTab range={range} refreshMs={refresh} />}
                        {activeTab === "tenants" && <TenantsTab range={range} refreshMs={refresh} />}
                        {activeTab === "jobs" && <JobsTab refreshMs={refresh} />}
                        {activeTab === "errors" && <ErrorsTab range={range} refreshMs={refresh} />}
                        {activeTab === "audit" && <AuditTab refreshMs={refresh} />}
                        {activeTab === "controls" && <ControlsTab refreshMs={refresh} />}
                    </div>
                </main>
            </div>
        </div>
    );
};
