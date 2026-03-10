import React, { useState, useEffect } from "react";
import {
    CurrencyEuroIcon,
    PlusIcon,
    ArchiveBoxIcon,
    CalculatorIcon,
    TagIcon,
    ChartPieIcon,
    ArrowPathIcon
} from "@heroicons/react/24/outline";
import * as adminApi from "../../lib/adminApi";

export const PricingIntelligenceTab: React.FC = () => {
    const [view, setView] = useState<'profiles' | 'routing'>('profiles');
    const [profiles, setProfiles] = useState<any[]>([]);
    const [routingHistory, setRoutingHistory] = useState<any[]>([]);
    const [conflicts, setConflicts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (view === 'profiles') fetchProfiles();
        if (view === 'routing') fetchRoutingData();
    }, [view]);

    const fetchRoutingData = async () => {
        setLoading(true);
        try {
            const [historyData, conflictData] = await Promise.all([
                adminApi.getEconomicRoutingHistory(),
                adminApi.getEconomicRoutingConflicts()
            ]);
            setRoutingHistory(Array.isArray(historyData) ? historyData : []);
            setConflicts(Array.isArray(conflictData) ? conflictData : []);
        } catch (err: any) {
            setError(err.message);
            setRoutingHistory([]);
            setConflicts([]);
        } finally {
            setLoading(false);
        }
    };

    const fetchProfiles = async () => {
        setLoading(true);
        try {
            const data = await adminApi.getPricingProfiles();
            setProfiles(Array.isArray(data) ? data : []);
        } catch (err: any) {
            setError(err.message);
            setProfiles([]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-black text-slate-900 tracking-tight">Pricing Intelligence Engine</h2>
                    <p className="text-sm text-slate-500 font-medium">Model production economics and manage margins.</p>
                </div>
                <button
                    className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-xl text-sm font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg active:scale-95"
                >
                    <PlusIcon className="w-4 h-4" /> New Profile
                </button>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label: "Pricing Profiles", value: profiles.length, icon: ArchiveBoxIcon, color: "text-blue-600", bg: "bg-blue-50" },
                    { label: "Active Nodes", value: profiles.filter(p => p.active).length, icon: TagIcon, color: "text-emerald-600", bg: "bg-emerald-50" },
                    { label: "Avg Markup", value: "35%", icon: CalculatorIcon, color: "text-amber-600", bg: "bg-amber-50" },
                    { label: "Economic Health", value: "92%", icon: ChartPieIcon, color: "text-rose-600", bg: "bg-rose-50" }
                ].map((stat, i) => (
                    <div key={i} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
                        <div>
                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{stat.label}</div>
                            <div className="text-xl font-black text-slate-900 mt-0.5">{stat.value}</div>
                        </div>
                        <div className={`w-10 h-10 ${stat.bg} ${stat.color} rounded-xl flex items-center justify-center`}>
                            <stat.icon className="w-5 h-5" />
                        </div>
                    </div>
                ))}
            </div>

            {/* Conditional Views */}
            {view === 'profiles' ? (
                /* Profiles Table */
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                    {/* ... (Existing Profiles Table Content) ... */}
                    <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                        <h3 className="font-black text-slate-900 text-xs uppercase tracking-widest">Active Economic Profiles</h3>
                        <button onClick={fetchProfiles} className="text-slate-400 hover:text-slate-600">
                            <ArrowPathIcon className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                                    <th className="px-6 py-4">Printer / Machine</th>
                                    <th className="px-6 py-4">Scope</th>
                                    <th className="px-6 py-4">Base Cost</th>
                                    <th className="px-6 py-4">Setup</th>
                                    <th className="px-6 py-4">Min. Fee</th>
                                    <th className="px-6 py-4">Status</th>
                                    <th className="px-6 py-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {profiles.map((p, i) => (
                                    <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="font-bold text-slate-900">{p.printer_name}</div>
                                            <div className="text-[10px] text-slate-400 uppercase font-bold">{p.machine_nickname || 'Printer-wide'}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase ${p.pricing_scope === 'MACHINE' ? 'bg-purple-50 text-purple-600' : 'bg-blue-50 text-blue-600'}`}>
                                                {p.pricing_scope}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 font-mono text-xs text-slate-600">{p.base_cost_per_sheet} {p.currency}</td>
                                        <td className="px-6 py-4 font-mono text-xs text-slate-600">{p.setup_cost} {p.currency}</td>
                                        <td className="px-6 py-4 font-mono text-xs text-slate-600">{p.minimum_job_fee} {p.currency}</td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-1.5">
                                                <div className={`w-1.5 h-1.5 rounded-full ${p.active ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                                                <span className="text-[10px] font-black uppercase text-slate-600">{p.active ? 'Active' : 'Disabled'}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button className="text-[10px] font-black uppercase text-primary hover:underline">Edit</button>
                                        </td>
                                    </tr>
                                ))}
                                {profiles.length === 0 && !loading && (
                                    <tr>
                                        <td colSpan={7} className="px-6 py-12 text-center text-slate-400 uppercase font-black text-xs tracking-widest">
                                            No pricing profiles defined
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                <div className="space-y-6">
                    {/* Economic Routing History */}
                    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                            <h3 className="font-black text-slate-900 text-xs uppercase tracking-widest">Economic Routing Decisions</h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                                        <th className="px-6 py-4">Task / Job</th>
                                        <th className="px-6 py-4">Selected Node</th>
                                        <th className="px-6 py-4">Final Score</th>
                                        <th className="px-6 py-4">Estimated Margin</th>
                                        <th className="px-6 py-4">Decision Date</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {routingHistory.map((h, i) => {
                                        const decision = h.final_decision_json || {};
                                        return (
                                            <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                                                <td className="px-6 py-4">
                                                    <div className="font-bold text-slate-900">{h.job_name}</div>
                                                    <div className="text-[10px] text-slate-400 font-bold">{h.job_id}</div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="text-xs font-bold text-slate-700">{decision.printer_name || 'N/A'}</div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-2">
                                                        <div className="text-sm font-black text-slate-900">{decision.final_routing_score}</div>
                                                        <div className="w-12 h-1 bg-slate-100 rounded-full overflow-hidden">
                                                            <div className="h-full bg-primary" style={{ width: `${decision.final_routing_score}%` }} />
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="text-xs font-bold text-emerald-600">{decision.margin_pct}%</div>
                                                    <div className="text-[10px] text-slate-400">+{decision.estimated_margin} EUR</div>
                                                </td>
                                                <td className="px-6 py-4 text-[10px] text-slate-500 font-bold">
                                                    {new Date(h.created_at).toLocaleString()}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Conflict Inspector */}
                    <div className="bg-white rounded-2xl border border-rose-100 overflow-hidden shadow-sm">
                        <div className="px-6 py-4 border-b border-rose-50 flex items-center justify-between bg-rose-50/30">
                            <h3 className="font-black text-rose-900 text-xs uppercase tracking-widest">Economic Conflict Inspector</h3>
                        </div>
                        <div className="divide-y divide-rose-50">
                            {conflicts.map((c, i) => (
                                <div key={i} className="px-6 py-4 flex items-start gap-4 hover:bg-rose-50/10">
                                    <div className={`mt-1 w-2 h-2 rounded-full ${c.severity === 'HIGH' ? 'bg-rose-500 animate-pulse' : c.severity === 'MEDIUM' ? 'bg-amber-500' : 'bg-blue-500'}`} />
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-black uppercase text-rose-600">{c.conflict_type}</span>
                                            <span className="text-[10px] text-slate-400 font-bold">• {c.job_name}</span>
                                        </div>
                                        <p className="text-xs text-slate-600 mt-0.5">{c.conflict_description}</p>
                                    </div>
                                    <div className="text-[10px] text-slate-400 font-bold">
                                        {new Date(c.created_at).toLocaleTimeString()}
                                    </div>
                                </div>
                            ))}
                            {conflicts.length === 0 && (
                                <div className="px-6 py-8 text-center text-slate-400 uppercase font-black text-xs tracking-widest italic">
                                    No economic conflicts detected
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
