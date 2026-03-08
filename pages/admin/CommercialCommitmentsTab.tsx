import React, { useState, useEffect } from "react";
import {
    DocumentCheckIcon,
    LockClosedIcon,
    NoSymbolIcon,
    ArrowPathIcon,
    CurrencyEuroIcon,
    ClockIcon,
    CheckCircleIcon,
    ExclamationCircleIcon,
    IdentificationIcon,
    ChartBarIcon
} from "@heroicons/react/24/outline";
import * as adminApi from "../../lib/adminApi";

export const CommercialCommitmentsTab: React.FC = () => {
    const [commitments, setCommitments] = useState<any[]>([]);
    const [selectedCommitment, setSelectedCommitment] = useState<any | null>(null);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState<any[]>([]);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [cData, sData] = await Promise.all([
                adminApi.getCommercialCommitments(),
                adminApi.getSettlementReadiness()
            ]);
            setCommitments(Array.isArray(cData) ? cData : []);
            setStats(Array.isArray(sData) ? sData : []);
        } catch (err) {
            console.error('Failed to fetch commercial data:', err);
            setCommitments([]);
            setStats([]);
        } finally {
            setLoading(false);
        }
    };

    const fetchDetail = async (id: string) => {
        try {
            const data = await adminApi.getCommercialCommitmentDetail(id);
            setSelectedCommitment(data);
        } catch (err) {
            console.error('Failed to fetch commitment detail:', err);
        }
    };

    const handleAction = async (id: string, action: 'lock' | 'void') => {
        try {
            if (action === 'lock') {
                await adminApi.lockCommercialCommitment(id);
            } else {
                await adminApi.voidCommercialCommitment(id);
            }
            fetchDetail(id);
            fetchData();
        } catch (err) {
            console.error(`Failed to ${action} commitment:`, err);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                        <DocumentCheckIcon className="w-6 h-6 text-indigo-600" />
                        Commercial Commitments & Settlement Readiness
                    </h2>
                    <p className="text-sm text-slate-500 font-medium tracking-tight">Immutable production agreements and payout preparation.</p>
                </div>
                <button onClick={fetchData} className="p-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors shadow-sm">
                    <ArrowPathIcon className={`w-5 h-5 text-slate-400 ${loading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            {/* Metrics Ribbon - Enhanced Density */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
                {stats.map((s, i) => (
                    <div key={i} className="bg-white overflow-hidden rounded-2xl border border-slate-200 shadow-sm relative group hover:border-indigo-300 transition-all">
                        <div className="absolute top-0 left-0 w-1 h-full bg-slate-100 group-hover:bg-indigo-500 transition-colors" />
                        <div className="p-4">
                            <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 truncate">{s.settlement_readiness_status.replace(/_/g, ' ')}</div>
                            <div className="text-xl font-black text-slate-900">{s.count}</div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Commitments Table */}
                <div className="lg:col-span-2">
                    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                        <table className="w-full text-left bg-white">
                            <thead>
                                <tr className="bg-slate-50/50 border-b border-slate-100">
                                    <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Reference</th>
                                    <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Printer</th>
                                    <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Amount</th>
                                    <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                                    <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Settlement</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {commitments.map((c, i) => (
                                    <tr
                                        key={i}
                                        onClick={() => fetchDetail(c.id)}
                                        className={`cursor-pointer hover:bg-slate-50 transition-colors ${selectedCommitment?.id === c.id ? 'bg-indigo-50/30' : ''}`}
                                    >
                                        <td className="px-4 py-4">
                                            <div className="font-black text-slate-900 text-xs">{c.transaction_reference}</div>
                                            <div className="text-[10px] text-slate-400 font-medium">#{c.job_id.slice(0, 8)}</div>
                                        </td>
                                        <td className="px-4 py-4 text-xs font-bold text-slate-600 truncate max-w-[120px]">{c.printer_name}</td>
                                        <td className="px-4 py-4 text-xs font-black text-slate-900">{c.committed_price} €</td>
                                        <td className="px-4 py-4">
                                            <span className={`text-[9px] font-black px-2 py-0.5 rounded border uppercase tracking-wider ${c.commercial_commitment_status === 'LOCKED' ? 'bg-indigo-50 text-indigo-600 border-indigo-100' :
                                                c.commercial_commitment_status === 'VOIDED' ? 'bg-red-50 text-red-600 border-red-100' : 'bg-slate-50 text-slate-600 border-slate-100'
                                                }`}>
                                                {c.commercial_commitment_status}
                                            </span>
                                        </td>
                                        <td className="px-4 py-4">
                                            <div className="flex items-center gap-1.5">
                                                {c.settlement_readiness_status === 'READY_FOR_PAYOUT' ? (
                                                    <CheckCircleIcon className="w-4 h-4 text-emerald-500" />
                                                ) : c.settlement_readiness_status === 'NOT_READY' ? (
                                                    <ClockIcon className="w-4 h-4 text-amber-500" />
                                                ) : (
                                                    <ExclamationCircleIcon className="w-4 h-4 text-blue-500" />
                                                )}
                                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter truncate max-w-[100px]">
                                                    {c.settlement_readiness_status.replace(/_/g, ' ')}
                                                </span>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Commitment Inspector */}
                <div className="lg:col-span-1">
                    {selectedCommitment ? (
                        <div className="space-y-6">
                            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                                <h3 className="text-lg font-black text-slate-900 tracking-tight mb-6 flex items-center gap-2">
                                    <IdentificationIcon className="w-5 h-5 text-indigo-500" />
                                    Commitment Detail
                                </h3>

                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                                            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-tight mb-1">Gross Value</div>
                                            <div className="text-lg font-black text-slate-900">{selectedCommitment.committed_price} €</div>
                                        </div>
                                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                                            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-tight mb-1">Commission</div>
                                            <div className="text-lg font-black text-emerald-600">+{selectedCommitment.committed_margin} €</div>
                                        </div>
                                    </div>

                                    {selectedCommitment.settlement_placeholder && (
                                        <div className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100 mt-4">
                                            <div className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                                <ChartBarIcon className="w-4 h-4" /> Settlement Projection
                                            </div>
                                            <div className="flex justify-between items-center mb-2">
                                                <span className="text-xs text-slate-600 font-medium">Payable to Printer</span>
                                                <span className="text-sm font-black text-slate-900">{selectedCommitment.settlement_placeholder.payable_to_printer} €</span>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <span className="text-xs text-slate-600 font-medium">Platform Take</span>
                                                <span className="text-sm font-black text-indigo-600">{selectedCommitment.settlement_placeholder.platform_fee} €</span>
                                            </div>
                                        </div>
                                    )}

                                    <div className="pt-4 border-t border-slate-100 space-y-3">
                                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Timeline & Events</div>
                                        <div className="space-y-3">
                                            {selectedCommitment.events.map((e: any, i: number) => (
                                                <div key={i} className="flex gap-3">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-slate-200 mt-1.5 shrink-0" />
                                                    <div>
                                                        <div className="text-[10px] font-black text-slate-900 uppercase tracking-tight">{e.event_type}</div>
                                                        <div className="text-[9px] text-slate-400 font-medium">{new Date(e.created_at).toLocaleString()}</div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {selectedCommitment.commercial_commitment_status === 'READY' && (
                                        <div className="pt-6 flex gap-3">
                                            <button
                                                onClick={() => handleAction(selectedCommitment.id, 'lock')}
                                                className="flex-1 py-3 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-indigo-600 transition-all flex items-center justify-center gap-2 shadow-lg"
                                            >
                                                <LockClosedIcon className="w-4 h-4" /> Lock Agreement
                                            </button>
                                            <button
                                                onClick={() => handleAction(selectedCommitment.id, 'void')}
                                                className="px-4 py-3 bg-white border border-slate-200 text-slate-400 rounded-xl hover:bg-red-50 hover:text-red-600 hover:border-red-100 transition-colors"
                                            >
                                                <NoSymbolIcon className="w-4 h-4" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="h-full min-h-[400px] bg-slate-50/50 rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 space-y-3">
                            <DocumentCheckIcon className="w-12 h-12 opacity-20" />
                            <p className="font-black uppercase text-xs tracking-widest opacity-40">Select a commitment to view ledger</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
