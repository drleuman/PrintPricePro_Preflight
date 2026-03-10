import React, { useMemo, useState } from 'react';
import type { PreflightResult, Issue } from '../types';
import { t } from '../i18n';
import { ISSUE_CATEGORY_LABELS, SEVERITY_COLORS } from '../constants'; // Importamos SEVERITY_COLORS
import { diffPreflight } from '../utils/diffPreflight';
import { FixedSizeList } from 'react-window'; // Importamos FixedSizeList

import {
  PhotoIcon,
  SwatchIcon,
  PencilIcon,
  AdjustmentsHorizontalIcon,
  ArrowsPointingOutIcon,
  DocumentTextIcon,
  InformationCircleIcon,
  ExclamationCircleIcon,
  ExclamationTriangleIcon,
  BoltIcon,
  CheckCircleIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';

type Props = {
  result: PreflightResult | null;
  onSelectIssue: (issue: Issue) => void;
  emptyHint?: string;
  onRunPreflight?: () => void;
  isRunning?: boolean;
  compareEnabled?: boolean;
  autoFixBefore?: PreflightResult | null;
  autoFixAfter?: PreflightResult | null;
};

/* =========================================================
   Iconos por categoría
   ======================================================= */

const CATEGORY_ICONS: Record<string, React.ComponentType<any>> = {
  images: PhotoIcon,
  image: PhotoIcon,
  color_spaces: SwatchIcon,
  color: SwatchIcon,
  fonts: PencilIcon,
  transparency: AdjustmentsHorizontalIcon,
  bleed_margins: ArrowsPointingOutIcon,
  resolution: DocumentTextIcon,
  compliance: InformationCircleIcon,
};

/* =========================================================
   Helpers
   ======================================================= */

function getSeverity(issue: Issue): 'error' | 'warning' | 'info' {
  const sev = String((issue as any).severity || '').toLowerCase();
  if (sev.includes('error')) return 'error';
  if (sev.includes('warn')) return 'warning';
  return 'info';
}

function severityLabel(sev: 'error' | 'warning' | 'info'): string {
  if (sev === 'error') return t('severityError') || 'Error';
  if (sev === 'warning') return t('severityWarning') || 'Warning';
  return t('severityInfo') || 'Info';
}

/* =========================================================
   Componente
   ======================================================= */

export const IssuesPanel: React.FC<Props> = ({
  result,
  onSelectIssue,
  emptyHint,
  onRunPreflight,
  isRunning,
  compareEnabled,
  autoFixBefore,
  autoFixAfter,
}) => {
  const [tab, setTab] = useState<'all' | 'error' | 'warning' | 'info'>('all');

  const issues = useMemo(
    () => (Array.isArray(result?.issues) ? (result!.issues as Issue[]) : []),
    [result]
  );

  const counts = useMemo(() => {
    let error = 0;
    let warning = 0;
    let info = 0;
    for (const it of issues) {
      if (!it) continue;
      const s = getSeverity(it);
      if (s === 'error') error++;
      else if (s === 'warning') warning++;
      else info++;
    }
    return { total: issues.length, error, warning, info };
  }, [issues]);

  const filtered = useMemo(() => {
    if (tab === 'all') return issues;
    return issues.filter((it) => it && getSeverity(it) === tab);
  }, [issues, tab]);

  // Se remueve grouped para usar filtered directamente con FixedSizeList
  // const grouped = useMemo(() => {
  //   const g: Record<string, Issue[]> = {};
  //   for (const it of filtered) {
  //     const key = (it.category || 'other').toLowerCase();
  //     if (!g[key]) g[key] = [];
  //     g[key].push(it);
  //   }
  //   return g;
  // }, [filtered]);

  const runBtnLabel = isRunning
    ? t('analyzingPDF') || 'Analyzing PDF...'
    : t('runPreflight') || 'Run Preflight';

  // Compare view
  const diff = useMemo(() => {
    if (compareEnabled && autoFixBefore && autoFixAfter) {
      return diffPreflight(autoFixBefore, autoFixAfter);
    }
    return null;
  }, [compareEnabled, autoFixBefore, autoFixAfter]);

  // Componente para renderizar cada fila en la lista virtualizada
  const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => {
    const iss = filtered[index];
    if (!iss) return null; // Safety check

    const sev = getSeverity(iss);
    const sevLabel = severityLabel(sev);

    // Fallback logic for V2 fields
    const displayCategory = (iss.category as any) || iss.type || 'other';
    const categoryLabel = (ISSUE_CATEGORY_LABELS[displayCategory as keyof typeof ISSUE_CATEGORY_LABELS]) || displayCategory;
    const displayMessage = iss.user_message || iss.message || iss.title || (iss as any).description || 'Issue';

    // Severity color handling
    const rawSev = (iss.severity || '').toLowerCase();
    const sevColorKey = rawSev.includes('error') ? 'error' : rawSev.includes('warn') ? 'warning' : 'info';
    const sevColorClass = SEVERITY_COLORS[sevColorKey as keyof typeof SEVERITY_COLORS] || '';

    return (
      <div style={style} className="px-3 border-b border-gray-100 last:border-b-0 flex items-center">
        <button
          type="button"
          onClick={() => iss && onSelectIssue(iss)}
          className={`w-full text-left ppp-issues-row ppp-issues-row--${sev} py-2 px-2`}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex flex-col min-w-0 flex-1 gap-0.5">
              <span className={`text-[9px] uppercase tracking-wider font-black ${sevColorClass.split(' ')[0]} ${(sevColorClass.split(' ')[1] || '').replace('100', '200')}`}>
                {sevLabel}
              </span>
              <span className="ppp-issues-row-title text-xs font-semibold text-gray-800 line-clamp-2 leading-tight">
                {displayMessage}
              </span>
              <span className="text-[10px] text-gray-400 leading-none">{categoryLabel}</span>
            </div>
            <span className="ppp-issues-row-page text-[10px] text-gray-400 whitespace-nowrap shrink-0 mt-0.5">
              {iss.page !== undefined ? `${t('page')} ${iss.page}` : t('documentWide')}
            </span>
          </div>
        </button>
      </div>
    );
  };

  if (diff) {
    // Compare view
    return (
      <section className="ppp-issues-panel">
        <div className="ppp-issues-panel__header">
          <h3 className="ppp-issues-panel__title">Compare Before/After</h3>
        </div>

        {/* Delta summary */}
        <div className="mb-4 p-4 bg-gray-50 rounded-lg">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-sm text-gray-500">Score</div>
              <div className="text-lg font-bold">
                {autoFixBefore?.score} → {autoFixAfter?.score}
                {diff.scoreDelta !== 0 && (
                  <span className={`ml-1 ${diff.scoreDelta > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    ({diff.scoreDelta > 0 ? '+' : ''}{diff.scoreDelta}%)
                  </span>
                )}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Errors</div>
              <div className="text-lg font-bold">
                {diff.severityCounts.before.error} → {diff.severityCounts.after.error}
                {diff.severityCounts.delta.error !== 0 && (
                  <span className={`ml-1 ${diff.severityCounts.delta.error < 0 ? 'text-green-600' : 'text-red-600'}`}>
                    ({diff.severityCounts.delta.error > 0 ? '+' : ''}{diff.severityCounts.delta.error})
                  </span>
                )}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Warnings</div>
              <div className="text-lg font-bold">
                {diff.severityCounts.before.warning} → {diff.severityCounts.after.warning}
                {diff.severityCounts.delta.warning !== 0 && (
                  <span className={`ml-1 ${diff.severityCounts.delta.warning < 0 ? 'text-green-600' : 'text-red-600'}`}>
                    ({diff.severityCounts.delta.warning > 0 ? '+' : ''}{diff.severityCounts.delta.warning})
                  </span>
                )}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Info</div>
              <div className="text-lg font-bold">
                {diff.severityCounts.before.info} → {diff.severityCounts.after.info}
                {diff.severityCounts.delta.info !== 0 && (
                  <span className={`ml-1 ${diff.severityCounts.delta.info < 0 ? 'text-green-600' : 'text-red-600'}`}>
                    ({diff.severityCounts.delta.info > 0 ? '+' : ''}{diff.severityCounts.delta.info})
                  </span>
                )}
              </div>
            </div>
          </div>
          {diff.issueChanges.newIssues.length > 0 && (
            <div className="mt-2 text-center">
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                <ExclamationTriangleIcon className="w-4 h-4" /> New issues detected: +{diff.issueChanges.newIssues.length}
              </span>
            </div>
          )}
        </div>

        {/* Before/After cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {/* Before card */}
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <h4 className="font-bold text-red-800 mb-2">BEFORE</h4>
            <div className="space-y-2">
              <div><strong>Score:</strong> {autoFixBefore.score}%</div>
              <div><strong>Summary:</strong> {autoFixBefore.summary}</div>
              <div><strong>Issues:</strong> {diff.severityCounts.before.error} errors, {diff.severityCounts.before.warning} warnings, {diff.severityCounts.before.info} info</div>
              <div>
                <strong>Top categories:</strong>
                <ul className="ml-4 mt-1">
                  {(autoFixBefore.categorySummaries || []).slice(0, 5).map(cat => (
                    <li key={cat.category} className="text-sm">
                      {ISSUE_CATEGORY_LABELS[cat.category] || cat.category}: {(cat.errors || 0) + (cat.warnings || 0) + (cat.info || 0)} issues
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* After card */}
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <h4 className="font-bold text-green-800 mb-2">AFTER</h4>
            <div className="space-y-2">
              <div><strong>Score:</strong> {autoFixAfter.score}%</div>
              <div><strong>Summary:</strong> {autoFixAfter.summary}</div>
              <div><strong>Issues:</strong> {diff.severityCounts.after.error} errors, {diff.severityCounts.after.warning} warnings, {diff.severityCounts.after.info} info</div>
              <div>
                <strong>Top categories:</strong>
                <ul className="ml-4 mt-1">
                  {(autoFixAfter.categorySummaries || []).slice(0, 5).map(cat => (
                    <li key={cat.category} className="text-sm">
                      {ISSUE_CATEGORY_LABELS[cat.category] || cat.category}: {(cat.errors || 0) + (cat.warnings || 0) + (cat.info || 0)} issues
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* What changed */}
        <div className="space-y-4">
          <h4 className="font-bold text-lg">What Changed</h4>

          {diff.issueChanges.fixedIssues.length > 0 && (
            <div>
              <h5 className="font-semibold text-green-700 mb-2 flex items-center gap-2"><CheckCircleIcon className="w-5 h-5" /> Fixed Issues ({diff.issueChanges.fixedIssues.length})</h5>
              <ul className="space-y-1 max-h-40 overflow-y-auto">
                {diff.issueChanges.fixedIssues.slice(0, 10).map((issue, i) => (
                  <li key={i} className="text-sm text-gray-700">
                    p.{issue.page} • {ISSUE_CATEGORY_LABELS[issue.category] || issue.category} • {issue.severity} — {issue.message}
                  </li>
                ))}
                {diff.issueChanges.fixedIssues.length > 10 && (
                  <li className="text-sm text-gray-500">... and {diff.issueChanges.fixedIssues.length - 10} more</li>
                )}
              </ul>
            </div>
          )}

          {diff.issueChanges.remainingIssues.length > 0 && (
            <div>
              <h5 className="font-semibold text-red-700 mb-2 flex items-center gap-2"><ArrowPathIcon className="w-5 h-5" /> Remaining Issues ({diff.issueChanges.remainingIssues.length})</h5>
              <ul className="space-y-1 max-h-40 overflow-y-auto">
                {diff.issueChanges.remainingIssues.slice(0, 10).map((issue, i) => (
                  <li key={i} className="text-sm text-gray-700">
                    p.{issue.page} • {ISSUE_CATEGORY_LABELS[issue.category] || issue.category} • {issue.severity} — {issue.message}
                  </li>
                ))}
                {diff.issueChanges.remainingIssues.length > 10 && (
                  <li className="text-sm text-gray-500">... and {diff.issueChanges.remainingIssues.length - 10} more</li>
                )}
              </ul>
            </div>
          )}

          {diff.issueChanges.newIssues.length > 0 && (
            <div>
              <h5 className="font-semibold text-red-700 mb-2 flex items-center gap-2"><ExclamationTriangleIcon className="w-5 h-5" /> New Issues ({diff.issueChanges.newIssues.length})</h5>
              <ul className="space-y-1 max-h-40 overflow-y-auto">
                {diff.issueChanges.newIssues.slice(0, 10).map((issue, i) => (
                  <li key={i} className="text-sm text-gray-700">
                    p.{issue.page} • {ISSUE_CATEGORY_LABELS[issue.category] || issue.category} • {issue.severity} — {issue.message}
                  </li>
                ))}
                {diff.issueChanges.newIssues.length > 10 && (
                  <li className="text-sm text-gray-500">... and {diff.issueChanges.newIssues.length - 10} more</li>
                )}
              </ul>
            </div>
          )}
        </div>
      </section>
    );
  }

  // Normal view
  return (
    <section className="ppp-issues-panel">
      {/* Header */}
      <div className="ppp-issues-panel__header">
        {/* Línea superior: título + resumen + botón */}
        <div className="ppp-issues-panel__header-main">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <h2 className="ppp-issues-panel__title">
                {t('issuesFound') || 'Issues Found'}
              </h2>
              <span className="ppp-badge-total">
                {counts.total}
              </span>
            </div>
            <p className="text-xs text-gray-500">
              {counts.total
                ? `${counts.total} ${t('issues')} · ${counts.error} ${t('errors')} · ${counts.warning} ${t('warnings')} · ${counts.info} ${t('info')}`
                : t('noIssuesToDisplay')}
            </p>
          </div>


        </div>

        {/* Tabs — cuadrados, alineados a la izquierda, sin pill redondo */}
        <div className="ppp-issues-tabs">
          <button
            type="button"
            className={
              'ppp-issues-tab ' +
              (tab === 'all' ? 'ppp-issues-tab--active' : '')
            }
            onClick={() => setTab('all')}
          >
            <InformationCircleIcon className="h-4 w-4" />
            <span>{t('issues') || 'Issues'}</span>
          </button>

          <button
            type="button"
            className={
              'ppp-issues-tab ' +
              (tab === 'error' ? 'ppp-issues-tab--active' : '')
            }
            onClick={() => setTab('error')}
          >
            <ExclamationCircleIcon className="h-4 w-4" />
            <span>
              {t('errors') || 'Errors'} ({counts.error})
            </span>
          </button>

          <button
            type="button"
            className={
              'ppp-issues-tab ' +
              (tab === 'warning' ? 'ppp-issues-tab--active' : '')
            }
            onClick={() => setTab('warning')}
          >
            <ExclamationTriangleIcon className="h-4 w-4" />
            <span>
              {t('warnings') || 'Warnings'} ({counts.warning})
            </span>
          </button>

          <button
            type="button"
            className={
              'ppp-issues-tab ' +
              (tab === 'info' ? 'ppp-issues-tab--active' : '')
            }
            onClick={() => setTab('info')}
          >
            <InformationCircleIcon className="h-4 w-4" />
            <span>
              {t('info') || 'Info'} ({counts.info})
            </span>
          </button>
        </div>
      </div>

      {/* Lista de categorías + issues */}
      <div className="ppp-issues-list">
        {counts.total === 0 && (
          <div className="ppp-issues-empty rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600 text-center absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3/4">
            {emptyHint || t('noIssuesToDisplay')}
          </div>
        )}

        {counts.total > 0 && (
          <FixedSizeList
            height={560}
            width="100%"
            itemCount={filtered.length}
            itemSize={76}
            className="ppp-issues-list-virtualizada"
          >
            {Row}
          </FixedSizeList>
        )}
      </div>
    </section>

  );
};
