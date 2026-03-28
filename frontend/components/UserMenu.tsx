import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { 
    UserIcon, 
    ChevronDownIcon, 
    ArrowLeftOnRectangleIcon, 
    ShieldCheckIcon, 
    KeyIcon, 
    CreditCardIcon 
} from '@heroicons/react/24/outline';

import { AccountPanel, AccountView } from './AccountPanel';

export const UserMenu: React.FC = () => {
    const { user, logout } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const [activeView, setActiveView] = useState<AccountView | null>(null);
    
    const menuRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);

    // Close dropdown on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Dropdown ARIA keyboard navigation mapping
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Close dropdown on Escape key
            if (e.key === 'Escape') {
                setIsOpen(false);
                setTimeout(() => triggerRef.current?.focus(), 0);
                return;
            }

            if (!isOpen || !menuRef.current) return;

            const focusableItems = Array.from(
                menuRef.current.querySelectorAll('[role="menuitem"]:not([disabled])')
            ) as HTMLElement[];
            
            if (focusableItems.length === 0) return;

            const currentIndex = focusableItems.indexOf(document.activeElement as HTMLElement);

            switch (e.key) {
                case 'ArrowDown':
                    e.preventDefault();
                    if (currentIndex < focusableItems.length - 1) {
                        focusableItems[currentIndex + 1].focus();
                    } else {
                        focusableItems[0].focus(); // cycle to top
                    }
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    if (currentIndex > 0) {
                        focusableItems[currentIndex - 1].focus();
                    } else {
                        focusableItems[focusableItems.length - 1].focus(); // cycle to bottom
                    }
                    break;
                case 'Home':
                    e.preventDefault();
                    focusableItems[0].focus();
                    break;
                case 'End':
                    e.preventDefault();
                    focusableItems[focusableItems.length - 1].focus();
                    break;
            }
        };

        if (isOpen) {
            document.addEventListener('keydown', handleKeyDown);
            // On open, optionally focus the first item if opened via keyboard? 
            // We'll let native Tab do its thing or the user can ArrowDown.
            // But ARIA dictates: If opened via Space/Enter/Down Arrow, focus first item.
            // For simplicity, we just listen to keydowns while open.
        }
        
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen]);

    const handleSelectView = useCallback((view: AccountView) => {
        setActiveView(view);
        setIsOpen(false);
    }, []);

    const handleLogout = useCallback(() => {
        setIsOpen(false);
        logout();
        window.location.href = '/'; 
    }, [logout]);

    const handleClosePanel = useCallback(() => {
        setActiveView(null);
        setTimeout(() => triggerRef.current?.focus(), 0);
    }, []);

    if (!user) return null;

    return (
        <>
            <div 
                className="relative" 
                ref={menuRef}
                onBlur={(e) => {
                    // Close menu if focus moves outside the module
                    if (!menuRef.current?.contains(e.relatedTarget as Node)) {
                        setIsOpen(false);
                    }
                }}
            >
                <button 
                    ref={triggerRef}
                    onClick={() => setIsOpen(!isOpen)}
                    aria-expanded={isOpen}
                    aria-haspopup="true"
                    aria-controls="user-dropdown-menu"
                    id="user-menu-button"
                    className="flex items-center gap-3 px-3 py-1.5 border border-[var(--border-color)] hover:border-[var(--accent-color)]/20 hover:bg-[var(--hover-bg)] transition-all group focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)]/50"
                >
                    <div className="flex flex-col items-end">
                        <span className="text-[0.8rem] font-black text-[var(--text-primary)] uppercase tracking-wider max-w-[120px] truncate">{user.email.split('@')[0]}</span>
                        <span className="text-[0.7rem] font-mono text-[var(--text-muted)] uppercase tracking-widest leading-none">ROLE: {user.role}</span>
                    </div>
                    <div className="h-8 w-8 bg-[var(--bg-tertiary)] border border-[var(--border-color)] flex items-center justify-center relative group-hover:bg-[var(--hover-bg)] transition-colors">
                        <UserIcon className="w-4 h-4 text-[var(--text-muted)] group-hover:text-[var(--text-primary)] transition-colors" />
                        {user.plan !== 'FREE' && <div className="absolute -top-1 -right-1 h-2 w-2 bg-[var(--accent-color)] shadow-[0_0_10px_var(--accent-color)] rounded-full"></div>}
                    </div>
                    <ChevronDownIcon className={`w-3 h-3 text-[var(--text-muted)] transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>

                {isOpen && (
                    <div 
                        id="user-dropdown-menu"
                        role="menu"
                        aria-labelledby="user-menu-button"
                        className="absolute right-0 mt-2 w-64 bg-[var(--bg-primary)] border border-[var(--border-color)] shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-[100] animate-in fade-in slide-in-from-top-2 duration-200"
                    >
                        {/* Header */}
                        <div className="p-4 border-b border-[var(--border-color)] bg-[var(--bg-tertiary)]/50 cursor-default">
                            <div className="text-[0.65rem] font-black text-[var(--text-muted)] uppercase tracking-[0.2em] mb-1">Signed in as</div>
                            <div className="text-sm font-bold text-[var(--text-primary)] truncate break-all overflow-hidden" title={user.email}>{user.email}</div>
                            <div className="mt-2 flex items-center gap-2">
                                <span className="px-1.5 py-0.5 bg-[var(--accent-color)]/10 text-[var(--accent-color)] text-[0.7rem] font-black uppercase tracking-widest border border-[var(--accent-color)]/20 shrink-0">
                                    {user.plan}
                                </span>
                                {user.organization_name && (
                                    <span className="text-[0.7rem] font-mono text-[var(--text-muted)] truncate italic relative top-px" title={user.organization_name}>
                                        // {user.organization_name}
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="p-2 flex flex-col gap-0.5">
                            <MenuButton 
                                onClick={() => handleSelectView('profile')}
                                icon={<UserIcon className="w-4 h-4" />} 
                                label="Profile Settings" 
                            />
                            <MenuButton 
                                onClick={() => handleSelectView('license')}
                                icon={<CreditCardIcon className="w-4 h-4" />} 
                                label="License & Usage" 
                                badge={user.plan === 'FREE' ? 'UPGRADE' : undefined} 
                            />
                            <MenuButton 
                                onClick={() => handleSelectView('api')}
                                icon={<KeyIcon className="w-4 h-4" />} 
                                label="API Access" 
                            />
                            <MenuButton 
                                onClick={() => handleSelectView('security')}
                                icon={<ShieldCheckIcon className="w-4 h-4" />} 
                                label="Security & Audit" 
                            />
                        </div>

                        {/* Final Sign out Handler */}
                        <div className="p-2 border-t border-[var(--border-color)] bg-[var(--bg-tertiary)]/30">
                            <button 
                                role="menuitem"
                                onClick={handleLogout}
                                className="w-full flex items-center gap-3 px-3 py-2 text-[var(--accent-color)] hover:bg-[var(--accent-color)]/5 transition-colors focus:outline-none focus:bg-[var(--accent-color)]/10 text-[0.8rem] font-bold uppercase tracking-[0.1em]"
                            >
                                <ArrowLeftOnRectangleIcon className="w-4 h-4" />
                                <span>Sign out</span>
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Sub View Drawers Triggered by State */}
            {activeView && (
                <AccountPanel activeView={activeView} onClose={handleClosePanel} />
            )}
        </>
    );
};

const MenuButton: React.FC<{ icon: React.ReactNode, label: string, badge?: string, disabled?: boolean, onClick: () => void }> = ({ icon, label, badge, disabled, onClick }) => (
    <button 
        role="menuitem"
        onClick={onClick}
        disabled={disabled}
        className={`w-full flex items-center justify-between px-3 py-2.5 transition-colors group focus:outline-none ${
            disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-[var(--hover-bg)] focus:bg-[var(--hover-bg)]'
        }`}
    >
        <div className="flex items-center gap-3 w-full overflow-hidden">
            <span className="text-[var(--text-muted)] group-hover:text-[var(--text-primary)] transition-colors shrink-0">{icon}</span>
            <span className="text-[0.8rem] font-bold text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] uppercase tracking-tight truncate">{label}</span>
        </div>
        {badge && (
            <span className="text-[0.65rem] font-black text-[#50fa7b] bg-[#50fa7b]/10 px-1 border border-[#50fa7b]/20 shrink-0 uppercase tracking-wider">{badge}</span>
        )}
    </button>
);
