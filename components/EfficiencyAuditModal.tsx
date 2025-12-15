import React, { useCallback, useEffect, useState } from 'react';
import { ModalProps } from '../types';
import { SafeHtmlMarkdown } from './SafeHtmlMarkdown';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { t } from '../i18n';

type ModelInfo = { name: string; supportedGenerationMethods?: string[] };
const API_VER = 'v1';

async function pickAvailableModel(): Promise<string> {
  const res = await fetch(`/api-proxy/${API_VER}/models?pageSize=200`);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${await res.text()}`);
  const data = await res.json();
  const list: ModelInfo[] = Array.isArray(data?.models) ? data.models : [];
  const gen = list.filter(m => (m.supportedGenerationMethods || []).includes('generateContent'));
  const by = (k: string) => gen.find(m => m.name?.toLowerCase().includes(k));
  return (by('flash')?.name || by('pro')?.name || gen[0]?.name || '').replace(/^models\//, '');
}

function extractText(json: any): string {
  try {
    const cand = json?.candidates?.[0];
    const parts = cand?.content?.parts;
    if (Array.isArray(parts)) {
      const all = parts.map((p: any) => (typeof p?.text === 'string' ? p.text : ''))
                      .filter(Boolean)
                      .join('\n\n')
                      .trim();
      if (all) return all;
    }
    if (typeof json?.output_text === 'string' && json.output_text.trim()) return json.output_text.trim();
    return '```\n' + JSON.stringify(json, null, 2) + '\n```';
  } catch {
    return '```\n' + JSON.stringify(json, null, 2) + '\n```';
  }
}

export const EfficiencyAuditModal: React.FC<ModalProps> = ({ isOpen, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchAI = useCallback(async () => {
    setLoading(true);
    setError(null);
    setAiResponse(null);

    const prompt = `Provide a concise, actionable checklist to efficiently preflight PDFs for print.
Cover:
- quick checks order
- recommended tools/workflows
- common pitfalls to avoid
Keep it brief, use bullet points.`;

    try {
      const model = await pickAvailableModel();
      if (!model) throw new Error('No Gemini model with generateContent available in this project.');

      const res = await fetch(`/api-proxy/${API_VER}/models/${encodeURIComponent(model)}:generateContent`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }] }),
      });

      if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${await res.text()}`);
      const json = await res.json();
      setAiResponse(extractText(json));
    } catch (e: any) {
      setError(e?.message || t('aiError'));
      setAiResponse(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) fetchAI();
    else { setAiResponse(null); setError(null); setLoading(false); }
  }, [isOpen, fetchAI]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full p-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold">{t('efficiencyAuditTitle')}</h2>
          <button className="p-2 rounded hover:bg-gray-100" onClick={onClose} aria-label={t('close')}>
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {loading && <p className="text-sm text-gray-500">{t('fetchingAIResponse')}</p>}
        {error && <p className="text-sm text-red-600 whitespace-pre-wrap break-words">{error}</p>}
        {!loading && !error && aiResponse && (
          <div className="prose max-w-none"><SafeHtmlMarkdown markdown={aiResponse} /></div>
        )}
        {!loading && !error && !aiResponse && (
          <p className="text-sm text-gray-500">{t('noIssuesToDisplay')}</p>
        )}

        <div className="mt-4 text-right">
          <button className="px-3 py-2 rounded bg-gray-100 hover:bg-gray-200" onClick={onClose}>{t('close')}</button>
        </div>
      </div>
    </div>
  );
};
