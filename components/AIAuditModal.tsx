import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
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
    return '';
  } catch {
    return '';
  }
}

type Props = ModalProps & {
  issue: Issue | null;
  fileMeta?: FileMeta | null;
  result?: PreflightResult | null;
  visualImage?: string | null; // Base64 jpeg
  cachedResponse?: string | null;
  onSaveResponse?: (response: string) => void;
  isVisualMode?: boolean;
};

export const AIAuditModal: React.FC<Props> = ({
  isOpen,
  onClose,
  issue,
  fileMeta,
  result,
  visualImage,
  cachedResponse,
  onSaveResponse,
  isVisualMode = false,
}) => {
  const [loading, setLoading] = useState(false);
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const buildPrompt = () => {
    if (visualImage) {
      return `
You are a senior print production expert performing a VISUAL QUALITY ASSURANCE check on a PDF page.
I am providing an image of the page.

Analyze the visual aesthetics and technical safety for print:
1.  **Layout & Margins**: Is text too close to the edge (risk of cutting)? Are margins balanced?
2.  **Contrast & Readability**: Is text legible against the background?
3.  **Image Quality**: Does anything look pixelated or low-quality in this preview?
4.  **Overall Professionalism**: Does the design look consistent and professional?

Provide a concise report with a "Visual Score" (0-10) and bullet points for improvements.
      `.trim();
    }

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

    const nameLine = fileMeta?.name ? `File: ${fileMeta.name}` : '';
    const sizeLine = fileMeta?.size ? `Size: ${fileMeta.size} bytes` : '';

    return `
You are a senior prepress technician. Perform a concise, actionable AI audit for a PDF intended for book printing.

${nameLine ? nameLine + '\n' : ''}${sizeLine ? sizeLine + '\n' : ''}${summary ? `Known notes/summary from engine: ${summary}\n` : ''
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
    // If we have a cached response, use it immediately
    if (cachedResponse) {
      setAiResponse(cachedResponse);
      setLoading(false);
      return;
    }

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

      const parts: any[] = [{ text: prompt }];
      if (visualImage) {
        const rawBase64 = visualImage.replace(/^data:image\/[a-z]+;base64,/, '');
        parts.push({
          inline_data: {
            mime_type: 'image/jpeg',
            data: rawBase64
          }
        });
      }

      const res = await fetch(
        `/api-proxy/${API_VER}/models/${encodeURIComponent(
          model
        )}:generateContent`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: parts }],
          }),
        }
      );

      if (!res.ok) {
        throw new Error(
          `${res.status} ${res.statusText}: ${await res.text()}`
        );
      }
      const json = await res.json();
      const text = extractTextFromGenResponse(json);
      setAiResponse(text);

      // Save for persistence
      if (onSaveResponse && text) {
        onSaveResponse(text);
      }
    } catch (e: any) {
      setError(e?.message || t('aiError'));
      setAiResponse(null);
    } finally {
      setLoading(false);
    }
  }, [issue, fileMeta, result, visualImage, cachedResponse, onSaveResponse]);

  useEffect(() => {
    if (isOpen) {
      fetchAI();
    } else {
      // Only clear response if we are NOT persisting (or logic handled by parent)
      // Actually, clearing here is fine because Parent will pass cachedResponse back in
      setAiResponse(null);
      setError(null);
      setLoading(false);
    }
  }, [isOpen, fetchAI]);

  if (!isOpen) return null;

  // Brute-force centering styles to guarantee visibility
  const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100vw',
    height: '100vh',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 2147483647, // Max integer value
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backdropFilter: 'blur(4px)',
  };

  const modalStyle: React.CSSProperties = {
    position: 'relative',
    backgroundColor: 'white',
    width: '90%',
    maxWidth: '700px',
    maxHeight: '85vh',
    borderRadius: '12px',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden', // Contain children
  };

  const showVisualBadge = visualImage || isVisualMode;

  const modalContent = (
    <div style={overlayStyle}>
      <div style={modalStyle}>

        {/* Header - Always visible */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-white shrink-0">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              {t('aiAuditTitle')}
              {showVisualBadge && (
                <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full border border-purple-200">
                  Vision Analysis
                </span>
              )}
            </h2>
          </div>
          <button
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            onClick={onClose}
            aria-label={t('close')}
          >
            <XMarkIcon className="h-6 w-6 text-gray-400 hover:text-gray-600" />
          </button>
        </div>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto p-4 min-h-0">
          {loading && (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-500 border-t-transparent"></div>
              <p className="text-gray-500 animate-pulse font-medium">{t('fetchingAIResponse')}</p>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-100 text-red-700 p-4 rounded-lg">
              <p className="font-bold">Error</p>
              <p className="text-sm mt-1">{error}</p>
            </div>
          )}

          {!loading && !error && aiResponse && (
            <div className="prose prose-sm max-w-none prose-headings:font-bold prose-p:text-gray-700">
              <SafeHtmlMarkdown markdown={aiResponse} />
            </div>
          )}

          {!loading && !error && !aiResponse && (
            <div className="text-center py-12 text-gray-400 italic">
              {t('noIssuesToDisplay')}
            </div>
          )}
        </div>

        {/* Footer - Always visible */}
        <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end shrink-0">
          <button
            className="px-5 py-2.5 rounded-lg bg-gray-900 text-white hover:bg-black font-medium transition-colors shadow-sm"
            onClick={onClose}
          >
            {t('close')}
          </button>
        </div>
      </div>
    </div>
  );

  // Use Portal if available
  if (typeof document !== 'undefined') {
    return createPortal(modalContent, document.body);
  }
  return modalContent;
};
