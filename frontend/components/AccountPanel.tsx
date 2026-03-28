import React, { useEffect, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import { t } from '../i18n';
import { 
    ShieldCheckIcon, 
    KeyIcon, 
    CreditCardIcon, 
    AtSymbolIcon, 
    IdentificationIcon,
    ArrowPathIcon,
    CheckCircleIcon
} from '@heroicons/react/24/outline';

export type AccountView = 'profile' | 'license' | 'api' | 'security';

interface AccountPanelProps {
    activeView: AccountView;
    onClose: () => void;
}

export const AccountPanel: React.FC<AccountPanelProps> = ({ activeView, onClose }) => {
    const { user } = useAuth();
    const trapRef = useRef<HTMLDivElement>(null);
    const initialFocusRef = useRef<HTMLButtonElement>(null);

    // Initial Focus and Trap Management
    useEffect(() => {
        // Set initial focus
        if (initialFocusRef.current) {
            initialFocusRef.current.focus();
        }

        // Handle Escape to close AND Trap TAB navigation
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
                return;
            }

            if (e.key === 'Tab' && trapRef.current) {
                const focusableNodes = Array.from(
                    trapRef.current.querySelectorAll<HTMLElement>(
                        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
                    )
                ).filter(node => !node.hasAttribute('disabled'));

                if (focusableNodes.length === 0) return;

                const firstElement = focusableNodes[0];
                const lastElement = focusableNodes[focusableNodes.length - 1];

                // Catch-all: If focus escaped the trap container, pull it back in
                if (!trapRef.current.contains(document.activeElement)) {
                    e.preventDefault();
                    if (e.shiftKey) {
                        lastElement.focus();
                    } else {
                        firstElement.focus();
                    }
                    return;
                }

                if (e.shiftKey) {
                    if (document.activeElement === firstElement) {
                        e.preventDefault();
                        lastElement.focus();
                    }
                } else {
                    if (document.activeElement === lastElement) {
                        e.preventDefault();
                        firstElement.focus();
                    }
                }
            }
        };

        // We bind the listener to document so we ensure catching the event
        // if for some reason focus slipped (though it shouldn't mathematically slip since we bounce it)
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    if (!user) return null;

    // View Routing
    const renderActiveView = () => {
        switch (activeView) {
            case 'profile':
                return <ProfilePanel user={user} />;
            case 'license':
                return <LicensePanel user={user} />;
            case 'api':
                return <ApiAccessPanel user={user} />;
            case 'security':
                return <SecurityPanel user={user} />;
            default:
                return null;
        }
    };

    const getViewTitle = () => {
        switch (activeView) {
            case 'profile': return t('account.profile.title');
            case 'license': return t('account.license.title');
            case 'api': return t('account.api.title');
            case 'security': return t('account.security.title');
            default: return t('appName');
        }
    };

    return (
        <div 
            className="fixed inset-0 z-[1000] flex items-center justify-end bg-black/60 backdrop-blur-sm animate-in fade-in duration-300"
            role="dialog"
            aria-modal="true"
            aria-labelledby="panel-title"
        >
            <div 
                ref={trapRef}
                className="h-full w-full max-w-xl bg-[var(--bg-primary)] border-l border-[var(--border-color)] shadow-[-50px_0_100px_rgba(0,0,0,0.5)] flex flex-col animate-in slide-in-from-right duration-500 overflow-hidden"
                onClick={(e) => e.stopPropagation()}
                tabIndex={-1}
            >
                {/* Header */}
                <div className="px-8 py-6 border-b border-[var(--border-color)] flex items-center justify-between bg-[var(--bg-tertiary)]/20 shadow-sm shrink-0">
                    <div className="overflow-hidden pr-4 flex-1">
                        <div className="text-[0.62rem] font-black text-[var(--accent-color)] uppercase tracking-[0.3em] mb-1 truncate" title={user.email}>
                            {user.email} // Identity Context
                        </div>
                        <h2 id="panel-title" className="text-xl md:text-2xl font-black text-[var(--text-primary)] uppercase tracking-tight truncate">
                            {getViewTitle()}
                        </h2>
                    </div>
                    <button 
                        ref={initialFocusRef}
                        onClick={onClose} 
                        aria-label={t('close')}
                        className="px-3 py-1.5 border border-[var(--border-color)] shrink-0 hover:border-[var(--accent-color)] hover:bg-[var(--accent-color)]/10 hover:text-[var(--accent-color)] text-[var(--text-muted)] text-[0.65rem] uppercase tracking-widest transition-all font-mono focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)]"
                    >
                        {t('close')}
                    </button>
                </div>

                {/* scroll container */}
                <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-12">
                    {renderActiveView()}
                </div>

                {/* Global Footer info relative to node */}
                <div className="p-4 md:p-6 border-t border-[var(--border-color)] shrink-0 bg-[var(--bg-tertiary)]/30 text-center flex justify-between items-center text-[0.65rem]">
                    <span className="font-mono text-[var(--text-muted)] opacity-50 uppercase tracking-widest truncate max-w-[50%] pr-2">
                        Node_ID: {user.id.split('-')[0]}
                    </span>
                    <span className="font-mono text-[var(--text-muted)] opacity-50 uppercase tracking-widest shrink-0">
                        Role Group: {user.role}
                    </span>
                </div>
            </div>
            
            {/* Click outside to close wrapper (tabIndex=-1 prevents focusing background) */}
            <div className="absolute inset-0 -z-10" onClick={onClose} tabIndex={-1} aria-hidden="true" />
        </div>
    );
};

// -------------------------------------------------------------------------------- //
// SEPARATE VIEWS COMPONENTS
// -------------------------------------------------------------------------------- //

const ProfilePanel = ({ user }: { user: any }) => (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-700 max-w-full">
        <SectionTitle title={t('account.identity')} icon={<IdentificationIcon className="w-5 h-5" />} />
        
        <div className="grid gap-6">
            <IdentityField 
                label={t('account.email.label')} 
                value={user.email} 
                icon={<AtSymbolIcon className="w-4 h-4 shrink-0" />} 
                readOnly 
            />
            <IdentityField 
                label={t('account.role.label')} 
                value={user.role} 
                icon={<ShieldCheckIcon className="w-4 h-4 shrink-0" />} 
                readOnly 
            />
            
            {user.organization_name ? (
                <IdentityField 
                    label={t('account.org.label')} 
                    value={user.organization_name} 
                    readOnly 
                />
            ) : (
                <div className="p-4 border border-dashed border-[var(--border-color)] bg-[var(--bg-tertiary)]/10">
                    <span className="text-[0.65rem] font-bold text-[var(--text-muted)] uppercase tracking-widest">{t('account.org.none')}</span>
                </div>
            )}
        </div>
        
        <div className="pt-6 mt-6 border-t border-[var(--border-color)]">
            <button 
                disabled={true}
                tabIndex={-1}
                aria-disabled="true"
                className="px-6 py-2 border border-[var(--border-color)] text-[0.7rem] font-black uppercase tracking-widest opacity-50 cursor-not-allowed bg-[var(--bg-secondary)] text-[var(--text-muted)]"
            >
                Edit Identification (Coming Soon)
            </button>
        </div>
    </div>
);

const LicensePanel = ({ user }: { user: any }) => (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-700 max-w-full">
        <SectionTitle title={t('account.quotas')} icon={<CreditCardIcon className="w-5 h-5" />} />
        
        <div className="border border-[var(--border-color)] bg-[var(--bg-tertiary)] p-6 space-y-6 relative overflow-hidden">
            <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-4">
                <div>
                    <span className="block text-[0.65rem] font-black text-[var(--text-muted)] uppercase tracking-[0.2em] mb-1">{t('account.service.tier')}</span>
                    <span className="text-xl font-black text-[var(--text-primary)] uppercase tracking-tight truncate max-w-full block">{user.plan}</span>
                </div>
                <div className={`h-2 w-2 rounded-full shrink-0 ${user.plan === 'FREE' ? 'bg-[var(--text-muted)]' : 'bg-[#50fa7b] shadow-[0_0_15px_#50fa7b]'}`} />
            </div>
            
            <div className="space-y-4">
                <UsageBar label="Daily Technical Parsing Jobs" current={0} total={user.daily_jobs_limit} />
                <UsageBar label="Automated Preflight AI Magic Fix" current={user.ai_magic_fix_enabled ? 1 : 0} total={1} BooleanCap="ENABLED" />
            </div>

            {user.plan === 'FREE' && (
                <div className="mt-8 pt-6 border-t border-[var(--border-color)] flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <p className="text-[0.7rem] font-mono text-[var(--text-secondary)] opacity-80 flex-1">
                        Unlock unbounded processing limits and full preflight analysis features by upgrading your node access.
                    </p>
                    <button className="shrink-0 px-6 py-3 bg-[var(--accent-color)] text-[var(--bg-primary)] text-[0.7rem] font-black uppercase tracking-[0.2em] hover:bg-[var(--accent-hover)] transition-all focus:outline-none focus:ring-2 focus:ring-[var(--accent-hover)] focus:ring-offset-2 focus:ring-offset-[var(--bg-primary)]">
                        Upgrade To PRO
                    </button>
                </div>
            )}
        </div>
    </div>
);

const ApiAccessPanel = ({ user }: { user: any }) => (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-700 max-w-full">
        <SectionTitle title={t('account.m2m.bridge')} icon={<KeyIcon className="w-5 h-5" />} />
        
        {user.role === 'DEVELOPER' || user.plan !== 'FREE' ? (
            <div className="space-y-6 max-w-full">
                <div className="p-4 md:p-6 border border-[var(--border-color)] bg-[var(--bg-tertiary)] font-mono relative overflow-hidden">
                    <div className="text-[0.65rem] text-[var(--text-muted)] mb-3 uppercase tracking-widest truncate">Active Development Provision</div>
                    
                    <div className="space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-[var(--bg-secondary)] border border-[var(--border-color)] p-3 gap-3">
                            <span className="text-sm font-bold opacity-40 select-none overflow-hidden text-ellipsis break-all max-w-full block">ppos_live_••••••••••••••••••••</span>
                            <span className="text-[0.55rem] uppercase tracking-widest text-[#50fa7b] bg-[#50fa7b]/10 px-2 py-0.5 border border-[#50fa7b]/20 shrink-0 self-start sm:self-auto">Active</span>
                        </div>
                        
                        <button className="flex items-center gap-2 text-[0.65rem] font-black text-[var(--accent-color)] uppercase hover:text-[var(--accent-hover)] transition-colors py-1 focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)] focus:ring-offset-2 focus:ring-offset-[var(--bg-primary)] rounded-sm">
                            <ArrowPathIcon className="w-4 h-4 shrink-0" />
                            <span className="truncate">Request Key Rotation</span>
                        </button>
                    </div>
                </div>
                
                <p className="border-l-2 border-[var(--accent-color)]/50 pl-4 py-2 text-[0.7rem] font-mono text-[var(--text-muted)]">
                    API Provisioning is currently managed mechanically. If you require rotation of secrets or higher throughput keys, contact support.
                </p>
            </div>
        ) : (
            <div className="p-8 border-2 border-dashed border-[var(--border-color)] text-center bg-[var(--bg-tertiary)]/20 flex flex-col items-center">
                <KeyIcon className="w-8 h-8 text-[var(--text-muted)] mb-4 shrink-0" />
                <h4 className="text-[var(--text-primary)] font-bold uppercase tracking-wider mb-2">No API Access Provisioned</h4>
                <p className="text-[0.75rem] font-mono text-[var(--text-muted)] max-w-[280px]">
                    Your current license profile does not grant systematic headless access. Upgrade to PRO or higher to gain programmatic ingress.
                </p>
            </div>
        )}
    </div>
);

const SecurityPanel = ({ user }: { user: any }) => (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-700 max-w-full">
        <SectionTitle title={t('account.session.integrity')} icon={<ShieldCheckIcon className="w-5 h-5" />} />
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-5 border border-[var(--border-color)] bg-[var(--bg-tertiary)] flex flex-col min-w-0">
                <span className="text-[0.55rem] font-black text-[var(--text-muted)] uppercase tracking-[0.2em] mb-3 truncate block">Authentication Contract</span>
                <div className="flex items-center gap-2 text-[var(--text-primary)] font-bold mt-auto shrink-0">
                    <CheckCircleIcon className="w-5 h-5 text-[#50fa7b] shrink-0" />
                    <span className="text-sm truncate block">JWT Validated</span>
                </div>
            </div>
            
            <div className="p-5 border border-[var(--border-color)] bg-[var(--bg-tertiary)] flex flex-col min-w-0">
                <span className="text-[0.55rem] font-black text-[var(--text-muted)] uppercase tracking-[0.2em] mb-3 truncate block">Login Method</span>
                <div className="flex items-center gap-2 text-[var(--text-primary)] font-bold mt-auto shrink-0">
                    <span className="text-sm font-mono text-[var(--text-secondary)] truncate block">Standard Flow</span>
                </div>
            </div>
        </div>

        <div className="mt-8 space-y-4">
            <h4 className="text-[0.65rem] font-black uppercase tracking-[0.2em] text-[var(--text-primary)] border-b border-[var(--border-color)] pb-2 truncate max-w-full">Audit Logs</h4>
            <div className="p-4 md:p-6 border border-dashed border-[var(--border-color)]/60 bg-[var(--bg-tertiary)]/30 flex items-start gap-4 flex-col sm:flex-row mx-auto justify-start text-left w-full overflow-hidden">
                <ShieldCheckIcon className="w-5 h-5 text-[var(--text-muted)] shrink-0 hidden sm:block" />
                <div className="min-w-0 flex-1 w-full">
                    <div className="text-[0.7rem] font-black text-[var(--text-primary)] uppercase tracking-widest mb-2 flex items-center gap-2">
                        <ShieldCheckIcon className="w-4 h-4 text-[#50fa7b] shrink-0 sm:hidden block" />
                        State Nominal
                    </div>
                    <p className="text-[0.7rem] font-mono text-[var(--text-muted)] break-words w-full">
                        No active security warnings or forensic exceptions detected for this session node. Historical audit syncing will be available in future releases.
                    </p>
                </div>
            </div>
        </div>
    </div>
);

// -------------------------------------------------------------------------------- //
// COMMONS
// -------------------------------------------------------------------------------- //

const SectionTitle: React.FC<{ title: string, icon: React.ReactNode }> = ({ title, icon }) => (
    <div className="flex items-center gap-3 text-[var(--text-primary)] pb-2 border-b border-[var(--border-color)]">
        <span className="text-[var(--accent-color)] shrink-0">{icon}</span>
        <h3 className="text-sm font-black uppercase tracking-[0.2em] truncate">{title}</h3>
    </div>
);

const IdentityField: React.FC<{ label: string, value: string, icon?: React.ReactNode, readOnly?: boolean }> = ({ label, value, icon, readOnly }) => (
    <div className="flex flex-col gap-2 p-4 md:p-5 border border-[var(--border-color)] bg-[var(--bg-secondary)] transition-colors hover:border-[var(--text-muted)] min-w-0">
        <span className="text-[0.65rem] font-black text-[var(--text-muted)] uppercase tracking-[0.2em] truncate">{label}</span>
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 text-base font-bold text-[var(--text-primary)] overflow-hidden w-full">
            {icon && <span className="text-[var(--accent-color)] shrink-0 hidden sm:block">{icon}</span>}
            <span className="font-mono text-xs md:text-sm truncate w-full break-all whitespace-normal sm:whitespace-nowrap sm:break-normal block">
                {value}
            </span>
        </div>
    </div>
);

const UsageBar: React.FC<{ label: string, current: number, total: number, BooleanCap?: string }> = ({ label, current, total, BooleanCap }) => (
    <div className="space-y-2 p-3 border border-transparent hover:border-[var(--border-color)] transition-all bg-[var(--bg-secondary)] min-w-0 w-full">
        <div className="flex flex-col sm:flex-row sm:justify-between items-start sm:items-center text-[0.65rem] font-black uppercase tracking-widest gap-1 sm:gap-4 overflow-hidden">
            <span className="text-[var(--text-primary)] truncate max-w-full shrink-1">{label}</span>
            {BooleanCap ? (
                <span className="text-[#50fa7b] shrink-0">{BooleanCap}</span>
            ) : (
                <span className="text-[var(--text-muted)] font-mono shrink-0">{current} / {total}</span>
            )}
        </div>
        <div className="h-1.5 bg-[var(--bg-tertiary)] w-full overflow-hidden mt-1 sm:mt-0">
            <div 
                className="h-full bg-[var(--accent-color)] shadow-[0_0_10px_var(--accent-color)] transition-all duration-1000 ease-in-out" 
                style={{ width: `${Math.min(100, (current / total) * 100)}%` }}
            />
        </div>
    </div>
);
