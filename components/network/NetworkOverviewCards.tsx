import React from "react";
import {
    BuildingOfficeIcon,
    SignalIcon,
    CircleStackIcon,
    ChartBarIcon,
    MapPinIcon,
    ClockIcon,
    ShieldCheckIcon,
    TicketIcon,
    RocketLaunchIcon
} from "@heroicons/react/24/outline";

interface OverviewStats {
    total_printers: number;
    active_printers: number;
    routing_ready_printers: number;
    avg_quality_score: number;
    capacity_available_today: number;
    capacity_total_today: number;
    capacity_utilization_pct: number;
    printers_full_today: number;
    stale_sync_count: number;
    regions_covered: number;
    reservations?: {
        active: number;
        expired_24h: number;
    };
    dispatch?: {
        active: number;
        reroute_rate: number;
    };
}

interface Props {
    stats: OverviewStats | null;
}

export const NetworkOverviewCards: React.FC<Props> = ({ stats }) => {
    if (!stats) return null;

    const cards = [
        {
            label: "Total Printers",
            value: stats.total_printers,
            sub: `${stats.active_printers} Active`,
            icon: BuildingOfficeIcon,
            color: "text-slate-600",
            bg: "bg-slate-50"
        },
        {
            label: "Routing Ready",
            value: stats.routing_ready_printers,
            sub: "Eligible for jobs",
            icon: SignalIcon,
            color: "text-emerald-600",
            bg: "bg-emerald-50"
        },
        {
            label: "Capacity Available",
            value: `${((stats.capacity_available_today / (stats.capacity_total_today || 1)) * 100).toFixed(0)}%`,
            sub: `${stats.printers_full_today} Saturated nodes`,
            icon: CircleStackIcon,
            color: "text-blue-600",
            bg: "bg-blue-50"
        },
        {
            label: "Utilization",
            value: `${stats.capacity_utilization_pct}%`,
            sub: "Current usage",
            icon: ChartBarIcon,
            color: "text-purple-600",
            bg: "bg-purple-50"
        },
        {
            label: "Avg Quality",
            value: `${(stats.avg_quality_score * 100).toFixed(0)}%`,
            sub: "Network performance",
            icon: ShieldCheckIcon,
            color: "text-orange-600",
            bg: "bg-orange-50"
        },
        {
            label: "Regions",
            value: stats.regions_covered,
            sub: "Global footprint",
            icon: MapPinIcon,
            color: "text-indigo-600",
            bg: "bg-indigo-50"
        },
        {
            label: "Stale Nodes",
            value: stats.stale_sync_count,
            sub: ">24h without sync",
            icon: ClockIcon,
            color: stats.stale_sync_count > 0 ? "text-rose-600" : "text-slate-400",
            bg: stats.stale_sync_count > 0 ? "bg-rose-50" : "bg-slate-50"
        },
        {
            label: "Active Locks",
            value: stats.reservations?.active || 0,
            sub: `${stats.reservations?.expired_24h || 0} Expired (24h)`,
            icon: TicketIcon,
            color: (stats.reservations?.active || 0) > 0 ? "text-amber-600" : "text-slate-400",
            bg: (stats.reservations?.active || 0) > 0 ? "bg-amber-50" : "bg-slate-50"
        },
        {
            label: "Auto Dispatch",
            value: stats.dispatch?.active || 0,
            sub: `${((stats.dispatch?.reroute_rate || 0) * 100).toFixed(1)}% Reroute`,
            icon: RocketLaunchIcon,
            color: "text-rose-500",
            bg: "bg-rose-50"
        }
    ];

    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-9 gap-4">
            {cards.map((card, idx) => (
                <div key={idx} className="glass p-4 rounded-2xl border border-white shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-2">
                        <div className={`p-2 rounded-lg ${card.bg} ${card.color}`}>
                            <card.icon className="w-4 h-4" />
                        </div>
                        <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">
                            {card.label}
                        </span>
                    </div>
                    <div className="text-2xl font-black text-slate-900 tracking-tight">{card.value}</div>
                    <div className="text-[10px] font-bold text-slate-500 mt-1 truncate">{card.sub}</div>
                </div>
            ))}
        </div>
    );
};
