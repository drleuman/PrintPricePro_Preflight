import React, { useState, useEffect } from "react";
import * as adminApi from "../../lib/adminApi";
import {
    BanknotesIcon,
    ArrowPathIcon,
    ChatBubbleLeftRightIcon,
    ShieldCheckIcon,
    ClipboardDocumentCheckIcon,
    ArrowRightIcon,
    UserCircleIcon,
    CpuChipIcon
} from "@heroicons/react/24/outline";

export const MarketplaceReadinessTab: React.FC = () => {
    const [negotiations, setNegotiations] = useState<any[]>([]);
    const [selectedOfferId, setSelectedOfferId] = useState<string | null>(null);
    const [negotiationChain, setNegotiationChain] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchNegotiations();
    }, []);

    const fetchNegotiations = async () => {
        setLoading(true);
        try {
            const data = await adminApi.getNegotiations();
            setNegotiations(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error('Failed to fetch negotiations:', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchNegotiationChain = async (offerId: string) => {
        setSelectedOfferId(offerId);
        try {
            const data = await adminApi.getNegotiationChain(offerId);
            setNegotiationChain(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error('Failed to fetch negotiation chain:', err);
        }
    };

    const handleAcceptCounter = async (offerId: string, counterofferId: string) => {
        try {
            const res = await adminApi.acceptCounteroffer(offerId, counterofferId);
            if (res) {
                fetchNegotiationChain(offerId);
                fetchNegotiations();
            }
        } catch (err) {
            console.error('Failed to accept counteroffer:', err);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                        <BanknotesIcon className="w-6 h-6 text-emerald-600" />
                        Marketplace Readiness & Negotiation
                    </h2>
                    <p className="text-sm text-slate-500 font-medium tracking-tight">Manage structured negotiations and commercial commitment states.</p>
                </div>
                <button onClick={fetchNegotiations} className="p-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors shadow-sm">
                    <ArrowPathIcon className={`w-5 h-5 text-slate-400 ${loading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Active Negotiations */}
                <div className="lg:col-span-1 space-y-4">
                    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                        <div className="p-4 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active Negotiations</span>
                        </div>
                        <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
                            {negotiations.map((n, i) => (
                                <button
                                    key={i}
                                    onClick={() => fetchNegotiationChain(n.offer_id)}
                                    className={`w-full text-left p-4 hover:bg-slate-50 transition-colors ${selectedOfferId === n.offer_id ? 'bg-emerald-50/50' : ''}`}
                                >
                                    <div className="flex justify-between items-start mb-1">
                                        <div className="font-bold text-slate-900 truncate pr-4">{n.printer_name}</div>
                                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border uppercase tracking-wider ${n.negotiation_status === 'ACCEPTED' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                            n.negotiation_status === 'COUNTERED' ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-blue-50 text-blue-600 border-blue-100'
                                            }`}>
                                            {n.negotiation_status}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold uppercase tracking-tight">
                                        <ChatBubbleLeftRightIcon className="w-3 h-3" /> {n.counteroffer_count} Rounds
                                        {n.committed_price && (
                                            <>
                                                <span>•</span>
                                                <span className="text-emerald-600">{n.committed_price} EUR</span>
                                            </>
                                        )}
                                    </div>
                                    {n.commercial_ready && (
                                        <div className="mt-2 text-[8px] font-black text-emerald-500 uppercase tracking-widest flex items-center gap-1">
                                            <ShieldCheckIcon className="w-3 h-3" /> Commercially Ready
                                        </div>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Negotiation Chain Inspector */}
                <div className="lg:col-span-2">
                    {selectedOfferId ? (
                        <div className="space-y-6">
                            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                                <h3 className="text-lg font-black text-slate-900 tracking-tight mb-6 flex items-center gap-2">
                                    <ChatBubbleLeftRightIcon className="w-5 h-5 text-blue-500" />
                                    Negotiation Chain
                                </h3>

                                <div className="space-y-8 relative before:absolute before:inset-0 before:left-5 before:w-0.5 before:bg-slate-100">
                                    {negotiationChain.map((co, i) => (
                                        <div key={i} className="relative pl-12">
                                            <div className={`absolute left-0 top-0 w-10 h-10 rounded-xl flex items-center justify-center border-2 ${co.counterparty === 'PRINTER' ? 'bg-blue-50 border-blue-100' : 'bg-slate-50 border-slate-200'
                                                }`}>
                                                {co.counterparty === 'PRINTER' ? <UserCircleIcon className="w-6 h-6 text-blue-400" /> : <CpuChipIcon className="w-6 h-6 text-slate-400" />}
                                            </div>
                                            <div className={`p-4 rounded-2xl border ${co.counteroffer_status === 'ACCEPTED' ? 'bg-emerald-50 border-emerald-100' :
                                                co.counteroffer_status === 'REJECTED' ? 'bg-red-50 border-red-100' : 'bg-white border-slate-100'
                                                }`}>
                                                <div className="flex justify-between items-start mb-2">
                                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                        {co.counterparty} PROPOSAL
                                                    </span>
                                                    <span className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider border ${co.counteroffer_status === 'ACCEPTED' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                                                        co.counteroffer_status === 'PENDING' ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-slate-100 text-slate-500 border-slate-200'
                                                        }`}>
                                                        {co.counteroffer_status}
                                                    </span>
                                                </div>
                                                <div className="grid grid-cols-2 gap-4 mb-3">
                                                    <div>
                                                        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">Proposed Price</div>
                                                        <div className="text-lg font-black text-slate-900">{co.proposed_price} EUR</div>
                                                    </div>
                                                    <div>
                                                        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">Lead Time</div>
                                                        <div className="text-lg font-black text-slate-900">{co.proposed_lead_time_days} Days</div>
                                                    </div>
                                                </div>
                                                {co.proposed_notes && (
                                                    <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-100 text-xs text-slate-600 italic">
                                                        "{co.proposed_notes}"
                                                    </div>
                                                )}

                                                {co.counteroffer_status === 'PENDING' && co.counterparty === 'PRINTER' && (
                                                    <div className="mt-4 flex gap-3">
                                                        <button
                                                            onClick={() => handleAcceptCounter(co.offer_id, co.id)}
                                                            className="flex-1 py-2 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-emerald-600 transition-colors shadow-sm"
                                                        >
                                                            Accept Terms
                                                        </button>
                                                        <button className="flex-1 py-2 bg-white border border-slate-200 text-slate-600 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-red-50 hover:text-red-600 hover:border-red-100 transition-colors">
                                                            Reject
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="mt-2 text-[9px] text-slate-400 font-medium px-2">
                                                {new Date(co.created_at).toLocaleString()}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Readiness Controls */}
                            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm border-t-4 border-t-emerald-500">
                                <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-4 flex items-center gap-2">
                                    <ClipboardDocumentCheckIcon className="w-5 h-5 text-emerald-500" />
                                    Commercial Readiness
                                </h4>
                                <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                                    <p className="text-xs text-emerald-800 font-medium mb-4">
                                        Once terms are final, mark the session as commercially ready to prepare for settlement.
                                    </p>
                                    <button className="w-full py-3 bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-emerald-700 transition-all shadow-md active:scale-95 flex items-center justify-center gap-2">
                                        Mark Commercially Ready
                                        <ArrowRightIcon className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="h-full min-h-[400px] bg-slate-50/50 rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 space-y-3">
                            <BanknotesIcon className="w-12 h-12 opacity-20" />
                            <p className="font-black uppercase text-xs tracking-widest opacity-40">Select a negotiation to inspect history</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
