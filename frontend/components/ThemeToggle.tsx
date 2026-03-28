import React from 'react';
import { useTheme } from '../hooks/useTheme';
import { SunIcon, MoonIcon } from '@heroicons/react/24/outline';

export const ThemeToggle: React.FC = () => {
    const { theme, toggleTheme } = useTheme();

    return (
        <button 
            onClick={toggleTheme}
            className="flex items-center gap-3 px-4 py-2 border border-[var(--border-color)] hover:border-[var(--accent-color)] hover:bg-[var(--hover-bg)] transition-all group"
            aria-label="Toggle Theme"
        >
            <div className="text-[var(--text-secondary)] group-hover:text-[var(--accent-color)] transition-colors">
                {theme === 'dark' ? (
                    <SunIcon className="h-5 w-5" />
                ) : (
                    <MoonIcon className="h-5 w-5" />
                )}
            </div>
            <span className="hidden md:inline text-[0.8rem] font-black uppercase tracking-[0.15em] text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]">
                {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
            </span>
        </button>
    );
};
