import React from 'react';
import { ThemeToggle } from '../components/ThemeToggle';
import { formatLabel } from '../utils/formatters';
import { useTranslation } from '../i18n';

/**
 * PREFLIGHT UI STARTER PACK — MONOLITH FIX LAYER v2.4
 *
 * Instructions:
 * 1. Define CSS variables globally if you want tokenized theming
 * 2. Keep corners at 0px
 * 3. Use this as a starter, not as the final full app
 */

type BadgeVariant = 'default' | 'warning' | 'certified' | 'processing' | 'error' | 'info';

export const PPOSLogo = ({ className = "h-8 w-8" }: { className?: string }) => (
  <svg 
    viewBox="0 0 375 375" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={{ transform: 'none' }}
  >
    <g transform="translate(0 375) scale(1 -1)">
      <path d="M 85.105,36.879 L 123.906,283.831 L 208.244,283.831 L 208.244,283.796 L 223.392,284.277 C 241.132,283.77 259.109,279.984 275.228,272.196 C 298.182,261.111 315.657,242.452 320.168,218.465 C 324.772,193.98 314.629,170.543 295.664,153.354 C 281.594,140.598 263.793,132.049 245.121,127.353 L 233.92,125.013 L 220.073,36.879 L 85.105,36.879 Z" fill="var(--accent-color)" />
      <path d="M 78.73,316.22 C 105.371,346.991 151.966,350.343 182.738,323.702 C 213.509,297.061 216.861,250.466 190.22,219.694 C 163.579,188.923 116.984,185.571 86.212,212.212 C 55.441,238.853 52.089,285.448 78.73,316.22 Z" fill="var(--accent-color)" />
      <path d="M 116.151,63.426 L 146.61,257.283 L 208.244,257.283 C 227.637,257.846 247.271,256.22 263.681,248.292 C 298.68,231.384 305.019,197.664 277.836,173.026 C 261.255,157.996 236.009,149.8 210.898,149.53 L 197.37,63.426 L 116.151,63.426 Z" fill="var(--bg-primary)" />
    </g>
  </svg>
);

export const StatusBadge = ({
  label,
  variant = 'default',
}: {
  label: string;
  variant?: BadgeVariant;
}) => {
  const { t } = useTranslation();
  const styles = {
    default: 'border-[var(--border-color)] text-[var(--text-secondary)]',
    warning: 'border-[var(--accent-color)] text-[var(--accent-color)] bg-[var(--accent-color)]/10',
    certified: 'border-[var(--border-color)] text-[var(--text-primary)] bg-[var(--hover-bg)]',
    processing: 'border-[var(--border-color)] text-[var(--accent-color)] bg-[var(--accent-color)]/5',
    error: 'border-[#ff0000] text-[#ff0000] bg-[#ff0000]/10',
    info: 'border-[var(--text-muted)] text-[var(--text-muted)] bg-[var(--bg-tertiary)]',
  };

  return (
    <span
      className={`inline-flex items-center gap-2 border px-3 py-1 text-[0.82rem] leading-none font-black uppercase font-mono whitespace-nowrap text-center ${styles[variant] || styles.default} tracking-normal`}
    >
      {variant === 'processing' && (
        <span className="h-1.5 w-1.5 shrink-0 animate-pulse bg-[#dc0000]" />
      )}
      {label}
    </span>
  );
};

export const PreflightShell = ({ children, headerContent, rightContent }: { children: React.ReactNode; headerContent?: React.ReactNode; rightContent?: React.ReactNode }) => (
  <div className="flex flex-col min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] transition-colors duration-300">
    <nav className="sticky top-0 z-50 flex h-20 shrink-0 items-center justify-between border-b border-[var(--border-color)] bg-[var(--bg-primary)] px-6 md:px-10 transition-colors duration-300">
      <div className="flex items-center gap-4 min-w-max">
        <PPOSLogo className="h-9 w-9" />
        <div className="hidden md:block">
          <div className="ppp-header-title leading-none uppercase flex gap-1.5">
            <span className="text-[var(--accent-color)]">PrintPrice</span> 
            <span className="text-[var(--text-primary)]">Pro</span>
          </div>
          <div className="ppp-header-subtitle text-[0.7rem] uppercase tracking-[0.55em] text-[var(--text-muted)] mt-1 ml-1 opacity-90">
            PREFLIGHT
          </div>
        </div>
      </div>

      <div className="flex flex-1 items-center gap-12 ml-10">
        {headerContent && (
          <div className="hidden lg:block">
            {headerContent}
          </div>
        )}
      </div>

      <div className="flex items-center gap-4 min-w-max">
        <ThemeToggle />
        <div className="h-8 w-px bg-[var(--border-color)] mx-2 hidden md:block"></div>
        {rightContent}
      </div>
    </nav>

    <main className="flex-1 mx-auto w-full max-w-[1400px] px-6 py-6 md:px-10 md:py-8 lg:px-16 lg:py-10">
      {children}
    </main>

    <footer className="border-t border-[var(--border-color)] bg-[var(--bg-secondary)] shrink-0 transition-colors duration-300">
        <div className="mx-auto max-w-[1400px] px-6 py-4 md:px-10 flex items-center justify-between">
            <SignalStrip compact />
            <div className="flex items-center gap-4 ml-6">
                <div className="h-4 w-px border-[var(--border-color)] hidden md:block"></div>
                <StatusBadge label="shell.authSynced" variant="certified" />
            </div>
        </div>
    </footer>
  </div>
);

