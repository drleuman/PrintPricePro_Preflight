import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../hooks/useAuth';
import { useTranslation } from '../i18n';
import { 
    ShieldCheckIcon, 
    KeyIcon, 
    CreditCardIcon, 
    AtSymbolIcon, 
    IdentificationIcon,
    ArrowPathIcon,
    CheckCircleIcon,
    DocumentTextIcon,
    ArrowDownTrayIcon
} from '@heroicons/react/24/outline';
import { useUserTelemetry } from '../hooks/useUserTelemetry';
import { useUserFileHistory, FileHistoryItem } from '../hooks/useUserFileHistory';

export type AccountView = 'profile' | 'license' | 'api' | 'security' | 'history';

const FIX_LABELS: Record<string, string> = {
    REBUILD_TRIMBOX: 'Trim box rebuilt',
    APPLY_BLEED: 'Bleed area adjusted',
    CONVERT_CMYK: 'Colors converted to CMYK',
    INJECT_OUTPUT_INTENT: 'Color profile attached',
    FLATTEN_FORMS: 'Form fields flattened',
    NORMALIZE_PAGE_BOXES: 'Page boxes normalized',
    CONVERT_GRAYSCALE: 'Converted to grayscale',
    REBUILD_300DPI: 'Rebuilt for 300 DPI output',
    BOOKLET_MODE: 'Prepared for booklet production',
    IMPOSE_BOOKLET: 'Prepared for booklet production',
};

function humanizeFixCodeLocal(code?: string | null): string {
    if (!code) return '—';
    return FIX_LABELS[code] ?? code;
}

function FixCoverageItemRow({ item }: { item: any }) {
    const code = item.repair_code || item.fix_method;
    return (
        <div className="pl-2 border-l border-[var(--border-color)]">
            <div className="flex items-center gap-2 flex-wrap">
                {item.severity && (
                    <span className={`text-[0.5rem] font-bold uppercase px-1.5 py-0.5 border ${
                        item.severity === 'error'
                            ? 'bg-red-500/10 text-red-400 border-red-500/20'
                            : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
                    }`}>
                        {item.severity}
                    </span>
                )}
                {code && (
                    <span className="text-[var(--text-primary)] font-bold text-[0.65rem]">
                        {humanizeFixCodeLocal(code)}
                    </span>
                )}
            </div>
            {item.message && (
                <p className="text-[var(--text-muted)] text-[0.6rem] leading-snug mt-0.5">{item.message}</p>
            )}
            {item.repair_reason && (
                <p className="text-[var(--text-muted)] italic text-[0.6rem] leading-snug mt-0.5">"{item.repair_reason}"</p>
            )}
        </div>
    );
}

