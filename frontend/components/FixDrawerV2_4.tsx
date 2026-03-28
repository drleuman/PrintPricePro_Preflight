import React, { useEffect, useState } from 'react';
import type { Issue } from '../types';
import { t } from '../i18n';
import { ISSUE_CATEGORY_LABELS } from '../constants';
import { SafeHtmlMarkdown } from './SafeHtmlMarkdown';
import { getIssueHint } from '../profiles/defaultProfile';
import { StatusBadge } from '../design/preflight_starter_pack';
import { formatLabel } from '../utils/formatters';
import {
  XMarkIcon,
  ExclamationCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  SparklesIcon,
  BeakerIcon,
  WrenchScrewdriverIcon,
  SwatchIcon,
  ArrowPathIcon,
  ChevronRightIcon
} from '@heroicons/react/24/outline';

type Props = {
  issue: Issue | null;
  onClose: () => void;
  onOpenAIAudit?: (issue: Issue) => void;
  onOpenEfficiencyTips?: (issue: Issue) => void;
  onFixBleed?: (mode: 'safe' | 'aggressive') => void;
  onConvertGrayscale?: () => void;
  onConvertCMYK?: () => void;
  onRebuildPdf?: () => void;
  selectedProfile?: string;
  onProfileChange?: (profile: string) => void;
  isFixing?: boolean;
  serverAvailable?: boolean;
};

