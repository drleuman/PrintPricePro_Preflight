import React, { useState } from "react";
import { t } from "../../i18n";
import {
    pauseQueue, resumeQueue, drainQueue, obliterateQueue,
    enableQuarantine, disableQuarantine, getQuarantineList,
    retryJob, cancelJob, getAdminQueueStats
} from "../../lib/adminApi";
import { useAdminQuery } from "../../hooks/useAdminData";
import {
    PauseIcon,
    PlayIcon,
    TrashIcon,
    ShieldExclamationIcon,
    ArrowPathRoundedSquareIcon,
    NoSymbolIcon,
    FireIcon,
    BriefcaseIcon,
    ClockIcon,
    ExclamationTriangleIcon,
    CheckCircleIcon,
    XCircleIcon,
    WrenchScrewdriverIcon
} from "@heroicons/react/24/outline";

export const ControlsTab: React.FC<{ refreshMs?: number }> = ({ refreshMs = 0 }) => {
    // Queries
    const qStats = useAdminQuery('queue:stats', () => getAdminQueueStats(), refreshMs);
    const qQuarantine = useAdminQuery('tenants:quarantine', () => getQuarantineList(), refreshMs);

    // Form states
    const [queueTarget, setQueueTarget] = useState<'preflight' | 'autofix'>('preflight');
    const [queueReason, setQueueReason] = useState("");

    const [tenantId, setTenantId] = useState("");
    const [quarantineTtl, setQuarantineTtl] = useState(120);
    const [tenantReason, setTenantReason] = useState("");

    const [dangerDrainDelayed, setDangerDrainDelayed] = useState(false);
    const [dangerObliterateConfirm, setDangerObliterateConfirm] = useState("");

    const [jobId, setJobId] = useState("");
    const [jobReason, setJobReason] = useState("");

    // Modal state
    const [modal, setModal] = useState<{
        action: string;
        desc: string;
        onConfirm: () => Promise<any>;
        danger?: boolean;
    } | null>(null);

    const [actionStatus, setActionStatus] = useState<{ msg: string, isError: boolean } | null>(null);

    const handleAction = async () => {
        if (!modal) return;
        setActionStatus(null);
        try {
            await modal.onConfirm();
            setActionStatus({ msg: `Success: ${modal.action}`, isError: false });
        } catch (e: any) {
            setActionStatus({ msg: `Failed: ${e.message}`, isError: true });
        } finally {
            setModal(null);
        }
    };

    const confirmAction = (action: string, desc: string, onConfirm: () => Promise<any>, danger = false) => {
        setModal({ action, desc, onConfirm, danger });
    };

    return (
        <div className="space-y-8">
            {actionStatus && (
                <div className={`p-4 rounded-xl shadow-sm border animate-slide-fade flex items-center gap-3 ${actionStatus.isError ? 'bg-red-50 border-red-200 text-red-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}>
                    {actionStatus.isError ? <XCircleIcon className="w-5 h-5" /> : <CheckCircleIcon className="w-5 h-5" />}
                    <span className="font-semibold text-sm">{actionStatus.msg}</span>
                    <button onClick={() => setActionStatus(null)} className="ml-auto hover:opacity-70">
                        <XCircleIcon className="w-4 h-4" />
                    </button>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                {/* 1. Queue Controls */}
                <div className="glass rounded-2xl p-6 hover-slide border border-white">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
                            <ArrowPathRoundedSquareIcon className="w-5 h-5 text-indigo-600" />
                        </div>
                        <h2 className="text-lg font-bold text-slate-800 tracking-tight">Queue Engine</h2>
                        <a href="/admin/help?doc=control-pause-queue" className="ml-auto flex items-center gap-1 text-xs text-blue-600 hover:underline bg-blue-50 px-2 flex-shrink-0 py-1 rounded-md font-medium border border-blue-100">
                            ℹ Explain Controls
                        </a>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-6">
                        <div className={`p-4 rounded-xl border transition-all duration-300 ${qStats.data?.stats?.paused?.preflight ? 'bg-amber-50/50 border-amber-200 animate-pulse-glow-red' : 'bg-emerald-50/50 border-emerald-200 animate-pulse-glow-green'}`}>
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Preflight</span>
                                <div className={`w-2 h-2 rounded-full ${qStats.data?.stats?.paused?.preflight ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                            </div>
                            <span className={`text-sm font-bold ${qStats.data?.stats?.paused?.preflight ? 'text-amber-700' : 'text-emerald-700'}`}>
                                {qStats.data?.stats?.paused?.preflight ? "PAUSED" : "OPERATIONAL"}
                            </span>
                        </div>
                        <div className={`p-4 rounded-xl border transition-all duration-300 ${qStats.data?.stats?.paused?.autofix ? 'bg-amber-50/50 border-amber-200 animate-pulse-glow-red' : 'bg-emerald-50/50 border-emerald-200 animate-pulse-glow-green'}`}>
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Autofix</span>
                                <div className={`w-2 h-2 rounded-full ${qStats.data?.stats?.paused?.autofix ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                            </div>
                            <span className={`text-sm font-bold ${qStats.data?.stats?.paused?.autofix ? 'text-amber-700' : 'text-emerald-700'}`}>
                                {qStats.data?.stats?.paused?.autofix ? "PAUSED" : "OPERATIONAL"}
                            </span>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="group relative">
                            <select className="w-full bg-slate-50/50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all appearance-none cursor-pointer" value={queueTarget} onChange={e => setQueueTarget(e.target.value as any)}>
                                <option value="preflight">Preflight Worker Queue</option>
                                <option value="autofix">Autofix Engine Queue</option>
                            </select>
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                <ArrowPathRoundedSquareIcon className="w-4 h-4" />
                            </div>
                        </div>

                        <div className="relative">
                            <input type="text" placeholder="Mandatory reason for audit..." className="w-full bg-slate-50/50 border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all" value={queueReason} onChange={e => setQueueReason(e.target.value)} />
                        </div>

                        <div className="flex gap-3">
                            <button
                                className="flex-1 flex items-center justify-center gap-2 bg-amber-500 text-white py-3 rounded-xl text-sm font-bold shadow-lg shadow-amber-500/20 hover:bg-amber-600 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:grayscale"
                                disabled={!queueReason}
                                onClick={() => confirmAction('Emergency Pause', `Halting ${queueTarget} processor. Incoming jobs will be queued but not handled.`, () => pauseQueue(queueTarget, queueReason))}
                            >
                                <PauseIcon className="w-4 h-4" />
                                Pause
                            </button>
                            <button
                                className="flex-1 flex items-center justify-center gap-2 bg-emerald-500 text-white py-3 rounded-xl text-sm font-bold shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:grayscale"
                                disabled={!queueReason}
                                onClick={() => confirmAction('Resume Engine', `Restarting ${queueTarget} processing.`, () => resumeQueue(queueTarget, queueReason))}
                            >
                                <PlayIcon className="w-4 h-4" />
                                Resume
                            </button>
                        </div>
                    </div>
                </div>

                {/* 2. Tenant Quarantine Controls */}
                <div className="glass rounded-2xl p-6 hover-slide border border-white">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center">
                            <NoSymbolIcon className="w-5 h-5 text-red-600" />
                        </div>
                        <h2 className="text-lg font-bold text-slate-800 tracking-tight">Access Control (Quarantine)</h2>
                    </div>

                    <div className="space-y-4">
                        <div className="relative">
                            <input type="text" placeholder="Tenant Identifier (UUID/ID)" className="w-full bg-slate-50/50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-mono outline-none focus:ring-2 focus:ring-red-500/20 transition-all" value={tenantId} onChange={e => setTenantId(e.target.value)} />
                        </div>
                        <div className="flex gap-2">
                            <div className="w-32">
                                <select className="w-full bg-slate-50/50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-red-500/20 transition-all cursor-pointer" value={quarantineTtl} onChange={e => setQuarantineTtl(Number(e.target.value))}>
                                    <option value={30}>30m</option>
                                    <option value={60}>1h</option>
                                    <option value={120}>2h</option>
                                    <option value={720}>12h</option>
                                </select>
                            </div>
                            <input type="text" placeholder="Reason for quarantine..." className="flex-1 bg-slate-50/50 border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-red-500/20 transition-all" value={tenantReason} onChange={e => setTenantReason(e.target.value)} />
                        </div>

                        <div className="flex gap-3">
                            <button
                                className="flex-1 flex items-center justify-center gap-2 bg-red-600 text-white py-3 rounded-xl text-sm font-bold shadow-lg shadow-red-600/20 hover:bg-red-700 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:grayscale"
                                disabled={!tenantReason || !tenantId}
                                onClick={() => confirmAction('Enable Quarantine', `Immediate isolation of tenant ${tenantId} for ${quarantineTtl} minutes. New ingestion will return 403 Forbidden.`, () => enableQuarantine(tenantId, quarantineTtl, tenantReason))}
                            >
                                <ShieldExclamationIcon className="w-4 h-4" />
                                Quarantine
                            </button>
                            <button
                                className="flex-1 flex items-center justify-center gap-2 bg-slate-800 text-white py-3 rounded-xl text-sm font-bold shadow-lg shadow-slate-800/20 hover:bg-slate-900 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                                disabled={!tenantReason || !tenantId}
                                onClick={() => confirmAction('Lift Isolation', `Restore platform access for tenant ${tenantId}.`, () => disableQuarantine(tenantId, tenantReason))}
                            >
                                <CheckCircleIcon className="w-4 h-4" />
                                Unblock
                            </button>
                        </div>
                    </div>

                    {/* Active Quarantines */}
                    {qQuarantine.data?.items && qQuarantine.data.items.length > 0 && (
                        <div className="mt-8 pt-6 border-t border-slate-100/50">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Isolated Targets</h3>
                                <span className="bg-red-100 text-red-700 text-[10px] font-bold px-2 py-0.5 rounded-full">{qQuarantine.data.items.length} ACTIVE</span>
                            </div>
                            <div className="max-h-32 overflow-y-auto space-y-2 pr-2 scrollbar-thin">
                                {qQuarantine.data.items.map((q: any) => (
                                    <div key={q.tenant_id} className="group p-3 bg-red-500/5 hover:bg-red-500/10 border border-red-500/10 rounded-xl flex justify-between items-center transition-all">
                                        <div className="flex flex-col">
                                            <span className="font-mono text-xs font-bold text-red-900">{q.tenant_id}</span>
                                            <div className="flex items-center gap-1 mt-1 text-[10px] text-slate-500">
                                                <ClockIcon className="w-3 h-3" />
                                                <span>Expires: {new Date(q.quarantined_until).toLocaleTimeString()}</span>
                                            </div>
                                        </div>
                                        <button
                                            className="opacity-0 group-hover:opacity-100 bg-white text-red-600 p-1.5 rounded-lg shadow-sm border border-red-100 hover:bg-red-50 transition-all"
                                            onClick={() => { setTenantId(q.tenant_id); setTenantReason('Manual early lift'); }}
                                        >
                                            <WrenchScrewdriverIcon className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* 3. Targeted Job Controls */}
                <div className="glass rounded-2xl p-6 hover-slide border border-white">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-8 h-8 rounded-lg bg-sky-50 flex items-center justify-center">
                            <BriefcaseIcon className="w-5 h-5 text-sky-600" />
                        </div>
                        <h2 className="text-lg font-bold text-slate-800 tracking-tight">Precision Operations</h2>
                    </div>

                    <div className="space-y-4">
                        <div className="relative">
                            <input type="text" placeholder="Target Job Transaction ID" className="w-full bg-slate-50/50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-mono outline-none focus:ring-2 focus:ring-sky-500/20 transition-all" value={jobId} onChange={e => setJobId(e.target.value)} />
                        </div>
                        <div className="relative">
                            <input type="text" placeholder="Context for retry/cancel..." className="w-full bg-slate-50/50 border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-sky-500/20 transition-all" value={jobReason} onChange={e => setJobReason(e.target.value)} />
                        </div>

                        <div className="flex gap-3">
                            <button
                                className="flex-1 flex items-center justify-center gap-2 bg-white text-slate-700 py-3 rounded-xl text-sm font-bold shadow-sm border border-slate-200 hover:bg-slate-50 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                                disabled={!jobReason || !jobId}
                                onClick={() => confirmAction('Retry Execution', `Re-enqueue job ${jobId}. This creates a new job record derived from the original payload.`, () => retryJob(jobId, jobReason))}
                            >
                                <ArrowPathRoundedSquareIcon className="w-4 h-4 text-sky-500" />
                                Retry
                            </button>
                            <button
                                className="flex-1 flex items-center justify-center gap-2 bg-sky-50 text-sky-700 py-3 rounded-xl text-sm font-bold shadow-sm border border-sky-100 hover:bg-sky-100 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                                disabled={!jobReason || !jobId}
                                onClick={() => confirmAction('Abort Process', `Cancel job ${jobId}. If running, workers will attempt to stop processing.`, () => cancelJob(jobId, jobReason))}
                            >
                                <NoSymbolIcon className="w-4 h-4" />
                                Kill Job
                            </button>
                        </div>
                    </div>
                </div>

                {/* 4. Danger Zone */}
                <div className="danger-glow bg-red-500/[0.02] rounded-2xl p-6 border border-red-500/20 transition-all duration-500 group overflow-hidden relative">
                    {/* Decorative warning stripes */}
                    <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/5 -rotate-45 translate-x-12 -translate-y-12 blur-2xl group-hover:bg-red-500/10 transition-colors" />

                    <div className="flex items-center gap-3 mb-6 relative z-10">
                        <div className="w-8 h-8 rounded-lg bg-red-600 flex items-center justify-center shadow-lg shadow-red-600/30">
                            <FireIcon className="w-5 h-5 text-white" />
                        </div>
                        <h2 className="text-lg font-bold text-red-900 tracking-tight underline decoration-red-500/30 underline-offset-4">CRITICAL OVERRIDE</h2>
                    </div>

                    <div className="space-y-8 relative z-10">
                        {/* Drain */}
                        <div className="bg-white/40 backdrop-blur-sm p-4 rounded-xl border border-red-200/50">
                            <h3 className="text-sm font-bold text-red-900 mb-2 flex items-center gap-2">
                                <TrashIcon className="w-4 h-4" />
                                Wipe Waiting Queue
                                <a href="/admin/help?doc=control-drain-queue" className="ml-auto text-xs text-red-600 hover:underline bg-white/60 px-2 py-1 flex-shrink-0 rounded-md font-bold shadow-sm border border-red-200">
                                    ℹ Explain Risk
                                </a>
                            </h3>
                            <p className="text-[11px] font-medium text-red-700 mb-4 leading-relaxed">Instantly purge all <span className="font-bold">WAITING</span> tasks. Running workers are unaffected but no new work will proceed from the backlog.</p>

                            <div className="flex flex-col sm:flex-row items-center gap-3 mb-4">
                                <select className="w-full sm:flex-1 bg-white border border-red-200 rounded-lg px-4 py-2.5 text-xs font-bold text-red-900 outline-none" value={queueTarget} onChange={e => setQueueTarget(e.target.value as any)}>
                                    <option value="preflight">PREFLIGHT-V2</option>
                                    <option value="autofix">AUTOFIX-V2</option>
                                </select>
                                <label className="w-full sm:w-auto flex items-center justify-center gap-2 bg-white px-4 py-2.5 rounded-lg border border-red-200 text-xs font-bold text-red-800 cursor-pointer hover:bg-red-50 transition-all">
                                    <input type="checkbox" className="accent-red-600" checked={dangerDrainDelayed} onChange={e => setDangerDrainDelayed(e.target.checked)} />
                                    Purge Delayed
                                </label>
                            </div>

                            <button
                                className="w-full bg-red-600 text-white py-2.5 rounded-lg text-xs font-black uppercase tracking-widest shadow-lg shadow-red-600/20 hover:bg-red-700 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-30 disabled:grayscale"
                                disabled={!queueReason}
                                onClick={() => confirmAction('PURGE QUEUE ☢️', `IRREVERSIBLE: This will remove all waiting jobs from ${queueTarget}.`, () => drainQueue(queueTarget, dangerDrainDelayed, queueReason), true)}
                            >
                                EXECUTE DRAIN
                            </button>
                        </div>

                        {/* Obliterate */}
                        <div className="pt-2">
                            <h3 className="text-sm font-bold text-red-900 mb-2 flex items-center gap-2">
                                <ShieldExclamationIcon className="w-4 h-4 text-red-600" />
                                Factory Reset Queue
                            </h3>
                            <p className="text-[11px] font-medium text-red-600/80 mb-4 leading-relaxed">Complete destruction of queue metadata. Use only for fatal recovery scenarios.</p>

                            <div className="flex flex-col gap-3">
                                <input
                                    type="text"
                                    placeholder="TYPE 'OBLITERATE' TO UNLOCK"
                                    className="w-full bg-white border border-red-400/50 rounded-lg px-4 py-3 text-xs font-black tracking-widest uppercase placeholder-red-200 text-red-900 outline-none focus:border-red-600 transition-all shadow-inner"
                                    value={dangerObliterateConfirm}
                                    onChange={e => setDangerObliterateConfirm(e.target.value)}
                                />
                                <button
                                    className="w-full bg-slate-900 text-red-500 py-3 rounded-lg text-xs font-black tracking-[0.2em] uppercase hover:bg-black transition-all hover:text-red-400 disabled:opacity-20 disabled:grayscale border-b-2 border-red-900"
                                    disabled={dangerObliterateConfirm !== 'OBLITERATE' || !queueReason}
                                    onClick={() => {
                                        confirmAction('OBLITERATE SYSTEM 💀', `CRITICAL DESTRUCTION: State reset for ${queueTarget}.`, () => obliterateQueue(queueTarget, queueReason), true);
                                        setDangerObliterateConfirm('');
                                    }}
                                >
                                    Iniciate Obliteration
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

            </div>

            {/* Modal Focus Overlay */}
            {modal && (
                <div className="fixed inset-0 bg-slate-950/80 flex items-center justify-center p-4 z-[100] backdrop-blur-md animate-fade-in">
                    <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 border border-white/20 animate-slide-fade">
                        <div className={`w-16 h-16 rounded-2xl mb-6 flex items-center justify-center ${modal.danger ? 'bg-red-100 text-red-600' : 'bg-primary/10 text-primary'}`}>
                            {modal.danger ? <ExclamationTriangleIcon className="w-8 h-8" /> : <ShieldExclamationIcon className="w-8 h-8" />}
                        </div>
                        <h2 className={`text-2xl font-black mb-4 tracking-tight ${modal.danger ? 'text-red-700' : 'text-slate-900'}`}>{modal.action}</h2>
                        <p className="text-slate-500 text-sm font-medium leading-relaxed mb-8">{modal.desc}</p>

                        <div className="flex gap-4">
                            <button
                                className="flex-1 px-4 py-3 text-sm font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all"
                                onClick={() => setModal(null)}
                            >
                                Abort
                            </button>
                            <button
                                className={`flex-[1.5] px-4 py-3 rounded-xl text-sm font-black text-white shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98] ${modal.danger ? 'bg-red-600 shadow-red-600/30 hover:bg-red-700' : 'bg-primary shadow-primary/30 hover:bg-primary-dark'}`}
                                onClick={handleAction}
                            >
                                Confirm Command
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
