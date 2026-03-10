import React, { useState, useEffect } from "react";
import * as adminApi from "../../lib/adminApi";
import {
    SignalIcon,
    ArrowPathIcon,
    BuildingOfficeIcon,
    MapPinIcon,
    CpuChipIcon,
    ChevronRightIcon,
    AdjustmentsHorizontalIcon,
    MagnifyingGlassIcon
} from "@heroicons/react/24/outline";
import { NetworkOverviewCards } from "../../components/network/NetworkOverviewCards";
import { NetworkCapacityTable } from "../../components/network/NetworkCapacityTable";
import { NetworkHealthPanel } from "../../components/network/NetworkHealthPanel";
import { RoutingIntelligencePanel } from "../../components/network/RoutingIntelligencePanel";
import { RoutingInsightsPanel } from "../../components/network/RoutingInsightsPanel";
import { SyncHealthPanel } from "../../components/network/SyncHealthPanel";
import { PrinterNodeDrawer } from "../../components/network/PrinterNodeDrawer";

export const NetworkOpsTab: React.FC = () => {
    const [printers, setPrinters] = useState<any[]>([]);
    const [overview, setOverview] = useState<any>(null);
    const [capacity, setCapacity] = useState<any[]>([]);
    const [health, setHealth] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedPrinterId, setSelectedPrinterId] = useState<string | null>(null);
    const [routingStats, setRoutingStats] = useState<any>(null);

    // Filters
    const [filters, setFilters] = useState({
        country: "",
        status: "",
        connect_status: "",
        routing_eligible: ""
    });

    const fetchData = async () => {
        setLoading(true);
        const queryParams = new URLSearchParams(filters).toString();

        try {
            const [pData, oData, cData, hData, rData] = await Promise.all([
                adminApi.getPrinters(queryParams),
                adminApi.getNetworkOverview(),
                adminApi.getCapacity(),
                adminApi.getHealth(),
                adminApi.getRoutingOverview()
            ]);

            setPrinters(Array.isArray(pData) ? pData : []);
            setOverview(oData && !oData.error ? oData : null);
            setCapacity(Array.isArray(cData) ? cData : []);
            setHealth(Array.isArray(hData) ? hData : []);
            setRoutingStats(rData && !rData.error ? rData : null);
        } catch (err) {
            console.error('Failed to fetch network ops data', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [filters]);

    const handleAction = async (id: string, action: 'approve' | 'suspend') => {
        try {
            await fetch(`/api/admin/network/printers/${id}/${action}`, {
                method: 'POST',
                headers: { 'X-Admin-Api-Key': localStorage.getItem('ppp_admin_api_key') || '' }
            });
            fetchData();
        } catch (err) {
            alert('Action failed');
        }
    };

    const getStatusBadge = (status: string) => {
        const colors: any = {
            'ACTIVE': 'bg-emerald-50 text-emerald-700 border-emerald-100',
            'PENDING_REVIEW': 'bg-amber-50 text-amber-700 border-amber-100',
            'SUSPENDED': 'bg-rose-50 text-rose-700 border-rose-100',
            'OFFLINE': 'bg-slate-50 text-slate-500 border-slate-100'
        };
        return (
            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border ${colors[status] || colors.OFFLINE}`}>
                {status}
            </span>
        );
    };

    const getSyncBadge = (status: string) => {
        const colors: any = {
            'HEALTHY': 'bg-emerald-50 text-emerald-600 border-emerald-100',
            'STALE': 'bg-amber-50 text-amber-600 border-amber-100',
            'OFFLINE': 'bg-rose-50 text-rose-600 border-rose-100'
        };
        return (
            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border ${colors[status] || colors.OFFLINE}`}>
                {status}
            </span>
        );
    };

    return (
        <div className="space-y-8 animate-slide-fade">
            {/* Header / Sync */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                        <SignalIcon className="w-6 h-6 text-primary" />
                        Network Control Tower
                    </h2>
                    <p className="text-slate-500 font-medium text-xs">Internal operations monitoring for the PrintPrice Global Network.</p>
                </div>
                <button
                    onClick={fetchData}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-black text-slate-700 hover:bg-slate-50 transition-all shadow-sm active:scale-95"
                >
                    <ArrowPathIcon className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    Sync Reality
                </button>
            </div>

            {/* Dash Core */}
            <div className="space-y-8">
                <NetworkOverviewCards stats={overview} />

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 space-y-6">
                        <NetworkCapacityTable data={capacity} />

                        {/* Printers Table Section */}
                        <div className="space-y-4">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <h3 className="font-black text-slate-900 uppercase tracking-wider text-[10px] flex items-center gap-2 px-1">
                                    <BuildingOfficeIcon className="w-4 h-4 text-slate-400" />
                                    Printer Nodes Inventory
                                </h3>

                                {/* Quick Filters */}
                                <div className="flex flex-wrap items-center gap-2">
                                    <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
                                        <AdjustmentsHorizontalIcon className="w-3.5 h-3.5 text-slate-400" />
                                        <select
                                            className="bg-transparent text-[10px] font-bold text-slate-600 outline-none"
                                            value={filters.status}
                                            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                                        >
                                            <option value="">All Status</option>
                                            <option value="ACTIVE">Active</option>
                                            <option value="PENDING_REVIEW">Pending</option>
                                            <option value="SUSPENDED">Suspended</option>
                                        </select>
                                    </div>
                                    <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
                                        <select
                                            className="bg-transparent text-[10px] font-bold text-slate-600 outline-none"
                                            value={filters.routing_eligible}
                                            onChange={(e) => setFilters({ ...filters, routing_eligible: e.target.value })}
                                        >
                                            <option value="">All Routing</option>
                                            <option value="true">Eligible</option>
                                            <option value="false">Non-Eligible</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden min-h-[400px]">
                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="bg-slate-50/50 border-b border-slate-200">
                                            <th className="px-6 py-3 font-bold text-slate-500 text-[9px] uppercase tracking-widest">Printer</th>
                                            <th className="px-6 py-3 font-bold text-slate-500 text-[9px] uppercase tracking-widest text-center">Status</th>
                                            <th className="px-6 py-3 font-bold text-slate-500 text-[9px] uppercase tracking-widest text-center">Connect</th>
                                            <th className="px-6 py-3 font-bold text-slate-500 text-[9px] uppercase tracking-widest text-center">Machines</th>
                                            <th className="px-6 py-3 font-bold text-slate-500 text-[9px] uppercase tracking-widest">Capacity</th>
                                            <th className="px-6 py-3 font-bold text-slate-500 text-[9px] uppercase tracking-widest">Sync Health</th>
                                            <th className="px-6 py-3 font-bold text-slate-500 text-[9px] uppercase tracking-widest">Routing</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {printers.map((p) => (
                                            <tr
                                                key={p.id}
                                                className="hover:bg-slate-50/80 transition-all cursor-pointer group"
                                                onClick={() => setSelectedPrinterId(p.id)}
                                            >
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                                                            <BuildingOfficeIcon className="w-4 h-4" />
                                                        </div>
                                                        <div>
                                                            <div className="text-xs font-black text-slate-900 group-hover:text-primary transition-colors">{p.name}</div>
                                                            <div className="text-[9px] font-bold text-slate-400 uppercase">{p.city}, {p.country}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    {getStatusBadge(p.status)}
                                                </td>
                                                <td className="px-6 py-4 text-center text-[10px] font-bold text-slate-500">
                                                    {p.connect_status}
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <div className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 rounded text-[10px] font-black text-slate-600">
                                                        <CpuChipIcon className="w-3 h-3" />
                                                        {p.machines_count}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="text-[10px] font-black text-slate-900">
                                                        {p.capacity_available_today ?? '—'} <span className="text-[8px] text-slate-400">units</span>
                                                    </div>
                                                    <div className="text-[8px] font-heavy text-slate-400 uppercase">LT: {p.lead_time_days || '?'}d</div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex flex-col">
                                                        {getSyncBadge(p.sync_status)}
                                                        <span className="text-[8px] font-medium text-slate-400 mt-1 uppercase">
                                                            {p.last_sync_at ? new Date(p.last_sync_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'NEVER'}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className={`text-[9px] font-black uppercase tracking-widest ${p.routing_eligible ? 'text-emerald-500' : 'text-rose-400'}`}>
                                                        {p.routing_eligible ? 'YES' : 'NO'}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                        {printers.length === 0 && (
                                            <tr>
                                                <td colSpan={6} className="px-6 py-20 text-center text-slate-400 text-xs font-bold uppercase tracking-widest">
                                                    No printers match the current filters.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <SyncHealthPanel health={overview?.sync_health} />
                        <RoutingInsightsPanel insights={routingStats} />
                        <RoutingIntelligencePanel stats={routingStats} />
                        <NetworkHealthPanel
                            warnings={health}
                            onWarningClick={(id) => setSelectedPrinterId(id)}
                        />
                    </div>
                </div>
            </div>

            {/* Detail Drawer */}
            <PrinterNodeDrawer
                printerId={selectedPrinterId}
                onClose={() => setSelectedPrinterId(null)}
                onAction={handleAction}
            />
        </div>
    );
};
