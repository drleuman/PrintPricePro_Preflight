import React, { useState, useEffect } from "react";
import * as adminApi from "../../lib/adminApi";
import {
    BuildingStorefrontIcon,
    ArrowPathIcon,
    TableCellsIcon,
    ShieldCheckIcon,
    AdjustmentsHorizontalIcon,
    BoltIcon,
    CurrencyEuroIcon
} from "@heroicons/react/24/outline";

export const MarketplaceTab: React.FC = () => {
    const [sessions, setSessions] = useState<any[]>([]);
    const [selectedSession, setSelectedSession] = useState<any | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchSessions();
    }, []);

    const fetchSessions = async () => {
        setLoading(true);
        try {
            const data = await adminApi.getMarketplaceSessions();
            setSessions(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error('Failed to fetch marketplace sessions:', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchSessionDetail = async (id: string) => {
        try {
            const data = await adminApi.getMarketplaceSessionDetail(id);
            setSelectedSession(data);
        } catch (err) {
            console.error('Failed to fetch session detail:', err);
        }
    };

    const handleSelectOffer = async (offerId: string) => {
        if (!selectedSession) return;
        try {
            const res = await adminApi.selectMarketplaceOffer(selectedSession.id, offerId);
            if (res) {
                fetchSessionDetail(selectedSession.id);
                fetchSessions();
            }
        } catch (err) {
            console.error('Selection failed:', err);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                        <BuildingStorefrontIcon className="w-6 h-6 text-blue-600" />
                        Marketplace Interaction
                    </h2>
                    <p className="text-sm text-slate-500 font-medium tracking-tight">Manage multi-offer sessions and competitive routing overrides.</p>
                </div>
                <button onClick={fetchSessions} className="p-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors shadow-sm">
                    <ArrowPathIcon className={`w-5 h-5 text-slate-400 ${loading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Sessions List */}
                <div className="lg:col-span-1 space-y-4">
                    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                        <div className="p-4 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active Sessions</span>
                            <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider">
                                {sessions.filter(s => s.session_status === 'OPEN').length} Open
                            </span>
                        </div>
                        <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
                            {sessions.map((s, i) => (
                                <button
                                    key={i}
                                    onClick={() => fetchSessionDetail(s.id)}
                                    className={`w-full text-left p-4 hover:bg-slate-50 transition-colors ${selectedSession?.id === s.id ? 'bg-blue-50/50' : ''}`}
                                >
                                    <div className="flex justify-between items-start mb-1">
                                        <div className="font-bold text-slate-900 truncate pr-4">{s.job_name}</div>
                                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border uppercase tracking-wider ${s.session_status === 'SELECTED' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                            s.session_status === 'OPEN' ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-slate-50 text-slate-500 border-slate-200'
                                            }`}>
                                            {s.session_status}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold uppercase tracking-tight">
                                        <TableCellsIcon className="w-3 h-3" /> {s.offer_count} Proposals
                                        <span>•</span>
                                        {new Date(s.created_at).toLocaleTimeString()}
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Offer Comparison View */}
                <div className="lg:col-span-2">
                    {selectedSession ? (
                        <div className="space-y-6">
                            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                                <div className="flex justify-between items-start mb-6">
                                    <div>
                                        <h3 className="text-lg font-black text-slate-900 tracking-tight">{selectedSession.job_name}</h3>
                                        <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Session ID: {selectedSession.id}</p>
                                    </div>
                                    <div className="flex gap-2">
                                        <span className={`px-3 py-1 rounded-xl text-[10px] font-black tracking-widest uppercase border ${selectedSession.selection_mode === 'ADMIN_OVERRIDE' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-slate-50 text-slate-600 border-slate-200'
                                            }`}>
                                            Mode: {selectedSession.selection_mode}
                                        </span>
                                    </div>
                                </div>

                                {/* Comparison Grid - Dense Multi-column */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {selectedSession.offers.map((o: any, i: number) => (
                                        <div key={i} className={`p-4 rounded-2xl border transition-all ${o.offer_selected ? 'bg-emerald-50/50 border-emerald-200 ring-2 ring-emerald-500/10' : 'bg-white border-slate-100 hover:border-slate-300 shadow-sm'
                                            }`}>
                                            <div className="flex justify-between items-start mb-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center font-black text-xs shadow-lg">
                                                        #{i + 1}
                                                    </div>
                                                    <div>
                                                        <div className="font-black text-slate-900 text-sm tracking-tight">{o.printer_name}</div>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            {i === 0 && <span className="bg-blue-600 text-white text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-tighter flex items-center gap-1 shadow-sm"><ShieldCheckIcon className="w-2.5 h-2.5" /> Best Choice</span>}
                                                            {o.offer_selected && <span className="bg-emerald-600 text-white text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-tighter flex items-center gap-1 shadow-sm"><BoltIcon className="w-2.5 h-2.5" /> Active</span>}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-lg font-black text-slate-900 leading-none">{o.suggested_price} €</div>
                                                    <div className="text-[9px] text-emerald-600 font-black mt-1 uppercase tracking-tighter">+{o.margin_pct}% Pargin</div>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-3 mb-4">
                                                <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
                                                    <div className="text-[9px] text-slate-400 font-bold uppercase tracking-tight">Lead Time</div>
                                                    <div className="font-black text-slate-900 text-xs">{o.lead_time_days} Work Days</div>
                                                </div>
                                                <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
                                                    <div className="text-[9px] text-slate-400 font-bold uppercase tracking-tight">Market Score</div>
                                                    <div className="font-black text-slate-900 text-xs">{Math.round(o.offer_priority_score)} / 100</div>
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-between pt-2 border-t border-slate-100/50">
                                                <div className="text-[10px] text-slate-400 font-medium">Node ID: {o.id.slice(0, 8)}</div>
                                                {!o.offer_selected && selectedSession.session_status === 'OPEN' && (
                                                    <button
                                                        onClick={() => handleSelectOffer(o.id)}
                                                        className="px-4 py-2 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-blue-600 transition-all shadow-md active:scale-95"
                                                    >
                                                        Select Offer
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Session Timeline */}
                            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Marketplace Event Log</h4>
                                <div className="space-y-4">
                                    {(selectedSession.events || []).map((e: any, i: number) => (
                                        <div key={i} className="flex gap-4 items-start pl-2 border-l-2 border-slate-100 pb-4 last:pb-0">
                                            <div className="mt-1 w-2 h-2 rounded-full bg-slate-300 ring-4 ring-white" />
                                            <div>
                                                <div className="text-xs font-black text-slate-900 uppercase tracking-wider">{e.event_type.replace(/_/g, ' ')}</div>
                                                <div className="text-[10px] text-slate-400 font-medium">
                                                    {new Date(e.created_at).toLocaleString()}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="h-full min-h-[400px] bg-slate-50/50 rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 space-y-3">
                            <AdjustmentsHorizontalIcon className="w-12 h-12 opacity-20" />
                            <p className="font-black uppercase text-xs tracking-widest opacity-40">Select a session to compare offers</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
