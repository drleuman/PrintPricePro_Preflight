import React, { useState, useEffect } from "react";
import * as adminApi from "../../lib/adminApi";
import {
    QueueListIcon,
    ArrowPathIcon,
    ClockIcon,
    CheckCircleIcon,
    XCircleIcon,
    ExclamationCircleIcon
} from "@heroicons/react/24/outline";

export const OffersTab: React.FC = () => {
    const [offers, setOffers] = useState<any[]>([]);
    const [metrics, setMetrics] = useState<any>({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [oData, mData] = await Promise.all([
                adminApi.getOffers(),
                adminApi.getOffersMetrics()
            ]);
            setOffers(Array.isArray(oData) ? oData : []);
            setMetrics(mData || {});
        } catch (err) {
            console.error('Failed to fetch offers:', err);
        } finally {
            setLoading(false);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'ACCEPTED': return 'bg-emerald-50 text-emerald-700 border-emerald-100';
            case 'REJECTED': return 'bg-rose-50 text-rose-700 border-rose-100';
            case 'EXPIRED': return 'bg-slate-100 text-slate-500 border-slate-200';
            case 'SENT': return 'bg-blue-50 text-blue-700 border-blue-100';
            case 'PENDING': return 'bg-amber-50 text-amber-700 border-amber-100';
            default: return 'bg-slate-50 text-slate-600';
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-black text-slate-900 tracking-tight">Production Offers</h2>
                    <p className="text-sm text-slate-500 font-medium">Monitor active proposals and network responsiveness.</p>
                </div>
                <button onClick={fetchData} className="p-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">
                    <ArrowPathIcon className={`w-5 h-5 text-slate-400 ${loading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[
                    { label: "Active Offers", value: metrics.pending || 0, icon: ClockIcon, color: "text-blue-600", bg: "bg-blue-50" },
                    { label: "Accepted", value: metrics.accepted || 0, icon: CheckCircleIcon, color: "text-emerald-600", bg: "bg-emerald-50" },
                    { label: "Rejected", value: metrics.rejected || 0, icon: XCircleIcon, color: "text-rose-600", bg: "bg-rose-50" },
                    { label: "Expired", value: metrics.expired || 0, icon: ExclamationCircleIcon, color: "text-slate-600", bg: "bg-slate-50" }
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

            {/* Offers Table */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                                <th className="px-6 py-4">Job / Printer</th>
                                <th className="px-6 py-4">Financials</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4">Expiry</th>
                                <th className="px-6 py-4">Created At</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {offers.map((o, i) => (
                                <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="font-bold text-slate-900 text-sm">{o.job_name}</div>
                                        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">{o.printer_name}</div>
                                    </td>
                                    <td className="px-6 py-4 text-xs">
                                        <div className="font-mono text-slate-700">{o.suggested_price} {o.currency}</div>
                                        <div className="text-[9px] text-emerald-600 font-bold">{o.margin_pct}% Margin</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black border uppercase tracking-wider ${getStatusColor(o.offer_status)}`}>
                                            {o.offer_status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-xs font-medium text-slate-500">
                                        {new Date(o.offer_expires_at).toLocaleTimeString()}
                                    </td>
                                    <td className="px-6 py-4 text-[10px] text-slate-400 font-bold">
                                        {new Date(o.created_at).toLocaleString()}
                                    </td>
                                </tr>
                            ))}
                            {offers.length === 0 && !loading && (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-slate-400 uppercase font-black text-xs tracking-widest">
                                        No offers found
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
