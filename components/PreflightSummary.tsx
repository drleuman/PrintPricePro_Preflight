import React, { useMemo } from 'react';
import type { FileMeta, Issue, PreflightResult } from '../types';
import { t, useLocale } from '../i18n';
import { ISSUE_CATEGORY_LABELS } from '../constants';
import { generatePreflightReport } from '../utils/reportGenerator';
import { formatBytes } from '../components/PreflightDropzone';
import {
  PhotoIcon,
  DocumentTextIcon,
  SwatchIcon,
  EyeIcon,
  ArrowsPointingOutIcon,
  ScissorsIcon,
  DocumentIcon,
  ChatBubbleLeftIcon,
  ClipboardDocumentListIcon,
  FilmIcon,
  RectangleStackIcon,
  InformationCircleIcon,
  CheckCircleIcon,
  Cog6ToothIcon,
  ExclamationCircleIcon,
} from '@heroicons/react/24/outline';

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

// Helper function to get icon component for category
const getCategoryIcon = (key: string) => {
  const iconStyle = { width: '24px', height: '24px' };
  switch (key) {
    case 'images':
      return <PhotoIcon style={iconStyle} />;
    case 'fonts':
      return <DocumentTextIcon style={iconStyle} />;
    case 'colors':
      return <SwatchIcon style={iconStyle} />;
    case 'transparency':
      return <EyeIcon style={iconStyle} />;
    case 'resolution':
      return <ArrowsPointingOutIcon style={iconStyle} />;
    case 'bleed':
      return <ScissorsIcon style={iconStyle} />;
    case 'pageSetup':
      return <DocumentIcon style={iconStyle} />;
    case 'annotations':
      return <ChatBubbleLeftIcon style={iconStyle} />;
    case 'formFields':
      return <ClipboardDocumentListIcon style={iconStyle} />;
    case 'multimedia':
      return <FilmIcon style={iconStyle} />;
    case 'layers':
      return <RectangleStackIcon style={iconStyle} />;
    case 'metadata':
      return <InformationCircleIcon style={iconStyle} />;
    case 'compliance':
      return <CheckCircleIcon style={iconStyle} />;
    case 'other':
      return <Cog6ToothIcon style={iconStyle} />;
    default:
      return <ExclamationCircleIcon style={iconStyle} />;
  }
};

export const PreflightSummary: React.FC<Props> = ({
  fileMeta,
  result,
  onRunPreflight,
  isRunning,
}) => {
  const { currentLocale } = useLocale(); // Obtener el locale actual
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
                    ? `— ${formatBytes(fileMeta.size, currentLocale)}`
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
            <button
              type="button"
              onClick={handleDownloadReport}
              disabled={!hasPdf || !result}
              className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              Download Report
            </button>
          </div>
        </div>
      </div>

      {/* Issue Categories Dashboard */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200/70 p-4 sm:px-6 space-y-3">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-900">
            {t('issueCategories')}
          </h3>
          <div className="text-xs text-gray-500">
            {categories.reduce((sum, cat) => sum + cat.errors + cat.warnings + cat.info, 0)} total issues
          </div>
        </div>

        {/* Dashboard Grid: 7 cols on XL, 4 on desktop, 3 on tablet, 2 on mobile */}
        <div className="ppp-categories-grid">
          {categories.map((cat) => {
            const hasIssues = cat.errors + cat.warnings + cat.info > 0;
            const totalIssues = cat.errors + cat.warnings + cat.info;
            const hasErrors = cat.errors > 0;
            const hasWarnings = cat.warnings > 0;

            return (
              <div
                key={cat.key}
                className={`relative rounded-xl border-2 transition-all ${hasErrors
                  ? 'border-red-200 bg-red-50/50'
                  : hasWarnings
                    ? 'border-amber-200 bg-amber-50/50'
                    : hasIssues
                      ? 'border-blue-200 bg-blue-50/50'
                      : 'border-gray-200 bg-gray-50'
                  } p-3 hover:shadow-md`}
              >
                {/* Icon & Total Badge */}
                <div className="flex items-start justify-between mb-2">
                  <div className="text-gray-600">
                    {getCategoryIcon(cat.key)}
                  </div>
                  <div className={`flex items-center justify-center min-w-[28px] h-7 px-2 rounded-full text-xs font-bold ${hasErrors
                    ? 'bg-red-600 text-white'
                    : hasWarnings
                      ? 'bg-amber-500 text-white'
                      : hasIssues
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-300 text-gray-600'
                    }`}>
                    {totalIssues}
                  </div>
                </div>

                {/* Category Label */}
                <h4 className="text-xs font-semibold text-gray-900 mb-2 leading-tight">
                  {cat.label}
                </h4>

                {/* Issue Breakdown */}
                {hasIssues ? (
                  <div>
                    {cat.errors > 0 && (
                      <span className="ppp-issue-pill ppp-issue-pill--error">
                        <span className="ppp-issue-pill__number">{cat.errors}</span>
                        <span className="ppp-issue-pill__label">err</span>
                      </span>
                    )}
                    {cat.warnings > 0 && (
                      <span className="ppp-issue-pill ppp-issue-pill--warning">
                        <span className="ppp-issue-pill__number">{cat.warnings}</span>
                        <span className="ppp-issue-pill__label">warn</span>
                      </span>
                    )}
                    {cat.info > 0 && (
                      <span className="ppp-issue-pill ppp-issue-pill--info">
                        <span className="ppp-issue-pill__number">{cat.info}</span>
                        <span className="ppp-issue-pill__label">info</span>
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="text-[10px] text-gray-400 font-medium">
                    ✓ No issues
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>

  );
};
