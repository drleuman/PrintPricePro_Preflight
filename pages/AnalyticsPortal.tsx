import React, { useEffect, useState, useCallback } from 'react';
import {
    ChartBarIcon, BoltIcon, ClockIcon, BanknotesIcon,
    ShieldCheckIcon, ArrowTrendingUpIcon, DocumentCheckIcon,
    CheckCircleIcon, ExclamationTriangleIcon, CalendarIcon,
    ArrowDownTrayIcon, ArrowPathIcon
} from '@heroicons/react/24/outline';

// ─── Types ────────────────────────────────────────────────────
interface Summary {
    tenant_id: string;
    range: string;
    total_jobs: number;
    total_batches: number;
    success_rate: number;
    hours_saved_total: number;
    value_generated_total: number;
    avg_risk_score_before: number;
    avg_risk_score_after: number;
    avg_risk_reduction: number;
}
interface TimePoint { date: string; jobs: number; hours_saved: number; value_generated: number; avg_risk_reduction: number; }
interface PolicyRow { policy_slug: string; jobs: number; hours_saved: number; value_generated: number; avg_risk_reduction: number; success_rate: number; }
interface ErrorRow { error_message: string; count: number; last_seen: string; }
interface BatchRow { batch_id: string; status: string; policy: string; total_jobs: number; completed_jobs: number; failed_jobs: number; hours_saved_total: number; value_generated_total: number; risk_reduction: number; created_at: string; links: { download: string }; }

type Range = '7d' | '30d' | '90d';
const BASE = '/api/v2/analytics';
const API_KEY = localStorage.getItem('ppp_api_key') || '';

// ─── Fetch helper ─────────────────────────────────────────────
async function fetchAnalytics<T>(endpoint: string, range: Range): Promise<T> {
    const res = await fetch(`${BASE}/${endpoint}?range=${range}`, {
        headers: { Authorization: `Bearer ${API_KEY}` }
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}

// ─── Sub-components ───────────────────────────────────────────
function KpiCard({ icon: Icon, label, value, sub, color = 'indigo' }: {
    icon: React.ElementType; label: string; value: string; sub?: string; color?: string;
}) {
    const colors: Record<string, string> = {
        indigo: 'from-indigo-500 to-indigo-600',
        emerald: 'from-emerald-500 to-emerald-600',
        amber: 'from-amber-500 to-amber-600',
        violet: 'from-violet-500 to-violet-600',
        blue: 'from-blue-500 to-blue-600',
        rose: 'from-rose-500 to-rose-600'
    };
    return (
        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-0.5">
            <div className="flex items-start justify-between mb-4">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${colors[color] || colors.indigo} flex items-center justify-center shadow-sm`}>
                    <Icon className="w-5 h-5 text-white" />
                </div>
            </div>
            <p className="text-sm font-medium text-slate-500 mb-1">{label}</p>
            <p className="text-2xl font-bold text-slate-900 tracking-tight">{value}</p>
            {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
        </div>
    );
}

function RangeSelector({ range, onChange }: { range: Range; onChange: (r: Range) => void }) {
    const opts: Range[] = ['7d', '30d', '90d'];
    return (
        <div className="flex bg-slate-100 rounded-xl p-1 gap-1">
            {opts.map(r => (
                <button key={r} onClick={() => onChange(r)}
                    className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${range === r
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'}`}
                >{r}</button>
            ))}
        </div>
    );
}

function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
    const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
    return (
        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
        </div>
    );
}

