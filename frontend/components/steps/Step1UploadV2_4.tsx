import React, { useState, useRef } from 'react';
import { pposFetch } from '../../lib/apiClient';
import { FileMeta, AppMode } from '../../types';
import { StatusBadge } from '../../design/preflight_starter_pack';
import { formatLabel } from '../../utils/formatters';
import { CloudArrowUpIcon, DocumentCheckIcon, AdjustmentsHorizontalIcon, SparklesIcon, InformationCircleIcon } from '@heroicons/react/24/outline';
import { useTranslation } from '../../i18n';
import { useAuth } from '../../hooks/useAuth';

interface Step1UploadV2_4Props {
    file: File | null;
    fileMeta: FileMeta | null;
    onFileSelect: (file: File | null) => void;
    onNext: (mode: AppMode) => void;
    selectedPolicy: string;
    onPolicyChange: (p: string) => void;
    isAuthenticated?: boolean;
    onError?: (error: { code: string; message: string; traceId?: string; v2?: boolean }) => void;
}

export const Step1UploadV2_4: React.FC<Step1UploadV2_4Props> = ({
    file,
    fileMeta,
    onFileSelect,
    onNext,
    selectedPolicy,
    onPolicyChange,
    onError,
}) => {
    const { t } = useTranslation();
    const { user } = useAuth();
    const [selectedMode, setSelectedMode] = useState<'magic' | 'manual'>('magic');
    const [policies, setPolicies] = useState<any[]>([]);
    const [policyStatus, setPolicyStatus] = useState<'idle' | 'loading' | 'error'>('idle');
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Phase 39.1: Limits and entitlements sourced from Control Plane via session/me endpoint.
    // user.max_file_size_mb and user.ai_magic_fix_enabled are now CP-governed.
    // Fallback to conservative FREE-tier defaults when user/CP data is absent.
    const dailyLimit = user?.daily_jobs_limit ?? 5;
    const usedToday = user?.jobs_used_today ?? 0;
    const resolvedClientMaxMb = user?.max_file_size_mb ?? user?.maxFileSizeMb;
    const isGuestOrExplicitFree = !user || !user.plan || user.plan === 'FREE';
    const maxMb = resolvedClientMaxMb ?? (isGuestOrExplicitFree ? 25 : 1024);
    const isAiFixAllowed = user?.ai_magic_fix_enabled === true;
    const isInGrace = user?.in_grace_period === true;

    React.useEffect(() => {
        console.log('[UPLOAD-GOV-CLIENT-LIMIT]', {
            authenticated: !!user,
            email: user?.email,
            tenantId: user?.tenantId || user?.id,
            plan: user?.plan,
            planCode: user?.planCode,
            max_file_size_mb: user?.max_file_size_mb,
            maxFileSizeMb: (user as any)?.maxFileSizeMb,
            resolvedClientMaxMb: maxMb,
            clientDecision: resolvedClientMaxMb ? 'EXPLICIT_LIMIT' : (isGuestOrExplicitFree ? 'FALLBACK_FREE' : 'FALLBACK_ENTERPRISE_CAPABLE'),
            governanceSource: (user as any)?._governance_source
        });
    }, [user, maxMb, isGuestOrExplicitFree]);

    React.useEffect(() => {
        if (!user) return;
        
        setPolicyStatus('loading');
        pposFetch<{ policies: any[] }>('/api/v2/jobs/policies')
            .then(res => {
                const loadedPolicies = res.policies || [];
                setPolicies(loadedPolicies);
                setPolicyStatus('idle');

                if (loadedPolicies.length > 0) {
                  // Default selection rule: OFFSET_MODERN_COATED or first available
                  const defaultPolicy = loadedPolicies.find(p => p.id === 'OFFSET_MODERN_COATED') || loadedPolicies[0];
                  if (defaultPolicy && !selectedPolicy) {
                    onPolicyChange(defaultPolicy.id);
                  }
                }

                console.log('[STEP1][POLICY]', {
                    loadedPolicies: loadedPolicies.length,
                    selectedPolicyId: selectedPolicy || (loadedPolicies.find(p => p.id === 'OFFSET_MODERN_COATED') || loadedPolicies[0])?.id
                });
            })
            .catch(err => {
                console.error('[POLICIES-FETCH-ERROR]', err);
                setPolicyStatus('error');
            });
    }, [user, onPolicyChange, selectedPolicy]);

    const handleFile = (f: File | null) => {
        if (f && f.type === 'application/pdf') {
            const sizeMb = f.size / (1024 * 1024);
            if (sizeMb > maxMb) {
                    onError({
                        code: 'FILE_SIZE_LIMIT_EXCEEDED',
                        message: `Plan ${user?.plan || 'GUEST'} supports up to ${maxMb}MB. This file is ${sizeMb.toFixed(1)}MB.`,
                        traceId: 'GOV_CLIENT_LIMIT',
                        v2: true
                    });
                return;
            }
            onFileSelect(f);
        } else if (f) {
            if (onError) {
                onError({
                    code: 'INVALID_FILE_TYPE',
                    message: t('invalidFileType'),
                    traceId: 'GOV_CLIENT_MIME',
                    v2: true
                });
            }
        }
    };

    const onDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const droppedFile = e.dataTransfer.files[0];
        handleFile(droppedFile);
    };

    const handleContinue = () => {
        if (!file) return;
        if (selectedMode === 'magic' && !isAiFixAllowed) {
            if (onError) {
                onError({
                    code: 'AI_ACCESS_RESTRICTED',
                    message: t('account.apiNoAccessDesc'),
                    traceId: 'GOV_CLIENT_TIER',
                    v2: true
                });
            }
            return;
        }
        const appMode: AppMode = selectedMode === 'magic' ? 'ai' : 'manual';
        onNext(appMode);
    };

    return (
        <div className="space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-1000">
            {/* Header Signal */}
            <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-6">
                <div>
                    <div className="ppp-phase-tag text-[var(--accent-color)] mb-1">
                        {t('stepNumber', { number: 1 })} / {t('uploadPdf').toUpperCase()}
                    </div>
                    <h2 className="text-3xl font-extrabold tracking-tight underline decoration-[var(--accent-color)]/30 decoration-4 underline-offset-8">{t('uploadYourPdf').toUpperCase()}</h2>
                </div>
                <div className="flex items-center gap-4">
                    <div className="h-10 w-px bg-[var(--border-color)] mx-2"></div>
                    <StatusBadge 
                        label={!file ? "shell.awaitingFile" : selectedMode === 'magic' ? "shell.stagedMagic" : "shell.stagedManual"} 
                        variant={file ? "certified" : "processing"} 
                    />
                </div>
            </div>

            <div className="flex flex-col lg:flex-row gap-8 items-start w-full">
                {/* Upload Zone */}
                <div 
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={onDrop}
                    className={`group relative flex flex-col items-center justify-center border-2 border-dashed transition-all duration-700 cursor-pointer min-h-[300px] md:min-h-[500px] w-full lg:flex-[1.2] min-w-0 overflow-hidden ${
                        isDragging ? 'border-[var(--accent-color)] bg-[var(--accent-color)]/5 shadow-[0_0_40px_rgba(220,0,0,0.1)] scale-[1.01]' : 
                        file ? 'border-[var(--border-color)] bg-[var(--hover-bg)]' : 'border-[var(--border-color)] hover:border-[var(--accent-color)]/30 hover:bg-[var(--hover-bg)]'
                    }`}
                >
                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        className="hidden" 
                        accept=".pdf" 
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleFile(e.target.files?.[0] || null)}
                    />

                    {/* Subtle Pulse Overlay when empty */}
                    {!file && !isDragging && (
                        <div className="absolute inset-0 bg-[var(--accent-color)]/[0.02] animate-pulse pointer-events-none" />
                    )}

                    {file ? (
                        <div className="flex flex-col items-center text-center p-10 animate-in zoom-in-95 duration-500 w-full">
                            <div className="h-24 w-20 bg-[var(--accent-color)] mb-8 flex items-center justify-center relative shadow-[0_0_40px_rgba(220,0,0,0.4)]">
                                <DocumentCheckIcon className="h-12 w-12 text-white" />
                                <div className="absolute -bottom-3 -right-3 h-8 w-8 bg-[var(--bg-primary)] flex items-center justify-center border-4 border-[var(--bg-primary)]">
                                    <div className="h-2 w-2 bg-[var(--accent-color)]" />
                                </div>
                            </div>
                            <div className="mb-2 text-[0.8rem] font-black text-[var(--accent-color)] uppercase tracking-[0.3em]">{t('selectedLabel')}</div>
                            <h3 className="text-2xl font-black mb-2 w-full truncate px-4" title={fileMeta?.name || file.name}>{fileMeta?.name || file.name}</h3>
                            <div className="text-[0.85rem] font-mono text-[var(--text-muted)] uppercase tracking-widest flex flex-wrap justify-center items-center gap-3">
                                <span>{(file.size / (1024 * 1024)).toFixed(2)} MB</span>
                                <span className="h-1 w-1 bg-[var(--border-color)] rounded-full" />
                                <span>{t('pdfProcessedReady')}</span>
                            </div>
                            <button 
                                onClick={(e) => { e.stopPropagation(); onFileSelect(null); }}
                                className="mt-10 px-6 py-3 border border-[var(--border-color)] bg-[var(--hover-bg)] text-[0.8rem] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--accent-color)]/20 transition-all font-bold"
                            >
                                {t('changeLabel')} {t('fileLabel')}
                            </button>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center text-center p-10 scale-110">
                            <div className="h-20 w-20 mb-8 flex items-center justify-center border border-[var(--border-color)] bg-[var(--hover-bg)] group-hover:border-[var(--accent-color)] group-hover:bg-[var(--accent-color)]/5 transition-all duration-500 shadow-inner">
                                <CloudArrowUpIcon className="h-10 w-10 text-[var(--text-muted)] group-hover:text-[var(--accent-color)] transition-colors" />
                            </div>
                            <p className="text-xl font-black mb-3 tracking-tight text-[var(--text-primary)]">{t('uploadYourPdf')}</p>
                            <p className="text-[var(--text-secondary)] text-sm uppercase tracking-[0.15em] font-bold mb-8">{t('uploadDescription')}</p>
                            
                            <div className="px-6 py-2 border border-[var(--border-color)] bg-[var(--bg-secondary)] text-[0.8rem] text-center font-mono text-[var(--text-muted)] uppercase tracking-[0.2em] w-full max-w-full overflow-hidden text-clip whitespace-normal break-words">
                                {t('dragAndDropModern')} / Max: {maxMb}MB
                            </div>
                        </div>
                    )}
                </div>

                {/* Configuration Zone */}
                <div className="flex flex-col justify-between space-y-8 w-full lg:flex-[0.8]">
                    <div className="border border-[var(--border-color)] bg-[var(--bg-secondary)] p-10 h-full">
                        <div className="flex items-center justify-between mb-8">
                            <div className="ppp-phase-tag text-[var(--accent-color)] mb-1">
                                {t('review').toUpperCase()}
                            </div>
                            <h3 className="text-xl font-extrabold tracking-tight">{t('chooseWorkflow')}</h3>
                        </div>

                        {/* Segmented toggle */}
                        <div className="relative flex bg-[var(--hover-bg)] p-1">
                            {/* Sliding pill */}
                            <div
                                className={`absolute inset-y-1 w-[calc(50%-2px)] bg-[var(--accent-color)] transition-all duration-300 ease-out shadow-[0_0_12px_rgba(220,0,0,0.25)] ${
                                    selectedMode === 'magic' ? 'left-1' : 'left-[calc(50%+1px)]'
                                }`}
                            />
                            <button
                                onClick={() => setSelectedMode('magic')}
                                className={`relative z-10 flex-1 flex items-center justify-center gap-2 py-2.5 px-4 transition-colors duration-300 ${
                                    selectedMode === 'magic' ? 'text-white' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                                }`}
                            >
                                <SparklesIcon className="h-4 w-4 shrink-0" />
                                <span className="text-[0.78rem] font-black uppercase tracking-wider">{t('aiMagicFix')}</span>
                            </button>
                            <button
                                onClick={() => setSelectedMode('manual')}
                                className={`relative z-10 flex-1 flex items-center justify-center gap-2 py-2.5 px-4 transition-colors duration-300 ${
                                    selectedMode === 'manual' ? 'text-white' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                                }`}
                            >
                                <AdjustmentsHorizontalIcon className="h-4 w-4 shrink-0" />
                                <span className="text-[0.78rem] font-black uppercase tracking-wider">{t('diagnosticModeTitle')}</span>
                            </button>
                        </div>

                        {/* Contextual description panel */}
                        <div
                            key={selectedMode}
                            className="flex items-start gap-3 px-4 py-3 border border-[var(--border-color)] bg-[var(--bg-primary)]/50 animate-in fade-in slide-in-from-top-2 duration-300"
                        >
                            <div className="p-2 bg-[var(--accent-color)]/10 text-[var(--accent-color)] shrink-0">
                                {selectedMode === 'magic'
                                    ? <SparklesIcon className="h-5 w-5" />
                                    : <AdjustmentsHorizontalIcon className="h-5 w-5" />}
                            </div>
                            <div>
                                <div className="text-[0.82rem] font-black uppercase tracking-wider text-[var(--text-primary)] mb-0.5">
                                    {selectedMode === 'magic' ? t('aiMagicFix') : t('diagnosticModeTitle')}
                                </div>
                                <div className="text-[0.83rem] text-[var(--text-secondary)] leading-snug">
                                    {selectedMode === 'magic' ? t('aiMagicFixDesc') : t('diagnosticModeDesc')}
                                </div>
                            </div>
                        </div>

                        {/* Show policy enforcement for any analysis mode */}
                        <div className="mt-10 space-y-4 animate-in fade-in slide-in-from-top-2 duration-500">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2 group/tip relative">
                                        <div className="text-[0.82rem] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">
                                            {t('shell.policyEnforcement')}
                                        </div>
                                        <InformationCircleIcon 
                                            className="h-4 w-4 text-[var(--text-muted)] cursor-help hover:text-[var(--accent-color)] transition-colors"
                                            aria-label="Policy Information"
                                            tabIndex={0}
                                        />
                                        
                                        {/* Minimal Tooltip Layer */}
                                        <div className="absolute left-0 bottom-full mb-3 w-[280px] sm:w-[320px] p-4 bg-[var(--bg-primary)] border border-[var(--border-color)] shadow-[0_20px_40px_rgba(0,0,0,0.4)] opacity-0 invisible group-hover/tip:opacity-100 group-hover/tip:visible focus-within:opacity-100 focus-within:visible transition-all duration-300 z-50">
                                            <div className="text-[0.65rem] font-black uppercase tracking-[0.25em] text-[var(--accent-color)] mb-2">{t('policyInfo.title')}</div>
                                            <p className="text-[0.78rem] text-[var(--text-primary)] leading-relaxed font-medium">
                                                {t('policyInfo.desc')}
                                            </p>
                                            <div className="mt-3 h-px bg-[var(--border-color)]"></div>
                                            <div className="mt-3 text-[0.6rem] font-mono text-[var(--text-muted)] uppercase tracking-widest">{t('policyInfo.version')}</div>
                                        </div>
                                    </div>
                                    <span className="text-[0.82rem] font-mono text-[var(--accent-color)] opacity-50">{formatLabel('PRODUCTION_GUARD')}</span>
                                </div>

                                <div className="space-y-3">
                                    <select 
                                        className="w-full bg-[var(--bg-tertiary)] border border-[var(--border-color)] p-4 text-[0.85rem] font-bold text-[var(--text-primary)] focus:border-[var(--accent-color)] outline-none appearance-none cursor-pointer hover:border-[var(--accent-color)]/30 transition-all font-mono uppercase"
                                        value={selectedPolicy}
                                        onChange={(e) => onPolicyChange(e.target.value)}
                                        disabled={policyStatus === 'loading'}
                                    >
                                        {policyStatus === 'loading' && <option>Loading policy catalog...</option>}
                                        {policyStatus === 'error' && <option>Unable to load policy catalog.</option>}
                                        {policyStatus === 'idle' && policies.length === 0 && <option>No policies available.</option>}
                                        {policies.map(p => {
                                            const primaryLabel = p.name ? p.name.split(' (')[0] : p.id;
                                            return (
                                                <option key={p.id} value={p.id}>
                                                    {primaryLabel.toUpperCase()}
                                                </option>
                                            );
                                        })}
                                    </select>

                                    <div className="flex flex-col gap-1.5 px-1">
                                        <p className="text-[0.7rem] font-bold text-[var(--text-muted)] uppercase tracking-widest">
                                            {t('policyInfo.helper')}
                                        </p>
                                        {selectedPolicy && (
                                            <p className="text-[0.75rem] font-medium text-[var(--accent-color)] opacity-90 italic">
                                                {selectedPolicy.includes('COATED') ? t('policyInfo.coatedDesc') :
                                                 selectedPolicy.includes('GRACOL') ? t('policyInfo.gracolDesc') :
                                                 selectedPolicy.includes('DIGITAL') ? t('policyInfo.digitalDesc') :
                                                 selectedPolicy.includes('WIDE') ? t('policyInfo.wideDesc') :
                                                 t('policyInfo.defaultDesc')}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>
                    </div>

                    <div className="space-y-4 ppp-mobile-sticky-footer">
                        <button 
                            onClick={handleContinue}
                            disabled={!file}
                            className={`w-full py-7 text-[0.85rem] font-black uppercase tracking-[0.4em] transition-all duration-700 relative overflow-hidden group ${
                                file ? 'bg-[var(--accent-color)] text-white hover:bg-[var(--accent-hover)] shadow-[0_20px_50px_rgba(220,0,0,0.3)]' : 
                                'bg-[var(--bg-tertiary)] text-[var(--text-dim)] cursor-not-allowed opacity-40'
                            }`}
                        >
                            {/* Industrial scanning effect on hover if ready */}
                            {file && (
                                <div className="absolute inset-0 bg-white/5 -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                            )}
                            <span className="relative z-10">{t('igniteEngine')}</span>
                        </button>
                    </div>
                    
                    <div className="ppp-mobile-spacer" />
                </div>
            </div>
        </div>
    );
};
