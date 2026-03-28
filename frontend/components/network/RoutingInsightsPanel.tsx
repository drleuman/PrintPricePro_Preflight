import React from "react";
import { ShieldCheckIcon, AdjustmentsHorizontalIcon, ExclamationTriangleIcon } from "@heroicons/react/24/outline";

interface Props {
    insights: {
        avg_confidence: number;
        fallback_rate: number;
        recent_conflicts: number;
    } | null;
}

export const RoutingInsightsPanel: React.FC<Props> = ({ insights }) => {
    if (!insights) return null;

    const getConfidenceColor = (score: number) => {
        if (score > 0.8) return 'text-emerald-500 bg-emerald-50 border-emerald-100';
        if (score > 0.5) return 'text-amber-500 bg-amber-50 border-amber-100';
        return 'text-rose-500 bg-rose-50 border-rose-100';
    };

    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-black text-slate-900 uppercase tracking-wider text-[10px] flex items-center gap-2">
                    <ShieldCheckIcon className="w-4 h-4 text-primary" />
                    Routing Insights & Confidence
                </h3>
            </div>
            <div className="p-6 space-y-4">
                <div className="grid grid-cols-3 gap-2">
                    <div className={`p-4 rounded-xl border text-center ${getConfidenceColor(insights.avg_confidence)}`}>
                        <div className="text-[8px] font-black uppercase tracking-widest mb-1 opacity-70">Avg Confidence</div>
                        <div className="text-xl font-black">{(insights.avg_confidence * 100).toFixed(0)}%</div>
                    </div>
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 text-center">
                        <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Fallback Rate</div>
                        <div className="text-xl font-black text-slate-700">{(insights.fallback_rate * 100).toFixed(0)}%</div>
                    </div>
                    <div className="p-4 rounded-xl bg-rose-50 border border-rose-100 text-center">
                        <div className="text-[8px] font-black text-rose-400 uppercase tracking-widest mb-1">Conflicts (24h)</div>
                        <div className="text-xl font-black text-rose-600">{insights.recent_conflicts}</div>
                    </div>
                </div>

                <div className="pt-4 border-t border-slate-50">
                    <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 italic">
                        <AdjustmentsHorizontalIcon className="w-4 h-4 text-slate-400" />
                        Fallback logic triggers automatically when primary compatibility fails.
                    </div>
                </div>
            </div>
        </div>
    );
};