export const FixDrawerV2_4: React.FC<Props> = ({
  issue,
  onClose,
  onOpenAIAudit,
  onOpenEfficiencyTips,
  onFixBleed,
  onConvertGrayscale,
  onConvertCMYK,
  onRebuildPdf,
  selectedProfile,
  onProfileChange,
  isFixing,
  serverAvailable = true
}) => {
  const [bleedMode, setBleedMode] = useState<'safe' | 'aggressive'>('safe');

  if (!issue) return null;

  const hint = getIssueHint(issue);
  const isError = (issue as any).severity === 'error';

  return (
    <aside className="fixed inset-y-0 right-0 w-[450px] bg-[var(--bg-secondary)] border-l border-[var(--border-color)] shadow-[-50px_0_100px_rgba(0,0,0,0.5)] flex flex-col z-[100] animate-in slide-in-from-right duration-500">
      {/* Header Signal */}
      <div className="p-8 border-b border-[var(--border-color)] flex items-center justify-between bg-[var(--bg-primary)]/40">
        <div className="flex items-center gap-4">
          <div className={`h-10 w-10 border border-[var(--border-color)] flex items-center justify-center ${isError ? 'text-[var(--accent-color)]' : 'text-[var(--text-secondary)]'}`}>
            {isError ? <ExclamationCircleIcon className="h-6 w-6" /> : <InformationCircleIcon className="h-6 w-6" />}
          </div>
          <div>
            <div className="text-[0.82rem] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">Trace Inspector v2.4</div>
            <h2 className="text-xl font-extrabold tracking-tight text-[var(--text-primary)] uppercase truncate max-w-[260px]">
                {issue.title || (issue as any).message || "System Deviation"}
            </h2>
          </div>
        </div>
        <button onClick={onClose} className="p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
          <XMarkIcon className="h-6 w-6" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-8 custom-scrollbar space-y-10">
        {/* Status Section */}
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <StatusBadge label={((issue as any).severity || 'WARNING').toUpperCase()} variant={isError ? 'warning' : 'default'} />
                <span className="text-[0.8rem] font-mono text-[var(--text-muted)] uppercase tracking-widest">Page {issue.page || 1} / Internal ID: {issue.id?.substring(0,8) || 'N/A'}</span>
            </div>
            <p className="text-[0.8rem] font-medium text-[var(--text-secondary)] leading-relaxed uppercase tracking-widest">
                {hint?.userFriendlySummary || (issue as any).message || "Detailed diagnostic data pending analysis."}
            </p>
        </div>

        {/* AI Forensic Support */}
        <div className="space-y-4">
            <div className="text-[0.82rem] font-black uppercase tracking-[0.2em] text-[var(--accent-color)]">{formatLabel('AI_HYPER_ASSIST')}</div>
            <div className="grid grid-cols-2 gap-3">
                <button 
                    onClick={() => onOpenAIAudit?.(issue)}
                    className="p-4 border border-[var(--accent-color)]/30 bg-[var(--accent-color)]/5 hover:bg-[var(--accent-color)]/10 transition-all flex flex-col items-center gap-3 text-center group"
                >
                    <SparklesIcon className="h-5 w-5 text-[var(--accent-color)]" />
                    <span className="text-[0.75rem] font-black uppercase tracking-widest text-[var(--accent-color)]">Deep Diagnostic</span>
                </button>
                <button 
                    onClick={() => onOpenEfficiencyTips?.(issue)}
                    className="p-4 border border-[var(--border-color)] bg-[var(--bg-tertiary)]/30 hover:bg-[var(--accent-color)]/5 transition-all flex flex-col items-center gap-3 text-center group"
                >
                    <BeakerIcon className="h-5 w-5 text-[var(--text-muted)] group-hover:text-[var(--accent-color)]" />
                    <span className="text-[0.75rem] font-black uppercase tracking-widest text-[var(--text-muted)] group-hover:text-[var(--text-primary)]">Efficiency Lab</span>
                </button>
            </div>
        </div>

        {/* Tactical Fixes */}
        <div className="space-y-6">
            <div className="text-[0.62rem] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">{formatLabel('Tactical_Correction')}</div>
            
            <div className="space-y-3">
                {/* Specific Fixes Render Here */}
                {['missing-bleed-info', 'insufficient-bleed'].includes(issue.id) && onFixBleed && (
                    <div className="p-6 border border-[var(--border-color)] bg-[var(--bg-tertiary)]/20 space-y-4">
                        <div className="flex justify-between items-center text-[0.8rem] font-black text-[var(--text-muted)] uppercase tracking-widest">
                            <span>{formatLabel('Bleed_Ingress_Mode')}</span>
                            <span className="text-[var(--accent-color)]">Automated</span>
                        </div>
                        <select 
                            value={bleedMode} 
                            onChange={(e) => setBleedMode(e.target.value as 'safe' | 'aggressive')}
                            className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] p-3 text-[0.85rem] font-mono text-[var(--text-primary)] outline-none focus:border-[var(--accent-color)]/50"
                        >
                            <option value="safe">SAFE_BOX_EXPANSION</option>
                            <option value="aggressive">AGGRESSIVE_SCALE_FILL</option>
                        </select>
                        <button 
                            onClick={() => onFixBleed(bleedMode)}
                            className="w-full py-4 bg-[var(--accent-color)] hover:bg-[var(--accent-hover)] text-white text-[0.82rem] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg"
                        >
                            <WrenchScrewdriverIcon className="h-4 w-4" />
                            Apply 3mm Standard Fix
                        </button>
                    </div>
                )}

                {/* Color/Profile Fixes */}
                {(issue.category === 'color' || issue.id?.includes('color')) && onConvertCMYK && (
                    <div className="p-6 border border-[var(--border-color)] bg-[var(--bg-tertiary)]/20 space-y-4">
                         <div className="flex justify-between items-center text-[0.8rem] font-black text-[var(--text-muted)] uppercase tracking-widest">
                            <span>{formatLabel('Policy_Enforcement')}</span>
                        </div>
                        <select 
                            value={selectedProfile || 'iso_coated_v3'} 
                            onChange={(e) => onProfileChange?.(e.target.value)}
                            className="w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] p-3 text-[0.85rem] font-mono text-[var(--text-primary)] outline-none focus:border-[var(--accent-color)]/50"
                        >
                            <option value="iso_coated_v3">FOGRA51 (PSD_V3)</option>
                            <option value="iso_uncoated_v3">FOGRA52 (PSO_V3)</option>
                        </select>
                        <button 
                            onClick={onConvertCMYK}
                            className="w-full py-4 bg-[var(--hover-bg)] hover:bg-[var(--accent-color)]/5 text-[var(--text-primary)] text-[0.82rem] font-black uppercase tracking-widest transition-all border border-[var(--border-color)] flex items-center justify-center gap-2"
                        >
                            <SwatchIcon className="h-4 w-4" />
                            Convert to CMYK Policy
                        </button>
                    </div>
                )}
            </div>
        </div>
      </div>

      {/* Footer Footer */}
      <div className="p-8 border-t border-[var(--border-color)] bg-[var(--bg-tertiary)]/10 flex items-center justify-between">
            <div className="flex flex-col gap-1">
                <span className="text-[0.75rem] font-black text-[var(--text-muted)] uppercase tracking-widest">{formatLabel('System_Load')}</span>
                <span className="text-[0.8rem] font-mono text-[var(--text-primary)]">0.42 / IDLE</span>
            </div>
            <button 
                onClick={onClose}
                className="text-[0.8rem] font-black uppercase tracking-widest text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
            >
                Dismiss
            </button>
      </div>
    </aside>
  );
};
