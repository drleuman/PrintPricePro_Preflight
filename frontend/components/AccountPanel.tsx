import React from 'react';
import { useAuth } from '../hooks/useAuth';
import { 
    ShieldCheckIcon, 
    KeyIcon, 
    CreditCardIcon, 
    AtSymbolIcon, 
    IdentificationIcon,
    ArrowPathIcon,
    ExclamationTriangleIcon
} from '@heroicons/react/24/outline';

export const AccountPanel: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const { user } = useAuth();

    if (!user) return null;

    return (
        <div className="fixed inset-0 z-[10000] flex items-center justify-end bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="h-full w-full max-w-xl bg-[var(--bg-primary)] border-l border-[var(--border-color)] shadow-[-50px_0_100px_rgba(0,0,0,0.5)] flex flex-col animate-in slide-in-from-right duration-500">
                {/* Header */}
                <div className="p-8 border-b border-[var(--border-color)] flex items-center justify-between">
                    <div>
                        <div className="text-[0.62rem] font-black text-[var(--accent-color)] uppercase tracking-[0.3em] mb-1">Authenticated Node</div>
                        <h2 className="text-2xl font-black text-[var(--text-primary)] uppercase tracking-tight">System Account Panel</h2>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-[var(--hover-bg)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all text-xs font-mono">
                        CLOSE_TERMINAL
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-8 space-y-12">
                    {/* Profile Section */}
                    <div className="space-y-6">
                        <SectionTitle title="Node Identity" icon={<IdentificationIcon className="w-4 h-4" />} />
                        <div className="grid gap-4">
                            <IdentityField label="Email_Identifier" value={user.email} icon={<AtSymbolIcon className="w-3.5 h-3.5" />} />
                            <IdentityField label="Technical_Role" value={user.role} icon={<ShieldCheckIcon className="w-3.5 h-3.5" />} />
                            {user.organization_name && <IdentityField label="Cluster_Organization" value={user.organization_name} />}
                        </div>
                    </div>

                    {/* License Section */}
                    <div className="space-y-6">
                        <SectionTitle title="Resource Governance" icon={<CreditCardIcon className="w-4 h-4" />} />
                        <div className="border border-[var(--border-color)] bg-[var(--bg-tertiary)] p-6 space-y-4">
                            <div className="flex items-center justify-between">
                                <span className="text-[0.65rem] font-black text-[var(--text-secondary)] uppercase tracking-widest">Active Plan</span>
                                <span className="px-2 py-0.5 bg-[var(--accent-color)]/10 text-[var(--accent-color)] text-[0.6rem] font-black border border-[var(--accent-color)]/30 uppercase tracking-widest leading-none">
                                    {user.plan}
                                </span>
                            </div>
                            <div className="space-y-2 pt-2">
                                <UsageBar label="Daily Jobs Quota" current={0} total={user.daily_jobs_limit} />
                                <UsageBar label="Max System Carriers" current={0} total={500} />
                            </div>
                            {user.plan === 'FREE' && (
                                <div className="mt-4 pt-4 border-t border-[var(--border-color)]">
                                    <button className="w-full py-3 bg-[var(--accent-color)] text-white text-[0.65rem] font-black uppercase tracking-[0.2em] hover:bg-[var(--accent-hover)] transition-all">
                                        Upgrade to PRO_NODE
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* API Access (Developers) */}
                    {user.role === 'DEVELOPER' && (
                        <div className="space-y-6">
                            <SectionTitle title="Machine-to-Machine Bridge" icon={<KeyIcon className="w-4 h-4" />} />
                            <div className="space-y-4">
                                <div className="p-4 border border-[var(--border-color)] bg-[var(--bg-tertiary)] font-mono">
                                    <div className="text-[0.55rem] text-[var(--text-muted)] mb-2 uppercase tracking-widest">Active API Key</div>
                                    <div className="flex items-center justify-between gap-4">
                                        <div className="text-xs text-[var(--text-primary)] truncate opacity-40">ppos_live_xxxxxxxxxxxxxxxxxxxxxx</div>
                                        <button className="text-[0.6rem] font-black text-[var(--accent-color)] uppercase underline shrink-0">Show_Key</button>
                                    </div>
                                </div>
                                <button className="flex items-center gap-2 text-[0.6rem] font-black text-[var(--text-muted)] uppercase hover:text-[var(--text-primary)] transition-all">
                                    <ArrowPathIcon className="w-3 h-3" />
                                    <span>Rotate_Credentials</span>
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Security Check */}
                    <div className="space-y-6">
                        <SectionTitle title="Security & Forensic Integrity" icon={<ExclamationTriangleIcon className="w-4 h-4" />} />
                        <div className="p-4 border border-[var(--accent-color)]/20 bg-[var(--accent-color)]/5 text-[0.65rem] text-[var(--accent-color)] font-black uppercase tracking-widest flex items-center gap-3">
                            <div className="h-2 w-2 bg-[var(--accent-color)] animate-pulse"></div>
                            System Under Forensic Surveillance
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-8 border-t border-[var(--border-color)] bg-[var(--bg-tertiary)]/30 text-center">
                    <div className="text-[0.6rem] font-mono text-[var(--text-muted)] opacity-50 uppercase tracking-widest">
                        Node_ID: {user.id} / Version: 2.4.0-ID-SYNC
                    </div>
                </div>
            </div>
        </div>
    );
};

const SectionTitle: React.FC<{ title: string, icon: React.ReactNode }> = ({ title, icon }) => (
    <div className="flex items-center gap-3 text-[var(--text-primary)]">
        <span className="text-[var(--accent-color)]">{icon}</span>
        <h3 className="text-[0.65rem] font-black uppercase tracking-[0.2em]">{title}</h3>
        <div className="h-px flex-1 bg-[var(--border-color)]"></div>
    </div>
);

const IdentityField: React.FC<{ label: string, value: string, icon?: React.ReactNode }> = ({ label, value, icon }) => (
    <div className="flex flex-col gap-1.5 p-4 border border-[var(--border-color)] bg-[var(--bg-tertiary)]/40">
        <span className="text-[0.55rem] font-black text-[var(--text-muted)] uppercase tracking-widest leading-none">{label}</span>
        <div className="flex items-center gap-2 text-sm font-bold text-[var(--text-primary)]">
            {icon && <span className="text-[var(--text-muted)]">{icon}</span>}
            {value}
        </div>
    </div>
);

const UsageBar: React.FC<{ label: string, current: number, total: number }> = ({ label, current, total }) => (
    <div className="space-y-1.5">
        <div className="flex justify-between items-center text-[0.55rem] font-black uppercase tracking-widest text-[var(--text-muted)]">
            <span>{label}</span>
            <span>{current} / {total}</span>
        </div>
        <div className="h-1 bg-[var(--bg-tertiary)] w-full">
            <div 
                className="h-full bg-[var(--accent-color)]/40 transition-all duration-1000" 
                style={{ width: `${Math.min(100, (current / total) * 100)}%` }}
            />
        </div>
    </div>
);
