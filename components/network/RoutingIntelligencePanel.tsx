import React from "react";
import { ChartBarSquareIcon, SignalIcon, SparklesIcon } from "@heroicons/react/24/outline";

interface RoutingStats {
    total_decisions: number;
    avg_routing_score: number;
    conflicts_count: number;
}

interface Props {
    stats: RoutingStats | null;
}

export const RoutingIntelligencePanel: React.FC<Props> = ({ stats }) => {
    if (!stats) return null;

    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 bg-indigo-50/50 border-b border-indigo-100 flex items-center justify-between">
                <h3 className="font-black text-indigo-900 uppercase tracking-wider text-[10px] flex items-center gap-2">
                    <SparklesIcon className="w-4 h-4 text-indigo-500" />
                    Routing Intelligence
                </h3>
            </div>
            <div className="p-6 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                        <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Decisions</div>
                        <div className="text-xl font-black text-slate-900">{stats.total_decisions}</div>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                        <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Avg Score</div>
                        <div className="text-xl font-black text-slate-900">{Math.round(stats.avg_routing_score)}%</div>
                    </div>
                </div>

                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-500 uppercase">Routing Conflicts</span>
                        <span className="px-2 py-0.5 bg-rose-100 text-rose-700 rounded-full text-[9px] font-black uppercase">
                            {stats.conflicts_count} Active
                        </span>
                    </div>
                    <div className="text-[10px] font-bold text-slate-400 leading-relaxed italic">
                        Conflicts occur when multiple printers share a similar routing score for the same region.
                    </div>
                </div>

                <div className="pt-4 border-t border-slate-100">
                    <button className="w-full py-3 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 flex items-center justify-center gap-2">
                        <SignalIcon className="w-4 h-4" />
                        Explore Recommendation Logic
                    </button>
                </div>
            </div>
        </div>
    );
};
