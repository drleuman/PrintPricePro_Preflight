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
  stageKey?: string;
  steps?: LoaderStep[];
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
  const [visualProgress, setVisualProgress] = useState(0);

  const pipeline = useMemo(() => steps ?? DEFAULT_STEPS, [steps]);
  const statuses = useMemo(() => computeStatuses(pipeline, stageKey), [pipeline, stageKey]);

  // Sync visual progress with stageKey but with emotional smoothing
  useEffect(() => {
    if (!isOpen) {
      setVisualProgress(0);
      return;
    }

    if (!stageKey) {
      setVisualProgress(5);
      return;
    }

    const total = pipeline.length;
    const activeIdx = pipeline.findIndex((s) => statuses[s.key] === 'active');
    const doneCount = pipeline.filter((s) => statuses[s.key] === 'done').length;

    // Base progress for completed steps
    const base = (doneCount / total) * 100;

    // Target for the end of the current active step
    const target = activeIdx === -1 ? base : ((activeIdx + 1) / total) * 100;

    // Slowly creep towards the target to keep things moving
    const interval = setInterval(() => {
      setVisualProgress((prev) => {
        if (prev >= target - 1) {
          // If we are at the target, creep ultra slowly to never look static
          return Math.min(99, prev + 0.05);
        }
        // Move faster if we just switched stages
        const diff = target - prev;
        const step = Math.max(0.1, diff * 0.1);
        return prev + step;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [isOpen, stageKey, pipeline, statuses]);

  useEffect(() => {
    if (!isOpen) {
      setTipIndex(0);
      return;
    }
    const interval = setInterval(() => {
      setTipIndex((prev) => (prev + 1) % LOADING_TIPS.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !lockUI) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen, lockUI]);

  if (!isOpen) return null;

  const activeIdx = pipeline.findIndex((s) => statuses[s.key] === 'active');
  const currentStep = pipeline[activeIdx === -1 ? 0 : activeIdx];

  const radius = 80;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (visualProgress / 100 * circumference);

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center pointer-events-auto overflow-hidden"
      aria-modal="true"
      role="dialog"
      style={{
        background: 'rgba(0, 0, 0, 0.4)',
        backdropFilter: 'blur(32px)',
        WebkitBackdropFilter: 'blur(32px)',
      }}
    >
      {/* Dynamic Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[20%] left-[20%] w-[40%] h-[40%] bg-emerald-500/15 rounded-full blur-[120px] animate-blob" />
        <div className="absolute bottom-[20%] right-[20%] w-[40%] h-[40%] bg-blue-500/15 rounded-full blur-[120px] animate-blob" style={{ animationDelay: '2s' }} />
      </div>

      <div className="relative w-full max-w-xl px-6 flex flex-col items-center">
        {/* Main Central Loader Component */}
        <div className="relative w-full aspect-square max-w-[380px] flex items-center justify-center">
          {/* Progress Circles */}
          <svg className="absolute inset-0 w-full h-full -rotate-90 transform" viewBox="0 0 200 200">
            {/* Inner Glassy Circle */}
            <circle cx="100" cy="100" r="85" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />

            {/* Track */}
            <circle
              cx="100"
              cy="100"
              r={radius}
              stroke="rgba(255,255,255,0.05)"
              strokeWidth="10"
              fill="transparent"
            />

            <defs>
              <linearGradient id="wow-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#10b981" />
                <stop offset="50%" stopColor="#3b82f6" />
                <stop offset="100%" stopColor="#8b5cf6" />
              </linearGradient>
            </defs>

            {/* Active Progress Stroke */}
            <circle
              cx="100"
              cy="100"
              r={radius}
              stroke="url(#wow-gradient)"
              strokeWidth="10"
              fill="transparent"
              strokeDasharray={circumference}
              style={{
                strokeDashoffset,
                transition: 'stroke-dashoffset 0.5s ease-out',
                strokeLinecap: 'round'
              }}
            />
          </svg>

          {/* Centered Rotating Card */}
          <div className="relative z-10 w-[72%] h-[72%] rounded-3xl bg-white/10 backdrop-blur-xl border border-white/20 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)] flex flex-col items-center justify-center text-center p-8 overflow-hidden">
            {/* Premium Shine Effect */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/10 pointer-events-none" />
            <div className="absolute -top-[50%] -left-[50%] w-[200%] h-[200%] bg-gradient-to-br from-white/5 via-transparent to-transparent rotate-45 pointer-events-none" />

            {/* Glowing Icon */}
            <div className="mb-4 relative">
              <div className="absolute inset-0 bg-blue-500/20 blur-xl rounded-full animate-pulse" />
              <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-white/20 to-white/5 flex items-center justify-center border border-white/20 shadow-inner">
                <span className="text-3xl animate-float">✨</span>
              </div>
            </div>

            {/* Title & Description with "Card Rotation" effect */}
            <div className="h-24 flex flex-col items-center justify-center">
              <div
                key={currentStep.key}
                className="animate-card-enter"
              >
                <h3 className="text-white text-xl font-black tracking-tight mb-2 drop-shadow-sm">
                  {currentStep.title}
                </h3>
                <p className="text-white/60 text-xs font-medium px-2 leading-relaxed max-w-[200px]">
                  {currentStep.description}
                </p>
              </div>
            </div>

            {/* Percentage */}
            <div className="mt-6 flex items-baseline gap-1">
              <span className="text-white text-4xl font-black tracking-tighter tabular-nums drop-shadow-md">
                {Math.floor(visualProgress)}
              </span>
              <span className="text-emerald-400 text-sm font-bold uppercase tracking-widest">%</span>
            </div>
          </div>
        </div>

        {/* Minimal Timeline Dots */}
        <div className="mt-12 flex items-center gap-3">
          {pipeline.map((s, idx) => {
            const status = statuses[s.key];
            const isActive = status === 'active';
            const isDone = status === 'done';
            return (
              <div
                key={s.key}
                className={`relative h-2 rounded-full transition-all duration-700 ${isActive ? 'w-12 bg-white shadow-[0_0_12px_rgba(255,255,255,0.4)]' : isDone ? 'w-2 bg-emerald-500' : 'w-2 bg-white/20'
                  }`}
              >
                {isActive && (
                  <div className="absolute inset-0 overflow-hidden rounded-full">
                    <div className="h-full w-full bg-gradient-to-r from-transparent via-blue-400 to-transparent animate-shimmer" />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Status Message & Tips */}
        <div className="mt-10 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 mb-4">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
            <span className="text-white/90 text-xs font-bold uppercase tracking-widest">{message}</span>
          </div>

          <div className="h-12 flex flex-col items-center justify-center">
            <p
              key={tipIndex}
              className="text-white/40 text-xs italic leading-relaxed max-w-sm px-8 animate-fade-blur"
            >
              " {LOADING_TIPS[tipIndex]} "
            </p>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes animate-blob {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
        }

        .animate-blob {
          animation: animate-blob 7s infinite alternate ease-in-out;
        }

        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }

        .animate-float {
          animation: float 3s ease-in-out infinite;
        }

        @keyframes card-enter {
          0% { opacity: 0; transform: translateY(20px) scale(0.9) rotateX(-20deg); filter: blur(10px); }
          100% { opacity: 1; transform: translateY(0) scale(1) rotateX(0); filter: blur(0); }
        }

        .animate-card-enter {
          animation: card-enter 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        @keyframes fade-blur {
          0% { opacity: 0; filter: blur(4px); transform: translateY(5px); }
          10%, 90% { opacity: 1; filter: blur(0); transform: translateY(0); }
          100% { opacity: 0; filter: blur(4px); transform: translateY(-5px); }
        }

        .animate-fade-blur {
          animation: fade-blur 5s ease-in-out infinite;
        }

        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }

        .animate-shimmer {
          animation: shimmer 2.5s infinite linear;
        }

        .tabular-nums {
          font-variant-numeric: tabular-nums;
        }
      `}</style>
    </div>
  );
};
