// pages/admin/NotificationsTab.tsx
import React, { useEffect, useState } from "react";
import {
    BellAlertIcon,
    CheckCircleIcon,
    XCircleIcon,
    ClockIcon,
    NoSymbolIcon,
    ArrowPathIcon,
    InformationCircleIcon,
    MagnifyingGlassIcon
} from "@heroicons/react/24/outline";

interface Notification {
    id: string;
    tenant_id: string;
    event_type: string;
    channel: string;
    status: string;
    subject: string;
    attempt_count: number;
    last_error: string | null;
    created_at: string;
    sent_at: string | null;
    scheduled_at: string | null;
    dedupe_key: string;
    payload_json: any;
}

interface NotificationEvent {
    id: number;
    event: string;
    metadata_json: any;
    created_at: string;
}

export const NotificationsTab: React.FC<{ refreshMs: number }> = ({ refreshMs }) => {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [detail, setDetail] = useState<{ notification: Notification; events: NotificationEvent[] } | null>(null);
    const [filterStatus, setFilterStatus] = useState<string>("");

    const fetchNotifications = async () => {
        try {
            const query = filterStatus ? `?status=${filterStatus}` : "";
            const res = await fetch(`/api/admin/notifications${query}`);
            const data = await res.json();
            if (data.ok) setNotifications(data.notifications);
        } catch (err) {
            console.error("Failed to fetch notifications", err);
        } finally {
            setLoading(false);
        }
    };

    const fetchDetail = async (id: string) => {
        try {
            const res = await fetch(`/api/admin/notifications/${id}`);
            const data = await res.json();
            if (data.ok) setDetail(data);
        } catch (err) {
            console.error("Failed to fetch notification detail", err);
        }
    };

    const handleResend = async (id: string) => {
        if (!confirm("Are you sure you want to resend this notification?")) return;
        try {
            const res = await fetch(`/api/admin/notifications/${id}/resend`, { method: "POST" });
            if (res.ok) {
                alert("Resend triggered");
                fetchNotifications();
                if (selectedId === id) fetchDetail(id);
            }
        } catch (err) {
            alert("Resend failed");
        }
    };

    const handleCancel = async (id: string) => {
        if (!confirm("Cancel this pending notification?")) return;
        try {
            const res = await fetch(`/api/admin/notifications/${id}/cancel`, { method: "POST" });
            if (res.ok) {
                fetchNotifications();
                if (selectedId === id) fetchDetail(id);
            }
        } catch (err) {
            alert("Cancel failed");
        }
    };

    useEffect(() => {
        fetchNotifications();
        if (refreshMs > 0) {
            const idx = setInterval(fetchNotifications, refreshMs);
            return () => clearInterval(idx);
        }
    }, [refreshMs, filterStatus]);

    useEffect(() => {
        if (selectedId) fetchDetail(selectedId);
        else setDetail(null);
    }, [selectedId]);

    const getStatusStyle = (status: string) => {
        switch (status) {
            case 'SENT': return "bg-emerald-50 text-emerald-700 border-emerald-100";
            case 'FAILED': return "bg-red-50 text-red-700 border-red-100";
            case 'PENDING': return "bg-amber-50 text-amber-700 border-amber-100";
            case 'SUPPRESSED': return "bg-slate-50 text-slate-500 border-slate-100";
            case 'CANCELED': return "bg-slate-100 text-slate-400 border-slate-200";
            default: return "bg-gray-50 text-gray-600";
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'SENT': return <CheckCircleIcon className="w-4 h-4" />;
            case 'FAILED': return <XCircleIcon className="w-4 h-4" />;
            case 'PENDING': return <ClockIcon className="w-4 h-4" />;
            case 'SUPPRESSED': return <NoSymbolIcon className="w-4 h-4" />;
            case 'CANCELED': return <NoSymbolIcon className="w-4 h-4" />;
            default: return null;
        }
    };

    return (
        <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-bold text-slate-900">Platform Notifications</h2>
                    <p className="text-sm text-slate-500">Audit trail and delivery status for tenant alerts.</p>
                </div>
                <div className="flex gap-2">
                    <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20"
                    >
                        <option value="">All Statuses</option>
                        <option value="PENDING">Pending</option>
                        <option value="SENT">Sent</option>
                        <option value="FAILED">Failed</option>
                        <option value="SUPPRESSED">Suppressed</option>
                        <option value="CANCELED">Canceled</option>
                    </select>
                    <button
                        onClick={fetchNotifications}
                        className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-500"
                    >
                        <ArrowPathIcon className="w-5 h-5" />
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 overflow-hidden bg-white rounded-xl border border-slate-200">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-medium font-mono uppercase text-[10px] tracking-wider">
                                <tr>
                                    <th className="px-4 py-3">Tenant</th>
                                    <th className="px-4 py-3">Channel / Event</th>
                                    <th className="px-4 py-3 text-center">Status</th>
                                    <th className="px-4 py-3 text-center">Attempts</th>
                                    <th className="px-4 py-3 text-right">Created</th>
                                    <th className="px-4 py-3"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {loading ? (
                                    <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">Loading notifications...</td></tr>
                                ) : notifications.length === 0 ? (
                                    <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">No notifications found</td></tr>
                                ) : (
                                    notifications.map(n => (
                                        <tr
                                            key={n.id}
                                            className={`hover:bg-slate-50 transition-colors cursor-pointer ${selectedId === n.id ? 'bg-primary/5' : ''}`}
                                            onClick={() => setSelectedId(n.id)}
                                        >
                                            <td className="px-4 py-3 font-medium text-slate-700">{n.tenant_id}</td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-1.5 mb-0.5">
                                                    <span className="text-[9px] font-black bg-slate-100 text-slate-500 px-1 rounded border border-slate-200 uppercase tracking-tighter">{n.channel}</span>
                                                    <div className="font-bold text-slate-900 text-[11px] truncate">{n.event_type}</div>
                                                </div>
                                                <div className="text-slate-500 text-[10px] truncate max-w-[200px] font-medium">{n.subject}</div>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-black border ${getStatusStyle(n.status)}`}>
                                                    {getStatusIcon(n.status)}
                                                    {n.status}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-center text-slate-500 font-mono text-[11px]">{n.attempt_count}</td>
                                            <td className="px-4 py-3 text-right text-slate-500 tabular-nums text-xs">
                                                {new Date(n.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                            </td>
                                            <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                                                <button
                                                    onClick={() => setSelectedId(n.id)}
                                                    className="p-1 hover:bg-slate-200 rounded-md text-slate-400 hover:text-slate-600"
                                                >
                                                    <MagnifyingGlassIcon className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="lg:col-span-1 border border-slate-200 rounded-xl bg-slate-50/50 flex flex-col min-h-[500px]">
                    {detail ? (
                        <div className="flex flex-col h-full animate-slide-fade">
                            <div className="p-4 border-b border-slate-200 bg-white rounded-t-xl flex justify-between items-start">
                                <div>
                                    <div className="text-[10px] font-black text-primary uppercase tracking-widest mb-1">{detail.notification.channel} Channel</div>
                                    <h3 className="font-bold text-slate-900">{detail.notification.event_type}</h3>
                                </div>
                                <div className="flex gap-1">
                                    {(detail.notification.status === 'FAILED' || detail.notification.status === 'SENT') && (
                                        <button
                                            onClick={() => handleResend(detail.notification.id)}
                                            className="p-1.5 bg-primary text-white rounded-lg shadow-sm hover:scale-105 transition-all"
                                            title="Resend"
                                        >
                                            <ArrowPathIcon className="w-4 h-4" />
                                        </button>
                                    )}
                                    {detail.notification.status === 'PENDING' && (
                                        <button
                                            onClick={() => handleCancel(detail.notification.id)}
                                            className="p-1.5 bg-red-500 text-white rounded-lg shadow-sm hover:scale-105 transition-all"
                                            title="Cancel"
                                        >
                                            <NoSymbolIcon className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto p-4 space-y-6">
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Audit Timeline</label>
                                    <div className="relative pl-4 space-y-4 border-l-2 border-slate-200 ml-1">
                                        {detail.events.map(ev => (
                                            <div key={ev.id} className="relative">
                                                <div className="absolute -left-[21px] top-1.5 w-3 h-3 bg-white border-2 border-slate-300 rounded-full" />
                                                <div className="text-[11px] font-bold text-slate-800">{ev.event}</div>
                                                <div className="text-[10px] text-slate-500 tabular-nums">{new Date(ev.created_at).toLocaleString()}</div>
                                                {ev.metadata_json && (
                                                    <pre className="mt-1 text-[9px] bg-white p-1.5 rounded border border-slate-100 overflow-x-auto text-slate-600 font-mono">
                                                        {JSON.stringify(typeof ev.metadata_json === 'string' ? JSON.parse(ev.metadata_json) : ev.metadata_json, null, 2)}
                                                    </pre>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {detail.notification.last_error && (
                                    <div className="bg-red-50 border border-red-100 p-3 rounded-lg">
                                        <div className="flex items-center gap-2 text-red-700 font-bold mb-1 text-[11px]">
                                            <InformationCircleIcon className="w-4 h-4" />
                                            Last Error
                                        </div>
                                        <div className="text-[10px] font-mono text-red-600 break-words">{detail.notification.last_error}</div>
                                    </div>
                                )}

                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Payload</label>
                                    <pre className="text-[10px] bg-slate-900 text-emerald-400 p-3 rounded-lg border border-slate-800 overflow-x-auto font-mono">
                                        {JSON.stringify(typeof detail.notification.payload_json === 'string' ? JSON.parse(detail.notification.payload_json) : detail.notification.payload_json, null, 2)}
                                    </pre>
                                </div>

                                {detail.notification.status === 'FAILED' && detail.notification.scheduled_at && (
                                    <div className="bg-amber-50 border border-amber-100 p-3 rounded-lg">
                                        <div className="flex items-center gap-2 text-amber-700 font-bold mb-1 text-[11px]">
                                            <ClockIcon className="w-4 h-4" />
                                            Next Attempt Scheduled
                                        </div>
                                        <div className="text-[10px] text-amber-600 font-mono">
                                            {new Date(detail.notification.scheduled_at).toLocaleString()}
                                        </div>
                                    </div>
                                )}

                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Dedupe Key</label>
                                    <div className="text-[10px] font-mono text-slate-400 break-all bg-white px-2 py-1.5 rounded border border-slate-200">{detail.notification.dedupe_key}</div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400 gap-3">
                            <BellAlertIcon className="w-12 h-12 opacity-20" />
                            <p className="text-sm font-medium">Select a notification to view audit details and history.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
