import React, { useMemo } from 'react';
import type { FileMeta, Issue, PreflightResult } from '../types';
import { t, useLocale } from '../i18n';
import type { TranslationKeys } from '../i18n';
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

// Map constants.ts category key (snake_case) to i18n key (camelCase)
const categoryKeyToI18nKey = (key: string): TranslationKeys => {
  const map: Record<string, TranslationKeys> = {
    images: 'categoryImages',
    color: 'categoryColor',
    fonts: 'categoryFonts',
    metadata: 'categoryMetadata',
    transparency: 'categoryTransparency',
    bleed_margins: 'categoryBleedMargins',
    resolution: 'categoryResolution',
    compliance: 'categoryCompliance',
    page_setup: 'categoryPageSetup',
    annotations: 'categoryAnnotations',
    form_fields: 'categoryFormFields',
    multimedia: 'categoryMultimedia',
    layers: 'categoryLayers',
    other: 'categoryOther',
  };
  return map[key] ?? 'categoryOther';
};

// Helper function to get icon component for category
const getCategoryIcon = (key: string) => {
  const iconStyle = { width: '24px', height: '24px' };
  switch (key) {
    case 'images':
      return <PhotoIcon style={iconStyle} />;
    case 'fonts':
      return <DocumentTextIcon style={iconStyle} />;
    case 'color':
      return <SwatchIcon style={iconStyle} />;
    case 'transparency':
      return <EyeIcon style={iconStyle} />;
    case 'resolution':
      return <ArrowsPointingOutIcon style={iconStyle} />;
    case 'bleed_margins':
      return <ScissorsIcon style={iconStyle} />;
    case 'page_setup':
      return <DocumentIcon style={iconStyle} />;
    case 'annotations':
      return <ChatBubbleLeftIcon style={iconStyle} />;
    case 'form_fields':
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
      const i18nKey = categoryKeyToI18nKey(key);
      buckets[key] = {
        key,
        label: t(i18nKey) || (ISSUE_CATEGORY_LABELS as Record<string, string>)[key] || key,
        errors: 0,
        warnings: 0,
        info: 0,
      };
    }

    for (const iss of issues) {
      if (!iss) continue;
      const catKey = (iss.category && buckets[iss.category]) ? iss.category : keys[0] || 'images';
      const sev = String(iss.severity || '').toLowerCase();
      const bucket = buckets[catKey];

      if (sev.includes('error')) bucket.errors++;
      else if (sev.includes('warn')) bucket.warnings++;
      else bucket.info++;
    }

    return Object.values(buckets);
  }, [issues, currentLocale]);

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
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-2 sm:px-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="ppp-score-circle w-10 h-10 text-lg shrink-0">
            {hasPdf && score !== null ? score : '–'}
          </div>
          <div className="space-y-0.5">
            <div className="flex items-baseline gap-2">
              <p className="text-sm font-bold text-gray-900">{t('overallScore') || 'Overall Score'}</p>
              {hasPdf && (
                <p className="text-[11px] text-gray-500 font-medium">
                  {errors} {t('errors')} · {warnings} {t('warnings')} · {info} {t('info')}
                </p>
              )}
            </div>
            <p className="text-[10px] text-gray-500 truncate max-w-sm">
              {!hasPdf
                ? t('noPdfLoaded')
                : `${t('fileLabel')}: ${fileMeta?.name} ${fileMeta?.size ? `— ${formatBytes(fileMeta.size, currentLocale)}` : ''}`}
            </p>
          </div>
        </div>

        <div>
          <button
            type="button"
            onClick={handleDownloadReport}
            disabled={!hasPdf || !result}
            className="inline-flex items-center justify-center px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none disabled:opacity-50"
          >
            {t('downloadReport')}
          </button>
        </div>
      </div>

      {/* Issue Categories Dashboard */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-2 sm:px-4 space-y-1.5">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
            {t('issueCategories')}
          </h3>
          <div className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">
            {categories.reduce((sum, cat) => sum + cat.errors + cat.warnings + cat.info, 0)} {t('totalIssues')}
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
                className={`relative rounded-lg border-2 flex flex-col transition-all ${hasErrors
                  ? 'border-red-200 bg-red-50/50'
                  : hasWarnings
                    ? 'border-amber-200 bg-amber-50/50'
                    : hasIssues
                      ? 'border-blue-200 bg-blue-50/50'
                      : 'border-gray-200 bg-gray-50'
                  } p-2 hover:shadow-md`}
              >
                {/* Icon & Label ROW */}
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5 text-gray-700">
                    <div className="[&>svg]:w-3.5 [&>svg]:h-3.5">
                      {getCategoryIcon(cat.key)}
                    </div>
                    <h4 className="text-[10px] font-semibold text-gray-900 leading-none truncate max-w-[65px]">
                      {cat.label}
                    </h4>
                  </div>
                  <div className={`flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full text-[9px] font-bold ${hasErrors
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

                {/* Issue Breakdown */}
                {hasIssues ? (
                  <div className="flex flex-wrap gap-1 mt-auto pt-1 border-t border-gray-900/5">
                    {cat.errors > 0 && (
                      <span className="text-[8px] font-bold text-red-700 bg-red-100 px-1 rounded uppercase tracking-wider">
                        {cat.errors} {t('errAbbr')}
                      </span>
                    )}
                    {cat.warnings > 0 && (
                      <span className="text-[8px] font-bold text-amber-700 bg-amber-100 px-1 rounded uppercase tracking-wider">
                        {cat.warnings} {t('warnAbbr')}
                      </span>
                    )}
                    {cat.info > 0 && (
                      <span className="text-[8px] font-bold text-blue-700 bg-blue-100 px-1 rounded uppercase tracking-wider">
                        {cat.info} {t('infoAbbr')}
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="text-[9px] text-gray-400 font-medium flex items-center gap-1 mt-auto pt-1 border-t border-gray-900/5">
                    <CheckCircleIcon className="w-3 h-3 text-green-500" /> {t('noIssues')}
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
