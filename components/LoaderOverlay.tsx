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
  { key: 'upload', title: 'Ingesting PDF', description: 'Loading pages, fonts, and metadata.' },
  { key: 'preflight', title: 'Preflight Scan', description: 'Checking RGB/CMYK, bleed, DPI, and PDF standard.' },
  { key: 'analyze', title: 'Issue Analysis', description: 'Classifying issues by severity and category.' },
  { key: 'fix', title: 'Applying Fixes', description: 'Converting color space and optimizing for print.' },
  { key: 'verify', title: 'Verification', description: 'Re-running checks to confirm improvements.' },
  { key: 'finalize', title: 'Finalizing Output', description: 'Preparing your print-ready file for download.' },
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
  const [stepProgress, setStepProgress] = useState<Record<string, number>>({});

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

  // Animate individual step progress
  useEffect(() => {
    if (!isOpen) {
      setStepProgress({});
      return;
    }

    const interval = setInterval(() => {
      setStepProgress((prev) => {
        const next = { ...prev };
        pipeline.forEach((s) => {
          const status = statuses[s.key];
          if (status === 'done') {
            next[s.key] = 100;
          } else if (status === 'active') {
            const current = prev[s.key] || 0;
            // Simulate progress: increment by random amount, cap at 95% until actually done
            next[s.key] = Math.min(95, current + Math.random() * 8);
          } else {
            next[s.key] = 0;
          }
        });
        return next;
      });
    }, 200);

    return () => clearInterval(interval);
  }, [isOpen, pipeline, statuses]);

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
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      aria-modal="true"
      role="dialog"
      style={{
        background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.85) 100%)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onWheel={(e) => e.preventDefault()}
    >
      <div
        className="w-full max-w-2xl animate-[fadeInScale_0.4s_ease-out]"
        onClick={(e) => e.stopPropagation()}
        style={{
          animation: 'fadeInScale 0.4s ease-out',
        }}
      >
        <div className="rounded-3xl bg-white shadow-[0_20px_60px_rgba(0,0,0,0.3)] border border-gray-200/50 overflow-hidden">
          {/* Header with gradient */}
          <div className="relative px-8 pt-8 pb-6 bg-gradient-to-br from-emerald-50 via-white to-blue-50 overflow-hidden">
            {/* Decorative background elements */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-emerald-200/20 to-blue-200/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tr from-blue-200/20 to-emerald-200/20 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />

            <div className="relative flex items-center gap-5">
              {/* Enhanced Spinner with gradient ring */}
              <div className="relative w-16 h-16 shrink-0">
                <div className="absolute inset-0 rounded-full bg-gradient-to-br from-emerald-100 to-blue-100" />
                <div
                  className="absolute inset-0 rounded-full animate-spin"
                  style={{
                    background: 'conic-gradient(from 0deg, transparent 0%, #10b981 50%, transparent 100%)',
                    mask: 'radial-gradient(circle, transparent 60%, black 60%)',
                    WebkitMask: 'radial-gradient(circle, transparent 60%, black 60%)',
                  }}
                />
                <div className="absolute inset-2 rounded-full bg-white flex items-center justify-center">
                  <svg className="w-6 h-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
              </div>

              <div className="min-w-0 flex-1">
                <h3 className="text-2xl font-bold bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 bg-clip-text text-transparent leading-tight">
                  Processing your PDF
                </h3>
                <p className="text-base text-gray-700 font-medium mt-1">
                  {message}
                </p>
                <p className="text-sm text-gray-500 mt-2 min-h-[20px] transition-opacity duration-300">
                  {LOADING_TIPS[tipIndex]}
                </p>
              </div>
            </div>

            {/* Overall Progress bar with gradient */}
            <div className="relative mt-6">
              <div className="h-3 w-full rounded-full bg-gray-200/80 overflow-hidden shadow-inner">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-emerald-600 to-blue-500 transition-all duration-700 ease-out shadow-lg"
                  style={{
                    width: `${Math.round(progress * 100)}%`,
                    boxShadow: '0 0 20px rgba(16, 185, 129, 0.5)',
                  }}
                />
              </div>
              <div className="mt-2.5 flex items-center justify-between text-xs font-semibold">
                <span className="text-gray-600">Prepress Pipeline</span>
                <span className="text-emerald-700">{Math.round(progress * 100)}%</span>
              </div>
            </div>
          </div>

          {/* Steps with individual progress bars */}
          <div className="px-8 py-6 bg-gradient-to-b from-white to-gray-50/50">
            <div className="space-y-3">
              {pipeline.map((s, idx) => {
                const st = statuses[s.key];
                const isActive = st === 'active';
                const isDone = st === 'done';
                const stepProg = stepProgress[s.key] || 0;

                return (
                  <div
                    key={s.key}
                    className={[
                      'relative rounded-2xl border-2 p-4 transition-all duration-500',
                      isActive
                        ? 'border-emerald-300 bg-gradient-to-br from-emerald-50 to-blue-50 shadow-lg shadow-emerald-100/50 scale-[1.02]'
                        : isDone
                          ? 'border-emerald-200/50 bg-white shadow-sm'
                          : 'border-gray-200 bg-white/50',
                    ].join(' ')}
                    style={{
                      transitionDelay: `${idx * 50}ms`,
                    }}
                  >
                    <div className="flex items-start gap-4">
                      {/* Status Icon with enhanced styling */}
                      <div className="mt-0.5">
                        {isDone ? (
                          <div className="relative">
                            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 text-white text-base font-bold shadow-lg shadow-emerald-200">
                              ✓
                            </span>
                            <div className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-20" />
                          </div>
                        ) : isActive ? (
                          <div className="relative">
                            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-emerald-100 to-blue-100 shadow-md">
                              <span className="h-3 w-3 rounded-full bg-gradient-to-br from-emerald-500 to-blue-500 animate-pulse shadow-lg" />
                            </span>
                            <div className="absolute inset-0 rounded-full bg-emerald-300 animate-ping opacity-30" />
                          </div>
                        ) : (
                          <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-400 text-lg font-bold">
                            {idx + 1}
                          </span>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-3 mb-2">
                          <p className={[
                            'text-base font-bold transition-colors',
                            isActive ? 'text-emerald-900' : isDone ? 'text-gray-700' : 'text-gray-500'
                          ].join(' ')}>
                            {s.title}
                          </p>
                          {isActive && (
                            <span className="text-xs font-bold text-emerald-700 bg-emerald-200 px-3 py-1.5 rounded-full shadow-sm animate-pulse">
                              RUNNING
                            </span>
                          )}
                          {isDone && (
                            <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-3 py-1.5 rounded-full shadow-sm">
                              DONE
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 mb-3">
                          {s.description}
                        </p>

                        {/* Individual step progress bar */}
                        {(isActive || isDone) && (
                          <div className="h-1.5 w-full rounded-full bg-gray-200/80 overflow-hidden">
                            <div
                              className={[
                                'h-full rounded-full transition-all duration-300 ease-out',
                                isDone
                                  ? 'bg-gradient-to-r from-emerald-400 to-emerald-500'
                                  : 'bg-gradient-to-r from-emerald-500 to-blue-500'
                              ].join(' ')}
                              style={{
                                width: `${Math.round(stepProg)}%`,
                                boxShadow: isActive ? '0 0 10px rgba(16, 185, 129, 0.4)' : 'none',
                              }}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer note with icon */}
            <div className="mt-6 flex items-start gap-3 p-4 rounded-xl bg-blue-50/50 border border-blue-100">
              <svg className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-blue-900 leading-relaxed">
                Please don't close this window. We're optimizing your PDF for professional printing.
              </p>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeInScale {
          from {
            opacity: 0;
            transform: scale(0.95) translateY(10px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
      `}</style>
    </div>
  );
};