export const SignalStrip = ({ compact = false }: { compact?: boolean }) => {
  const { t } = useTranslation();
  return (
    <div className={`grid gap-3 border-[var(--border-color)] bg-[var(--bg-secondary)] ${compact ? 'flex flex-row items-center justify-between border-0 p-0' : 'grid gap-3 border p-4 md:grid-cols-4 md:gap-4 md:p-6'}`}>
      {[
        t('shell.footer.production'),
        t('shell.footer.traceable'),
        t('shell.footer.deterministic'),
        t('shell.footer.certified'),
      ].map((item, idx) => (
        <div key={item} className="flex items-center gap-3">
          <span
            className={`h-1.5 w-1.5 ${
              idx === 2 ? 'animate-pulse bg-[var(--accent-color)]' : 'bg-[var(--accent-color)]'
            }`}
          />
          <span className={`${compact ? 'text-[0.8rem]' : 'text-[0.88rem]'} uppercase tracking-[0.16em] text-[var(--text-muted)] font-mono leading-none`}>
            {item}
          </span>
        </div>
      ))}
    </div>
  );
};

export const ValidationHero = () => {
    const { t } = useTranslation();
    return (
        <section className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
          <div>
            <div className="mb-4 text-[0.7rem] font-black uppercase tracking-[0.22em] text-[var(--accent-color)]">
              {t('shell.hero.subtitle')}
            </div>
            <h1 className="max-w-[10ch] font-extrabold tracking-[-0.05em] text-5xl leading-[0.95] sm:text-6xl md:text-7xl">
              {t('shell.hero.title')}
            </h1>
            <p className="mt-6 max-w-[60ch] text-base leading-7 text-[var(--text-secondary)] md:text-lg">
              {t('shell.hero.desc')}
            </p>
      
            <div className="mt-8 flex flex-wrap gap-4">
              <button className="bg-[var(--accent-color)] px-8 py-4 text-[0.92rem] font-extrabold uppercase tracking-[0.18em] text-white transition-all duration-300 hover:bg-[var(--accent-hover)] hover:shadow-[0_10px_30px_rgba(220,0,0,0.25)]">
                {t('shell.hero.button.check')}
              </button>
              <button className="border border-[var(--border-color)] px-8 py-4 text-[0.92rem] font-extrabold uppercase tracking-[0.18em] text-[var(--accent-color)] transition-all duration-300 hover:bg-[var(--hover-bg)]">
                {t('shell.hero.button.report')}
              </button>
            </div>
          </div>
      
          <CertificationPanel />
        </section>
    );
};