function FixCoveragePanel({ coverage }: { coverage: any }) {
    const pct = coverage.total_issues > 0
        ? Math.round((coverage.fixed_count / coverage.total_issues) * 100)
        : 0;

    return (
        <div className="mt-1 font-mono text-xs bg-[var(--bg-secondary)] p-3 border border-[var(--border-color)]">
            <div className="flex items-center justify-between mb-1.5">
                <span className="text-[0.6rem] font-bold text-[var(--text-muted)] uppercase tracking-widest">
                    Fix Coverage
                </span>
                <span className="text-[0.6rem] text-[var(--text-muted)]">
                    {coverage.fixed_count} / {coverage.total_issues} issues resolved
                </span>
            </div>
            <div className="w-full h-0.5 bg-[var(--bg-tertiary)] mb-3 overflow-hidden">
                <div className="h-full bg-[#50fa7b] transition-all" style={{ width: `${pct}%` }} />
            </div>

            {coverage.fixed?.length > 0 && (
                <div className="mb-3">
                    <span className="text-[0.6rem] font-bold text-[#50fa7b] uppercase tracking-widest block mb-1.5">
                        ✓ Applied ({coverage.fixed_count})
                    </span>
                    <div className="space-y-2">
                        {coverage.fixed.map((item: any, i: number) => (
                            <FixCoverageItemRow key={i} item={item} />
                        ))}
                    </div>
                </div>
            )}

            {coverage.skipped?.length > 0 && (
                <div className="mb-3">
                    <span className="text-[0.6rem] font-bold text-yellow-400 uppercase tracking-widest block mb-1.5">
                        ↷ Skipped ({coverage.skipped_count})
                    </span>
                    <div className="space-y-2">
                        {coverage.skipped.map((item: any, i: number) => (
                            <FixCoverageItemRow key={i} item={item} />
                        ))}
                    </div>
                </div>
            )}

            {coverage.failed?.length > 0 && (
                <div className="mb-3">
                    <span className="text-[0.6rem] font-bold text-red-400 uppercase tracking-widest block mb-1.5">
                        ✗ Failed ({coverage.failed_count})
                    </span>
                    <div className="space-y-2">
                        {coverage.failed.map((item: any, i: number) => (
                            <FixCoverageItemRow key={i} item={item} />
                        ))}
                    </div>
                </div>
            )}

            {coverage.not_attempted?.length > 0 && (
                <div className="mb-1">
                    <span className="text-[0.6rem] font-bold text-[var(--text-muted)] uppercase tracking-widest block mb-1.5">
                        — Not Attempted ({coverage.not_attempted_count})
                    </span>
                    <div className="space-y-2">
                        {coverage.not_attempted.map((item: any, i: number) => (
                            <FixCoverageItemRow key={i} item={item} />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

interface AccountPanelProps {
    activeView: AccountView;
    onClose: () => void;
    onChangeView?: (view: AccountView) => void;
}

export const AccountPanel: React.FC<AccountPanelProps> = ({ activeView, onClose, onChangeView }) => {
    const { t } = useTranslation();
    const { user } = useAuth();
    const { telemetry, isLoading: isTelemetryLoading, error: telemetryError } = useUserTelemetry();
    // Fetch globally so we can show the badge on any tab
    const { history, isLoading: isHistoryLoading, error: historyError, refresh: refreshHistory } = useUserFileHistory(20);
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
                return <ProfilePanel user={user} telemetry={telemetry} />;
            case 'license':
                return <LicensePanel user={user} telemetry={telemetry} isTelemetryLoading={isTelemetryLoading} telemetryError={telemetryError} />;
            case 'api':
                return <ApiAccessPanel user={user} telemetry={telemetry} />;
            case 'security':
                return <SecurityPanel user={user} telemetry={telemetry} />;
            case 'history':
                return <HistoryPanel history={history} isLoading={isHistoryLoading} error={historyError} refresh={refreshHistory} />;
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
            case 'history': return t('account.history.title').toUpperCase();
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
                <div className="px-4 md:px-8 py-5 md:py-6 border-b border-[var(--border-color)] flex items-center justify-between bg-[var(--bg-tertiary)]/20 shadow-sm shrink-0">
                    <div className="overflow-hidden pr-4 flex-1">
                        <div className="text-[0.62rem] font-black text-[var(--accent-color)] uppercase tracking-[0.3em] mb-1 truncate break-all" title={user.email}>
                            {user.email} // {t('account.identityContext')}
                        </div>
                        <h2 id="panel-title" className="text-xl md:text-2xl font-black text-[var(--text-primary)] uppercase tracking-tight truncate break-all">
                            {getViewTitle()}
                        </h2>
                    </div>
                    <button 
                        ref={initialFocusRef}
                        onClick={onClose} 
                        aria-label={t('common.close')}
                        className="px-3 py-1.5 border border-[var(--border-color)] shrink-0 hover:border-[var(--accent-color)] hover:bg-[var(--accent-color)]/10 hover:text-[var(--accent-color)] text-[var(--text-muted)] text-[0.65rem] uppercase tracking-widest transition-all font-mono focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)]"
                    >
                        {t('common.close')}
                    </button>
                </div>

                {/* Tabs */}
                {onChangeView && (
                    <div className="flex px-4 md:px-8 border-b border-[var(--border-color)] bg-[var(--bg-primary)] overflow-x-auto shrink-0 scrollbar-hide">
                        {[
                            { id: 'profile', label: t('account.profile.title') },
                            { id: 'license', label: t('account.license.title') },
                            { id: 'history', label: t('account.history.title'), badge: history?.items?.length },
                            { id: 'api', label: t('account.api.title') },
                            { id: 'security', label: t('account.security.title') }
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => onChangeView(tab.id as AccountView)}
                                className={`px-4 py-3 text-[0.65rem] md:text-xs font-bold uppercase tracking-wider whitespace-nowrap border-b-2 transition-colors focus:outline-none ${
                                    activeView === tab.id
                                        ? 'border-[var(--accent-color)] text-[var(--text-primary)]'
                                        : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:border-[var(--border-color)]'
                                }`}
                            >
                                {tab.label}
                                {tab.badge ? (
                                    <span className="ml-2 inline-flex items-center justify-center px-1.5 py-0.5 text-[0.6rem] font-black text-[#50fa7b] bg-[#50fa7b]/10 border border-[#50fa7b]/20 rounded-full">
                                        {tab.badge}
                                    </span>
                                ) : null}
                            </button>
                        ))}
                    </div>
                )}

                {/* scroll container */}
                <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-12">
                    {renderActiveView()}
                </div>

                {/* Global Footer info relative to node */}
                <div className="p-4 md:p-6 border-t border-[var(--border-color)] shrink-0 bg-[var(--bg-tertiary)]/30 text-center flex justify-between items-center text-[0.65rem]">
                    <span className="font-mono text-[var(--text-muted)] opacity-50 uppercase tracking-widest truncate max-w-[50%] pr-2">
                        {t('common.nodeId')}: {user.id.split('-')[0]}
                    </span>
                    <span className="font-mono text-[var(--text-muted)] opacity-50 uppercase tracking-widest shrink-0">
                        {t('common.role')}: {user.role}
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

const ProfilePanel = ({ user, telemetry }: { user: any, telemetry: any }) => {
    const { t } = useTranslation();
    return (
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
                    {t('account.editSoon')}
                </button>
            </div>
        </div>
    );
};

const LicensePanel = ({ user, telemetry, isTelemetryLoading, telemetryError }: { user: any, telemetry: any, isTelemetryLoading?: boolean, telemetryError?: any }) => {
    const { t } = useTranslation();
    
    if (isTelemetryLoading) {
        return (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-700 max-w-full">
                <SectionTitle title={t('account.quotas')} icon={<CreditCardIcon className="w-5 h-5" />} />
                <div className="p-8 border-2 border-dashed border-[var(--border-color)] text-center text-[var(--text-muted)] text-[0.75rem] font-mono">
                    Loading account telemetry...
                </div>
            </div>
        );
    }

    if (telemetryError || !telemetry) {
        return (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-700 max-w-full">
                <SectionTitle title={t('account.quotas')} icon={<CreditCardIcon className="w-5 h-5" />} />
                <div className="p-8 border-2 border-dashed border-red-500/50 text-center text-red-400 text-[0.75rem] font-mono">
                    Telemetry unavailable
                </div>
            </div>
        );
    }

    const resolvedTelemetry = telemetry?.ok ? telemetry : telemetry;

    const license = resolvedTelemetry?.license ?? {};
    const identity = resolvedTelemetry?.identity ?? {};
    const adminAccess = resolvedTelemetry?.adminAccess ?? {};
    const usage = resolvedTelemetry?.usage ?? {};

    const commercialPlan = license.plan || 'UNKNOWN';
    const accessRole = identity.operationalRole || identity.role || 'UNKNOWN';
    const appRole = identity.appRole || 'UNKNOWN';
    const adminActive = adminAccess.enabled === true;

    const dailyLimit = license.daily_jobs_limit;
    const jobsToday = usage.jobsToday ?? 0;
    const jobsDisplay = dailyLimit == null ? `${jobsToday} / Unlimited` : `${jobsToday} / ${dailyLimit}`;

    const maxUploadMb = license.max_file_size_mb ?? 0;

    const shouldShowUpgrade =
        !adminActive &&
        !['SYSTEM', 'ENTERPRISE', 'FOUNDING_PRINTHOUSE'].includes(commercialPlan);

    console.info('[ACCOUNT-PANEL][LICENSE-TELEMETRY]', {
        commercialPlan,
        accessRole,
        appRole,
        adminActive,
        jobsDisplay,
        maxUploadMb
    });

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-700 max-w-full">
            <SectionTitle title={t('account.quotas')} icon={<CreditCardIcon className="w-5 h-5" />} />
            
            <div className="border border-[var(--border-color)] bg-[var(--bg-tertiary)] p-6 space-y-6 relative overflow-hidden">
                <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-4">
                    <div>
                        <span className="block text-[0.65rem] font-black text-[var(--text-muted)] uppercase tracking-[0.2em] mb-1">Commercial Plan</span>
                        <span className="text-xl font-black text-[var(--text-primary)] uppercase tracking-tight truncate max-w-full block">{commercialPlan}</span>
                    </div>
                    <div className={`h-2 w-2 rounded-full shrink-0 ${commercialPlan === 'FREE' ? 'bg-[var(--text-muted)]' : 'bg-[#50fa7b] shadow-[0_0_15px_#50fa7b]'}`} />
                </div>
                
                <div className="grid grid-cols-2 gap-4 pb-4 border-b border-[var(--border-color)] text-xs font-mono">
                    <div>
                        <span className="text-[var(--text-muted)] uppercase block text-[0.6rem] mb-1">Access Role</span>
                        <span className="text-[var(--text-primary)]">{accessRole}</span>
                    </div>
                    <div>
                        <span className="text-[var(--text-muted)] uppercase block text-[0.6rem] mb-1">App Role</span>
                        <span className="text-[var(--text-primary)]">{appRole}</span>
                    </div>
                    <div className="col-span-2">
                        <span className="text-[var(--text-muted)] uppercase block text-[0.6rem] mb-1">Admin Access</span>
                        <span className={`${adminActive ? 'text-[#50fa7b]' : 'text-[var(--text-muted)]'} font-bold`}>
                            {adminActive ? 'ACTIVE' : 'INACTIVE'}
                        </span>
                    </div>
                </div>

                <div className="space-y-4">
                    <UsageBar 
                        label={t('account.dailyParsingJobs')} 
                        current={jobsToday} 
                        total={dailyLimit == null ? jobsToday : dailyLimit} 
                        BooleanCap={dailyLimit == null ? 'Unlimited' : undefined}
                    />
                    <UsageBar 
                        label="Max Upload Size" 
                        current={maxUploadMb} 
                        total={maxUploadMb} 
                        BooleanCap={`${maxUploadMb} MB`} 
                    />
                </div>
                
                <div className="mt-4 pt-4 border-t border-[var(--border-color)] text-[0.65rem] font-mono text-[var(--text-muted)] italic">
                    Plan controls commercial limits. Role controls operational/admin permissions.
                </div>

                {shouldShowUpgrade && (
                    <div className="mt-8 pt-6 border-t border-[var(--border-color)] flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div className="flex-1">
                            <h4 className="text-[0.75rem] font-black text-[var(--text-primary)] uppercase tracking-widest mb-1">{t('account.upgradeTitle')}</h4>
                            <p className="text-[0.65rem] font-mono text-[var(--text-secondary)] opacity-80">
                                {t('account.upgradeDesc')}
                            </p>
                        </div>
                        <button className="shrink-0 px-6 py-3 bg-[var(--accent-color)] text-[var(--bg-primary)] text-[0.7rem] font-black uppercase tracking-[0.2em] hover:bg-[var(--accent-hover)] transition-all focus:outline-none focus:ring-2 focus:ring-[var(--accent-hover)] focus:ring-offset-2 focus:ring-offset-[var(--bg-primary)]">
                            {t('account.upgradeBtn')}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

const ApiAccessPanel = ({ user, telemetry }: { user: any, telemetry: any }) => {
    const { t } = useTranslation();
    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-700 max-w-full">
            <SectionTitle title={t('account.m2m.bridge')} icon={<KeyIcon className="w-5 h-5" />} />
            
            {user.role === 'DEVELOPER' || user.plan !== 'FREE' ? (
                <div className="space-y-6 max-w-full">
                    <div className="p-4 md:p-6 border border-[var(--border-color)] bg-[var(--bg-tertiary)] font-mono relative overflow-hidden">
                        <div className="text-[0.65rem] text-[var(--text-muted)] mb-3 uppercase tracking-widest truncate">{t('account.apiProvision')}</div>
                        
                        <div className="space-y-4">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-[var(--bg-secondary)] border border-[var(--border-color)] p-3 gap-3">
                                <span className="text-sm font-bold opacity-40 select-none overflow-hidden text-ellipsis break-all max-w-full block">
                                    {telemetry?.apiAccess?.maskedKey || t('account.apiNoAccessDesc', 'Not provisioned')}
                                </span>
                                <span className={`text-[0.55rem] uppercase tracking-widest px-2 py-0.5 border shrink-0 self-start sm:self-auto ${
                                    telemetry?.apiAccess?.enabled ? 'text-[#50fa7b] bg-[#50fa7b]/10 border-[#50fa7b]/20' : 'text-[var(--text-muted)] bg-[var(--bg-tertiary)] border-[var(--border-color)]'
                                }`}>
                                    {telemetry?.apiAccess?.enabled ? t('common.active') : telemetry?.apiAccess?.rotationStatus || 'INACTIVE'}
                                </span>
                            </div>
                            
                            <button 
                                onClick={async () => {
                                    try {
                                        const token = localStorage.getItem('ppos_auth_token');
                                        await fetch('/api/v2/me/api-key/rotation-request', {
                                            method: 'POST',
                                            headers: { 'Authorization': `Bearer ${token}` }
                                        });
                                        alert('API key rotation requested successfully.');
                                    } catch(e) {
                                        alert('Failed to request API key rotation.');
                                    }
                                }}
                                className="flex items-center gap-2 text-[0.65rem] font-black text-[var(--accent-color)] uppercase hover:text-[var(--accent-hover)] transition-colors py-1 focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)] focus:ring-offset-2 focus:ring-offset-[var(--bg-primary)] rounded-sm"
                            >
                                <ArrowPathIcon className="w-4 h-4 shrink-0" />
                                <span className="truncate">{t('account.apiKeyRotation')}</span>
                            </button>
                        </div>
                    </div>
                    
                    <p className="border-l-2 border-[var(--accent-color)]/50 pl-4 py-2 text-[0.7rem] font-mono text-[var(--text-muted)]">
                        {t('account.apiMechanical')}
                    </p>
                </div>
            ) : (
                <div className="p-8 border-2 border-dashed border-[var(--border-color)] text-center bg-[var(--bg-tertiary)]/20 flex flex-col items-center">
                    <KeyIcon className="w-8 h-8 text-[var(--text-muted)] mb-4 shrink-0" />
                    <h4 className="text-[var(--text-primary)] font-bold uppercase tracking-wider mb-2">{t('account.apiNoAccess')}</h4>
                    <p className="text-[0.75rem] font-mono text-[var(--text-muted)] max-w-[280px]">
                        {t('account.apiNoAccessDesc')}
                    </p>
                </div>
            )}
        </div>
    );
};

const SecurityPanel = ({ user, telemetry }: { user: any, telemetry: any }) => {
    const { t } = useTranslation();
    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-700 max-w-full">
            <SectionTitle title={t('account.session.integrity')} icon={<ShieldCheckIcon className="w-5 h-5" />} />
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-5 border border-[var(--border-color)] bg-[var(--bg-tertiary)] flex flex-col min-w-0">
                    <span className="text-[0.55rem] font-black text-[var(--text-muted)] uppercase tracking-[0.2em] mb-3 truncate block">{t('account.authContract')}</span>
                    <div className="flex items-center gap-2 text-[var(--text-primary)] font-bold mt-auto shrink-0">
                        <CheckCircleIcon className="w-5 h-5 text-[#50fa7b] shrink-0" />
                        <span className="text-sm truncate block">{t('account.jwtValidated')}</span>
                    </div>
                </div>
                
                <div className="p-5 border border-[var(--border-color)] bg-[var(--bg-tertiary)] flex flex-col min-w-0">
                    <span className="text-[0.55rem] font-black text-[var(--text-muted)] uppercase tracking-[0.2em] mb-3 truncate block">{t('account.loginMethod')}</span>
                    <div className="flex items-center gap-2 text-[var(--text-primary)] font-bold mt-auto shrink-0">
                        <span className="text-sm font-mono text-[var(--text-secondary)] truncate block">{telemetry?.security?.loginMethod || t('account.standardFlow')}</span>
                    </div>
                </div>
            </div>

            <div className="mt-8 space-y-4">
                <h4 className="text-[0.65rem] font-black uppercase tracking-[0.2em] text-[var(--text-primary)] border-b border-[var(--border-color)] pb-2 truncate max-w-full">{t('account.auditLogs')}</h4>
                <div className="p-4 md:p-6 border border-dashed border-[var(--border-color)]/60 bg-[var(--bg-tertiary)]/30 flex items-start gap-4 flex-col sm:flex-row mx-auto justify-start text-left w-full overflow-hidden">
                    <ShieldCheckIcon className="w-5 h-5 text-[var(--text-muted)] shrink-0 hidden sm:block" />
                    <div className="min-w-0 flex-1 w-full">
                        <div className="text-[0.7rem] font-black text-[var(--text-primary)] uppercase tracking-widest mb-2 flex items-center gap-2">
                            <ShieldCheckIcon className="w-4 h-4 text-[#50fa7b] shrink-0 sm:hidden block" />
                            {t('account.stateNominal')}
                        </div>
                        <p className="text-[0.7rem] font-mono text-[var(--text-muted)] break-words w-full">
                            {t('account.auditDesc')}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

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
                <span className="text-[#50fa7b] shrink-0 font-bold">{BooleanCap}</span>
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


const HELPTIP_WIDTH = 256;

const HelpTip = ({ text }: { text: string }) => {
    const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
    const triggerRef = useRef<HTMLSpanElement>(null);

    const show = () => {
        if (!triggerRef.current) return;
        const rect = triggerRef.current.getBoundingClientRect();
        const vw = window.innerWidth;
        let left = rect.left;
        if (left + HELPTIP_WIDTH > vw - 8) {
            left = rect.right - HELPTIP_WIDTH;
        }
        setPos({ top: rect.bottom + 6, left: Math.max(8, left) });
    };

    const hide = () => setPos(null);

    useEffect(() => {
        if (!pos) return;
        window.addEventListener('scroll', hide, { capture: true, passive: true });
        return () => window.removeEventListener('scroll', hide, { capture: true });
    }, [pos]);

    return (
        <span className="inline-flex ml-1 align-middle">
            <span
                ref={triggerRef}
                onPointerEnter={show}
                onPointerLeave={hide}
                className="cursor-help text-[var(--text-muted)] border border-[var(--border-color)] px-1 text-[10px] leading-none rounded-sm hover:border-[var(--accent-color)] hover:text-[var(--accent-color)] transition-colors select-none"
            >?</span>
            {pos && createPortal(
                <span
                    style={{ position: 'fixed', top: pos.top, left: pos.left, width: HELPTIP_WIDTH, zIndex: 9999 }}
                    className="pointer-events-none border border-[var(--border-color)] bg-[var(--bg-primary)] p-3 text-[11px] leading-relaxed text-[var(--text-primary)] shadow-[0_5px_15px_rgba(0,0,0,0.5)] normal-case tracking-normal font-normal animate-in fade-in duration-150"
                >
                    {text}
                </span>,
                document.body
            )}
        </span>
    );
};


type TooltipButtonProps = {
  children: React.ReactNode;
  tooltip: string;
  onClick: () => void;
  className?: string;
  disabled?: boolean;
};

const TooltipButton: React.FC<TooltipButtonProps> = ({
  children,
  tooltip,
  onClick,
  className = '',
  disabled = false
}) => {
  return (
    <span className="relative inline-flex group">
      <button
        type="button"
        disabled={disabled}
        onClick={onClick}
        title={tooltip}
        className={[
          'inline-flex items-center justify-center',
          'border border-[var(--border-color)] bg-[var(--bg-tertiary)] text-[var(--text-primary)]',
          'px-3 py-2 text-[11px] font-bold uppercase tracking-[0.12em]',
          'hover:border-[var(--accent-color)] hover:text-[var(--accent-color)]',
          'disabled:opacity-40 disabled:cursor-not-allowed',
          'transition-colors min-h-[34px] rounded-sm',
          className
        ].join(' ')}
      >
        {children}
      </button>

      <span
        className={[
          'pointer-events-none absolute z-50 hidden group-hover:block',
          'left-0 ml-5 sm:ml-0 sm:left-1/2 top-full mt-2 w-[calc(100vw-40px)] max-w-[280px] sm:w-72 sm:-translate-x-1/2', // left-0 and ml-5 on mobile ensures 20px padding from left edge
          'border border-[var(--border-color)] bg-[var(--bg-primary)] px-3 py-2',
          'text-[11px] leading-relaxed text-[var(--text-primary)] shadow-[0_5px_15px_rgba(0,0,0,0.5)]',
          'normal-case tracking-normal font-normal text-left'
        ].join(' ')}
      >
        {tooltip}
      </span>
    </span>
  );
};

const HistoryPanel = ({ history, isLoading, error, refresh }: { history: any, isLoading: boolean, error: any, refresh: () => void }) => {
    const { t } = useTranslation();

    const getStatusTooltip = (status: string) => {
        if (status === 'COMPLETED_WITH_FINDINGS') return "Analysis finished and issues or warnings were found in the PDF.";
        if (status === 'QUEUED') return "This job is waiting or still processing. Refresh the history later to see the final result.";
        if (status === 'DEGRADED') return "The analysis completed with limited diagnostic fidelity. Some information may be incomplete.";
        if (status === 'FAILED') return "The job failed before producing a complete result.";
        if (status === 'REVIEW_REQUIRED') return "The file needs human review before it can be considered production-ready.";
        return "";
    };


    const downloadArtifact = async (jobId: string, type: string) => {
        const token = localStorage.getItem('ppos_auth_token');
        if (!token) return;
        const res = await fetch(`/api/v2/jobs/${jobId}/artifacts/${type}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) {
            alert('Failed to download artifact.');
            return;
        }
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${type}_${jobId}`;
        a.click();
        window.URL.revokeObjectURL(url);
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-700 max-w-full">
            <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-2">
                <div className="flex items-center gap-1"><SectionTitle title={t('account.history.title').toUpperCase()} icon={<DocumentTextIcon className="w-5 h-5" />} /><HelpTip text="Your previous preflight analyses and Magic Fix results. Use this area to review past uploads, download reports, inspect corrected files, and understand what was changed." /></div>
                <button onClick={refresh} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)] focus:ring-offset-2 focus:ring-offset-[var(--bg-primary)] p-1 rounded-sm">
                   <ArrowPathIcon className="w-4 h-4" />
                </button>
            </div>
            
            {isLoading && <div className="text-sm font-mono opacity-50 p-4">Loading history...</div>}
            {error && <div className="text-sm text-red-500 font-mono p-4">Failed to load history: {String(error.message || error)}</div>}
            
            {!isLoading && !error && (!history?.items || history.items.length === 0) && (
                <div className="p-8 border-2 border-dashed border-[var(--border-color)] text-center text-[var(--text-muted)] text-[0.75rem] font-mono">
                    No files processed yet.
                </div>
            )}

            {!isLoading && !error && history?.items && history.items.length > 0 && (
                <div className="space-y-6">
                    <div className="text-[0.65rem] font-bold text-[var(--text-muted)] uppercase tracking-widest">
                        {history.scope === 'tenant' ? 'Showing tenant history.' : 'Showing your files.'}
                        <HelpTip text="This list shows files processed under the current tenant/workspace, not only files uploaded by this browser session." />
                    </div>
                    {history.items.map((item: FileHistoryItem) => (
                        <div key={item.jobId} className="border border-[var(--border-color)] bg-[var(--bg-secondary)] p-4 flex flex-col gap-3 transition-colors hover:border-[var(--text-muted)] min-w-0">
                            <div className="flex justify-between items-start gap-4">
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-[0.55rem] uppercase tracking-widest bg-[var(--bg-tertiary)] text-[var(--text-primary)] px-2 py-0.5 border border-[var(--border-color)] shrink-0">
                                            {item.type}
                                            {item.type === 'ANALYZE' && <HelpTip text="Analysis jobs inspect the PDF and detect print-production issues. They do not modify the file." />}
                                        </span>
                                                                                <span className={`text-[0.55rem] font-bold uppercase tracking-widest px-2 py-0.5 border shrink-0 ${
                                            item.status.includes('ERROR') || item.status.includes('FAILED') ? 'text-red-400 border-red-500/20 bg-red-500/10' :
                                            item.status.includes('REVIEW') || item.status.includes('DEGRADED') ? 'text-yellow-400 border-yellow-500/20 bg-yellow-500/10' :
                                            item.status.includes('CERTIFIED') || item.status.includes('COMPLETED') ? 'text-[#50fa7b] border-[#50fa7b]/20 bg-[#50fa7b]/10' :
                                            item.status.includes('QUEUED') ? 'text-orange-300 border-orange-400/20 bg-orange-400/10' :
                                            'text-[var(--text-primary)] border-[var(--border-color)] bg-[var(--bg-tertiary)]'
                                        }`}>
                                            {item.status.replace(/_/g, ' ')}
                                        </span>
                                    </div>
                                    <h4 className="text-sm font-bold text-[var(--text-primary)] truncate break-all block" title={item.filename}>
                                        {item.filename}
                                        {item.status === 'QUEUED' && <span className="ml-2 text-[0.65rem] font-mono text-orange-400 uppercase font-normal">(Processing / waiting for final sync)</span>}
                                    </h4>
                                    <div className="text-[0.65rem] font-mono text-[var(--text-muted)] mt-1">
                                        {new Date(item.createdAt).toLocaleString()} • {item.fileSizeMb.toFixed(2)} MB <HelpTip text="Original uploaded file size as recorded by the preflight registry." />
                                        {item.type === 'ANALYZE' && (
                                            <span className="ml-2">
                                                (<span className="inline-flex items-center">Issues: {item.issuesCount || 0} <HelpTip text="Issues are detected technical or production risks in the original PDF." /></span>, <span className="inline-flex items-center">Findings: {item.findingsCount || 0} <HelpTip text="Findings are the normalized diagnostics reported by the preflight engine. They may include warnings, risks, and issues." /></span>)
                                            </span>
                                        )}
                                        {item.type === 'AUTOFIX' && (
                                            <span className="ml-2">
                                                (Applied: {item.appliedFixesCount || 0}, Skipped: {item.skippedFixesCount || 0}, Failed: {item.failedFixesCount || 0})
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-wrap gap-2 pt-2 border-t border-[var(--border-color)]/50">
                                {item.artifacts.analysisReport && (
                                    <button onClick={() => downloadArtifact(item.jobId, 'analysis_report')} className="flex items-center gap-1.5 text-[0.6rem] font-black uppercase tracking-widest text-[var(--accent-color)] hover:text-[var(--accent-hover)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)] rounded-sm py-1 px-2 border border-[var(--border-color)] hover:border-[var(--accent-hover)] bg-[var(--bg-tertiary)]">
                                        <ArrowDownTrayIcon className="w-3 h-3 shrink-0" />
                                        REPORT JSON
                                    </button>
                                )}
                                {item.artifacts.reviewPdf && (
                                    <button onClick={() => downloadArtifact(item.jobId, 'review_pdf')} className="flex items-center gap-1.5 text-[0.6rem] font-black uppercase tracking-widest text-[var(--accent-color)] hover:text-[var(--accent-hover)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)] rounded-sm py-1 px-2 border border-[var(--border-color)] hover:border-[var(--accent-hover)] bg-[var(--bg-tertiary)]">
                                        <ArrowDownTrayIcon className="w-3 h-3 shrink-0" />
                                        REVIEW PDF
                                    </button>
                                )}
                                {item.artifacts.fixedPdf && (
                                    <button onClick={() => downloadArtifact(item.jobId, 'fixed_pdf')} className="flex items-center gap-1.5 text-[0.6rem] font-black uppercase tracking-widest text-[var(--accent-color)] hover:text-[var(--accent-hover)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)] rounded-sm py-1 px-2 border border-[var(--border-color)] hover:border-[var(--accent-hover)] bg-[var(--bg-tertiary)]">
                                        <ArrowDownTrayIcon className="w-3 h-3 shrink-0" />
                                        FIXED PDF
                                    </button>
                                )}
                                {item.artifacts.certifiedPdf && (
                                    <button onClick={() => downloadArtifact(item.jobId, 'certified_pdf')} className="flex items-center gap-1.5 text-[0.6rem] font-black uppercase tracking-widest text-[var(--accent-color)] hover:text-[var(--accent-hover)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)] rounded-sm py-1 px-2 border border-[var(--border-color)] hover:border-[var(--accent-hover)] bg-[var(--bg-tertiary)]">
                                        <ArrowDownTrayIcon className="w-3 h-3 shrink-0" />
                                        CERTIFIED PDF
                                    </button>
                                )}
                                
                                {item.type === 'ANALYZE' && (
                                    <div className="w-full mt-4 pt-4 border-t border-[var(--border-color)] flex flex-col gap-3">
                                        <h5 className="text-[0.7rem] font-bold text-[var(--text-primary)] uppercase tracking-widest flex items-center">Related Magic Fixes <HelpTip text="Magic Fix jobs are automated correction attempts created from a previous analysis. They may repair page boxes, bleed, color profiles, or other print-production problems." /></h5>
                                        {(!item.relatedFixJobs || item.relatedFixJobs.length === 0) ? (
                                            <span className="text-xs text-[var(--text-muted)] font-mono">No related fixes yet.</span>
                                        ) : (
                                            <div className="flex flex-col gap-4">
                                                {item.relatedFixJobs.map(f => {
                                                    const hasArtifacts = f.artifacts.fixAudit || f.artifacts.reviewPdf || f.artifacts.fixedPdf || f.artifacts.certifiedPdf;
                                                    
                                                    const getStatusLabel = (status: string) => {
                                                        if (status.includes('ERROR') || status.includes('FAILED')) return { label: 'Failed', color: 'text-red-400' };
                                                        if (status.includes('REVIEW') || status.includes('DEGRADED')) return { label: 'Review required', color: 'text-yellow-400' };
                                                        if (status.includes('CERTIFIED') || status.includes('COMPLETED')) return { label: 'Completed with findings', color: 'text-[#50fa7b]' };
                                                        if (status.includes('QUEUED')) return { label: 'Processing', color: 'text-orange-300' };
                                                        return { label: status.replace(/_/g, ' '), color: 'text-[var(--text-primary)]' };
                                                    };
                                                    const statusInfo = getStatusLabel(f.status);

                                                    // Phase APP-40.6 — File History OS View: trust-level badge
                                                    // green = certified, yellow = review required, red = failed, gray = diagnostic only
                                                    const trustBadge: Record<string, { label: string; color: string; dot: string }> = {
                                                        CERTIFIED_SAFE: { label: 'Production certified', color: 'text-[#50fa7b]', dot: 'bg-[#50fa7b]' },
                                                        REVIEW_REQUIRED: { label: 'Review required', color: 'text-yellow-400', dot: 'bg-yellow-400' },
                                                        NEEDS_ATTENTION: { label: 'Needs attention', color: 'text-red-400', dot: 'bg-red-400' },
                                                        FIXED_UNCERTIFIED: { label: 'Fixed (not certified)', color: 'text-[var(--text-primary)]', dot: 'bg-[var(--text-muted)]' },
                                                        DIAGNOSTIC_ONLY: { label: 'Diagnostic only', color: 'text-[var(--text-muted)]', dot: 'bg-[var(--text-muted)]' }
                                                    };
                                                    const badge = trustBadge[f.trustLevel as string] || trustBadge.DIAGNOSTIC_ONLY;

                                                    return (
                                                    <div key={f.jobId} className="border border-[var(--border-color)] bg-[var(--bg-primary)] p-4 flex flex-col gap-4">
                                                        <div>
                                                            <div className="flex items-center justify-between mb-1">
                                                                <h6 className="font-bold text-[var(--text-primary)] text-sm">Magic Fix Result</h6>
                                                                <span className={`text-xs font-bold uppercase tracking-widest ${statusInfo.color}`}>
                                                                    {statusInfo.label}
                                                                </span>
                                                            </div>
                                                            <div className="text-xs font-mono text-[var(--text-muted)] flex items-center gap-3 flex-wrap">
                                                                <span>Fix ID: {f.jobId} <HelpTip text="Internal identifier for this Magic Fix job. Support may ask for it when investigating a file." /></span>
                                                                {f.sourceJobId && <span>Source job: {f.sourceJobId}</span>}
                                                                <span className={`inline-flex items-center gap-1.5 font-bold uppercase tracking-widest text-[0.6rem] ${badge.color}`}>
                                                                    <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                                                                    {badge.label}
                                                                    <HelpTip text="Trust level reflects what the engine actually vouches for: certified means production-safe, review required means a human must approve before print, fixed (not certified) means the file changed but isn't certified, diagnostic only means no automated fix was applied." />
                                                                </span>
                                                                {typeof f.fix_coverage === 'number' && <span>Fix coverage: {Math.round(f.fix_coverage * 100)}%</span>}
                                                            </div>
                                                        </div>

                                                        {f.status.includes('QUEUED') && (
                                                            <div className="bg-[var(--bg-tertiary)] p-3 border-l-2 border-orange-400 text-xs text-[var(--text-primary)] font-mono">
                                                                This job is still processing. Refresh history in a moment.
                                                            </div>
                                                        )}

                                                        {f.requiresHumanReview && !f.status.includes('QUEUED') && (
                                                            <div className="bg-[var(--bg-tertiary)] p-3 border-l-2 border-yellow-400 text-xs text-[var(--text-primary)] font-mono">
                                                                Review required before production. Please inspect the Review PDF or Fixed PDF before sending to print.
                                                            </div>
                                                        )}

                                                        {f.productionCertified && !f.status.includes('QUEUED') && (
                                                            <div className="bg-[var(--bg-tertiary)] p-3 border-l-2 border-[#50fa7b] text-xs text-[var(--text-primary)] font-mono">
                                                                Production certified. This file can be used for print production.
                                                            </div>
                                                        )}

                                                        <div className="flex gap-6 text-xs font-mono text-[var(--text-primary)] bg-[var(--bg-secondary)] p-3 border border-[var(--border-color)]">
                                                            <div className="flex flex-col">
                                                                <span className="text-[var(--text-muted)] uppercase tracking-widest text-[0.6rem] mb-0.5 flex items-center">Applied <HelpTip text="Number of requested corrections that were applied automatically." /></span>
                                                                <span className="font-bold text-lg leading-none">{f.appliedFixesCount || 0}</span>
                                                            </div>
                                                            <div className="flex flex-col">
                                                                <span className="text-[var(--text-muted)] uppercase tracking-widest text-[0.6rem] mb-0.5 flex items-center">Skipped <HelpTip text="Number of requested corrections that were intentionally skipped, usually because they require manual or visual review." /></span>
                                                                <span className="font-bold text-lg leading-none">{f.skippedFixesCount || 0}</span>
                                                            </div>
                                                            <div className="flex flex-col">
                                                                <span className="text-[var(--text-muted)] uppercase tracking-widest text-[0.6rem] mb-0.5 flex items-center">Failed <HelpTip text="Number of requested corrections that failed during automated processing." /></span>
                                                                <span className="font-bold text-lg leading-none">{f.failedFixesCount || 0}</span>
                                                            </div>
                                                        </div>

                                                        <div>
                                                            <h6 className="text-[0.65rem] font-bold text-[var(--text-muted)] uppercase tracking-widest mb-2">Available Downloads</h6>
                                                            {!hasArtifacts ? (
                                                                <span className="text-xs font-mono text-[var(--text-muted)] italic">No downloadable artifacts available yet.</span>
                                                            ) : (
                                                                <div className="flex flex-wrap gap-2">
                                                                    {f.artifacts.fixAudit && (
                                                                        <button onClick={() => downloadArtifact(f.jobId, 'fix_audit')} className="text-[0.6rem] font-bold uppercase tracking-widest text-[var(--text-primary)] hover:text-[var(--accent-color)] transition-colors rounded-sm py-1.5 px-3 border border-[var(--border-color)] hover:border-[var(--accent-color)] bg-[var(--bg-tertiary)]">Fix Audit JSON</button>
                                                                    )}
                                                                    {f.artifacts.reviewPdf && (
                                                                        <button onClick={() => downloadArtifact(f.jobId, 'review_pdf')} className="text-[0.6rem] font-bold uppercase tracking-widest text-[var(--text-primary)] hover:text-[var(--accent-color)] transition-colors rounded-sm py-1.5 px-3 border border-[var(--border-color)] hover:border-[var(--accent-color)] bg-[var(--bg-tertiary)]">Review PDF</button>
                                                                    )}
                                                                    {f.artifacts.fixedPdf && (
                                                                        <button onClick={() => downloadArtifact(f.jobId, 'fixed_pdf')} className="text-[0.6rem] font-bold uppercase tracking-widest text-[var(--text-primary)] hover:text-[var(--accent-color)] transition-colors rounded-sm py-1.5 px-3 border border-[var(--border-color)] hover:border-[var(--accent-color)] bg-[var(--bg-tertiary)]">Fixed PDF</button>
                                                                    )}
                                                                    {f.artifacts.certifiedPdf && (
                                                                        <button onClick={() => downloadArtifact(f.jobId, 'certified_pdf')} className="text-[0.6rem] font-bold uppercase tracking-widest text-[#50fa7b] hover:text-[#50fa7b] transition-colors rounded-sm py-1.5 px-3 border border-[#50fa7b]/50 hover:border-[#50fa7b] bg-[#50fa7b]/10">Certified PDF</button>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>

                                                        {f.fix_coverage ? (
                                                            <FixCoveragePanel coverage={f.fix_coverage} />
                                                        ) : f.clientChangeSummary ? (
                                                            <details open className="mt-1 group">
                                                                <summary className="cursor-pointer font-bold text-xs text-[var(--accent-color)] hover:text-[var(--accent-hover)] transition-colors select-none">
                                                                    <span className="group-open:hidden">[+] View Client Change Summary</span>
                                                                    <span className="hidden group-open:inline">[-] Hide Client Change Summary</span>
                                                                </summary>
                                                                <div className="mt-4 space-y-4 font-mono text-xs bg-[var(--bg-secondary)] p-4 border border-[var(--border-color)]">
                                                                    <div className="border-b border-[var(--border-color)] pb-3">
                                                                        <h6 className="font-bold text-sm text-[var(--text-primary)] mb-2 flex items-center">Client Change Summary <HelpTip text="Human-readable summary of the Magic Fix result." /></h6>
                                                                        <p className="text-[var(--text-muted)] leading-relaxed">
                                                                            This file was processed by Magic Fix, but it still requires review before production.
                                                                        </p>
                                                                    </div>

                                                                    <div>
                                                                        <span className="font-bold block text-[var(--text-muted)] uppercase tracking-widest text-[0.65rem] mb-1 flex items-center">Recommendation <HelpTip text="What you should do next with this corrected file." /></span>
                                                                        <span className={f.clientChangeSummary.productionCertified ? 'text-[#50fa7b] font-bold' : f.clientChangeSummary.requiresHumanReview ? 'text-yellow-400 font-bold' : 'text-[var(--text-primary)]'}>
                                                                            {f.clientChangeSummary.productionRecommendation}
                                                                        </span>
                                                                    </div>

                                                                    {(!f.clientChangeSummary.appliedChanges?.length && !f.clientChangeSummary.skippedChanges?.length && !f.clientChangeSummary.failedChanges?.length) && (
                                                                        <div className="text-xs text-[var(--text-muted)] italic font-mono mb-4">
                                                                            No detailed correction list is available for this fix, but the final recommendation is shown below.
                                                                        </div>
                                                                    )}
                                                                    {f.clientChangeSummary.appliedChanges && f.clientChangeSummary.appliedChanges.length > 0 && (
                                                                        <div>
                                                                            <span className="font-bold block text-[var(--text-muted)] uppercase tracking-widest text-[0.65rem] mb-1.5 flex items-center">What changed <HelpTip text="Corrections that were successfully applied by Magic Fix." /></span>
                                                                            <ul className="list-none space-y-1.5 pl-0">
                                                                                {f.clientChangeSummary.appliedChanges.map((ac: any, i: number) => (
                                                                                    <li key={i} className="flex gap-2 items-start">
                                                                                        <span className="text-[#50fa7b] shrink-0">✓</span>
                                                                                        <span className="text-[var(--text-primary)] leading-snug flex items-center gap-1">
                                                                                            {ac.label}
                                                                                            {ac.description && <HelpTip text={ac.description} />}
                                                                                        </span>
                                                                                    </li>
                                                                                ))}
                                                                            </ul>
                                                                        </div>
                                                                    )}

                                                                    {f.clientChangeSummary.reviewWarnings && f.clientChangeSummary.reviewWarnings.length > 0 && (
                                                                        <div>
                                                                            <span className="font-bold block text-yellow-500 uppercase tracking-widest text-[0.65rem] mb-1.5 flex items-center">Needs review <HelpTip text="Items that should be visually checked before production." /></span>
                                                                            <ul className="list-none space-y-1.5 pl-0 text-yellow-400">
                                                                                {f.clientChangeSummary.reviewWarnings.map((rw: any, i: number) => (
                                                                                    <li key={i} className="flex gap-2">
                                                                                        <span className="shrink-0">⚠</span>
                                                                                        <span className="leading-snug">{rw}</span>
                                                                                    </li>
                                                                                ))}
                                                                            </ul>
                                                                        </div>
                                                                    )}

                                                                    {f.clientChangeSummary.skippedChanges && f.clientChangeSummary.skippedChanges.length > 0 && (
                                                                        <div>
                                                                            <span className="font-bold block text-[var(--text-muted)] uppercase tracking-widest text-[0.65rem] mb-1.5 flex items-center">Not applied <HelpTip text="Requested corrections that were skipped automatically." /></span>
                                                                            <ul className="list-none space-y-1.5 pl-0 text-[var(--text-muted)]">
                                                                                {f.clientChangeSummary.skippedChanges.map((sc: any, i: number) => (
                                                                                    <li key={i} className="flex gap-2 items-start">
                                                                                        <span className="shrink-0">-</span>
                                                                                        <span className="leading-snug flex items-center gap-1">
                                                                                            {sc.label}
                                                                                            {sc.reason && <HelpTip text={sc.reason} />}
                                                                                        </span>
                                                                                    </li>
                                                                                ))}
                                                                            </ul>
                                                                        </div>
                                                                    )}

                                                                    {f.clientChangeSummary.failedChanges && f.clientChangeSummary.failedChanges.length > 0 && (
                                                                        <div>
                                                                            <span className="font-bold block text-[var(--text-muted)] uppercase tracking-widest text-[0.65rem] mb-1.5 flex items-center">Failed <HelpTip text="Corrections that could not be completed automatically." /></span>
                                                                            <ul className="list-none space-y-1.5 pl-0 text-red-400">
                                                                                {f.clientChangeSummary.failedChanges.map((fc: any, i: number) => (
                                                                                    <li key={i} className="flex gap-2">
                                                                                        <span className="shrink-0">✗</span>
                                                                                        <span className="leading-snug">{fc.label}</span>
                                                                                    </li>
                                                                                ))}
                                                                            </ul>
                                                                        </div>
                                                                    )}
                                                                    {f.clientChangeSummary.whatCannotBeFixedAutomatically && f.clientChangeSummary.whatCannotBeFixedAutomatically.length > 0 && (
                                                                        <div>
                                                                            <span className="font-bold block text-[var(--text-muted)] uppercase tracking-widest text-[0.65rem] mb-1.5 flex items-center">Cannot be fixed automatically <HelpTip text="These findings are not reliable autofix candidates. They require a higher-resolution reupload or operator review before production." /></span>
                                                                            <ul className="list-none space-y-1.5 pl-0 text-amber-400">
                                                                                {f.clientChangeSummary.whatCannotBeFixedAutomatically.map((cf: any, i: number) => (
                                                                                    <li key={i} className="flex gap-2">
                                                                                        <span className="shrink-0">⚠</span>
                                                                                        <span className="leading-snug">{cf.label}</span>
                                                                                    </li>
                                                                                ))}
                                                                            </ul>
                                                                        </div>
                                                                    )}
                                                                    {f.clientChangeSummary.recommendedNextActions && f.clientChangeSummary.recommendedNextActions.length > 0 && (
                                                                        <div>
                                                                            <span className="font-bold block text-[var(--text-muted)] uppercase tracking-widest text-[0.65rem] mb-1.5 flex items-center">Recommended next action <HelpTip text="What we suggest doing next for the items that the engine could not reliably fix automatically." /></span>
                                                                            <ul className="list-none space-y-1.5 pl-0 text-[var(--text-primary)]">
                                                                                {f.clientChangeSummary.recommendedNextActions.map((ra: any, i: number) => (
                                                                                    <li key={i} className="flex gap-2">
                                                                                        <span className="shrink-0">→</span>
                                                                                        <span className="leading-snug">{ra.action}</span>
                                                                                    </li>
                                                                                ))}
                                                                            </ul>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </details>
                                                        ) : (
                                                            <div className="mt-1 text-xs text-[var(--text-muted)] italic font-mono">No detailed change summary is available for this fix job.</div>
                                                        )}
                                                    </div>
                                                )})}
                                            </div>
                                        )}
                                    </div>
                                )}
                                {item.type === 'AUTOFIX' && item.sourceAnalyzeJob && (
                                    <div className="w-full mt-2 pt-2 border-t border-[var(--border-color)]/30 text-[0.65rem] font-mono text-[var(--text-muted)] flex items-center">
                                        <span className="opacity-70 mr-2 shrink-0">Source Analysis:</span>
                                        <span className="px-1.5 py-0.5 bg-[var(--bg-tertiary)] border border-[var(--border-color)]" title={item.sourceAnalyzeJob.status}>{item.sourceAnalyzeJob.jobId.substring(0, 15)}...</span>
                                    </div>
                                )}
                                {item.type === 'AUTOFIX' && !item.sourceAnalyzeJob && (
                                    <div className="w-full mt-2 pt-2 border-t border-[var(--border-color)]/30 text-[0.6rem] font-mono text-[var(--text-muted)] opacity-50">
                                        Source analysis unavailable
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

