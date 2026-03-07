import React, { useState, useEffect } from "react";
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
            const res = await fetch('/api/admin/marketplace/sessions', {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('admin_key')}` }
            });
            setSessions(await res.json());
        } catch (err) {
            console.error('Failed to fetch marketplace sessions:', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchSessionDetail = async (id: string) => {
        try {
            const res = await fetch(`/api/admin/marketplace/sessions/${id}`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('admin_key')}` }
            });
            setSelectedSession(await res.json());
        } catch (err) {
            console.error('Failed to fetch session detail:', err);
        }
    };

    const handleSelectOffer = async (offerId: string) => {
        if (!selectedSession) return;
        try {
            const res = await fetch(`/api/admin/marketplace/sessions/${selectedSession.id}/select`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('admin_key')}`
                },
                body: JSON.stringify({ offer_id: offerId, selection_mode: 'ADMIN_OVERRIDE' })
            });
            if (res.ok) {
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

                                {/* Comparison Grid */}
                                <div className="space-y-3">
                                    <div className="grid grid-cols-12 gap-4 px-4 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                        <div className="col-span-4">Printer Node</div>
                                        <div className="col-span-2 text-center">Score</div>
                                        <div className="col-span-2 text-center">Price / Margin</div>
                                        <div className="col-span-2 text-center">Lead Time</div>
                                        <div className="col-span-2"></div>
                                    </div>
                                    {selectedSession.offers.map((o: any, i: number) => (
                                        <div key={i} className={`grid grid-cols-12 gap-4 p-4 rounded-2xl border transition-all ${o.offer_selected ? 'bg-emerald-50/50 border-emerald-200 ring-2 ring-emerald-500/10' : 'bg-white border-slate-100 hover:border-slate-300'
                                            }`}>
                                            <div className="col-span-4 flex items-center gap-3">
                                                <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 font-black text-xs">
                                                    #{i + 1}
                                                </div>
                                                <div>
                                                    <div className="font-bold text-slate-900 text-sm tracking-tight">{o.printer_name}</div>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        {i === 0 && <span className="bg-blue-100 text-blue-700 text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-tighter flex items-center gap-1"><ShieldCheckIcon className="w-2.5 h-2.5" /> Best Tech</span>}
                                                        {o.offer_selected && <span className="bg-emerald-100 text-emerald-700 text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-tighter flex items-center gap-1"><BoltIcon className="w-2.5 h-2.5" /> Selected</span>}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="col-span-2 flex flex-col items-center justify-center">
                                                <div className="text-lg font-black text-slate-900 leading-none">{Math.round(o.offer_priority_score)}</div>
                                                <div className="text-[9px] text-slate-400 font-bold uppercase mt-1">Market Prio</div>
                                            </div>
                                            <div className="col-span-2 flex flex-col items-center justify-center">
                                                <div className="font-mono text-sm font-bold text-slate-700">{o.suggested_price} {o.currency}</div>
                                                <div className="text-[9px] text-emerald-600 font-black mt-1 uppercase tracking-tighter">{o.margin_pct}% Margin</div>
                                            </div>
                                            <div className="col-span-2 flex flex-col items-center justify-center">
                                                <div className="font-black text-slate-900 text-sm tracking-tighter">{o.lead_time_days} Days</div>
                                                <div className="text-[9px] text-slate-400 font-bold uppercase mt-1 tracking-tighter">Est. Delivery</div>
                                            </div>
                                            <div className="col-span-2 flex items-center justify-end">
                                                {!o.offer_selected && selectedSession.session_status === 'OPEN' && (
                                                    <button
                                                        onClick={() => handleSelectOffer(o.id)}
                                                        className="px-4 py-2 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-blue-600 transition-colors shadow-sm active:scale-95"
                                                    >
                                                        Override & Select
                                                    </button>
                                                )}
                                                {o.offer_selected && (
                                                    <div className="text-emerald-500 font-black uppercase text-[10px] tracking-widest flex items-center gap-1">
                                                        <ShieldCheckIcon className="w-5 h-5" /> Active
                                                    </div>
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