export const CertificationPanel = ({
    title = "CERTIFIED OUTPUT",
    issuesFound = 0,
    fixesApplied = 0,
    profile = "BOOK_STANDARD",
    riskStatus = "certified",
}: {
    title?: string;
    issuesFound?: number;
    fixesApplied?: number;
    profile?: string;
    riskStatus?: 'certified' | 'warning' | 'processing' | 'default';
}) => {
    const { t } = useTranslation();
    return (
      <div className="border border-[var(--border-color)] bg-[var(--bg-secondary)] p-8">
        <div className="mb-6 flex items-start justify-between gap-6 overflow-hidden">
          <StatusBadge label={title} variant={riskStatus} />
          <span className="text-[0.65rem] uppercase tracking-[0.25em] text-[var(--text-muted)] font-mono shrink-0 whitespace-nowrap pt-1.5 min-w-fit border-l border-[var(--border-color)] pl-4">
            Trace 0x48a
          </span>
        </div>
    
        <div className="space-y-5">
          <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-4">
            <span className="text-[var(--text-secondary)] text-[0.8rem] font-black uppercase tracking-widest">{t('shell.issuesFound')}</span>
            <span className="font-bold text-xl">{issuesFound.toString().padStart(2, '0')}</span>
          </div>
          <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-4">
            <span className="text-[var(--text-secondary)] text-[0.8rem] font-black uppercase tracking-widest">{t('shell.fixesApplied')}</span>
            <span className="font-bold text-xl">{fixesApplied.toString().padStart(2, '0')}</span>
          </div>
          <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-4">
            <span className="text-[var(--text-secondary)] text-[0.8rem] font-black uppercase tracking-widest">{t('shell.policyProfile')}</span>
            <span className="text-[0.85rem] uppercase tracking-[0.12em] font-mono italic">{formatLabel(profile)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[var(--text-secondary)] text-[0.8rem] font-black uppercase tracking-widest">{t('shell.finalState')}</span>
            <StatusBadge label={riskStatus === 'certified' ? 'shell.ready' : 'shell.action'} variant={riskStatus} />
          </div>
        </div>
      </div>
    );
};

export const DiagnosticCard = ({
  title,
  children,
  icon: Icon,
}: {
  title: string;
  children: React.ReactNode;
  icon?: React.ComponentType<{ size?: number; className?: string }>;
}) => (
  <div className="group border border-[var(--border-color)] bg-[var(--bg-secondary)] p-6 transition-all duration-300 hover:border-[var(--accent-color)] hover:bg-[var(--hover-bg)]">
    <div className="mb-8 flex items-start justify-between">
      {Icon ? (
        <div className="flex h-12 w-12 items-center justify-center border border-[var(--border-color)] bg-[var(--bg-tertiary)] text-[var(--text-secondary)] transition-colors group-hover:border-[var(--accent-color)] group-hover:text-[var(--accent-color)]">
          <Icon size={20} />
        </div>
      ) : (
        <div />
      )}
      <StatusBadge label="common.active" variant="processing" />
    </div>

    <h3 className="mb-3 text-2xl font-extrabold tracking-[-0.03em]">{title}</h3>
    <div className="text-sm leading-7 text-[var(--text-secondary)]">{children}</div>
  </div>
);

export const IssueRow = ({
  title,
  type,
  fixAvailable = true,
  severity = 'warning',
  onClick,
  active = false,
}: {
  title: string;
  type: string;
  fixAvailable?: boolean;
  severity?: BadgeVariant;
  onClick?: () => void;
  active?: boolean;
}) => {
  const { t } = useTranslation();
  const borderStyles = {
    error: 'border-l-[#ff0000]',
    warning: 'border-l-[var(--accent-color)]',
    info: 'border-l-[var(--text-muted)]',
    certified: 'border-l-[var(--border-color)]',
    default: 'border-l-[var(--border-color)]',
    processing: 'border-l-[var(--accent-color)]'
  };

  const getSeverityLabel = () => {
      if (severity === 'error') return t('error').toUpperCase();
      if (severity === 'warning') return t('severityWarning').toUpperCase();
      return t('info').toUpperCase();
  };

  const getFixLabel = () => {
    return fixAvailable ? t('shell.fixAvailable').toUpperCase() : t('shell.manualReview').toUpperCase();
  };

  return (
    <div 
      onClick={onClick}
      className={`border-l-4 p-5 md:p-6 transition-all duration-300 cursor-pointer ${borderStyles[severity] || borderStyles.default} ${
          active 
          ? 'bg-[rgba(220,0,0,0.05)] shadow-[0_0_20px_rgba(220,0,0,0.1)]' 
          : 'bg-[var(--bg-secondary)] hover:bg-[var(--hover-bg)]'
      }`}
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <StatusBadge label={type || 'GENERAL'} variant={severity} />
          <StatusBadge 
            label={getFixLabel()} 
            variant={fixAvailable ? "processing" : "default"} 
          />
        </div>
        <span className="text-[0.88rem] uppercase tracking-[0.16em] text-[var(--text-muted)] font-mono">
          {t('issue')?.toUpperCase() || 'ISSUE'} / {getSeverityLabel()}
        </span>
      </div>
  
      <h4 className="text-lg font-bold tracking-tight">{title}</h4>
    </div>
  );
};

export const BeforeAfterPanel = () => {
  const { t } = useTranslation();
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="border border-[var(--border-color)] bg-[var(--bg-secondary)] p-6">
        <div className="mb-4 flex items-center justify-between">
          <StatusBadge label="shell.originalFile" variant="warning" />
          <span className="text-[0.88rem] uppercase tracking-[0.16em] text-[var(--text-secondary)] font-mono">
            {t('shell.before').toUpperCase()}
          </span>
        </div>
        <div className="space-y-3 text-sm text-[#8d8d91]">
          <div>• Missing bleed</div>
          <div>• RGB profile detected</div>
          <div>• Low-resolution images</div>
          <div>• Fonts not fully embedded</div>
        </div>
      </div>

      <div className="border border-[var(--border-color)] bg-[var(--bg-panel)] p-6">
        <div className="mb-4 flex items-center justify-between">
          <StatusBadge label="shell.certOutput" variant="certified" />
          <span className="text-[0.88rem] uppercase tracking-[0.16em] text-[var(--text-secondary)] font-mono">
            {t('shell.after').toUpperCase()}
          </span>
        </div>
        <div className="space-y-3 text-sm text-[#e5e2e3]">
          <div>• Bleed validated</div>
          <div>• Color profile corrected</div>
          <div>• Output approved</div>
          <div>• Fonts verified</div>
        </div>
      </div>
    </div>
  );
};

