import React, { useEffect, useState, useCallback } from 'react';
import type { Issue } from '../types';
import { pposFetch, getAuthToken } from '../lib/apiClient';
import { pickAvailableModel, GEMINI_API_VER } from '../lib/gemini';
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
  onApplyCorrection?: () => void;
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
  onApplyCorrection,
  selectedProfile,
  onProfileChange,
  isFixing,
  serverAvailable = true
}) => {
  const [bleedMode, setBleedMode] = useState<'safe' | 'aggressive'>('safe');
  const [policies, setPolicies] = useState<any[]>([]);
  const [efficiencyLoading, setEfficiencyLoading] = useState(false);
  const [efficiencyResponse, setEfficiencyResponse] = useState<string | null>(null);
  const [efficiencyError, setEfficiencyError] = useState<string | null>(null);

  const fetchEfficiencyTips = useCallback(async () => {
    if (!issue) return;
    setEfficiencyLoading(true);
    setEfficiencyError(null);
    setEfficiencyResponse(null);
    try {
      const model = await pickAvailableModel();
      const prompt = `Efficiency and ink-saving checklist for print preflight issue: ${issue.title || issue.message}. Category: ${issue.category || 'General'}. Provide tactical advice for a pre-press operator.`;
      
      const data = await pposFetch<any>(`/api/gemini-proxy/${GEMINI_API_VER}/models/${encodeURIComponent(model)}:generateContent`, {
        method: 'POST',
        body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }] }),
      });

      const cand = data?.candidates?.[0];
      const parts = cand?.content?.parts;
      const text = Array.isArray(parts) ? parts.map((p: any) => p?.text || '').join('\n\n').trim() : (data?.output_text || '');
      setEfficiencyResponse(text);
    } catch (e: any) {
      setEfficiencyError(e?.message || 'AI protocol failed to initialize.');
    } finally {
      setEfficiencyLoading(false);
    }
  }, [issue]);

  useEffect(() => {
    // Reset efficiency state when issue changes
    setEfficiencyResponse(null);
    setEfficiencyError(null);
    setEfficiencyLoading(false);

    // Only attempt policy fetch if the component is being shown
    if (!issue) return;

    const token = getAuthToken();
    if (!token) {
        console.warn('[DRAWER-AUTH-OMISSION] Attempted policy fetch without token. skipping.');
        return;
    }

    pposFetch<{ policies: any[] }>('/api/v2/jobs/policies')
      .then(res => {
        if (res.policies) setPolicies(res.policies);
      })
      .catch(err => {
        if (err.status === 401) {
            console.error('[DRAWER-AUTH-REJECTION] Policy fetch returned 401 (Unauthorized). ensuring bearer token injection.');
        } else {
            console.error('[DRAWER-POLICIES-ERROR]', err);
        }
      });
  }, [issue]);

  if (!issue) return null;

  const hint = getIssueHint(issue);
  const isError = (issue as any).severity === 'error';

  // Prioritize forensic detail over generic labels
  const displayTitle = issue.title || issue.summary || issue.message || issue.rule || issue.code || "Critical Trace Finding";
  const displayId = issue.id || issue.uuid || issue.rule || issue.code || 'N/A';

  return (
    <aside className="fixed inset-y-0 right-0 w-[450px] bg-[var(--bg-secondary)] border-l border-[var(--border-color)] shadow-[-50px_0_100px_rgba(0,0,0,0.5)] flex flex-col z-[100] animate-in slide-in-from-right duration-500">
      {/* Header Signal */}
      <div className="p-8 border-b border-[var(--border-color)] flex items-center justify-between bg-[var(--bg-primary)]/40">
        <div className="flex items-center gap-4">
          <div className={`h-10 w-10 border border-[var(--border-color)] flex items-center justify-center ${isError ? 'text-[var(--accent-color)]' : 'text-[var(--text-secondary)]'}`}>
            {isError ? <ExclamationCircleIcon className="h-6 w-6" /> : <InformationCircleIcon className="h-6 w-6" />}
          </div>
          <div>
            <div className="text-[0.82rem] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">{t('inspector.traceTitle')}</div>
            <h2 className="text-xl font-extrabold tracking-tight text-[var(--text-primary)] uppercase truncate max-w-[260px]">
                {displayTitle}
            </h2>
          </div>
        </div>
        <button onClick={onClose} className="p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
          <XMarkIcon className="h-6 w-6" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-8 custom-scrollbar space-y-10">
        {/* Status Section */}
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <StatusBadge label={((issue as any).severity || 'WARNING').toUpperCase()} variant={isError ? 'warning' : 'default'} />
                <span className="text-[0.8rem] font-mono text-[var(--text-muted)] uppercase tracking-widest">
                  {issue.page ? `${t('inspector.pageLabelPage')} ${issue.page}` : t('inspector.pageLabelDoc')} / {displayId.substring(0,8)}
                </span>
            </div>
            
            <div className="space-y-2">
                <div className="text-[0.65rem] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">{t('inspector.findingDetails')}</div>
                <p className="text-[0.9rem] font-medium text-[var(--text-primary)] leading-relaxed">
                    {issue.message}
                </p>
                {issue.description && (
                  <p className="text-[0.8rem] text-[var(--text-secondary)] leading-relaxed">
                    {issue.description}
                  </p>
                )}
            </div>

            {issue.recommendation && (
              <div className="p-4 bg-[var(--accent-color)]/5 border-l-2 border-[var(--accent-color)] space-y-2">
                  <div className="text-[0.65rem] font-black uppercase tracking-[0.2em] text-[var(--accent-color)]">{t('inspector.engineRecommendation')}</div>
                  <p className="text-[0.8rem] text-[var(--text-primary)] font-medium italic">
                    {issue.recommendation}
                  </p>
              </div>
            )}

            {(issue.context || issue.source) && (
              <div className="p-4 border-l-2 border-[var(--border-color)] bg-[var(--bg-tertiary)]/10 space-y-2">
                  <div className="text-[0.65rem] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">{t('inspector.technicalContext')}</div>
                  <p className="text-[0.75rem] font-mono text-[var(--text-secondary)] leading-relaxed">
                    {issue.context || issue.source}
                  </p>
              </div>
            )}
            
            <div className="flex items-center gap-4 text-[0.7rem] font-mono text-[var(--text-muted)] uppercase tracking-widest">
                <span>{t('inspector.fixable')} {issue.fixable ? t('inspector.isFixableYes') : t('inspector.isFixableNo')}</span>
            </div>
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
                    <span className="text-[0.75rem] font-black uppercase tracking-widest text-[var(--accent-color)]">{t('inspector.deepDiagnostic')}</span>
                </button>
                <button 
                    onClick={fetchEfficiencyTips}
                    disabled={efficiencyLoading}
                    className={`p-4 border border-[var(--border-color)] bg-[var(--bg-secondary)]/40 hover:border-[var(--accent-color)]/30 hover:bg-[var(--accent-color)]/5 transition-all flex flex-col items-center gap-3 text-center group ${efficiencyLoading ? 'opacity-50 cursor-wait' : ''}`}
                >
                    <BeakerIcon className={`h-5 w-5 ${efficiencyLoading ? 'animate-pulse text-[var(--accent-color)]' : 'text-[var(--text-secondary)] group-hover:text-[var(--accent-color)]'}`} />
                    <span className="text-[0.75rem] font-black uppercase tracking-widest text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]">
                        {efficiencyLoading ? t('common.processing') : t('inspector.efficiencyLab')}
                    </span>
                </button>
            </div>

            {/* Efficiency Lab Response Area */}
            {(efficiencyLoading || efficiencyResponse || efficiencyError) && (
              <div className="p-6 border border-[var(--border-color)] bg-[var(--bg-primary)]/60 animate-in fade-in slide-in-from-top-4 duration-500">
                  <div className="flex items-center gap-3 mb-4">
                      <BeakerIcon className="h-5 w-5 text-[var(--accent-color)]" />
                      <span className="text-[0.7rem] font-black uppercase tracking-[0.2em] text-[var(--text-primary)]">{t('inspector.efficiencyProtocol')}</span>
                  </div>
                  
                  {efficiencyLoading ? (
                    <div className="space-y-3 py-4">
                        <div className="h-2 w-full bg-[var(--border-color)] overflow-hidden">
                            <div className="h-full bg-[var(--accent-color)] animate-[shimmer_2s_infinite]"></div>
                        </div>
                        <div className="text-[0.65rem] font-black uppercase tracking-widest text-[var(--text-muted)] animate-pulse">{t('inspector.consultingAi')}</div>
                    </div>
                  ) : efficiencyError ? (
                    <div className="p-3 bg-[var(--accent-color)]/10 border border-[var(--accent-color)]/20 text-[var(--accent-color)] text-[0.75rem] font-mono">{efficiencyError}</div>
                  ) : (
                    <div className="prose dark:prose-invert prose-sm max-w-none text-[var(--text-primary)] leading-relaxed">
                        <SafeHtmlMarkdown markdown={efficiencyResponse || ""} />
                    </div>
                  )}
                  
                  {(efficiencyResponse || efficiencyError) && (
                    <button 
                      onClick={() => setEfficiencyResponse(null)}
                      className="mt-6 text-[0.65rem] font-black uppercase tracking-widest text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                    >
                        {t('inspector.resetProtocol')}
                    </button>
                  )}
              </div>
            )}
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
                            {t('inspector.applyBleedFix')}
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
                            value={selectedProfile} 
                            onChange={(e) => onProfileChange?.(e.target.value)}
                            className="w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] p-3 text-[0.85rem] font-mono text-[var(--text-primary)] outline-none focus:border-[var(--accent-color)]/50"
                        >
                            {policies.length === 0 && <option value="">Loading policies...</option>}
                            {policies.map(p => (
                                <option key={p.id} value={p.id}>{p.name.toUpperCase()}</option>
                            ))}
                        </select>
                        <button 
                            onClick={onConvertCMYK}
                            className="w-full py-4 bg-[var(--hover-bg)] hover:bg-[var(--accent-color)]/5 text-[var(--text-primary)] text-[0.82rem] font-black uppercase tracking-widest transition-all border border-[var(--border-color)] flex items-center justify-center gap-2"
                        >
                            <SwatchIcon className="h-4 w-4" />
                            {t('inspector.applyCmykFix')}
                        </button>
                    </div>
                )}
                {/* General Direct Action Correction */}
                {issue.fixable && onApplyCorrection && (
                    <button 
                        onClick={onApplyCorrection}
                        className="w-full py-5 bg-[var(--accent-color)] hover:bg-[var(--accent-hover)] text-white text-[0.85rem] font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3 shadow-[0_15px_30px_rgba(220,0,0,0.3)] group"
                    >
                        <WrenchScrewdriverIcon className="h-5 w-5 animate-bounce group-hover:animate-none" />
                        {t('inspector.fixIssue')}
                    </button>
                )}
            </div>
        </div>
      </div>

      {/* Footer Footer */}
      <div className="p-8 border-t border-[var(--border-color)] bg-[var(--bg-tertiary)]/10 flex items-center justify-between">
            <div className="flex flex-col gap-1">
                <span className="text-[0.75rem] font-black text-[var(--text-muted)] uppercase tracking-widest">{t('inspector.systemLoad')}</span>
                <span className="text-[0.8rem] font-mono text-[var(--text-primary)]">0.42 / IDLE</span>
            </div>
            <button 
                onClick={onClose}
                className="text-[0.8rem] font-black uppercase tracking-widest text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
            >
                {t('inspector.dismiss')}
            </button>
      </div>
    </aside>
  );
};
