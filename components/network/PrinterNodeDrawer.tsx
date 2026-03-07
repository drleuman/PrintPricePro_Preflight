import React from "react";
import * as adminApi from "../../lib/adminApi";
import {
    XMarkIcon,
    BuildingOfficeIcon,
    CheckCircleIcon,
    XCircleIcon,
    CpuChipIcon,
    CalendarIcon,
    MapPinIcon,
    BoltIcon,
    GlobeAltIcon,
    QuestionMarkCircleIcon,
    ChartBarSquareIcon,
    SignalIcon,
    HeartIcon,
    ShieldCheckIcon,
    ExclamationTriangleIcon,
    RocketLaunchIcon
} from "@heroicons/react/24/outline";

interface Props {
    printerId: string | null;
    onClose: () => void;
    onAction: (id: string, action: 'approve' | 'suspend') => void;
}

export const PrinterNodeDrawer: React.FC<Props> = ({ printerId, onClose, onAction }) => {
    const [data, setData] = React.useState<any>(null);
    const [loading, setLoading] = React.useState(false);

    React.useEffect(() => {
        if (printerId) {
            setLoading(true);
            adminApi.getPrinters().then(printers => {
                const found = printers.find(p => p.id === printerId);
                if (found) {
                    // Fetch full detail if available, or use the object from list
                    // For now, list has most of what we need
                    setData({ profile: found.profile, id: found.id });
                }
                setLoading(false);
            }).catch(err => {
                console.error(err);
                setLoading(false);
            });
        }
    }, [printerId]);

    if (!printerId) return null;

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'ACTIVE': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
            case 'PENDING_REVIEW': return 'bg-amber-100 text-amber-700 border-amber-200';
            case 'SUSPENDED': return 'bg-rose-100 text-rose-700 border-rose-200';
            default: return 'bg-slate-100 text-slate-400 border-slate-200';
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex justify-end">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-fade-in" onClick={onClose} />
            <div className="relative w-full max-w-xl bg-slate-50 h-full shadow-2xl animate-slide-left overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-200 sticky top-0 bg-white/90 backdrop-blur-md z-10">
                    <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border-2 ${getStatusColor(data?.profile?.status)}`}>
                            <BuildingOfficeIcon className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-slate-900 tracking-tight">{data?.profile?.name || 'Loading...'}</h2>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Printer ID: {printerId}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                        <XMarkIcon className="w-6 h-6 text-slate-400" />
                    </button>
                </div>

                {loading ? (
                    <div className="p-20 flex flex-col items-center gap-4 text-slate-400">
                        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                        <span className="text-xs font-black uppercase tracking-widest">Loading node data...</span>
                    </div>
                ) : data && (
                    <div className="p-6 space-y-8 pb-20">
                        {/* Section 1: Actions & Summary */}
                        <div className="space-y-4">
                            <div className="flex gap-3">
                                {data.profile.status !== 'ACTIVE' ? (
                                    <button
                                        onClick={() => onAction(printerId, 'approve')}
                                        className="flex-1 flex items-center justify-center gap-2 px-6 py-4 bg-emerald-600 text-white rounded-2xl text-sm font-black hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200"
                                    >
                                        <CheckCircleIcon className="w-5 h-5" /> Approve & Enable Routing
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => onAction(printerId, 'suspend')}
                                        className="flex-1 flex items-center justify-center gap-2 px-6 py-4 bg-white border-2 border-rose-100 text-rose-600 rounded-2xl text-sm font-black hover:bg-rose-50 transition-all"
                                    >
                                        <XCircleIcon className="w-5 h-5" /> Suspend Operations
                                    </button>
                                )}
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                                <div className="p-3 bg-white rounded-xl border border-slate-200 text-center">
                                    <div className="text-[8px] font-black text-slate-400 uppercase mb-1">Status</div>
                                    <div className="text-xs font-bold text-slate-900">{data.profile.status}</div>
                                </div>
                                <div className="p-3 bg-white rounded-xl border border-slate-200 text-center">
                                    <div className="text-[8px] font-black text-slate-400 uppercase mb-1">Connect</div>
                                    <div className="text-xs font-bold text-slate-900">{data.profile.connect_status}</div>
                                </div>
                                <div className="p-3 bg-white rounded-xl border border-slate-200 text-center">
                                    <div className="text-[8px] font-black text-slate-400 uppercase mb-1">Quality</div>
                                    <div className="text-xs font-bold text-slate-900">{(data.profile.quality_score * 100).toFixed(0)}%</div>
                                </div>
                                <div className="p-3 bg-white rounded-xl border border-slate-200 text-center col-span-3">
                                    <div className="text-[8px] font-black text-slate-400 uppercase mb-1">Last API Sync</div>
                                    <div className="text-xs font-bold text-slate-900 flex items-center justify-center gap-2">
                                        <SignalIcon className={`w-3 h-3 ${data.profile.sync_status === 'HEALTHY' ? 'text-emerald-500' : 'text-rose-400'}`} />
                                        {data.profile.last_sync_at ? new Date(data.profile.last_sync_at).toLocaleString() : 'NEVER'}
                                        <span className={`ml-2 px-2 py-0.5 rounded-full text-[8px] font-black uppercase ${data.profile.sync_status === 'HEALTHY' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                                            {data.profile.sync_status}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Section 2: Hardware */}
                        <div className="space-y-3">
                            <h3 className="font-black text-slate-900 text-[10px] uppercase tracking-widest flex items-center gap-2">
                                <CpuChipIcon className="w-4 h-4 text-slate-400" />
                                Production Hardware
                            </h3>
                            <div className="grid gap-2">
                                {data.machines.map((m: any, idx: number) => (
                                    <div key={idx} className="bg-white p-4 rounded-xl border border-slate-200 flex items-center justify-between">
                                        <div>
                                            <div className="text-sm font-black text-slate-900">{m.nickname || m.name}</div>
                                            <div className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-2">
                                                {m.type} • {m.status}
                                                <span className={`flex items-center gap-1 ${m.machine_health === 'OK' ? 'text-emerald-500' : 'text-rose-500'}`}>
                                                    <HeartIcon className="w-3 h-3" /> {m.machine_health || 'UNKNOWN'}
                                                </span>
                                            </div>
                                            {m.last_status_update && (
                                                <div className="text-[8px] italic text-slate-400 mt-1 uppercase">Updated: {new Date(m.last_status_update).toLocaleTimeString()}</div>
                                            )}
                                        </div>
                                        <div className="text-xs font-heavy text-slate-500 bg-slate-50 px-2 py-1 rounded-md border border-slate-100 text-right">
                                            <div className="text-[8px] font-black text-slate-300 uppercase">Index</div>
                                            {m.capacity_index}
                                        </div>
                                    </div>
                                ))}
                                {data.machines.length === 0 && (
                                    <div className="p-6 text-center bg-slate-100/50 rounded-xl border border-slate-200 text-slate-400 text-[10px] uppercase font-black tracking-widest">
                                        No hardware registered
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Section 3: Capacity History */}
                        <div className="space-y-3">
                            <h3 className="font-black text-slate-900 text-[10px] uppercase tracking-widest flex items-center gap-2">
                                <CalendarIcon className="w-4 h-4 text-slate-400" />
                                Capacity Log (Last 7 Days)
                            </h3>
                            <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
                                {data.capacity.map((c: any, idx: number) => (
                                    <div key={idx} className="px-4 py-3 flex items-center justify-between">
                                        <div className="text-xs font-bold text-slate-700">{new Date(c.date).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}</div>
                                        <div className="flex items-center gap-6">
                                            <div className="text-right">
                                                <div className="text-[8px] font-black text-slate-400 uppercase">Available</div>
                                                <div className="text-xs font-black text-slate-900">{c.capacity_available}</div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-[8px] font-black text-slate-400 uppercase">Lead Time</div>
                                                <div className="text-xs font-black text-slate-600">{c.lead_time_days}d</div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {data.capacity.length === 0 && (
                                    <div className="p-6 text-center text-slate-400 text-[10px] uppercase font-black">No capacity data recorded</div>
                                )}
                            </div>
                        </div>

                        {/* Section 4: Active Reservations (Phase 27.2) */}
                        <div className="space-y-3">
                            <h3 className="font-black text-slate-900 text-[10px] uppercase tracking-widest flex items-center gap-2">
                                <BoltIcon className="w-4 h-4 text-amber-500" />
                                Active Capacity Reservations
                            </h3>
                            <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
                                {data.reservations && data.reservations.map((r: any, idx: number) => (
                                    <div key={idx} className="px-4 py-3 flex items-center justify-between bg-amber-50/30">
                                        <div>
                                            <div className="text-[10px] font-black text-slate-900 uppercase">Res ID: {r.id.split('-')[0]}</div>
                                            <div className="text-[8px] font-bold text-slate-400 uppercase">Job: {r.job_id.split('-')[0]} • Units: {r.reserved_units}</div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-[8px] font-black text-amber-600 uppercase">Expires In</div>
                                            <div className="text-[10px] font-black text-slate-900">
                                                {Math.max(0, Math.round((new Date(r.expires_at).getTime() - Date.now()) / 60000))} min
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Section 5: Assignment History (Phase 27.3) */}
                        <div className="space-y-3">
                            <h3 className="font-black text-slate-900 text-[10px] uppercase tracking-widest flex items-center gap-2">
                                <RocketLaunchIcon className="w-4 h-4 text-rose-500" />
                                Recent Dispatches
                            </h3>
                            <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
                                {data.assignments && data.assignments.map((a: any, idx: number) => (
                                    <div key={idx} className="px-4 py-3 flex items-center justify-between">
                                        <div>
                                            <div className="text-[10px] font-black text-slate-900 uppercase">Assignment ID: {a.id.split('-')[0]}</div>
                                            <div className="text-[8px] font-bold text-slate-400 uppercase">Job: {a.job_id.split('-')[0]} • Attempt: {a.dispatch_attempt}</div>
                                        </div>
                                        <div className="text-right">
                                            <div className={`text-[10px] font-black uppercase ${a.assignment_status === 'ACCEPTED' ? 'text-emerald-600' :
                                                a.assignment_status === 'REJECTED' ? 'text-rose-500' :
                                                    'text-amber-500'
                                                }`}>
                                                {a.assignment_status}
                                            </div>
                                            <div className="text-[8px] font-bold text-slate-400 uppercase">{new Date(a.created_at).toLocaleTimeString()}</div>
                                        </div>
                                    </div>
                                ))}
                                {(!data.assignments || data.assignments.length === 0) && (
                                    <div className="p-6 text-center text-slate-400 text-[10px] uppercase font-black">No recent assignments</div>
                                )}
                            </div>
                        </div>

                        {/* Section 5: Eligibility & Health */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-3">
                                <h3 className="font-black text-slate-900 text-[10px] uppercase tracking-widest flex items-center gap-2">
                                    <ShieldCheckIcon className="w-4 h-4 text-slate-400" />
                                    Eligibility Check
                                </h3>
                                <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-2">
                                    {data.eligibility.reasons.map((r: any, idx: number) => (
                                        <div key={idx} className="flex items-center justify-between">
                                            <span className="text-[10px] font-bold text-slate-500 uppercase">{r.label}</span>
                                            {r.met ? <CheckCircleIcon className="w-4 h-4 text-emerald-500" /> : <XCircleIcon className="w-4 h-4 text-rose-400" />}
                                        </div>
                                    ))}
                                    <div className={`mt-3 pt-3 border-t border-slate-100 text-center font-black text-[10px] tracking-widest ${data.eligibility.is_eligible ? 'text-emerald-600' : 'text-rose-500'}`}>
                                        {data.eligibility.is_eligible ? 'ROUTING ENABLED' : 'ROUTING DISABLED'}
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-3">
                                <h3 className="font-black text-slate-900 text-[10px] uppercase tracking-widest flex items-center gap-2">
                                    <BoltIcon className="w-4 h-4 text-rose-500" />
                                    Node Health
                                </h3>
                                <div className="space-y-2">
                                    {data.health_warnings.map((w: any, idx: number) => (
                                        <div key={idx} className={`p-3 rounded-xl border flex gap-2 ${w.severity === 'CRITICAL' ? 'bg-rose-50 border-rose-100 text-rose-700' : 'bg-amber-50 border-amber-100 text-amber-700'}`}>
                                            <ExclamationTriangleIcon className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                                            <div className="text-[10px] font-bold leading-tight">{w.message}</div>
                                        </div>
                                    ))}
                                    {data.health_warnings.length === 0 && (
                                        <div className="p-6 text-center bg-emerald-50 rounded-xl border border-emerald-100 text-emerald-600 text-[10px] font-black uppercase tracking-widest">
                                            Healthy
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Section 5: Historical Performance (Phase 26.2) */}
                        <div className="space-y-3">
                            <h3 className="font-black text-slate-900 text-[10px] uppercase tracking-widest flex items-center gap-2">
                                <ChartBarSquareIcon className="w-4 h-4 text-indigo-500" />
                                Historical Performance
                            </h3>
                            <div className="bg-indigo-900 rounded-2xl p-6 text-white shadow-xl shadow-indigo-100">
                                <div className="grid grid-cols-2 gap-8 mb-6">
                                    <div>
                                        <div className="text-[8px] font-black text-indigo-300 uppercase tracking-widest mb-1">Jobs Processed</div>
                                        <div className="text-3xl font-black">{data.performance?.jobs_processed || 0}</div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-[8px] font-black text-indigo-300 uppercase tracking-widest mb-1">Success Rate</div>
                                        <div className="text-3xl font-black text-emerald-400">
                                            {((data.performance?.jobs_success / (data.performance?.jobs_processed || 1)) * 100 || 100).toFixed(0)}%
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-4 pt-6 border-t border-indigo-800">
                                    <div className="flex items-center justify-between text-[10px]">
                                        <span className="font-bold uppercase text-indigo-300 tracking-wider">On-Time Delivery</span>
                                        <span className="font-black">{(data.performance?.on_time_delivery_rate * 100 || 100).toFixed(0)}%</span>
                                    </div>
                                    <div className="w-full bg-indigo-800 h-1.5 rounded-full overflow-hidden">
                                        <div
                                            className="bg-emerald-400 h-full transition-all duration-1000"
                                            style={{ width: `${(data.performance?.on_time_delivery_rate * 100 || 100)}%` }}
                                        />
                                    </div>
                                    <div className="flex items-center justify-between text-[10px]">
                                        <span className="font-bold uppercase text-indigo-300 tracking-wider">Reprint Rate</span>
                                        <span className={`font-black ${data.performance?.reprint_rate > 0.05 ? 'text-rose-400' : 'text-indigo-100'}`}>
                                            {(data.performance?.reprint_rate * 100 || 0).toFixed(1)}%
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Section 6: Regions */}
                        <div className="space-y-3">
                            <h3 className="font-black text-slate-900 text-[10px] uppercase tracking-widest flex items-center gap-2">
                                <GlobeAltIcon className="w-4 h-4 text-slate-400" />
                                Service Regions
                            </h3>
                            <div className="flex flex-wrap gap-2">
                                {data.service_regions.map((r: any, idx: number) => (
                                    <span key={idx} className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600">
                                        {r.region} ({r.country})
                                    </span>
                                ))}
                                {data.service_regions.length === 0 && (
                                    <div className="w-full p-4 text-center bg-slate-100 rounded-xl text-slate-400 text-[10px] font-black uppercase">No regions defined</div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div >
    );
};

// Imports stabilized
