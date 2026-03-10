// pages/admin/SuccessWorkspace.tsx
import React, { useEffect, useState } from 'react';
import {
    HeartIcon,
    ExclamationTriangleIcon,
    ShieldExclamationIcon,
    CurrencyEuroIcon,
    ArrowUpCircleIcon,
    UserGroupIcon,
    RocketLaunchIcon
} from '@heroicons/react/24/outline';
import * as adminApi from '../../lib/adminApi';
import { TenantDetail } from '../../lib/adminApi';

export const SuccessWorkspace: React.FC = () => {
    const [tenants, setTenants] = useState<TenantDetail[]>([]);
    const [workflows, setWorkflows] = useState<adminApi.CSWorkflow[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            try {
                const [tenantData, workflowData] = await Promise.all([
                    adminApi.getTenantsList(),
                    adminApi.getCSWorkflows()
                ]);
                setTenants(tenantData);
                setWorkflows(workflowData);
            } catch (err) {
                console.error('Failed to load success data', err);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    const stats = React.useMemo(() => {
        // Healthy: Active tenants not on free plan with regular usage
        const healthy = tenants.filter(t => t.status === 'ACTIVE' && t.plan !== 'FREE' && t.dailyUsage > 0).length;

        // At Risk: High usage relative to quota OR flatlining usage
        const atRisk = tenants.filter(t =>
            t.status === 'ACTIVE' &&
            (t.dailyUsage > (t.daily_job_limit * 0.85) || (t.last_active_at && new Date(t.last_active_at).getTime() < new Date().getTime() - 7 * 24 * 60 * 60 * 1000))
        ).length;

        const interrupted = tenants.filter(t => t.status === 'SUSPENDED' || t.status === 'QUARANTINED').length;

        // Finalized Revenue at Risk logic:
        // (Active Daily Usage * 0.10€ baseline) 
        // + (Plan-based factor if suspended or near expiry)
        const totalValueAtRisk = tenants.reduce((acc, t) => {
            let risk = 0;
            const isSuspended = t.status === 'SUSPENDED' || t.status === 'QUARANTINED';
            const isNearExpiry = t.plan_expires_at && (new Date(t.plan_expires_at).getTime() - new Date().getTime() < 7 * 24 * 60 * 60 * 1000);

            if (isSuspended) {
                // Full daily value lost
                risk += (t.dailyUsage * 0.15);
            } else if (isNearExpiry || t.dailyUsage > t.daily_job_limit) {
                // Partial risk of churn or interruption
                risk += (t.dailyUsage * 0.05);
            }

            return acc + risk;
        }, 0);

        const recommendations = tenants.filter(t =>
            t.plan !== 'ENTERPRISE' &&
            t.dailyUsage > (t.daily_job_limit * 0.9)
        );

        const upcomingRenewals = tenants.filter(t => {
            if (!t.plan_expires_at) return false;
            const diff = new Date(t.plan_expires_at).getTime() - new Date().getTime();
            return diff > 0 && diff < 30 * 24 * 60 * 60 * 1000;
        });

        return { healthy, atRisk, interrupted, totalValueAtRisk, recommendations, upcomingRenewals };
    }, [tenants]);

    if (loading) return <div className="p-12 text-center text-slate-500 font-medium">Analyzing account health...</div>;

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Health Overview Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <HealthCard
                    title="Healthy"
                    count={stats.healthy}
                    icon={HeartIcon}
                    color="text-emerald-600"
                    bg="bg-emerald-50"
                    tooltip="Active paying tenants with recent activity"
                />
                <HealthCard
                    title="Churn Risk"
                    count={stats.atRisk}
                    icon={ExclamationTriangleIcon}
                    color="text-rose-600"
                    bg="bg-rose-50"
                    tooltip="Tenants with high inactivity or approaching quota limits"
                />
                <HealthCard
                    title="Upsell Potential"
                    count={stats.recommendations.length}
                    icon={ArrowUpCircleIcon}
                    color="text-indigo-600"
                    bg="bg-indigo-50"
                    tooltip="Tenants consistently hitting >90% of their current quota"
                />
                <div className="bg-slate-900 rounded-3xl p-6 text-white shadow-xl" title="Estimated daily revenue lost from suspended accounts and at-risk renewals">
                    <div className="flex items-center gap-3 mb-4">
                        <CurrencyEuroIcon className="w-6 h-6 text-primary-light" />
                        <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Revenue at Risk</span>
                    </div>
                    <div className="text-3xl font-black">€{stats.totalValueAtRisk.toFixed(2)}</div>
                    <div className="text-[10px] text-slate-400 mt-2">Potential Loss (Estimated Daily)</div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Active CS Workflows */}
                <div className="bg-slate-50/50 rounded-3xl border border-slate-200 overflow-hidden col-span-1 lg:col-span-2">
                    <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white">
                        <div className="flex items-center gap-3">
                            <RocketLaunchIcon className="w-6 h-6 text-indigo-600" />
                            <h3 className="font-bold text-slate-900">Success Automation Workflows</h3>
                        </div>
                    </div>
                    <div className="p-0 overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                                <tr>
                                    <th className="px-6 py-3">Tenant</th>
                                    <th className="px-6 py-3">Workflow</th>
                                    <th className="px-6 py-3">Step</th>
                                    <th className="px-6 py-3">Status</th>
                                    <th className="px-6 py-3">Next Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 bg-white">
                                {workflows.length > 0 ? workflows.map(w => (
                                    <tr key={w.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="font-bold text-sm text-slate-900">{w.tenant_name}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-[10px] font-black bg-indigo-50 text-indigo-700 px-2 py-1 rounded-md uppercase">
                                                {w.workflow_type.replace('_', ' ')}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-xs font-medium text-slate-600">
                                            Stage {w.current_step}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`text-[10px] font-black px-2 py-1 rounded-full uppercase ${w.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' :
                                                w.status === 'COMPLETED' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'
                                                }`}>
                                                {w.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-xs font-medium text-slate-500">
                                            {w.next_action_at ? new Date(w.next_action_at).toLocaleDateString() : 'Manual Completion'}
                                        </td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center text-slate-400 text-sm italic">
                                            No active workflows currently running.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Upgrade Recommendations */}
                <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-slate-50 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <ArrowUpCircleIcon className="w-6 h-6 text-primary" />
                            <h3 className="font-bold text-slate-900">Upgrade Recommendations</h3>
                        </div>
                        <span className="bg-primary/10 text-primary text-[10px] font-black px-2 py-1 rounded-full uppercase">
                            {stats.recommendations.length} Leads
                        </span>
                    </div>
                    <div className="divide-y divide-slate-50">
                        {stats.recommendations.length > 0 ? stats.recommendations.map(t => (
                            <div key={t.id} className="p-4 hover:bg-slate-50 transition-colors flex items-center justify-between">
                                <div>
                                    <div className="font-bold text-slate-900 text-sm">{t.name}</div>
                                    <div className="text-[10px] text-slate-500 font-medium">
                                        Consistently hitting {((t.dailyUsage / t.daily_job_limit) * 100).toFixed(0)}% of {t.plan} quota
                                    </div>
                                </div>
                                <button className="px-3 py-1 bg-primary/10 text-primary text-[10px] font-bold rounded-lg hover:bg-primary hover:text-white transition-all">
                                    Prepare Offer
                                </button>
                            </div>
                        )) : (
                            <div className="p-12 text-center text-slate-400 text-sm font-medium">No urgent upgrade leads today.</div>
                        )}
                    </div>
                </div>

                {/* Upcoming Renewals */}
                <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-slate-50 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <UserGroupIcon className="w-6 h-6 text-blue-600" />
                            <h3 className="font-bold text-slate-900">Upcoming Renewals (30d)</h3>
                        </div>
                    </div>
                    <div className="divide-y divide-slate-50">
                        {stats.upcomingRenewals.length > 0 ? stats.upcomingRenewals.map(t => (
                            <div key={t.id} className="p-4 hover:bg-slate-50 transition-colors flex items-center justify-between">
                                <div>
                                    <div className="font-bold text-slate-900 text-sm">{t.name}</div>
                                    <div className="text-[10px] text-slate-500 font-medium">
                                        Expires: {new Date(t.plan_expires_at!).toLocaleDateString()}
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${t.dailyUsage > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                                        {t.dailyUsage > 0 ? 'ACTIVE USE' : 'ZERO ACTIVITY'}
                                    </div>
                                </div>
                            </div>
                        )) : (
                            <div className="p-12 text-center text-slate-400 text-sm font-medium">No renewals soon.</div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

const HealthCard = ({ title, count, icon: Icon, color, bg, tooltip }: any) => (
    <div className={`p-6 rounded-3xl ${bg} border border-white/50 shadow-sm`} title={tooltip}>
        <div className="flex items-center justify-between mb-4">
            <Icon className={`w-6 h-6 ${color}`} />
            <span className="text-2xl font-black text-slate-900">{count}</span>
        </div>
        <div className="text-xs font-bold text-slate-500 uppercase tracking-widest">{title}</div>
    </div>
);
