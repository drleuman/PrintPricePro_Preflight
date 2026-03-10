import React, { useState } from 'react';
import {
    CalendarIcon,
    BoltIcon,
    ClockIcon
} from '@heroicons/react/24/outline';

export const ConnectCapacity = () => {
    return (
        <div style={{ padding: '40px', maxWidth: '1200px', margin: '0 auto' }}>
            <header style={{ marginBottom: '40px' }}>
                <h2 style={{ fontSize: '24px', fontWeight: 800 }}>Production Capacity</h2>
                <p style={{ color: '#6b7280', fontSize: '14px' }}>Sync your real-time availability with the routing engine.</p>
            </header>

            <div style={{
                background: 'white', borderRadius: '24px', padding: '32px', border: '1px solid #f3f4f6',
                boxShadow: '0 10px 15px -3px rgba(0,0,0,0.05)'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                    <div style={{ fontSize: '18px', fontWeight: 700 }}>Next 7 Days Snapshot</div>
                    <button style={{
                        color: '#6366f1', background: '#6366f110', border: 'none',
                        padding: '8px 20px', borderRadius: '12px', fontSize: '13px', fontWeight: 600, cursor: 'pointer'
                    }}>
                        Bulk Update
                    </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {[0, 1, 2, 3, 4, 5, 6].map(i => {
                        const date = new Date();
                        date.setDate(date.getDate() + i);
                        const isToday = i === 0;

                        return (
                            <div key={i} style={{
                                display: 'flex', alignItems: 'center', gap: '24px', padding: '16px 24px',
                                background: isToday ? '#f9fafb' : 'transparent', borderRadius: '16px', border: '1px solid #f3f4f6'
                            }}>
                                <div style={{ width: '120px' }}>
                                    <div style={{ fontSize: '14px', fontWeight: 700 }}>{date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' })}</div>
                                    <div style={{ fontSize: '12px', color: '#9ca3af' }}>{isToday ? 'Today' : 'Upcoming'}</div>
                                </div>

                                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div style={{ flex: 1, height: '8px', background: '#f3f4f6', borderRadius: '4px', position: 'relative', overflow: 'hidden' }}>
                                        <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: '80%', background: '#10b981' }} />
                                    </div>
                                    <div style={{ fontSize: '13px', fontWeight: 700, width: '40px' }}>80%</div>
                                </div>

                                <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#6b7280', fontSize: '13px' }}>
                                        <ClockIcon className="w-4 h-4" /> 3d Lead Time
                                    </div>
                                    <button style={{
                                        padding: '6px 12px', borderRadius: '8px', border: '1px solid #e5e7eb',
                                        background: 'white', fontSize: '12px', fontWeight: 600, cursor: 'pointer'
                                    }}>
                                        Edit
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};
