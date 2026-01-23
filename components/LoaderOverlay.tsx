import React, { useEffect, useMemo, useState } from 'react';

type StepStatus = 'done' | 'active' | 'pending';

export type LoaderStep = {
  key: string;
  title: string;
  description: string;
};

type Props = {
  isOpen: boolean;
  message?: string;

  /**
   * Current stage key, e.g. "upload" | "preflight" | "analyze" | "convert" | "verify" | "finalize"
   * If omitted, we show an indeterminate progress but still rotate tips.
   */
  stageKey?: string;

  /**
   * Optional custom pipeline. If omitted, defaults to a print preflight pipeline.
   */
  steps?: LoaderStep[];

  /**
   * If true (default), blocks page scroll and interactions.
   */
  lockUI?: boolean;
};

const DEFAULT_STEPS: LoaderStep[] = [
  { key: 'upload',   title: 'Ingesting PDF',           description: 'Loading pages, fonts, and metadata.' },
  { key: 'preflight',title: 'Preflight Scan',          description: 'Checking RGB/CMYK, bleed, DPI, and PDF standard.' },
  { key: 'analyze',  title: 'Issue Analysis',          description: 'Classifying issues by severity and category.' },
  { key: 'fix',      title: 'Applying Fixes',          description: 'Converting color space and optimizing for print.' },
  { key: 'verify',   title: 'Verification',            description: 'Re-running checks to confirm improvements.' },
  { key: 'finalize', title: 'Finalizing Output',       description: 'Preparing your print-ready file for download.' },
];

const LOADING_TIPS = [
  'Please wait — complex PDFs can take a little longer.',
  'Tip: Photos should be at least 150 DPI (300 recommended for offset).',
  'Tip: Always include 3 mm bleed on all sides for trimming safety.',
  'Tip: Embed fonts to prevent substitutions at RIP time.',
  'Tip: CMYK conversion is safer when using an ICC profile like ISO Coated v2.',
];

function computeStatuses(steps: LoaderStep[], stageKey?: string): Record<string, StepStatus> {
  if (!stageKey) {
    // No stage: show only the first as active to keep UI lively
    return Object.fromEntries(
      steps.map((s, i) => [s.key, i === 0 ? 'active' : 'pending'])
    ) as Record<string, StepStatus>;
  }

  const idx = steps.findIndex((s) => s.key === stageKey);
  if (idx === -1) {
    // Unknown stage -> keep first active
    return Object.fromEntries(
      steps.map((s, i) => [s.key, i === 0 ? 'active' : 'pending'])
    ) as Record<string, StepStatus>;
  }

  const out: Record<string, StepStatus> = {};
  steps.forEach((s, i) => {
    if (i < idx) out[s.key] = 'done';
    else if (i === idx) out[s.key] = 'active';
    else out[s.key] = 'pending';
  });
  return out;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export const LoaderOverlay: React.FC<Props> = ({
  isOpen,
  message = 'Processing…',
  stageKey,
  steps,
  lockUI = true,
}) => {
  const [tipIndex, setTipIndex] = useState(0);

  const pipeline = useMemo(() => steps ?? DEFAULT_STEPS, [steps]);
  const statuses = useMemo(() => computeStatuses(pipeline, stageKey), [pipeline, stageKey]);

  // Derived progress (nice-looking, but not "lying" too much)
  const progress = useMemo(() => {
    const total = pipeline.length;
    const done = pipeline.filter((s) => statuses[s.key] === 'done').length;
    const activeIdx = pipeline.findIndex((s) => statuses[s.key] === 'active');
    // We "animate" active step as halfway.
    const base = done / total;
    const withActive = activeIdx >= 0 ? base + (0.5 / total) : base;
    return clamp(withActive, 0, 1);
  }, [pipeline, statuses]);

  // Rotate tips
  useEffect(() => {
    if (!isOpen) {
      setTipIndex(0);
      return;
    }
    const interval = setInterval(() => {
      setTipIndex((prev) => (prev + 1) % LOADING_TIPS.length);
    }, 3500);
    return () => clearInterval(interval);
  }, [isOpen]);

  // Lock scroll + prevent ESC closing other modals + stop accidental interactions
  useEffect(() => {
    if (!isOpen || !lockUI) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (e: KeyboardEvent) => {
      // Block ESC and Enter spamming while processing
      if (e.key === 'Escape' || e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    window.addEventListener('keydown', onKeyDown, { capture: true });
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKeyDown, { capture: true } as any);
    };
  }, [isOpen, lockUI]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] bg-black/55 backdrop-blur-sm flex items-center justify-center"
      aria-modal="true"
      role="dialog"
      // Blocks clicks from reaching the app
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onWheel={(e) => e.preventDefault()}
    >
      <div
        className="w-full max-w-lg mx-4 rounded-2xl bg-white shadow-2xl border border-black/5 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4 bg-gradient-to-b from-gray-50 to-white">
          <div className="flex items-center gap-4">
            {/* Spinner */}
            <div className="relative w-12 h-12 shrink-0">
              <div className="absolute inset-0 rounded-full border-4 border-gray-100" />
              <div className="absolute inset-0 rounded-full border-4 border-emerald-600 border-t-transparent animate-spin" />
            </div>

            <div className="min-w-0">
              <h3 className="text-lg font-semibold text-gray-900 leading-tight">
                Processing your PDF
              </h3>
              <p className="text-sm text-gray-600 font-medium">
                {message}
              </p>
              <p className="text-xs text-gray-400 mt-1 h-4">
                {LOADING_TIPS[tipIndex]}
              </p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-4">
            <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-emerald-600 transition-all duration-500 ease-out"
                style={{ width: `${Math.round(progress * 100)}%` }}
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px] text-gray-400">
              <span>Prepress pipeline</span>
              <span>{Math.round(progress * 100)}%</span>
            </div>
          </div>
        </div>

        {/* Steps */}
        <div className="px-6 pb-6">
          <div className="mt-2 space-y-3">
            {pipeline.map((s) => {
              const st = statuses[s.key];
              const isActive = st === 'active';
              const isDone = st === 'done';

              return (
                <div
                  key={s.key}
                  className={[
                    'flex items-start gap-3 rounded-xl border p-3 transition-colors',
                    isActive ? 'border-emerald-200 bg-emerald-50/60' : 'border-gray-100 bg-white',
                  ].join(' ')}
                >
                  {/* Status Icon */}
                  <div className="mt-0.5">
                    {isDone ? (
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-600 text-white text-sm">
                        ✓
                      </span>
                    ) : isActive ? (
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-600/15 text-emerald-700 text-sm">
                        <span className="h-2.5 w-2.5 rounded-full bg-emerald-600 animate-pulse" />
                      </span>
                    ) : (
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 text-gray-400 text-sm">
                        •
                      </span>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-gray-900">
                        {s.title}
                      </p>
                      {isActive && (
                        <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-100 px-2 py-1 rounded-full">
                          running
                        </span>
                      )}
                      {isDone && (
                        <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-100 px-2 py-1 rounded-full">
                          done
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {s.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer note */}
          <div className="mt-4 text-[11px] text-gray-400 leading-relaxed">
            Please don't close this window. We're optimizing your PDF for professional printing.
          </div>
        </div>
      </div>
    </div>
  );
};
