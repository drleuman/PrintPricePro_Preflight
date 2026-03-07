import React, { useEffect, useState } from "react";
import {
    SignalIcon,
    ChartBarIcon,
    UserGroupIcon,
    ExclamationTriangleIcon,
    ArrowPathIcon,
    BoltIcon
} from "@heroicons/react/24/outline";
import * as adminApi from "../../lib/adminApi";

interface EngagementSignal {
    id: string;
    tenant_id: string;
    tenant_name: string;
    signal_type: string;
    action_taken: string;
    metadata_json: any;
    created_at: string;
}

interface SignalStat {
    signal_type: string;
    count: number;
    last_seen: string;
}

export const EngagementSignalsTab: React.FC = () => {
    const [signals, setSignals] = useState<EngagementSignal[]>([]);
    const [stats, setStats] = useState<SignalStat[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [sigData, statData] = await Promise.all([
                adminApi.getEngagementSignals(),
                adminApi.getEngagementStats()
            ]);
            setSignals(sigData);
            setStats(statData);
        } catch (err) {
            console.error("Failed to fetch engagement data", err);
            setSignals([]);
            setStats([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const getSignalColor = (type: string) => {
        if (type.includes('quota.100') || type.includes('expired')) return 'text-red-600 bg-red-50 border-red-100';
        if (type.includes('quota.80') || type.includes('expiry')) return 'text-amber-600 bg-amber-50 border-amber-100';
        if (type.includes('high_usage')) return 'text-blue-600 bg-blue-50 border-blue-100';
        return 'text-slate-600 bg-slate-50 border-slate-100';
    };

    return (
        <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                        <BoltIcon className="w-5 h-5 text-primary" />
                        Engagement Automation Signals
                    </h2>
                    <p className="text-sm text-slate-500">Automated decisions and triggers from the Engagement Engine.</p>
                </div>
                <button
                    onClick={fetchData}
                    className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
                >
                    <ArrowPathIcon className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {stats.map(stat => (
                    <div key={stat.signal_type} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{stat.signal_type}</div>
                        <div className="text-2xl font-bold text-slate-900">{stat.count}</div>
                        <div className="text-[10px] text-slate-500 mt-1">Last seen: {new Date(stat.last_seen).toLocaleDateString()}</div>
                    </div>
                ))}
            </div>

            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-medium font-mono uppercase text-[10px] tracking-wider">
                            <tr>
                                <th className="px-4 py-3">Timestamp</th>
                                <th className="px-4 py-3">Tenant</th>
                                <th className="px-4 py-3">Signal</th>
                                <th className="px-4 py-3">Action</th>
                                <th className="px-4 py-3">Context</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {signals.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-4 py-12 text-center text-slate-400 italic">
                                        No engagement signals recorded yet.
                                    </td>
                                </tr>
                            ) : (
                                signals.map(sig => (
                                    <tr key={sig.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-4 py-3 text-slate-500 tabular-nums text-xs">
                                            {new Date(sig.created_at).toLocaleString()}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="font-bold text-slate-900 text-xs">{sig.tenant_name}</div>
                                            <div className="text-[10px] font-mono text-slate-400">{sig.tenant_id}</div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black border uppercase ${getSignalColor(sig.signal_type)}`}>
                                                {sig.signal_type}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-1.5 text-slate-700 font-medium text-xs">
                                                <SignalIcon className="w-3.5 h-3.5 text-primary" />
                                                {sig.action_taken}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <pre className="text-[9px] bg-slate-50 p-1.5 rounded border border-slate-100 text-slate-600 font-mono max-w-[300px] truncate">
                                                {JSON.stringify(typeof sig.metadata_json === 'string' ? JSON.parse(sig.metadata_json) : sig.metadata_json)}
                                            </pre>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
