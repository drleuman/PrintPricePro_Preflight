// pages/AdminDashboard.tsx
import React, { useMemo, useState } from "react";
import { t, LocaleProvider, useLocale } from "../i18n";
import { getAdminKey, setAdminKey, clearAdminKey } from "../lib/adminApi";
import { OverviewTab } from "./admin/OverviewTab";
import { PricingIntelligenceTab } from "./admin/PricingIntelligenceTab";
import { OffersTab } from "./admin/OffersTab";
import { MarketplaceTab } from "./admin/MarketplaceTab";
import { MarketplaceReadinessTab } from "./admin/MarketplaceReadinessTab";
import { CommercialCommitmentsTab } from "./admin/CommercialCommitmentsTab";
import { AutonomousOpsTab } from "./admin/AutonomousOpsTab";
import { FinancialOpsTab } from "./admin/FinancialOpsTab";
import TenantManagement from "./admin/TenantManagement";
import { SuccessWorkspace } from "./admin/SuccessWorkspace";
import { JobsTab } from "./admin/JobsTab";
import { ErrorsTab } from "./admin/ErrorsTab";
import { AuditTab } from "./admin/AuditTab";
import { ControlsTab } from "./admin/ControlsTab";
import { NotificationsTab } from "./admin/NotificationsTab";
import { EngagementSignalsTab } from "./admin/EngagementSignalsTab";
import { NetworkOpsTab } from "./admin/NetworkOpsTab";
import {
    ChartBarIcon,
    UsersIcon,
    QueueListIcon,
    ExclamationTriangleIcon,
    ShieldCheckIcon,
    WrenchScrewdriverIcon,
    ArrowPathIcon,
    ClockIcon,
    XMarkIcon,
    BookOpenIcon,
    HeartIcon,
    BanknotesIcon,
    BellIcon,
    BoltIcon,
    BuildingOfficeIcon,
    BuildingStorefrontIcon,
    CurrencyEuroIcon,
    DocumentCheckIcon,
    CpuChipIcon,
    ArrowsRightLeftIcon,
    AdjustmentsHorizontalIcon
} from "@heroicons/react/24/outline";

type Tab = "overview" | "success" | "tenants" | "network" | "pricing" | "offers" | "marketplace" | "negotiations" | "commitments" | "autonomy" | "finance" | "notifications" | "jobs" | "errors" | "audit" | "controls" | "engagement";
type Range = "24h" | "7d" | "30d";

