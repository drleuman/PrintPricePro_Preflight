import React, { useState, useEffect } from 'react';
import {
    PlusIcon,
    CpuChipIcon,
    TrashIcon,
    MagnifyingGlassIcon
} from '@heroicons/react/24/outline';

export const ConnectMachines = () => {
    const [machines, setMachines] = useState<any[]>([]);
    const [profiles, setProfiles] = useState<any[]>([]);
    const [searchTerm, setSearchTerm] = useState('');

    return (
        <div style={{ padding: '40px', maxWidth: '1200px', margin: '0 auto' }}>
            <header style={{ marginBottom: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h2 style={{ fontSize: '24px', fontWeight: 800 }}>Hardware Registry</h2>
                    <p style={{ color: '#6b7280', fontSize: '14px' }}>Declare your machines to receive compatible jobs.</p>
                </div>
                <button style={{
                    background: '#111827', color: 'white', border: 'none', padding: '12px 24px',
                    borderRadius: '16px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer'
                }}>
                    <PlusIcon className="w-5 h-5" /> Add Machine
                </button>
            </header>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '24px' }}>
                {machines.length === 0 ? (
                    <div style={{
                        gridColumn: '1 / -1', border: '2px dashed #e5e7eb', borderRadius: '24px',
                        padding: '60px', textAlign: 'center', color: '#9ca3af'
                    }}>
                        <CpuChipIcon className="w-12 h-12 mx-auto mb-4 opacity-20" />
                        <p>No machines registered yet.</p>
                        <p style={{ fontSize: '13px' }}>Add your first machine to start the capability profiling.</p>
                    </div>
                ) : (
                    machines.map((m, i) => (
                        <div key={i} style={{
                            background: 'white', borderRadius: '20px', padding: '24px',
                            border: '1px solid #f3f4f6', position: 'relative'
                        }}>
                            <div style={{ fontSize: '12px', fontWeight: 700, color: '#3b82f6', textTransform: 'uppercase', marginBottom: '8px' }}>
                                {m.profile_type || 'OFFSET'}
                            </div>
                            <h4 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '4px' }}>{m.nickname || m.profile_name}</h4>
                            <div style={{ fontSize: '13px', color: '#6b7280' }}>Capacity Index: {m.capacity_index}</div>

                            <button style={{
                                position: 'absolute', top: '24px', right: '24px', color: '#ef4444',
                                background: 'none', border: 'none', cursor: 'pointer'
                            }}>
                                <TrashIcon className="w-5 h-5" />
                            </button>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};
