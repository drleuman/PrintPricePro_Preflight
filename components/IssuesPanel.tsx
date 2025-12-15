import React, { useMemo, useState } from 'react';
import type { PreflightResult, Issue } from '../types';
import { t } from '../i18n';
import { ISSUE_CATEGORY_LABELS } from '../constants';

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
} from '@heroicons/react/24/outline';

type Props = {
  result: PreflightResult | null;
  onSelectIssue: (issue: Issue) => void;
  emptyHint?: string;
  onRunPreflight?: () => void;
  isRunning?: boolean;
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
      const s = getSeverity(it);
      if (s === 'error') error++;
      else if (s === 'warning') warning++;
      else info++;
    }
    return { total: issues.length, error, warning, info };
  }, [issues]);

  const filtered = useMemo(() => {
    if (tab === 'all') return issues;
    return issues.filter((it) => getSeverity(it) === tab);
  }, [issues, tab]);

  const grouped = useMemo(() => {
    const g: Record<string, Issue[]> = {};
    for (const it of filtered) {
      const key = (it.category || 'other').toLowerCase();
      if (!g[key]) g[key] = [];
      g[key].push(it);
    }
    return g;
  }, [filtered]);

  const runBtnLabel = isRunning
    ? t('analyzingPDF') || 'Analyzing PDF...'
    : t('runPreflight') || 'Run Preflight';

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
? `${counts.total} issues · ${counts.error} errors · ${counts.warning} warnings · ${counts.info} info`
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
<div className="ppp-issues-empty rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600">
{emptyHint || t('noIssuesToDisplay')}
</div>
)}

{Object.keys(grouped).map((key) => {
const list = grouped[key];
if (!list || !list.length) return null;

const Icon =
CATEGORY_ICONS[key] ||
CATEGORY_ICONS[list[0].category || ''] ||
InformationCircleIcon;

const label =
ISSUE_CATEGORY_LABELS[
key as keyof typeof ISSUE_CATEGORY_LABELS
] ||
ISSUE_CATEGORY_LABELS[
list[0].category as keyof typeof ISSUE_CATEGORY_LABELS
] ||
list[0].category ||
key;

return (
<div key={key} className="ppp-issues-category-card">
<div className="ppp-issues-category-header">
<div className="ppp-issues-category-title">
<Icon className="h-4 w-4" />
<span>{label}</span>
</div>
<span className="ppp-issues-category-count">
{list.length} {list.length === 1 ? 'issue' : 'issues'}
</span>
</div>

<div className="ppp-issues-category-body">
{list.map((iss, idx) => {
const sev = getSeverity(iss);
const sevLabel = severityLabel(sev);

return (
<button
key={idx}
type="button"
onClick={() => onSelectIssue(iss)}
className={`ppp-issues-row ppp-issues-row--${sev}`}
>
<div className="ppp-issues-row-main">
<span className="ppp-issues-row-severity">
{sevLabel}
</span>

{/* AQUÍ va ahora la descripción real del issue */}
<span className="ppp-issues-row-title">
{iss.message ||
iss.title ||
iss.description ||
t('issue')}
</span>
</div>

<span className="ppp-issues-row-page">
{t('page')} {iss.page ?? '—'}
</span>
</button>
);
})}
</div>
</div>
);
})}
</div>
</section>

  );
};
