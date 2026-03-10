import React, { useMemo } from 'react';
import type { PreflightResult, Issue, Severity } from '../types';
import { ShieldCheckIcon, XCircleIcon, Cog6ToothIcon, RocketLaunchIcon, CheckCircleIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';

type Props = {
  before: PreflightResult | null;
  after: PreflightResult | null;
  report: any | null;
  runId?: number | null;
  options?: {
    safeOnly: boolean;
    aggressive: boolean;
    forceRebuild: boolean;
    forceBleed: boolean;
    forceCmyk: boolean;
    flatten: boolean;
    allowRasterOutput?: boolean;
  };
  onToggleOption?: (key: any) => void;
  onRun?: () => void;
  isRunning?: boolean;
  compareEnabled?: boolean;
  onToggleCompare?: (enabled: boolean) => void;
};

function countBySeverity(issues: Issue[] = []) {
  const out = { error: 0, warning: 0, info: 0, total: 0 };
  for (const i of issues) {
    out.total += 1;
    if (i.severity === 'error') out.error += 1;
    else if (i.severity === 'warning') out.warning += 1;
    else out.info += 1;
  }
  return out;
}

function countByCategory(issues: Issue[] = []) {
  const map: Record<string, number> = {};
  for (const i of issues) {
    const c = (i.category || 'other') as string;
    map[c] = (map[c] || 0) + 1;
  }
  return map;
}

function fmtMs(ms: any) {
  const n = Number(ms);
  if (!Number.isFinite(n)) return '';
  if (n < 1000) return `${Math.round(n)} ms`;
  return `${(n / 1000).toFixed(2)} s`;
}

function opLabel(op: string) {
  if (op === 'cmyk') return 'Convert → CMYK (PSO Coated v3 / FOGRA51)';
  if (op === 'gray') return 'Convert → Grayscale';
  if (op === 'rebuild') return 'Rebuild / Upscale';
  if (op === 'bleed') return 'Add Bleed Canvas';
  return op;
}

export const AutoFixProPanel: React.FC<Props> = ({
  before,
  after,
  report,
  runId,
  options,
  onToggleOption,
  onRun,
  isRunning,
  compareEnabled,
  onToggleCompare
}) => {
  const beforeCounts = useMemo(() => countBySeverity(before?.issues || []), [before]);
  const afterCounts = useMemo(() => countBySeverity(after?.issues || []), [after]);

  const categoryDiffs = useMemo(() => {
    const b = countByCategory(before?.issues || []);
    const a = countByCategory(after?.issues || []);
    const all = new Set([...Object.keys(b), ...Object.keys(a)]);
    const rows = Array.from(all).map((k) => {
      const bv = b[k] || 0;
      const av = a[k] || 0;
      return { category: k, before: bv, after: av, delta: av - bv };
    });
    // Biggest reductions first
    rows.sort((x, y) => (x.delta - y.delta) || (y.before - x.before));
    return rows.slice(0, 6);
  }, [before, after]);

  const hasAnything = !!before || !!after || !!report;

  if (!hasAnything) return null;

  const scoreBefore = before?.score ?? null;
  const scoreAfter = after?.score ?? null;
  const scoreDelta =
    typeof scoreBefore === 'number' && typeof scoreAfter === 'number'
      ? scoreAfter - scoreBefore
      : null;

  const steps = Array.isArray(report?.steps) ? report.steps : [];
  const warnings = Array.isArray(report?.warnings) ? report.warnings : [];

  return (
    <div className="mb-4 rounded-xl bg-white shadow-sm border border-red-100 overflow-hidden">
      <div className="px-4 py-2 bg-gradient-to-r from-red-50 to-red-50 border-b border-red-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheckIcon className="w-6 h-6 text-red-600" />
          <div className="font-black text-red-900 text-sm uppercase tracking-tight">AI Magic Fix Engine</div>
        </div>
        <div className="flex items-center gap-3">
          {report?.blocked && <div className="text-[10px] font-bold text-white bg-red-600 px-1.5 py-0.5 rounded-full uppercase tracking-wider">Blocked</div>}
          {runId && <div className="text-[10px] font-medium text-red-600 bg-red-100 px-1.5 py-0.5 rounded-full">Run #{runId}</div>}
          <div className="text-[10px] text-gray-500">
            {report?.endedAt ? `Done: ${new Date(report.endedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
          </div>
        </div>
      </div>

      {/* Compare Before/After Toggle */}
      {before && after && onToggleCompare && (
        <div className="px-4 py-1.5 bg-gray-50/50 border-b border-gray-100">
          <label className="flex items-center gap-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={compareEnabled || false}
              onChange={(e) => onToggleCompare(e.target.checked)}
              className="w-3.5 h-3.5 text-indigo-600 rounded border-gray-300"
            />
            <span className="text-[11px] font-bold text-gray-500 group-hover:text-red-900 transition-colors uppercase tracking-wider">
              Compare Before/After
            </span>
          </label>
        </div>
      )}

      <div className="p-4">
        {report?.blocked && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200">
            <div className="flex items-start gap-3">
              <XCircleIcon className="w-8 h-8 text-red-600" />
              <div>
                <div className="font-bold text-red-900 text-lg">AI Magic Fix Blocked by Raster Guard</div>
                <p className="text-red-800 text-sm mt-1">
                  The operation resulted in a rasterized PDF (images only), which violates the default strict vector policy.
                  Rasterized text is not selectable and may print with lower quality.
                </p>
                {onToggleOption && (
                  <div className="mt-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={options?.allowRasterOutput || false}
                        onChange={() => onToggleOption('allowRasterOutput')}
                        className="w-4 h-4 text-red-600 rounded focus:ring-red-500"
                      />
                      <span className="text-sm font-bold text-red-900">Allow Raster Output (Override Guard)</span>
                    </label>
                    <p className="text-xs text-red-700 ml-6 mt-1">Check this and run again if you accept rasterization.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {!report && options && onToggleOption && (
          <div className="mb-4 p-3 rounded-lg bg-red-50/30 border border-red-100/50">
            <div className="text-[11px] font-black text-red-900/40 mb-2 uppercase tracking-widest flex items-center gap-2">
              <Cog6ToothIcon className="w-4 h-4 text-red-900/40" /> Options
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-2">
              <label className="flex items-center gap-2 cursor-pointer group">
                <input type="checkbox" checked={options.safeOnly} onChange={() => onToggleOption('safeOnly')} className="w-3 h-3 text-red-600 rounded" />
                <span className="text-[10px] font-bold text-gray-600 group-hover:text-red-900 transition-colors">Safe fixes</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer group">
                <input type="checkbox" checked={options.aggressive} onChange={() => onToggleOption('aggressive')} className="w-3 h-3 text-red-600 rounded" />
                <span className="text-[10px] font-bold text-gray-600 group-hover:text-red-900 transition-colors">Aggressive</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer group">
                <input type="checkbox" checked={options.forceBleed} onChange={() => onToggleOption('forceBleed')} className="w-3 h-3 text-red-600 rounded" />
                <span className="text-[10px] font-bold text-gray-600 group-hover:text-red-900 transition-colors">+3mm Bleed</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer group">
                <input type="checkbox" checked={options.forceCmyk} onChange={() => onToggleOption('forceCmyk')} className="w-3 h-3 text-red-600 rounded" />
                <span className="text-[10px] font-bold text-gray-600 group-hover:text-red-900 transition-colors">CMYK (PSO V3)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer group">
                <input type="checkbox" checked={options.forceRebuild} onChange={() => onToggleOption('forceRebuild')} className="w-3 h-3 text-red-600 rounded" />
                <span className="text-[10px] font-bold text-gray-600 group-hover:text-red-900 transition-colors">300 DPI rebuild</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer group">
                <input type="checkbox" checked={options.flatten} onChange={() => onToggleOption('flatten')} className="w-3 h-3 text-red-600 rounded" />
                <span className="text-[10px] font-bold text-gray-600 group-hover:text-red-900 transition-colors">Flatten Transp.</span>
              </label>
            </div>
            {onRun && (
              <div className="mt-3 pt-3 border-t border-red-100/50 flex justify-end">
                <button
                  onClick={onRun}
                  disabled={isRunning}
                  className="px-4 py-1.5 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white text-[11px] font-black uppercase tracking-widest rounded-md shadow-sm transition-all active:scale-95 flex items-center gap-2"
                >
                  {isRunning ? 'Magic in progress...' : <><RocketLaunchIcon className="w-4 h-4" /> Start AI Magic Fix</>}
                </button>
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          {/* Before / After */}
          <div className="flex flex-col gap-3">
            <div className="rounded-xl bg-white p-3 border border-gray-100 shadow-sm relative overflow-hidden flex items-center justify-between">
              <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
              <div className="text-sm font-bold text-gray-900">Preflight Score</div>
              <div className="flex items-center gap-3">
                <div className="flex flex-col items-center">
                  <div className="text-[9px] text-gray-400 uppercase font-bold">Before</div>
                  <div className="text-xl font-bold text-gray-400">{scoreBefore ?? '—'}</div>
                </div>
                <div className="text-gray-300 text-lg">→</div>
                <div className="flex flex-col items-center">
                  <div className="text-[9px] text-red-500 uppercase font-bold">After</div>
                  <div className={`text-2xl font-extrabold ${scoreDelta && scoreDelta > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {scoreAfter ?? '—'}
                  </div>
                </div>
                {scoreDelta !== null && scoreDelta !== 0 && (
                  <div className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${scoreDelta > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {scoreDelta > 0 ? '▲' : '▼'}{Math.abs(scoreDelta)}%
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-xl bg-white p-3 border border-gray-100 shadow-sm flex flex-col justify-center">
              <div className="text-sm font-bold text-gray-900 mb-2">Fix Impact</div>
              <div className="flex justify-between items-center gap-2">
                <div className="flex flex-col items-center bg-gray-50 rounded px-2 py-1 flex-1">
                  <div className="text-[9px] text-red-400 uppercase font-bold">Critical</div>
                  <div className="text-sm font-bold text-gray-900">
                    {beforeCounts.error} <span className="text-gray-300">→</span> <span className={afterCounts.error < beforeCounts.error ? 'text-green-600' : ''}>{afterCounts.error}</span>
                  </div>
                </div>
                <div className="flex flex-col items-center bg-gray-50 rounded px-2 py-1 flex-1">
                  <div className="text-[9px] text-amber-500 uppercase font-bold">Warn</div>
                  <div className="text-sm font-bold text-gray-900">
                    {beforeCounts.warning} <span className="text-gray-300">→</span> <span className={afterCounts.warning < beforeCounts.warning ? 'text-green-600' : ''}>{afterCounts.warning}</span>
                  </div>
                </div>
                <div className="flex flex-col items-center bg-gray-50 rounded px-2 py-1 flex-1">
                  <div className="text-[9px] text-gray-400 uppercase font-bold">Info</div>
                  <div className="text-sm font-bold text-gray-900">
                    {beforeCounts.info} <span className="text-gray-300">→</span> {afterCounts.info}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Category deltas */}
          <div className="rounded-xl bg-white p-3 border border-gray-100 shadow-sm">
            <div className="text-sm font-bold text-gray-900 mb-2">Improvements by Category</div>
            {categoryDiffs.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-gray-400 italic">No issues detected to fix.</div>
            ) : (
              <div className="space-y-2">
                {categoryDiffs.filter(r => r.before > 0).map((r) => (
                  <div key={r.category} className="group">
                    <div className="flex items-center justify-between text-[10px] mb-0.5">
                      <div className="text-gray-600 font-medium truncate capitalize leading-tight">{r.category.replace('_', ' ')}</div>
                      <div className="font-bold text-gray-900 leading-tight">
                        {r.before} <span className="text-gray-300">→</span> <span className={r.after < r.before ? 'text-green-600' : ''}>{r.after}</span>
                      </div>
                    </div>
                    <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-1000 ${r.after === 0 ? 'bg-green-500' : 'bg-indigo-400'}`}
                        style={{ width: `${r.before > 0 ? (1 - (r.after / r.before)) * 100 : 0}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Steps applied */}
          <div className="rounded-xl bg-white p-3 border border-gray-100 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-bold text-gray-900">Fix Pipeline</div>
              {report?.duration_total_ms && <div className="text-[10px] text-gray-400">Total: {fmtMs(report.duration_total_ms)}</div>}
            </div>

            {steps.length === 0 && !isRunning ? (
              <div className="h-full flex items-center justify-center text-xs text-gray-400 italic">Queueing pipeline...</div>
            ) : (
              <div className="space-y-1.5 max-h-[140px] overflow-custom overflow-y-auto pr-1">
                {isRunning && steps.length === 0 && (
                  <div className="flex flex-col items-center py-2 bg-indigo-50 rounded-lg animate-pulse">
                    <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mb-1"></div>
                    <div className="text-[10px] text-indigo-700 font-bold uppercase tracking-wider">Initializing...</div>
                  </div>
                )}
                {steps.map((s: any, idx: number) => (
                  <div key={idx} className="flex items-center gap-2 p-1.5 rounded-lg bg-gray-50 border border-gray-100 hover:border-indigo-200 transition-colors">
                    <div className="flex-shrink-0 w-4 h-4 rounded-full bg-green-100 text-green-700 flex items-center justify-center"><CheckCircleIcon className="w-3 h-3" /></div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <div className="text-[10px] font-bold text-gray-800 truncate">{opLabel(String(s.action || s.op || 'step'))}</div>
                        <div className="text-[9px] font-medium text-indigo-600 bg-indigo-50 px-1 rounded">{fmtMs(s.ms)}</div>
                      </div>
                      {s.warnings && s.warnings.length > 0 && (
                        <div className="text-[8px] text-amber-600 mt-0.5 font-medium italic flex items-center gap-1"><ExclamationTriangleIcon className="w-2.5 h-2.5" /> {s.warnings[0]}</div>
                      )}
                    </div>
                  </div>
                ))}
                {isRunning && steps.length > 0 && (
                  <div className="flex items-center gap-2 p-1.5 rounded-lg bg-red-50 border border-red-100 animate-pulse">
                    <div className="w-3 h-3 border border-red-600 border-t-transparent rounded-full animate-spin"></div>
                    <div className="text-[10px] text-red-700 font-bold">Running...</div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {warnings.length > 0 && (
          <div className="mt-6 p-4 rounded-xl bg-amber-50 border border-amber-100">
            <div className="text-xs font-bold text-amber-800 mb-2 flex items-center gap-2">
              <ExclamationTriangleIcon className="w-4 h-4" /> Risk & Notes Summary
            </div>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1.5 list-disc pl-5 text-[11px] text-amber-900/80">
              {warnings.map((w: any, idx: number) => (
                <li key={idx} className="leading-tight">{String(w)}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};
