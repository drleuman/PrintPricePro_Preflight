import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { LockClosedIcon, ShieldCheckIcon, EnvelopeIcon, ArrowRightIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { PPOSLogo, StatusBadge } from '../design/preflight_starter_pack';
import { useTranslation } from '../i18n';
import { ThemeToggle } from './ThemeToggle';

type AuthMode = 'LOGIN' | 'INITIALIZE' | 'MAGIC';

export const AuthOverlayV2_4: React.FC = () => {
    const { t } = useTranslation();
    const { isAuthenticated, login } = useAuth();
    const [mode, setMode] = useState<AuthMode>('LOGIN');
    const [loading, setLoading] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState<'AUTHOR' | 'PUBLISHER' | 'PRINT_HOUSE' | 'DEVELOPER'>('AUTHOR');
    const [error, setError] = useState<string | null>(null);

    if (isAuthenticated) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        const endpoint = mode === 'LOGIN' ? '/api/auth/login' : '/api/auth/register';
        const body = mode === 'LOGIN'
            ? { email, password }
            : { email, password, role };

        try {
            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            const data = await res.json();

            if (res.ok) {
                login(data.token, data.user, data.refreshToken);
            } else {
                setError(data.message || t('auth.error.invalid'));
            }
        } catch (err) {
            setError(t('auth.error.connection'));
        } finally {
            setLoading(false);
        }
    };

    const roles = [
        { id: 'AUTHOR', label: t('auth.role.author') },
        { id: 'PUBLISHER', label: t('auth.role.publisher') },
        { id: 'PRINT_HOUSE', label: t('auth.role.printHouse') },
        { id: 'DEVELOPER', label: t('auth.role.developer') }
    ];

    return (
        <div 
            className="fixed inset-0 z-[9999] flex items-start sm:items-center justify-center backdrop-blur-3xl animate-in fade-in duration-700 overflow-y-auto pt-8 pb-8 sm:p-0"
            style={{ backgroundColor: 'var(--bg-tertiary)' }}
        >
            {/* Subtle Grid Pattern */}
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none">
                <div className="h-full w-full bg-[linear-gradient(rgba(220,0,0,0.2)_1px,transparent_1px),linear-gradient(90deg,rgba(220,0,0,0.2)_1px,transparent_1px)] bg-[size:32px_32px]"></div>
            </div>

            {/* Top Right Controls */}
            <div className="absolute top-8 right-8 z-50">
                <ThemeToggle />
            </div>

            <div className="w-full max-w-[480px] border border-[var(--border-color)] bg-[var(--bg-panel)] shadow-[0_0_150px_rgba(220,0,0,0.15)] relative overflow-hidden">
                {/* Brand Accent Bar */}
                <div className="h-[2px] bg-[#FF0000] w-full shadow-[0_0_15px_#FF0000]"></div>

                <div className="p-6 sm:p-12 space-y-10">
                    {/* Header Section */}
                    <div className="flex flex-col items-center text-center space-y-6">
                        <PPOSLogo className="w-14 h-14 border border-[var(--border-color)] p-3 bg-[var(--hover-bg)] shadow-[0_0_30px_rgba(255,255,255,0.02)]" />
                        <div className="space-y-3">
                            <h2 className="text-3xl font-black tracking-tight text-[var(--text-primary)]">
                                {mode === 'LOGIN' ? t('auth.welcome') : t('auth.join')}
                            </h2>
                            <p className="text-[var(--text-secondary)] text-[0.85rem] font-medium leading-relaxed">
                                {t('auth.secureWorkspace')}
                            </p>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-8">
                        {error && (
                            <div className="bg-[#FF0000]/5 border border-[#FF0000]/40 px-5 py-4 text-[#FF0000] text-[0.75rem] font-bold uppercase tracking-widest flex items-center gap-4 animate-in fade-in slide-in-from-top-1">
                                <span className="h-2 w-2 bg-[#FF0000] shadow-[0_0_8px_#FF0000]"></span>
                                {error}
                            </div>
                        )}

                        {/* Role Selection (on Register) */}
                        {mode === 'INITIALIZE' && (
                            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
                                <div className="space-y-1">
                                    <label className="text-[0.7rem] font-black text-[var(--text-primary)] uppercase tracking-[0.15em]">{t('auth.selectRole')}</label>
                                    <p className="text-[var(--text-muted)] text-[0.65rem]">{t('auth.roleTailor')}</p>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    {roles.map(r => (
                                        <button
                                            key={r.id}
                                            type="button"
                                            onClick={() => setRole(r.id as any)}
                                            className={`h-[48px] text-[0.65rem] font-black uppercase tracking-widest border transition-all duration-300 ${role === r.id ? 'border-[#FF0000] bg-[#FF0000]/10 text-[var(--text-primary)] shadow-[0_0_10px_rgba(255,0,0,0.1)]' : 'border-[var(--border-color)] bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:border-[#FF0000] hover:text-[var(--text-primary)]'}`}
                                        >
                                            {r.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Main Inputs */}
                        <div className="space-y-5">
                            <div className="space-y-2">
                                <label className="text-[0.7rem] font-black text-[var(--text-primary)] uppercase tracking-[0.15em]">{t('auth.email')}</label>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none">
                                        <EnvelopeIcon className="h-4 w-4 text-[var(--text-muted)] group-focus-within:text-[#FF0000] transition-colors duration-300" />
                                    </div>
                                    <input
                                        type="email"
                                        required
                                        className="h-[56px] w-full bg-[var(--bg-tertiary)] border border-[var(--border-color)] pl-14 pr-6 text-[0.9rem] text-[var(--text-primary)] caret-[var(--accent-color)] outline-none focus:border-[#FF0000] focus:shadow-[0_0_20px_rgba(255,0,0,0.05)] transition-all duration-300 placeholder:text-[var(--text-muted)] font-medium"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder={t('auth.emailPlaceholder')}
                                    />
                                </div>
                            </div>

                            {mode !== 'MAGIC' && (
                                <div className="space-y-2">
                                    <label className="text-[0.7rem] font-black text-[var(--text-primary)] uppercase tracking-[0.15em]">{t('auth.password')}</label>
                                    <div className="relative group">
                                        <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none">
                                            <LockClosedIcon className="h-4 w-4 text-[var(--text-muted)] group-focus-within:text-[#FF0000] transition-colors duration-300" />
                                        </div>
                                        <input
                                            type="password"
                                            required={(mode as string) !== 'MAGIC'}
                                            className="h-[56px] w-full bg-[var(--bg-tertiary)] border border-[var(--border-color)] pl-14 pr-6 text-[0.9rem] text-[var(--text-primary)] caret-[var(--accent-color)] outline-none focus:border-[#FF0000] focus:shadow-[0_0_20px_rgba(255,0,0,0.05)] transition-all duration-300 placeholder:text-[var(--text-muted)] font-medium"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            placeholder={t('auth.passwordPlaceholder')}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Action Buttons */}
                        <div className="space-y-6">
                            <button
                                type="submit"
                                disabled={loading}
                                className={`h-[64px] w-full bg-[#FF0000] hover:bg-[#FF3333] active:bg-[#CC0000] text-white text-[0.8rem] font-black uppercase tracking-[0.3em] transition-all duration-300 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-4 shadow-[0_4px_20px_rgba(255,0,0,0.2)] group`}
                            >
                                {loading ? (
                                    <span className="animate-pulse flex items-center gap-2">
                                        <ArrowPathIcon className="w-5 h-5 animate-spin" />
                                        {t('common.verifying')}
                                    </span>
                                ) : (
                                    <>
                                        <span>{mode === 'LOGIN' ? t('auth.login') : mode === 'MAGIC' ? t('auth.sendLink') : t('auth.register')}</span>
                                        <ArrowRightIcon className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                    </>
                                )}
                            </button>

                            <div className="flex flex-col items-center space-y-5 pt-2">
                                <div className="flex items-center gap-3 text-[0.7rem] font-bold uppercase tracking-widest text-[#6b6b70]">
                                    <span>{mode === 'LOGIN' ? t('auth.noAccount') : t('auth.hasAccount')}</span>
                                    <button
                                        type="button"
                                        onClick={() => setMode(m => {
                                            if (m === 'LOGIN') return 'INITIALIZE';
                                            return 'LOGIN';
                                        })}
                                        className="text-[#FF0000] hover:text-[#FF3333] hover:underline underline-offset-4 transition-all duration-300"
                                    >
                                        {mode === 'LOGIN' ? t('auth.register') : t('auth.backToLogin')}
                                    </button>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => setMode(m => {
                                        if (m === 'MAGIC') return 'LOGIN';
                                        return 'MAGIC';
                                    })}
                                    className="text-[0.6rem] font-bold text-[#444448] hover:text-[#88888e] transition-colors uppercase tracking-[0.2em]"
                                >
                                    {mode === 'MAGIC' ? t('auth.useStandard') : t('auth.requestMagic')}
                                </button>
                            </div>
                        </div>
                    </form>
                </div>

                {/* Secure Footer Indicator */}
                <div className="px-6 sm:px-12 py-6 bg-[var(--bg-tertiary)] border-t border-[var(--border-color)] flex items-center justify-center gap-3">
                    <ShieldCheckIcon className="h-3.5 w-3.5 text-[#32D74B]" />
                    <span className="text-[0.6rem] font-mono text-[var(--text-muted)] tracking-widest uppercase">{t('auth.secureConnection')}</span>
                </div>
            </div>
        </div>
    );
};
