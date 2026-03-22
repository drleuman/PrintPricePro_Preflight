import React, { useState, useEffect } from 'react';
import { ConnectDashboard } from './ConnectDashboard';
import { ConnectMachines } from './ConnectMachines';
import { ConnectCapacity } from './ConnectCapacity';
import { ConnectOnboarding } from './ConnectOnboarding';
import {
    HomeIcon,
    CpuChipIcon,
    BoltIcon,
    UserCircleIcon,
    ArrowRightOnRectangleIcon
} from '@heroicons/react/24/outline';

export const ConnectPortal = () => {
    const [isOnboarded, setIsOnboarded] = useState(false);
    const [view, setView] = useState('dashboard');

    if (!isOnboarded) {
        return (
            <div style={{ minHeight: '100vh', background: '#f8fafc', padding: '40px' }}>
                <div style={{ textAlign: 'center', marginBottom: '40px' }}>
                    <div style={{ fontSize: '24px', fontWeight: 900, letterSpacing: '-1px' }}>PRINTPRICE <span style={{ color: '#ef4444' }}>CONNECT</span></div>
                </div>
                <ConnectOnboarding onComplete={() => setIsOnboarded(true)} />
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', minHeight: '100vh', background: '#fdfdfe' }}>
            {/* Sidebar */}
            <aside style={{
                width: '280px', borderRight: '1px solid #f3f4f6', padding: '32px',
                display: 'flex', flexDirection: 'column', gap: '32px'
            }}>
                <div style={{ fontSize: '20px', fontWeight: 900, letterSpacing: '-1px' }}>PRINTPRICE <span style={{ color: '#ef4444' }}>CONNECT</span></div>

                <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {[
                        { id: 'dashboard', label: 'Dashboard', icon: HomeIcon },
                        { id: 'machines', label: 'Hardware Registry', icon: CpuChipIcon },
                        { id: 'capacity', label: 'Production Sync', icon: BoltIcon },
                        { id: 'profile', label: 'Node Profile', icon: UserCircleIcon },
                    ].map(item => (
                        <button
                            key={item.id}
                            onClick={() => setView(item.id)}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 20px',
                                border: 'none', background: view === item.id ? '#111827' : 'transparent',
                                color: view === item.id ? 'white' : '#4b5563', borderRadius: '16px',
                                fontWeight: 600, fontSize: '14px', cursor: 'pointer', textAlign: 'left',
                                transition: 'all 0.2s'
                            }}
                        >
                            <item.icon className="w-5 h-5" />
                            {item.label}
                        </button>
                    ))}
                </nav>

                <button style={{
                    display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 20px',
                    border: 'none', background: 'transparent', color: '#ef4444',
                    fontWeight: 600, fontSize: '14px', cursor: 'pointer'
                }}>
                    <ArrowRightOnRectangleIcon className="w-5 h-5" />
                    Logout
                </button>
            </aside>

            {/* Content */}
            <main style={{ flex: 1, overflowY: 'auto' }}>
                {view === 'dashboard' && <ConnectDashboard />}
                {view === 'machines' && <ConnectMachines />}
                {view === 'capacity' && <ConnectCapacity />}
                {view === 'profile' && <div style={{ padding: '60px', textAlign: 'center', color: '#9ca3af' }}>Profile settings coming soon...</div>}
            </main>
        </div>
    );
};
