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
  'Tip: Embed fonts to prevent substitutions at print time.',
  'Tip: We\'ll convert colors safely for professional printing.',
];

function computeStatuses(steps: LoaderStep[], stageKey?: string): Record<string, StepStatus> {
  if (!stageKey) {
    return Object.fromEntries(
      steps.map((s, i) => [s.key, i === 0 ? 'active' : 'pending'])
    ) as Record<string, StepStatus>;
  }

  const idx = steps.findIndex((s) => s.key === stageKey);
  if (idx === -1) {
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

  // Better progress calculation
  const progress = useMemo(() => {
    const total = pipeline.length;
    const done = pipeline.filter((s) => statuses[s.key] === 'done').length;
    const activeIdx = pipeline.findIndex((s) => statuses[s.key] === 'active');

    if (activeIdx === -1) {
      return clamp(done / total, 0, 1);
    }

    const activeProgress = stepProgress[pipeline[activeIdx].key] || 0;
    const base = done / total;
    const activeContribution = (activeProgress / 100) / total;

    return clamp(base + activeContribution, 0, 1);
  }, [pipeline, statuses, stepProgress]);

  // More aggressive progress animation
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
            const increment = 3 + Math.random() * 9;
            // Cap at 88% to avoid "stuck at 95%" perception
            next[s.key] = Math.min(88, current + increment);
          } else {
            next[s.key] = 0;
          }
        });
        return next;
      });
    }, 150);

    return () => clearInterval(interval);
  }, [isOpen, pipeline, statuses]);

  // Resync progress when stageKey changes
  useEffect(() => {
    if (!isOpen || !stageKey) return;
    // Smooth transition when backend updates stage
    setStepProgress((prev) => {
      const next = { ...prev };

      pipeline.forEach((s) => {
        const status = statuses[s.key];
        if (status === 'done') {
          next[s.key] = 100;
        } else if (status === 'active') {
          // Start active step at 14% to avoid blink from 0
          next[s.key] = Math.max(next[s.key] ?? 0, 14);
        } else if (status === 'pending') {
          next[s.key] = next[s.key] ?? 0;
        }
      });

      return next;
    });
  }, [stageKey, isOpen, pipeline, statuses]);

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

  useEffect(() => {
    if (!isOpen || !lockUI) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    const opts = { capture: true } as const;
    window.addEventListener('keydown', onKeyDown, opts);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKeyDown, opts);
    };
  }, [isOpen, lockUI]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-2 sm:p-4 pointer-events-auto"
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
      onTouchMove={(e) => e.preventDefault()}
    >
      <div
        className="w-full max-w-2xl max-h-[95vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        style={{
          animation: 'fadeInScale 0.4s ease-out',
        }}
      >
        <div className="rounded-2xl sm:rounded-3xl bg-white shadow-[0_20px_60px_rgba(0,0,0,0.3)] border border-gray-200/50 overflow-hidden">
          {/* Header - Responsive */}
          <div className="relative px-4 sm:px-6 md:px-8 pt-4 sm:pt-6 md:pt-8 pb-3 sm:pb-4 md:pb-6 bg-gradient-to-br from-emerald-50 via-white to-blue-50 overflow-hidden">
            <div className="absolute top-0 right-0 w-32 sm:w-48 md:w-64 h-32 sm:h-48 md:h-64 bg-gradient-to-br from-emerald-200/20 to-blue-200/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-24 sm:w-36 md:w-48 h-24 sm:h-36 md:h-48 bg-gradient-to-tr from-blue-200/20 to-emerald-200/20 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />

            <div className="relative flex items-center gap-3 sm:gap-4 md:gap-5">
              <div className="relative w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 shrink-0">
                <div className="absolute inset-0 rounded-full bg-gradient-to-br from-emerald-100 to-blue-100" />
                <div
                  className="absolute inset-0 rounded-full animate-spin"
                  style={{
                    background: 'conic-gradient(from 0deg, transparent 0%, #10b981 50%, transparent 100%)',
                    mask: 'radial-gradient(circle, transparent 60%, black 60%)',
                    WebkitMask: 'radial-gradient(circle, transparent 60%, black 60%)',
                  }}
                />
                <div className="absolute inset-1 sm:inset-2 rounded-full bg-white flex items-center justify-center">
                  <svg className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
              </div>

              <div className="min-w-0 flex-1">
                <h3 className="text-lg sm:text-xl md:text-2xl font-bold bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 bg-clip-text text-transparent leading-tight">
                  Processing your PDF
                </h3>
                <p aria-live="polite" className="text-sm sm:text-base text-gray-700 font-medium mt-0.5 sm:mt-1">
                  {message}
                </p>
                <p aria-live="polite" className="text-xs sm:text-sm text-gray-500 mt-1 sm:mt-2 min-h-[16px] sm:min-h-[20px] transition-opacity duration-300 truncate">
                  {LOADING_TIPS[tipIndex]}
                </p>
              </div>
            </div>

            <div className="relative mt-3 sm:mt-4 md:mt-6">
              <div className="h-2 sm:h-2.5 md:h-3 w-full rounded-full bg-gray-200/80 overflow-hidden shadow-inner">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-emerald-600 to-blue-500 transition-all duration-700 ease-out shadow-lg"
                  style={{
                    width: `${Math.round(progress * 100)}%`,
                    boxShadow: '0 0 20px rgba(16, 185, 129, 0.5)',
                  }}
                />
              </div>
              <div className="mt-1.5 sm:mt-2 md:mt-2.5 flex items-center justify-between text-[10px] sm:text-xs font-semibold">
                <span className="text-gray-600">Prepress Pipeline</span>
                <span className="text-emerald-700">{Math.round(progress * 100)}%</span>
              </div>
            </div>
          </div>

          {/* Steps - Compact */}
          <div className="px-4 sm:px-6 md:px-8 py-3 sm:py-4 md:py-6 bg-gradient-to-b from-white to-gray-50/50 max-h-[50vh] overflow-y-auto">
            <div className="space-y-2 sm:space-y-2.5 md:space-y-3">
              {pipeline.map((s, idx) => {
                const st = statuses[s.key];
                const isActive = st === 'active';
                const isDone = st === 'done';
                const stepProg = stepProgress[s.key] || 0;

                return (
                  <div
                    key={s.key}
                    className={[
                      'relative rounded-xl sm:rounded-2xl border-2 p-2 sm:p-3 md:p-4 transition-all duration-500',
                      isActive
                        ? 'border-emerald-300 bg-gradient-to-br from-emerald-50 to-blue-50 shadow-lg shadow-emerald-100/50 scale-[1.01] sm:scale-[1.02]'
                        : isDone
                          ? 'border-emerald-200/50 bg-white shadow-sm'
                          : 'border-gray-200 bg-white/50',
                    ].join(' ')}
                  >
                    <div className="flex items-start gap-2 sm:gap-3 md:gap-4">
                      <div className="mt-0.5">
                        {isDone ? (
                          <div className="relative">
                            <span className="inline-flex h-7 w-7 sm:h-8 sm:w-8 md:h-9 md:w-9 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 text-white text-sm sm:text-base font-bold shadow-lg shadow-emerald-200">
                              ✓
                            </span>
                            <div className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-20" />
                          </div>
                        ) : isActive ? (
                          <div className="relative">
                            <span className="inline-flex h-7 w-7 sm:h-8 sm:w-8 md:h-9 md:w-9 items-center justify-center rounded-full bg-gradient-to-br from-emerald-100 to-blue-100 shadow-md">
                              <span className="h-2 w-2 sm:h-2.5 sm:w-2.5 md:h-3 md:w-3 rounded-full bg-gradient-to-br from-emerald-500 to-blue-500 animate-pulse shadow-lg" />
                            </span>
                            <div className="absolute inset-0 rounded-full bg-emerald-300 animate-ping opacity-30" />
                          </div>
                        ) : (
                          <span className="inline-flex h-7 w-7 sm:h-8 sm:w-8 md:h-9 md:w-9 items-center justify-center rounded-full bg-gray-100 text-gray-400 text-sm sm:text-base md:text-lg font-bold">
                            {idx + 1}
                          </span>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2 sm:gap-3 mb-1 sm:mb-1.5 md:mb-2">
                          <p className={[
                            'text-sm sm:text-base font-bold transition-colors',
                            isActive ? 'text-emerald-900' : isDone ? 'text-gray-700' : 'text-gray-500'
                          ].join(' ')}>
                            {s.title}
                          </p>
                          {isActive && (
                            <span className="text-[10px] sm:text-xs font-bold text-emerald-700 bg-emerald-200 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full shadow-sm animate-pulse whitespace-nowrap">
                              In progress
                            </span>
                          )}
                          {isDone && (
                            <span className="text-[10px] sm:text-xs font-bold text-emerald-700 bg-emerald-100 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full shadow-sm whitespace-nowrap">
                              Completed
                            </span>
                          )}
                        </div>
                        <p className="text-xs sm:text-sm text-gray-600 mb-1.5 sm:mb-2 md:mb-3 hidden sm:block">
                          {s.description}
                        </p>

                        {/* Progress bar - MORE VISIBLE */}
                        {(isActive || isDone) && (
                          <div className="h-2 sm:h-2.5 w-full rounded-full bg-gray-200/80 overflow-hidden shadow-inner">
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

            <div className="mt-3 sm:mt-4 md:mt-6 flex items-start gap-2 sm:gap-3 p-2 sm:p-3 md:p-4 rounded-lg sm:rounded-xl bg-blue-50/50 border border-blue-100">
              <svg className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-xs sm:text-sm text-blue-900 leading-relaxed">
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
        
        .max-h-\[50vh\]::-webkit-scrollbar {
          width: 6px;
        }
        
        .max-h-\[50vh\]::-webkit-scrollbar-track {
          background: #f1f1f1;
          border-radius: 10px;
        }
        
        .max-h-\[50vh\]::-webkit-scrollbar-thumb {
          background: #10b981;
          border-radius: 10px;
        }
        
        .max-h-\[50vh\]::-webkit-scrollbar-thumb:hover {
          background: #059669;
        }
      `}</style>
    </div>
  );
};
