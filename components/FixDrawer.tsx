import React, { useEffect, useState } from 'react';
import type { Issue } from '../types';
import { t } from '../i18n';
import { ISSUE_CATEGORY_LABELS } from '../constants';
import { SafeHtmlMarkdown } from './SafeHtmlMarkdown';
// OJO: si el helper se llama issuePrompts.ts, cambia esta ruta:
import { getIssueHint } from '../profiles/defaultProfile';

import {
  XMarkIcon,
  ExclamationCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';

type Props = {
  issue: Issue | null;
  onClose: () => void;
  onOpenAIAudit?: (issue: Issue) => void;
  onOpenEfficiencyTips?: (issue: Issue) => void;
  onFixBleed?: () => void;
  isFixing?: boolean;
};

/* =========================================================
   Gemini helpers con cache de modelo y respuestas
   ======================================================= */

type ModelInfo = { name: string; supportedGenerationMethods?: string[] };

const API_VER = 'v1';

// cache modelo elegido
let CACHED_MODEL_NAME: string | null = null;

// cache de respuestas por issue+tipo
// tipo: "explain" | "efficiency"
const aiCache: Record<string, { explain?: string; efficiency?: string }> = {};

async function pickAvailableModel(): Promise<string> {
  if (CACHED_MODEL_NAME) return CACHED_MODEL_NAME;

  const res = await fetch(`/api-proxy/${API_VER}/models?pageSize=200`);
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText}: ${await res.text()}`);
  }
  const data = await res.json();
  const list: ModelInfo[] = Array.isArray(data?.models) ? data.models : [];
  const gen = list.filter((m) =>
    (m.supportedGenerationMethods || []).includes('generateContent')
  );

  const by = (k: string) =>
    gen.find((m) => m.name?.toLowerCase().includes(k));

  const chosen =
    by('flash')?.name ||
    by('pro')?.name ||
    gen[0]?.name ||
    '';

  if (!chosen) {
    throw new Error('No Gemini model with generateContent available.');
  }

  CACHED_MODEL_NAME = chosen.replace(/^models\//, '');
  return CACHED_MODEL_NAME;
}

function extractTextFromGenResponse(json: any): string {
  try {
    const cand = json?.candidates?.[0];
    const parts = cand?.content?.parts;
    if (Array.isArray(parts)) {
      const all = parts
        .map((p: any) => (typeof p?.text === 'string' ? p.text : ''))
        .filter(Boolean)
        .join('\n\n')
        .trim();
      if (all) return all;
    }
    if (typeof json?.output_text === 'string' && json.output_text.trim()) {
      return json.output_text.trim();
    }
    return '```\n' + JSON.stringify(json, null, 2) + '\n```';
  } catch {
    return '```\n' + JSON.stringify(json, null, 2) + '\n```';
  }
}

async function generateWithGemini(prompt: string): Promise<string> {
  const model = await pickAvailableModel();

  const res = await fetch(
    `/api-proxy/${API_VER}/models/${encodeURIComponent(
      model
    )}:generateContent`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
      }),
    }
  );

  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText}: ${await res.text()}`);
  }

  const json = await res.json();
  return extractTextFromGenResponse(json);
}

/* =========================================================
   Prompts por issue
   ======================================================= */

function describeIssue(issue: Issue): string {
  const parts: string[] = [];

  if (issue.category) parts.push(`Category: ${issue.category}`);
  if (typeof issue.page === 'number') parts.push(`Page: ${issue.page}`);
  if ((issue as any).severity) parts.push(`Severity: ${(issue as any).severity}`);
  if (issue.title) parts.push(`Title: ${issue.title}`);
  if ((issue as any).message) parts.push(`Message: ${(issue as any).message}`);
  if ((issue as any).details) parts.push(`Details: ${(issue as any).details}`);
  if ((issue as any).hint) parts.push(`Hint: ${(issue as any).hint}`);

  return parts.join('\n');
}

function buildExplainPrompt(issue: Issue): string {
  const hint = getIssueHint(issue);

  return `
You are a senior prepress technician.

We detected the following PDF preflight issue. Use the **raw data** AND the **human-friendly description** of this issue type to explain what is happening and propose concrete, tool-specific fixes.

Issue type hint (human-friendly):
- Short title: ${hint.shortTitle}
- Summary: ${hint.userFriendlySummary}

Extra guidance for you (AI assistant):
${hint.aiPrompt}

Issue context (raw data from the engine):
${describeIssue(issue)}

Instructions:
- Write a short **Markdown** answer.
- Use headings: "Fastest Fix", "Best Quality Fix", "Time & Cost Impact".
- When relevant, mention concrete steps in tools like Adobe InDesign, Illustrator, or Acrobat Preflight.
- Focus only on what is relevant for this specific issue type.
- Keep it concise and focused on print production (CMYK, resolution, bleed, fonts, etc.).
`.trim();
}

