import React, { useCallback, useEffect, useState } from 'react';
import { Issue, ModalProps, PreflightResult, FileMeta } from '../types';
import { SafeHtmlMarkdown } from './SafeHtmlMarkdown';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { t } from '../i18n';
import { getIssueHint } from '../profiles/defaultProfile';

type ModelInfo = { name: string; supportedGenerationMethods?: string[] };

const API_VER = 'v1';

async function pickAvailableModel(): Promise<string> {
  const res = await fetch(`/api-proxy/${API_VER}/models?pageSize=200`);
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText}: ${await res.text()}`);
  }
  const data = await res.json();
  const list: ModelInfo[] = Array.isArray(data?.models) ? data.models : [];
  const gen = list.filter((m) =>
    (m.supportedGenerationMethods || []).includes('generateContent')
  );
  const by = (k: string) => gen.find((m) => m.name?.toLowerCase().includes(k));
  return (by('flash')?.name || by('pro')?.name || gen[0]?.name || '').replace(
    /^models\//,
    ''
  );
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

type Props = ModalProps & {
  issue: Issue | null;
  fileMeta?: FileMeta | null;
  result?: PreflightResult | null;
};

export const AIAuditModal: React.FC<Props> = ({
  isOpen,
  onClose,
  issue,
  fileMeta,
  result,
}) => {
  const [loading, setLoading] = useState(false);
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const buildPrompt = () => {
    const fileName = fileMeta?.name || '(unknown file name)';
    const fileSizeStr = fileMeta?.size
      ? `${fileMeta.size} bytes (~${(fileMeta.size / (1024 * 1024)).toFixed(
          1
        )} MB)`
      : 'unknown size';

    const summary =
      typeof (result as any)?.summary === 'string'
        ? (result as any).summary
        : typeof (result as any)?.summary?.text === 'string'
        ? (result as any).summary.text
        : '';

    // Prompt específico por issue
    if (issue) {
      const hint = getIssueHint(issue);

      const issueMessage =
        (issue as any).message ||
        issue.title ||
        '(no explicit message provided)';
      const issueDetails =
        (issue as any).details ||
        issue.description ||
        '(no extra details provided)';

      return `
You are a prepress and print production expert. You help book authors fix technical PDF preflight issues.

PDF context:
- File name: ${fileName}
- File size: ${fileSizeStr}
${summary ? `- Global summary from engine: ${summary}` : ''}

Specific issue detected by the engine:
- Issue id: ${issue.id}
- Category: ${issue.category ?? 'unknown'}
- Page: ${issue.page ?? 'unknown'}
- Severity: ${issue.severity ?? 'unknown'}
- Engine message: ${issueMessage}
- Engine details: ${issueDetails}

Human-friendly explanation of this issue type:
${hint.userFriendlySummary}

Special instructions for you (the AI assistant):
${hint.aiPrompt}

Now respond with clear sections, using concise paragraphs and bullet points where helpful:

1) What is happening (explain the problem in simple language).
2) Why it matters in print (risks and visual impact).
3) Fastest fix (quick steps in common tools like Acrobat, InDesign, or PitStop).
4) Best quality fix (slightly more advanced but robust workflow).
5) Checks to validate the fix (what to review in the new PDF: preflight, output preview, separations, etc.).
`.trim();
    }

    // Sin issue: auditoría general basada en contexto del PDF
    const nameLine = fileMeta?.name ? `File: ${fileMeta.name}` : '';
    const sizeLine = fileMeta?.size ? `Size: ${fileMeta.size} bytes` : '';

    return `
You are a senior prepress technician. Perform a concise, actionable AI audit for a PDF intended for book printing.

${nameLine ? nameLine + '\n' : ''}${sizeLine ? sizeLine + '\n' : ''}${
      summary ? `Known notes/summary from engine: ${summary}\n` : ''
    }

Focus on:
- Fonts (embedding, small sizes, Type 3).
- Color (RGB vs CMYK vs grayscale, mixing color spaces).
- Transparency and overprint.
- Bleed and trim boxes.
- Image resolution.
- Interactive elements (forms, annotations, multimedia, layers).

Deliver your answer in sections:

1) Top risks to inspect (prioritized list).
2) Quick verification steps in Acrobat (with concrete menu paths).
3) Suggested fixes (Acrobat / InDesign / PitStop) with bullet steps.
4) Final validation checklist (Output Preview, Separations, Overprint, PDF/X profile).
`.trim();
  };

  const fetchAI = useCallback(async () => {
    setLoading(true);
    setError(null);
    setAiResponse(null);

    try {
      const model = await pickAvailableModel();
      if (!model) {
        throw new Error(
          'No Gemini model with generateContent available in this project.'
        );
      }

      const prompt = buildPrompt();
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
        throw new Error(
          `${res.status} ${res.statusText}: ${await res.text()}`
        );
      }
      const json = await res.json();
      setAiResponse(extractTextFromGenResponse(json));
    } catch (e: any) {
      setError(e?.message || t('aiError'));
      setAiResponse(null);
    } finally {
      setLoading(false);
    }
  }, [issue, fileMeta, result]);

  useEffect(() => {
    if (isOpen) {
      fetchAI();
    } else {
      setAiResponse(null);
      setError(null);
      setLoading(false);
    }
  }, [isOpen, fetchAI]);

  if (!isOpen) return null;

  const hint = issue ? getIssueHint(issue) : null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full p-4">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h2 className="text-lg font-semibold">{t('aiAuditTitle')}</h2>
            {issue && hint && (
              <p className="mt-1 text-xs text-gray-600">
                {hint.shortTitle} — {hint.userFriendlySummary}
              </p>
            )}
          </div>
          <button
            className="p-2 rounded hover:bg-gray-100"
            onClick={onClose}
            aria-label={t('close')}
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {loading && (
          <p className="text-sm text-gray-500">{t('fetchingAIResponse')}</p>
        )}

        {error && (
          <p className="text-sm text-red-600 whitespace-pre-wrap break-words">
            {error}
          </p>
        )}

        {!loading && !error && aiResponse && (
          <div className="prose max-w-none">
            <SafeHtmlMarkdown markdown={aiResponse} />
          </div>
        )}

        {!loading && !error && !aiResponse && (
          <p className="text-sm text-gray-500">{t('noIssuesToDisplay')}</p>
        )}

        <div className="mt-4 text-right">
          <button
            className="px-3 py-2 rounded bg-gray-100 hover:bg-gray-200"
            onClick={onClose}
          >
            {t('close')}
          </button>
        </div>
      </div>
    </div>
  );
};
