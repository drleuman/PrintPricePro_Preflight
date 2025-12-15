import React, { useMemo } from 'react';
import type { FileMeta, Issue, PreflightResult } from '../types';
import { t } from '../i18n';
import { ISSUE_CATEGORY_LABELS } from '../constants';
import { generatePreflightReport } from '../utils/reportGenerator';

type Props = {
  fileMeta: FileMeta | null;
  result: PreflightResult | null;
  onRunPreflight?: () => void;
  isRunning?: boolean;
};

type CategoryBucket = {
  key: string;
  label: string;
  errors: number;
  warnings: number;
  info: number;
};

export const PreflightSummary: React.FC<Props> = ({
  fileMeta,
  result,
  onRunPreflight,
  isRunning,
}) => {
  const issues: Issue[] = useMemo(
    () => (Array.isArray(result?.issues) ? (result!.issues as Issue[]) : []),
    [result]
  );

  const { errors, warnings, info } = useMemo(() => {
    let e = 0,
      w = 0,
      i = 0;
    for (const iss of issues) {
      const sev = String(iss.severity || '').toLowerCase();
      if (sev.includes('error')) e++;
      else if (sev.includes('warn')) w++;
      else i++;
    }
    return { errors: e, warnings: w, info: i };
  }, [issues]);

  const categories = useMemo<CategoryBucket[]>(() => {
    const keys = Object.keys(ISSUE_CATEGORY_LABELS) as string[];
    const buckets: Record<string, CategoryBucket> = {};

    for (const key of keys) {
      buckets[key] = {
        key,
        label: (ISSUE_CATEGORY_LABELS as any)[key] || key,
        errors: 0,
        warnings: 0,
        info: 0,
      };
    }

    for (const iss of issues) {
      const catKey = iss.category && buckets[iss.category] ? iss.category : keys[0] || 'images';
      const sev = String(iss.severity || '').toLowerCase();
      const bucket = buckets[catKey];

      if (sev.includes('error')) bucket.errors++;
      else if (sev.includes('warn')) bucket.warnings++;
      else bucket.info++;
    }

    return Object.values(buckets);
  }, [issues]);

  const score = result?.score ?? null;

  const hasPdf = !!fileMeta;

  const handleDownloadReport = async () => {
    if (!result || !fileMeta) return;
    try {
      const pdfBytes = await generatePreflightReport(result, fileMeta);
      const blob = new Blob([pdfBytes as any], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${fileMeta.name.replace(/\.pdf$/i, '')}_report.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Failed to generate report', e);
      window.alert('Failed to generate report');
    }
  };

  return (
    <section className="space-y-4">
      {/* Overall Score card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200/70 p-4 sm:px-6">
        <h2 className="text-base font-semibold text-gray-900 mb-2">
          {t('issuesSummary')}
        </h2>

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="ppp-score-circle">
              {hasPdf && score !== null ? score : '–'}
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-gray-900">
                {t('overallScore')}
              </p>
              <p className="text-sm text-gray-700">
                {!hasPdf
                  ? t('noPdfLoaded')
                  : result?.summary ||
                  `Preflight check for "${fileMeta?.name}" identified ${issues.length} potential issues. Review them carefully.`}
              </p>
              {hasPdf && (
                <p className="text-xs text-gray-500">
                  File: {fileMeta?.name}{' '}
                  {fileMeta?.size
                    ? `— ${(fileMeta.size / 1024).toFixed(0)} KB`
                    : null}
                </p>
              )}
              {hasPdf && (
                <p className="text-xs text-gray-500">
                  {errors} errors · {warnings} warnings · {info} info
                </p>
              )}
            </div>
          </div>

          <div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleDownloadReport}
                disabled={!hasPdf || !result}
                className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                Download Report
              </button>
              <button
                type="button"
                onClick={onRunPreflight}
                disabled={!onRunPreflight || !hasPdf || isRunning}
                className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md shadow hover:bg-red-700 disabled:opacity-60"
              >
                {isRunning ? t('analyzingPDF') : t('runPreflight')}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Issue Categories grid */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200/70 p-4 sm:px-6 space-y-3">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-sm font-semibold text-gray-900">
            {t('issueCategories')}
          </h3>
        </div>

        {/* AQUÍ el cambio: usamos ppp-summary-categories y sin inline style */}
        <div className="ppp-summary-categories">
          {categories.map((cat) => {
            const hasIssues = cat.errors + cat.warnings + cat.info > 0;
            return (
              <div
                key={cat.key}
                className="rounded-xl border border-gray-200 bg-gray-50 p-3"
              >
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-semibold text-gray-800">
                    {cat.label}
                  </p>
                  <div className="ppp-summary-totalwrap">
                    <div className="ppp-summary-total">{cat.errors + cat.warnings + cat.info}</div>
                    <div className="ppp-summary-total-label">issues</div>
                  </div>
                </div>
                {hasIssues ? (
                  <div className="ppp-summary-sev">
                    <span className="ppp-summary-sev-item ppp-summary-sev-item--error">{cat.errors}</span>
                    <span className="ppp-summary-sev-label">errors</span>
                    <span className="ppp-summary-sep">·</span>
                    <span className="ppp-summary-sev-item ppp-summary-sev-item--warning">{cat.warnings}</span>
                    <span className="ppp-summary-sev-label">warnings</span>
                    <span className="ppp-summary-sep">·</span>
                    <span className="ppp-summary-sev-item ppp-summary-sev-item--info">{cat.info}</span>
                    <span className="ppp-summary-sev-label">info</span>
                  </div>
                ) : (
                  <p className="text-xs text-gray-500">
                    {t('noIssuesToDisplay')}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>

  );
};
