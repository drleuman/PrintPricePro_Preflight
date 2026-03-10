import React from "react";
import { CloudArrowUpIcon, CheckCircleIcon, ExclamationTriangleIcon, SignalSlashIcon } from "@heroicons/react/24/outline";

interface SyncSummary {
    healthy: number;
    stale: number;
    offline: number;
}

interface Props {
    health: SyncSummary | null;
}

export const SyncHealthPanel: React.FC<Props> = ({ health }) => {
    if (!health) return null;

    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-black text-slate-900 uppercase tracking-wider text-[10px] flex items-center gap-2">
                    <CloudArrowUpIcon className="w-4 h-4 text-primary" />
                    Network Sync Health
                </h3>
            </div>
            <div className="p-6">
                <div className="grid grid-cols-3 gap-2">
                    <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-100 text-center">
                        <div className="text-[8px] font-black text-emerald-400 uppercase tracking-widest mb-1">Healthy</div>
                        <div className="text-xl font-black text-emerald-600">{health.healthy}</div>
                    </div>
                    <div className="p-4 rounded-xl bg-amber-50 border border-amber-100 text-center">
                        <div className="text-[8px] font-black text-amber-400 uppercase tracking-widest mb-1">Stale</div>
                        <div className="text-xl font-black text-amber-600">{health.stale}</div>
                    </div>
                    <div className="p-4 rounded-xl bg-rose-50 border border-rose-100 text-center">
                        <div className="text-[8px] font-black text-rose-400 uppercase tracking-widest mb-1">Offline</div>
                        <div className="text-xl font-black text-rose-600">{health.offline}</div>
                    </div>
                </div>

                <div className="mt-4 pt-4 border-t border-slate-50 space-y-2">
                    <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 italic leading-tight">
                        <CheckCircleIcon className="w-3.5 h-3.5 text-emerald-500" />
                        Healthy nodes are syncing within 6 hours.
                    </div>
                    <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 italic leading-tight">
                        <SignalSlashIcon className="w-3.5 h-3.5 text-rose-500" />
                        Nodes over 24h are automatically pulled from routing.
                    </div>
                </div>
            </div>
        </div>
    );
};
