import React, { useState, useEffect } from 'react';
import {
    BuildingOfficeIcon,
    CpuChipIcon,
    ArrowPathIcon,
    CheckBadgeIcon,
    ExclamationCircleIcon,
    ChartBarIcon
} from '@heroicons/react/24/outline';

export const ConnectDashboard = () => {
    const [stats, setStats] = useState({
        status: 'READY',
        nodeStatus: 'ACTIVE',
        machines: 0,
        qualityScore: 0.5,
        capacityToday: 0.8
    });

    return (
        <div style={{ padding: '40px', color: '#111827', maxWidth: '1200px', margin: '0 auto' }}>
            <header style={{ marginBottom: '48px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <div>
                    <h1 style={{ fontSize: '32px', fontWeight: 800, letterSpacing: '-0.5px', marginBottom: '8px' }}>
                        Production Hub
                    </h1>
                    <p style={{ color: '#6b7280', fontSize: '16px' }}>
                        Manage your network node and real-time capacity.
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <div style={{
                        background: stats.nodeStatus === 'ACTIVE' ? '#ecfdf5' : '#fff7ed',
                        color: stats.nodeStatus === 'ACTIVE' ? '#059669' : '#d97706',
                        padding: '8px 16px', borderRadius: '12px', fontSize: '13px', fontWeight: 700,
                        display: 'flex', alignItems: 'center', gap: '6px', border: '1px solid currentColor', opacity: 0.8
                    }}>
                        {stats.nodeStatus === 'ACTIVE' ? <CheckBadgeIcon className="w-4 h-4" /> : <ArrowPathIcon className="w-4 h-4" />}
                        {stats.nodeStatus}
                    </div>
                </div>
            </header>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '24px', marginBottom: '48px' }}>
                {[
                    { label: 'Connect Status', value: stats.status, icon: ArrowPathIcon, color: '#3b82f6' },
                    { label: 'Quality Score', value: `${(stats.qualityScore * 100).toFixed(0)}%`, icon: ChartBarIcon, color: '#10b981' },
                    { label: 'Hardware Active', value: stats.machines, icon: CpuChipIcon, color: '#6366f1' },
                    { label: 'Capacity (Today)', value: `${(stats.capacityToday * 100).toFixed(0)}%`, icon: BuildingOfficeIcon, color: '#f59e0b' }
                ].map((card, i) => (
                    <div key={i} style={{
                        background: 'white', padding: '24px', borderRadius: '24px',
                        border: '1px solid #f3f4f6', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)'
                    }}>
                        <div style={{ background: `${card.color}10`, width: '40px', height: '40px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
                            <card.icon style={{ width: '20px', height: '20px', color: card.color }} />
                        </div>
                        <div style={{ fontSize: '13px', color: '#6b7280', fontWeight: 600, marginBottom: '4px' }}>{card.label}</div>
                        <div style={{ fontSize: '24px', fontWeight: 800 }}>{card.value}</div>
                    </div>
                ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
                <div style={{ background: 'white', borderRadius: '24px', padding: '32px', border: '1px solid #f3f4f6' }}>
                    <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '24px' }}>Recent Production Signals</h3>
                    <div style={{ color: '#9ca3af', textAlign: 'center', padding: '40px 0' }}>
                        No jobs routed to this node yet. Complete onboarding to go live.
                    </div>
                </div>
                <div style={{ background: '#111827', borderRadius: '24px', padding: '32px', color: 'white' }}>
                    <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '16px' }}>Node Health</h3>
                    <p style={{ fontSize: '14px', color: '#9ca3af', lineHeight: '1.6', marginBottom: '24px' }}>
                        Your node is partially configured. To become eligible for autonomous routing:
                    </p>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {[
                            { text: 'Identity Verified', done: true },
                            { text: 'Hardware Registered', done: stats.machines > 0 },
                            { text: 'Capacity Sync Active', done: false },
                            { text: 'Compliance Check', done: true }
                        ].map((item, i) => (
                            <li key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: item.done ? '#fff' : '#4b5563' }}>
                                {item.done ? <CheckBadgeIcon className="w-5 h-5 text-emerald-400" /> : <div style={{ width: '20px', height: '20px', borderRadius: '50%', border: '2px solid #374151' }} />}
                                {item.text}
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </div>
    );
};