function StatusBadge({ status }: { status: string }) {
    const map: Record<string, string> = {
        SUCCEEDED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        PARTIAL: 'bg-amber-50 text-amber-700 border-amber-200',
        FAILED: 'bg-rose-50 text-rose-700 border-rose-200',
        RUNNING: 'bg-blue-50 text-blue-700 border-blue-200',
        QUEUED: 'bg-slate-50 text-slate-600 border-slate-200',
    };
    return (
        <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${map[status] || 'bg-slate-50 text-slate-600 border-slate-200'}`}>
            {status}
        </span>
    );
}

// ─── ApiKeyGate ───────────────────────────────────────────────
function ApiKeyGate({ onKeySet }: { onKeySet: (k: string) => void }) {
    const [input, setInput] = useState('');
    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-lg p-8 max-w-md w-full">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center mb-6">
                    <ShieldCheckIcon className="w-6 h-6 text-white" />
                </div>
                <h1 className="text-xl font-bold text-slate-900 mb-1">Print Analytics Portal</h1>
                <p className="text-slate-500 text-sm mb-6">Enter your API key to access your analytics dashboard.</p>
                <input
                    className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-mono mb-4 outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400"
                    placeholder="ppk_live_xxxxxxxxxxxxxxxx"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && onKeySet(input)}
                />
                <button
                    onClick={() => onKeySet(input)}
                    className="w-full bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-semibold py-3 rounded-xl hover:opacity-90 transition-opacity"
                >
                    Access Dashboard
                </button>
            </div>
        </div>
    );
}

// ─── Main Portal ──────────────────────────────────────────────
export function AnalyticsPortal() {
    const [apiKey, setApiKey] = useState(API_KEY);
    const [range, setRange] = useState<Range>('30d');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const [summary, setSummary] = useState<Summary | null>(null);
    const [timeseries, setTimeseries] = useState<TimePoint[]>([]);
    const [policies, setPolicies] = useState<PolicyRow[]>([]);
    const [errors, setErrors] = useState<ErrorRow[]>([]);
    const [batches, setBatches] = useState<BatchRow[]>([]);

    const load = useCallback(async (key: string, r: Range) => {
        if (!key) return;
        localStorage.setItem('ppp_api_key', key);
        setLoading(true);
        setError('');
        try {
            const headers = { Authorization: `Bearer ${key}` };
            const [s, ts, p, e, b] = await Promise.all([
                fetch(`${BASE}/summary?range=${r}`, { headers }).then(r => r.json()),
                fetch(`${BASE}/timeseries?range=${r}`, { headers }).then(r => r.json()),
                fetch(`${BASE}/policies?range=${r}`, { headers }).then(r => r.json()),
                fetch(`${BASE}/errors?range=${r}`, { headers }).then(r => r.json()),
                fetch(`${BASE}/batches?range=${r}`, { headers }).then(r => r.json()),
            ]);
            if (s.error) throw new Error(s.error);
            setSummary(s);
            setTimeseries(ts.data || []);
            setPolicies(p.policies || []);
            setErrors(e.errors || []);
            setBatches(b.batches || []);
        } catch (err: any) {
            setError(err.message || 'Failed to load analytics');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { if (apiKey) load(apiKey, range); }, [apiKey, range, load]);

    if (!apiKey) return <ApiKeyGate onKeySet={k => { setApiKey(k); load(k, range); }} />;

    const maxValue = Math.max(...timeseries.map(t => t.value_generated), 1);
    const maxJobs = Math.max(...timeseries.map(t => t.jobs), 1);

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 font-sans">
            {/* Header */}
            <header className="border-b border-slate-200 bg-white/80 backdrop-blur sticky top-0 z-40">
                <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
                            <ChartBarIcon className="w-4 h-4 text-white" />
                        </div>
                        <div>
                            <h1 className="text-sm font-bold text-slate-900">Print Intelligence Analytics</h1>
                            {summary && <p className="text-xs text-slate-400">{summary.tenant_id}</p>}
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <RangeSelector range={range} onChange={setRange} />
                        <button onClick={() => load(apiKey, range)}
                            className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors">
                            <ArrowPathIcon className={`w-4 h-4 text-slate-600 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
                {error && (
                    <div className="bg-rose-50 border border-rose-200 rounded-xl px-5 py-4 text-rose-700 text-sm font-medium">
                        {error}
                    </div>
                )}

                {/* Value Banner */}
                {summary && summary.value_generated_total > 0 && (
                    <div className="bg-gradient-to-r from-indigo-600 to-violet-600 rounded-2xl p-6 text-white">
                        <p className="text-indigo-200 text-sm font-medium mb-1">ROI Generated</p>
                        <p className="text-3xl font-black">
                            PrintPrice has generated <span className="text-yellow-300">${summary.value_generated_total.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span> in prepress efficiency value for your organization.
                        </p>
                        <p className="text-indigo-300 text-sm mt-2">Last {range} • {summary.total_jobs.toLocaleString()} jobs processed</p>
                    </div>
                )}

                {/* KPI Cards */}
                {summary && (
                    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
                        <KpiCard icon={DocumentCheckIcon} label="Total Jobs" value={summary.total_jobs.toLocaleString()} color="indigo" />
                        <KpiCard icon={CalendarIcon} label="Total Batches" value={summary.total_batches.toLocaleString()} color="blue" />
                        <KpiCard icon={CheckCircleIcon} label="Success Rate" value={`${summary.success_rate.toFixed(1)}%`} color="emerald" />
                        <KpiCard icon={ClockIcon} label="Hours Saved" value={`${summary.hours_saved_total.toFixed(1)}h`} sub="prepress time" color="amber" />
                        <KpiCard icon={BanknotesIcon} label="Value Generated" value={`$${Math.round(summary.value_generated_total).toLocaleString()}`} sub="USD ROI" color="emerald" />
                        <KpiCard icon={ShieldCheckIcon} label="Risk Reduction" value={`${summary.avg_risk_reduction} pts`} sub={`${summary.avg_risk_score_before}→${summary.avg_risk_score_after}`} color="violet" />
                    </div>
                )}

                {/* Timeseries */}
                {timeseries.length > 0 && (
                    <section className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
                        <h2 className="text-sm font-bold text-slate-700 mb-5 flex items-center gap-2">
                            <ArrowTrendingUpIcon className="w-4 h-4 text-indigo-500" /> Activity — Last {range}
                        </h2>
                        <div className="space-y-2">
                            {timeseries.map(t => (
                                <div key={t.date} className="grid grid-cols-[100px_1fr_1fr_80px_80px] gap-3 items-center text-xs">
                                    <span className="text-slate-400 font-mono">{t.date}</span>
                                    <div className="space-y-0.5">
                                        <MiniBar value={t.jobs} max={maxJobs} color="bg-indigo-400" />
                                        <span className="text-slate-400">{t.jobs} jobs</span>
                                    </div>
                                    <div className="space-y-0.5">
                                        <MiniBar value={t.value_generated} max={maxValue} color="bg-emerald-400" />
                                        <span className="text-slate-400">${Math.round(t.value_generated)}</span>
                                    </div>
                                    <span className="text-right text-amber-600 font-semibold">{t.hours_saved.toFixed(1)}h</span>
                                    <span className="text-right text-violet-600 font-semibold">-{t.avg_risk_reduction}pts</span>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* Policies + Errors */}
                <div className="grid md:grid-cols-2 gap-6">
                    {/* Policy Performance */}
                    {policies.length > 0 && (
                        <section className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
                            <h2 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
                                <BoltIcon className="w-4 h-4 text-amber-500" /> Policy Performance
                            </h2>
                            <div className="space-y-3">
                                {policies.map(p => (
                                    <div key={p.policy_slug} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                                        <div>
                                            <p className="font-semibold text-sm text-slate-800">{p.policy_slug}</p>
                                            <p className="text-xs text-slate-400">{p.jobs} jobs · {p.success_rate.toFixed(1)}% ok</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm font-bold text-emerald-600">${Math.round(p.value_generated).toLocaleString()}</p>
                                            <p className="text-xs text-violet-500">-{p.avg_risk_reduction}pts risk</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* Top Errors */}
                    {errors.length > 0 && (
                        <section className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
                            <h2 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
                                <ExclamationTriangleIcon className="w-4 h-4 text-rose-500" /> Top Errors
                            </h2>
                            <div className="space-y-3">
                                {errors.map((e, i) => (
                                    <div key={i} className="flex items-center gap-3 py-2 border-b border-slate-50 last:border-0">
                                        <span className="w-6 h-6 rounded-full bg-rose-50 text-rose-600 text-xs font-bold flex items-center justify-center flex-shrink-0">{e.count}</span>
                                        <div className="min-w-0">
                                            <p className="text-xs font-mono text-slate-700 truncate">{e.error_message}</p>
                                            <p className="text-xs text-slate-400">{new Date(e.last_seen).toLocaleDateString()}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}
                </div>

                {/* Batch History */}
                {batches.length > 0 && (
                    <section className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
                            <CalendarIcon className="w-4 h-4 text-blue-500" />
                            <h2 className="text-sm font-bold text-slate-700">Batch History</h2>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50">
                                    <tr className="text-left text-xs font-semibold text-slate-500">
                                        <th className="px-6 py-3">Batch</th>
                                        <th className="px-4 py-3">Status</th>
                                        <th className="px-4 py-3 text-right">Jobs</th>
                                        <th className="px-4 py-3 text-right">Value</th>
                                        <th className="px-4 py-3 text-right">Saved</th>
                                        <th className="px-4 py-3 text-right">Risk ↓</th>
                                        <th className="px-4 py-3 text-right">Download</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {batches.map(b => (
                                        <tr key={b.batch_id} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-6 py-3">
                                                <p className="font-mono text-xs text-slate-700">{b.batch_id.slice(0, 18)}…</p>
                                                <p className="text-xs text-slate-400">{new Date(b.created_at).toLocaleDateString()}</p>
                                            </td>
                                            <td className="px-4 py-3"><StatusBadge status={b.status} /></td>
                                            <td className="px-4 py-3 text-right">
                                                <span className="text-slate-700 font-semibold">{b.completed_jobs}</span>
                                                <span className="text-slate-400">/{b.total_jobs}</span>
                                            </td>
                                            <td className="px-4 py-3 text-right font-bold text-emerald-600">${Math.round(b.value_generated_total).toLocaleString()}</td>
                                            <td className="px-4 py-3 text-right font-semibold text-amber-600">{b.hours_saved_total.toFixed(1)}h</td>
                                            <td className="px-4 py-3 text-right font-semibold text-violet-600">-{b.risk_reduction}pts</td>
                                            <td className="px-4 py-3 text-right">
                                                {['SUCCEEDED', 'PARTIAL'].includes(b.status) && (
                                                    <a
                                                        href={b.links.download}
                                                        className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700 bg-indigo-50 px-3 py-1 rounded-lg"
                                                        download
                                                    >
                                                        <ArrowDownTrayIcon className="w-3 h-3" /> ZIP
                                                    </a>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </section>
                )}

                {/* Empty state */}
                {!loading && summary && summary.total_jobs === 0 && (
                    <div className="text-center py-16 text-slate-400">
                        <ChartBarIcon className="w-12 h-12 mx-auto mb-4 opacity-30" />
                        <p className="text-sm">No data yet for this period. Submit some jobs to start seeing analytics.</p>
                    </div>
                )}
            </main>
        </div>
    );
}
