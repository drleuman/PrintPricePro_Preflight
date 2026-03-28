import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { 
    UserIcon, 
    ChevronDownIcon, 
    ArrowLeftOnRectangleIcon, 
    ShieldCheckIcon, 
    KeyIcon, 
    CreditCardIcon 
} from '@heroicons/react/24/outline';

import { AccountPanel } from './AccountPanel';

export const UserMenu: React.FC = () => {
    const { user, logout } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const [showAccountPanel, setShowAccountPanel] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    if (!user) return null;

    const handleOpenProfile = () => {
        setShowAccountPanel(true);
        setIsOpen(false);
    };

    return (
        <>
            <div className="relative" ref={menuRef}>
                <button 
                    onClick={() => setIsOpen(!isOpen)}
                    className="flex items-center gap-3 px-3 py-1.5 border border-[var(--border-color)] hover:border-[var(--accent-color)]/20 hover:bg-[var(--hover-bg)] transition-all group"
                >
                    <div className="flex flex-col items-end">
                        <span className="text-[0.8rem] font-black text-[var(--text-primary)] uppercase tracking-wider">{user.email.split('@')[0]}</span>
                        <span className="text-[0.7rem] font-mono text-[var(--accent-color)] uppercase tracking-widest leading-none">NODE: {user.role}</span>
                    </div>
                    <div className="h-8 w-8 bg-[var(--bg-tertiary)] border border-[var(--border-color)] flex items-center justify-center relative">
                        <UserIcon className="w-4 h-4 text-[var(--text-muted)] group-hover:text-[var(--text-primary)] transition-colors" />
                        {user.plan === 'PRO' && <div className="absolute -top-1 -right-1 h-2 w-2 bg-[var(--accent-color)]"></div>}
                    </div>
                    <ChevronDownIcon className={`w-3 h-3 text-[var(--text-muted)] transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>

                {isOpen && (
                    <div className="absolute right-0 mt-2 w-64 bg-[var(--bg-primary)] border border-[var(--border-color)] shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-[100] animate-in fade-in slide-in-from-top-2 duration-200">
                        {/* Header */}
                        <div className="p-4 border-b border-[var(--border-color)] bg-[var(--bg-tertiary)]/50">
                            <div className="text-[0.75rem] font-black text-[var(--text-muted)] uppercase tracking-[0.2em] mb-1">Authenticated Node</div>
                            <div className="text-sm font-bold text-[var(--text-primary)] truncate">{user.email}</div>
                            <div className="mt-2 flex items-center gap-2">
                                <span className="px-1.5 py-0.5 bg-[var(--accent-color)]/10 text-[var(--accent-color)] text-[0.7rem] font-black uppercase tracking-widest border border-[var(--accent-color)]/20">
                                    {user.plan}
                                </span>
                                {user.organization_name && (
                                    <span className="text-[0.75rem] font-mono text-[var(--text-muted)] truncate italic">
                                        // {user.organization_name}
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="p-2">
                            <MenuButton 
                                onClick={handleOpenProfile}
                                icon={<UserIcon className="w-4 h-4" />} 
                                label="Profile Settings" 
                            />
                            <MenuButton 
                                onClick={handleOpenProfile}
                                icon={<CreditCardIcon className="w-4 h-4" />} 
                                label="License & Usage" 
                                badge={user.plan === 'FREE' ? 'UPGRADE' : undefined} 
                            />
                            {user.role === 'DEVELOPER' && (
                                <MenuButton 
                                    onClick={handleOpenProfile}
                                    icon={<KeyIcon className="w-4 h-4" />} 
                                    label="API Governance" 
                                />
                            )}
                            <MenuButton icon={<ShieldCheckIcon className="w-4 h-4" />} label="Security Audit" />
                        </div>

                        {/* Footer */}
                        <div className="p-2 border-t border-[var(--border-color)] bg-[var(--bg-tertiary)]/30">
                            <button 
                                onClick={logout}
                                className="w-full flex items-center gap-3 px-3 py-2 text-[var(--accent-color)] hover:bg-[var(--accent-color)]/5 transition-colors text-[0.85rem] font-black uppercase tracking-[0.15em]"
                            >
                                <ArrowLeftOnRectangleIcon className="w-4 h-4" />
                                <span>Release Access Node</span>
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {showAccountPanel && (
                <AccountPanel onClose={() => setShowAccountPanel(false)} />
            )}
        </>
    );
};

const MenuButton: React.FC<{ icon: React.ReactNode, label: string, badge?: string, onClick?: () => void }> = ({ icon, label, badge, onClick }) => (
    <button 
        onClick={onClick}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-[var(--hover-bg)] transition-colors group"
    >
        <div className="flex items-center gap-3">
            <span className="text-[var(--text-muted)] group-hover:text-[var(--text-primary)] transition-colors">{icon}</span>
            <span className="text-[0.85rem] font-bold text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] uppercase tracking-tight">{label}</span>
        </div>
        {badge && (
            <span className="text-[0.7rem] font-black text-[var(--accent-color)] animate-pulse">{badge}</span>
        )}
    </button>
);
