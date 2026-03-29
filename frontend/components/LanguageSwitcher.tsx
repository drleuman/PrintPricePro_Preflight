import React from 'react';
import { useLocale, Locale } from '../i18n';

export const LanguageSwitcher: React.FC = () => {
    const { currentLocale, setLocale } = useLocale();

    const toggleLocale = (newLocale: Locale) => {
        setLocale(newLocale);
    };

    return (
        <div className="flex items-center gap-1 border border-[var(--border-color)] bg-[var(--bg-secondary)]/50 p-1">
            <button 
                onClick={() => toggleLocale('en')}
                className={`px-2 py-1 text-[0.65rem] font-black uppercase tracking-widest transition-all ${
                    currentLocale === 'en' 
                    ? 'bg-[var(--accent-color)] text-white shadow-[0_0_15px_rgba(220,0,0,0.4)]' 
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--hover-bg)]'
                }`}
            >
                EN
            </button>
            <button 
                onClick={() => toggleLocale('es')}
                className={`px-2 py-1 text-[0.65rem] font-black uppercase tracking-widest transition-all ${
                    currentLocale === 'es' 
                    ? 'bg-[var(--accent-color)] text-white shadow-[0_0_15px_rgba(220,0,0,0.4)]' 
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--hover-bg)]'
                }`}
            >
                ES
            </button>
        </div>
    );
};