const AdminDashboardInner: React.FC = () => {
    const { currentLocale } = useLocale();
    const [activeTab, setActiveTab] = useState<Tab>("overview");
    const [range, setRange] = useState<Range>("24h");
    const [refresh, setRefresh] = useState<number>(0);
    const [reloadKey, setReloadKey] = useState<number>(0);
    const [isAuthorized, setIsAuthorized] = useState<boolean>(!!getAdminKey());
    const [authKey, setAuthKey] = useState<string>("");

    const handleConnect = () => {
        if (!authKey.trim()) return;
        setAdminKey(authKey.trim());
        setIsAuthorized(true);
        setReloadKey(r => r + 1); // trigger reload of all data
    };

    const handleDisconnect = () => {
        clearAdminKey();
        setIsAuthorized(false);
        setAuthKey("");
    };

    const tabs = useMemo(
        () =>
        ([
            ["overview", t("admin.tabs.overview" as any), ChartBarIcon],
            ["success", "Success Workspace", HeartIcon],
            ["tenants", "Tenants & Subscriptions", UsersIcon],
            ["network", "Network Operations", BuildingOfficeIcon],
            ["pricing", "Pricing Intelligence", CurrencyEuroIcon],
            ["offers", "Production Offers", QueueListIcon],
            ["marketplace", "Marketplace", BuildingStorefrontIcon],
            ["negotiations", "Negotiation & Readiness", ArrowsRightLeftIcon],
            ["commitments", "Commercial Commitments", DocumentCheckIcon],
            ["autonomy", "Autonomous Operations", CpuChipIcon],
            ["finance", "Financial Operations", BanknotesIcon],
            ["notifications", "Notifications", BellIcon],
            ["jobs", t("admin.tabs.jobs" as any), QueueListIcon],
            ["errors", t("admin.tabs.errors" as any), ExclamationTriangleIcon],
            ["audit", t("admin.tabs.audit" as any), ShieldCheckIcon],
            ["controls", t("admin.tabs.controls" as any), WrenchScrewdriverIcon],
            ["engagement", "Engagement", BoltIcon],
        ] as Array<[Tab, string, any]>),
        [currentLocale]
    );

    if (!isAuthorized) {
        return (
            <div className="min-h-screen premium-gradient flex items-center justify-center p-6">
                <div className="max-w-3xl w-full glass rounded-3xl p-10 border border-white shadow-2xl animate-slide-fade">
                    <div className="flex flex-col items-center text-center gap-6">
                        <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center shadow-xl shadow-primary/20">
                            <ShieldCheckIcon className="w-8 h-8 text-white" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-slate-900 tracking-tight">Admin Gate</h2>
                            <p className="text-sm text-slate-500 font-medium mt-2">Enter your secure API key to access control systems.</p>
                        </div>
                        <div className="w-full space-y-4">
                            <input
                                type="password"
                                className="w-full bg-white/50 border border-slate-200 rounded-xl px-5 py-3.5 text-center text-lg font-mono tracking-widest outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all"
                                placeholder="••••••••••••"
                                value={authKey}
                                onChange={(e) => setAuthKey(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleConnect()}
                            />
                            <button
                                onClick={handleConnect}
                                className="w-full bg-slate-900 text-white rounded-xl py-4 font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg active:scale-95"
                            >
                                Establish Connection
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

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

                    <a
                        href="/admin/help"
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors border border-blue-100 font-medium text-sm ml-2"
                        title="Operations Knowledge Console"
                    >
                        <BookOpenIcon className="w-5 h-5" />
                        <span className="hidden sm:inline">Help Console</span>
                    </a>

                    <button
                        onClick={handleDisconnect}
                        className="p-2.5 rounded-xl bg-red-50 text-red-500 hover:bg-red-100 transition-colors border border-red-100 ml-2"
                        title="Disconnect"
                    >
                        <XMarkIcon className="w-5 h-5" />
                    </button>
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
                        {activeTab === "overview" && <OverviewTab key={`overview-${reloadKey}`} range={range} refreshMs={refresh} />}
                        {activeTab === "success" && <SuccessWorkspace key={`success-${reloadKey}`} />}
                        {activeTab === "tenants" && <TenantManagement key={`tenants-${reloadKey}`} />}
                        {activeTab === "network" && <NetworkOpsTab key={`network-${reloadKey}`} />}
                        {activeTab === "pricing" && <PricingIntelligenceTab key={`pricing-${reloadKey}`} />}
                        {activeTab === "offers" && <OffersTab key={`offers-${reloadKey}`} />}
                        {activeTab === "marketplace" && <MarketplaceTab key={`marketplace-${reloadKey}`} />}
                        {activeTab === "negotiations" && <MarketplaceReadinessTab key={`negotiations-${reloadKey}`} />}
                        {activeTab === "commitments" && <CommercialCommitmentsTab key={`commitments-${reloadKey}`} />}
                        {activeTab === "autonomy" && <AutonomousOpsTab key={`autonomy-${reloadKey}`} />}
                        {activeTab === "finance" && <FinancialOpsTab key={`finance-${reloadKey}`} />}
                        {activeTab === "notifications" && <NotificationsTab key={`notifications-${reloadKey}`} refreshMs={refresh} />}
                        {activeTab === "jobs" && <JobsTab key={`jobs-${reloadKey}`} refreshMs={refresh} />}
                        {activeTab === "errors" && <ErrorsTab key={`errors-${reloadKey}`} range={range} refreshMs={refresh} />}
                        {activeTab === "audit" && <AuditTab key={`audit-${reloadKey}`} refreshMs={refresh} />}
                        {activeTab === "controls" && <ControlsTab key={`controls-${reloadKey}`} refreshMs={refresh} />}
                        {activeTab === "engagement" && <EngagementSignalsTab key={`engagement-${reloadKey}`} />}
                    </div>
                </main>
            </div>
        </div>
    );
};

export const AdminDashboard: React.FC = () => {
    return (
        <LocaleProvider>
            <AdminDashboardInner />
        </LocaleProvider>
    );
};