function buildEfficiencyPrompt(issue: Issue): string {
  const hint = getIssueHint(issue);

  return `
You are a print prepress efficiency expert.

We detected this specific PDF preflight issue. Use the **issue type description** and the **raw engine data** to propose a lean, efficient workflow to fix it.

Issue type hint:
- Short title: ${hint.shortTitle}
- Summary: ${hint.userFriendlySummary}

Extra guidance for you (AI assistant):
${hint.aiPrompt}

Issue context (raw data from the engine):
${describeIssue(issue)}

Instructions:
- Answer in **Markdown**.
- Use short sections and bullet points.
- Compare "Fastest Fix" vs "Most robust fix".
- Focus on minimizing wasted time and cost without sacrificing print quality.
- Mention typical pitfalls only if they apply to this specific issue (e.g. RGB images, missing bleed, low resolution, small text).
`.trim();
}

/* =========================================================
   Componente
   ======================================================= */

export const FixDrawer: React.FC<Props> = ({ issue, onClose, onOpenAIAudit, onOpenEfficiencyTips, onFixBleed, isFixing }) => {
  const [isLoadingExplain, setIsLoadingExplain] = useState(false);
  const [isLoadingEff, setIsLoadingEff] = useState(false);
  const [explainText, setExplainText] = useState<string | null>(null);
  const [effText, setEffText] = useState<string | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);

  // sincroniza textos con cache cuando cambia el issue
  useEffect(() => {
    if (!issue) {
      setExplainText(null);
      setEffText(null);
      setErrorText(null);
      setIsLoadingExplain(false);
      setIsLoadingEff(false);
      return;
    }

    const cacheKey = issue.id || `${issue.category}-${issue.page}-${issue.title}`;
    const cached = aiCache[cacheKey];

    setExplainText(cached?.explain ?? null);
    setEffText(cached?.efficiency ?? null);
    setErrorText(null);
  }, [issue]);

  if (!issue) return null;

  const isError = (issue as any).severity === 'error';
  const isWarning = (issue as any).severity === 'warning';

  const Icon = isError
    ? ExclamationCircleIcon
    : isWarning
      ? ExclamationTriangleIcon
      : InformationCircleIcon;

  const severityLabel =
    (issue as any).severity === 'error'
      ? t('severityError')
      : (issue as any).severity === 'warning'
        ? t('severityWarning')
        : t('severityInfo');

  const severityClass =
    (issue as any).severity === 'error'
      ? 'text-red-600 bg-red-50 border-red-100'
      : (issue as any).severity === 'warning'
        ? 'text-amber-600 bg-amber-50 border-amber-100'
        : 'text-sky-600 bg-sky-50 border-sky-100';

  const categoryLabel =
    issue.category
      ? ISSUE_CATEGORY_LABELS[
      issue.category as keyof typeof ISSUE_CATEGORY_LABELS
      ] || issue.category
      : null;

  const cacheKey = issue.id || `${issue.category}-${issue.page}-${issue.title}`;
  const hint = getIssueHint(issue);

  const handleExplainClick = async () => {
    if (!issue) return;

    // cache: si ya lo tenemos, no llamar a la API
    if (aiCache[cacheKey]?.explain) {
      setExplainText(aiCache[cacheKey].explain || null);
      return;
    }

    try {
      setIsLoadingExplain(true);
      setErrorText(null);
      const prompt = buildExplainPrompt(issue);
      const out = await generateWithGemini(prompt);
      setExplainText(out);
      aiCache[cacheKey] = {
        ...(aiCache[cacheKey] || {}),
        explain: out,
      };
    } catch (e: any) {
      setErrorText(
        e?.message || t('aiError') || 'AI audit failed. Please try again.'
      );
    } finally {
      setIsLoadingExplain(false);
    }
  };

  const handleEfficiencyClick = async () => {
    if (!issue) return;

    if (aiCache[cacheKey]?.efficiency) {
      setEffText(aiCache[cacheKey].efficiency || null);
      return;
    }

    try {
      setIsLoadingEff(true);
      setErrorText(null);
      const prompt = buildEfficiencyPrompt(issue);
      const out = await generateWithGemini(prompt);
      setEffText(out);
      aiCache[cacheKey] = {
        ...(aiCache[cacheKey] || {}),
        efficiency: out,
      };
    } catch (e: any) {
      setErrorText(
        e?.message ||
        t('aiError') ||
        'AI efficiency tips failed. Please try again.'
      );
    } finally {
      setIsLoadingEff(false);
    }
  };

  return (
    <aside className="ppp-drawer">
      {/* Header */}
      <div className="pl-4 pr-3 py-4 border-b border-gray-200 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            {t('selectedIssueDetails') || 'Selected Issue Details'}
          </p>
          <h2 className="mt-1 text-base font-semibold text-gray-900">
            {issue.title || t('issue')}
          </h2>
          <p className="mt-1 text-xs text-gray-500">
            {t('currentIssue') || 'Current Issue'} ·{' '}
            {t('pageLabel', { page: issue.page || 1 })}
          </p>
          {/* mini resumen del tipo de issue */}
          {hint && (
            <p className="mt-1 text-[11px] text-gray-500">
              {hint.shortTitle} — {hint.userFriendlySummary}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center justify-center rounded-full p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 -mr-1"
          aria-label={t('close')}
        >
          <XMarkIcon className="h-6 w-6" aria-hidden="true" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
        {/* Severity + categoría */}
        <div
          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${severityClass}`}
        >
          <Icon className="h-4 w-4" aria-hidden="true" />
          <span>{severityLabel}</span>
          {categoryLabel && (
            <>
              <span className="text-gray-300">•</span>
              <span className="text-gray-600">{categoryLabel}</span>
            </>
          )}
        </div>

        {/* Hint del helper (Suggested Fix real o Summary) */}
        {hint && (
          <div className="bg-gray-50 border border-dashed border-gray-200 rounded-lg px-4 py-3">
            <p className="text-xs font-medium text-gray-500 mb-1">
              {hint.suggestedFix ? (t('suggestedFix') || 'Suggested fix') : (t('issueSummary') || 'Issue Summary')}
            </p>
            <p className="text-sm text-gray-700 whitespace-pre-line">
              {hint.suggestedFix || hint.userFriendlySummary}
            </p>
          </div>
        )}

        {/* Details básicos del issue (engine) */}
        {issue.details && (
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-1">
              {t('details')}
            </h3>
            <p className="text-sm text-gray-700 whitespace-pre-line">
              {issue.details}
            </p>
          </div>
        )}

        {issue.hint && (
          <div className="bg-gray-50 border border-dashed border-gray-200 rounded-lg px-3 py-2">
            <p className="text-xs font-medium text-gray-500 mb-1">
              {t('engineHint') || t('suggestedFix') || 'Engine Hint'}
            </p>
            <p className="text-sm text-gray-700 whitespace-pre-line">
              {issue.hint}
            </p>
          </div>
        )}

        {/* Actions IA */}
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-2">
            {t('drawerActions') || t('actions') || 'Actions'}
          </h3>

          <div className="space-y-2">
            {/* Fix Button for specific issues */}
            {onFixBleed && (['missing-bleed-info', 'insufficient-bleed'].includes(issue.id)) && (
              <button
                type="button"
                onClick={onFixBleed}
                disabled={isFixing}
                className="w-full inline-flex items-center justify-center rounded-md border border-transparent bg-indigo-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-60"
              >
                {isFixing ? 'Fixing...' : 'Fix: Add 3mm Bleed'}
              </button>
            )}

            {/* Rojo – Explain & Suggest Fix */}
            <button
              type="button"
              onClick={handleExplainClick}
              disabled={isLoadingExplain}
              className="w-full inline-flex items-center justify-center rounded-md border border-transparent bg-red-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-700 disabled:opacity-60"
            >
              {isLoadingExplain
                ? t('fetchingAIResponse') || 'Fetching AI response...'
                : t('explainSuggestFix')}
            </button>

            {/* Verde – Efficiency Tips */}
            <button
              type="button"
              onClick={handleEfficiencyClick}
              disabled={isLoadingEff}
              className="w-full inline-flex items-center justify-center rounded-md border border-transparent bg-emerald-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60"
            >
              {isLoadingEff
                ? t('fetchingAIResponse') || 'Fetching AI response...'
                : t('getEfficiencyTips')}
            </button>

            {/* Mobile-friendly Close Button (at bottom) */}
            <button
              type="button"
              onClick={onClose}
              className="mt-4 w-full inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-3 py-3 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:hidden"
            >
              {t('close') || 'Close'}
            </button>

            <p className="mt-1 text-[11px] text-gray-400">
              AI is cached per issue. Clicking again on the same issue reuses
              the previous response.
            </p>
          </div>
        </div>

        {/* Mensajes de error IA */}
        {errorText && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {errorText}
          </div>
        )}

        {/* Resultados IA */}
        <div className="space-y-4 markdown-body">
          {explainText && (
            <section>
              <h3 className="text-sm font-semibold text-gray-900 mb-1">
                {t('aiAuditTitle') || 'AI Audit: Explain & Suggest Fixes'}
              </h3>
              <SafeHtmlMarkdown markdown={explainText} />
            </section>
          )}

          {effText && (
            <section>
              <h3 className="text-sm font-semibold text-gray-900 mb-1">
                {t('efficiencyAuditTitle') || 'AI Audit: Get Efficiency Tips'}
              </h3>
              <SafeHtmlMarkdown markdown={effText} />
            </section>
          )}
        </div>
      </div>
    </aside>
  );
};