export const ActionBar = () => {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-6 border-t border-[var(--border-color)] bg-[var(--bg-secondary)] p-6 md:flex-row md:items-center md:justify-between md:p-8">
      <div className="flex items-center gap-5">
        <div className="flex h-12 w-12 items-center justify-center bg-[rgba(220,0,0,0.1)]">
          <div className="h-2 w-2 animate-pulse bg-[var(--accent-color)]" />
        </div>
        <div>
          <div className="text-sm font-bold tracking-tight">{t('shell.engineReady')}</div>
          <div className="mt-1 text-[0.88rem] uppercase tracking-[0.18em] text-[var(--text-secondary)] font-mono">
            {t('shell.engineState', { state: t('common.idle').toUpperCase(), workers: '04', policy: t('common.standard').toUpperCase() })}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row">
        <button className="border border-[var(--border-color)] px-8 py-4 text-[0.92rem] font-extrabold uppercase tracking-[0.18em] text-[var(--accent-color)] transition-all duration-300 hover:bg-[var(--hover-bg)]">
          {t('shell.downloadReport')}
        </button>
        <button className="bg-[var(--accent-color)] px-8 py-4 text-[0.92rem] font-extrabold uppercase tracking-[0.18em] text-white transition-all duration-300 hover:bg-[var(--accent-hover)] hover:shadow-[0_10px_30px_rgba(220,0,0,0.25)]">
          {t('shell.rerunValidation')}
        </button>
      </div>
    </div>
  );
};

export const PreflightStarterDemo = () => {
  const { t } = useTranslation();
  return (
    <PreflightShell>
      <div className="space-y-10 md:space-y-14">
        <SignalStrip />
        <ValidationHero />

        <section className="grid gap-6 lg:grid-cols-3">
          <DiagnosticCard title="Detect real production issues">
            Find color, bleed, font, and resolution problems before they become expensive failures.
          </DiagnosticCard>
          <DiagnosticCard title="Fix files automatically">
            Apply policy-based corrections and generate production-ready output without manual work.
          </DiagnosticCard>
          <DiagnosticCard title="Prevent costly print errors">
            Validate every file against real production rules before it reaches the press.
          </DiagnosticCard>
        </section>

        <section className="space-y-5">
          <div className="text-[0.92rem] font-black uppercase tracking-[0.22em] text-[#dc0000]">
            {t('shell.activeIssues')}
          </div>
          <IssueRow title="Missing bleed on outer edges" type="BLEED" />
          <IssueRow title="RGB images detected in interior pages" type="COLOR" />
          <IssueRow title="Font embedding incomplete in cover file" type="FONTS" fixAvailable={false} />
        </section>

        <section className="space-y-5">
          <div className="text-[0.92rem] font-black uppercase tracking-[0.22em] text-[#dc0000]">
            {t('shell.beforeAfter')}
          </div>
          <BeforeAfterPanel />
        </section>

        <ActionBar />
      </div>
    </PreflightShell>
  );
};
