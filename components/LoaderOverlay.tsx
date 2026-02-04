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

    const base = (doneCount / total) * 100;
    const target = activeIdx === -1 ? base : ((activeIdx + 1) / total) * 100;

    const interval = setInterval(() => {
      setVisualProgress((prev) => {
        if (prev >= target - 1) {
          return Math.min(99.9, prev + 0.02);
        }
        const diff = target - prev;
        const step = Math.max(0.1, diff * 0.15);
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
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(30px)',
        WebkitBackdropFilter: 'blur(30px)',
        overflow: 'hidden',
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}
      aria-modal="true"
      role="dialog"
    >
      {/* Background Animated Blobs */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        <div className="blob" style={{
          position: 'absolute', top: '20%', left: '20%', width: '40%', height: '40%',
          background: 'rgba(16, 185, 129, 0.15)', borderRadius: '50%', filter: 'blur(100px)',
          animation: 'blob-move 10s infinite alternate ease-in-out'
        }} />
        <div className="blob" style={{
          position: 'absolute', bottom: '20%', right: '20%', width: '45%', height: '45%',
          background: 'rgba(59, 130, 246, 0.15)', borderRadius: '50%', filter: 'blur(100px)',
          animation: 'blob-move 12s infinite alternate-reverse ease-in-out'
        }} />
      </div>

      <div style={{ position: 'relative', width: '100%', maxWidth: '450px', padding: '0 20px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>

        {/* Main Circular Loader Area */}
        <div style={{ position: 'relative', width: '100%', maxWidth: '360px', borderRadius: '50%', border: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ paddingBottom: '100%' }}></div> {/* Aspect square fallback */}
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>

            {/* SVG Ring */}
            <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', transform: 'rotate(-90deg)' }} viewBox="0 0 200 200">
              <circle cx="100" cy="100" r={radius} stroke="rgba(255,255,255,0.1)" strokeWidth="10" fill="transparent" />
              <defs>
                <linearGradient id="magic-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#10b981" />
                  <stop offset="50%" stopColor="#3b82f6" />
                  <stop offset="100%" stopColor="#8b5cf6" />
                </linearGradient>
              </defs>
              <circle
                cx="100"
                cy="100"
                r={radius}
                stroke="url(#magic-gradient)"
                strokeWidth="10"
                fill="transparent"
                strokeDasharray={circumference}
                style={{
                  strokeDashoffset,
                  transition: 'stroke-dashoffset 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
                  strokeLinecap: 'round'
                }}
              />
            </svg>

            {/* Central Card */}
            <div style={{
              position: 'relative', width: '74%', height: '74%', borderRadius: '32px',
              backgroundColor: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(15px)',
              border: '1px solid rgba(255,255,255,0.2)', boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              padding: '24px', textAlign: 'center', overflow: 'hidden'
            }} className="card-pulse">

              {/* Floating Icon */}
              <div style={{ marginBottom: '16px', fontSize: '32px' }} className="float-icon">✨</div>

              {/* Step Transitions */}
              <div style={{ height: '80px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <div key={currentStep.key} style={{ animation: 'slideFadeUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards' }}>
                  <h3 style={{ color: '#fff', fontSize: '20px', fontWeight: 900, letterSpacing: '-0.5px', marginBottom: '8px', margin: 0 }}>
                    {currentStep.title}
                  </h3>
                  <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '12px', fontWeight: 500, margin: 0, lineHeight: 1.4 }}>
                    {currentStep.description}
                  </p>
                </div>
              </div>

              {/* Percentage */}
              <div style={{ marginTop: '20px', display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                <span style={{ color: '#fff', fontSize: '42px', fontWeight: 900, letterSpacing: '-2px', fontVariantNumeric: 'tabular-nums' }}>
                  {Math.floor(visualProgress)}
                </span>
                <span style={{ color: '#10b981', fontSize: '14px', fontWeight: 800 }}>%</span>
              </div>

            </div>
          </div>
        </div>

        {/* Timeline Dots */}
        <div style={{ marginTop: '40px', display: 'flex', gap: '10px' }}>
          {pipeline.map((s) => {
            const status = statuses[s.key];
            const isActive = status === 'active';
            const isDone = status === 'done';
            return (
              <div key={s.key} style={{
                height: '6px', width: isActive ? '40px' : isDone ? '10px' : '10px',
                borderRadius: '3px', background: isActive ? '#fff' : isDone ? '#10b981' : 'rgba(255,255,255,0.2)',
                transition: 'all 0.6s ease', position: 'relative', overflow: 'hidden'
              }}>
                {isActive && <div style={{
                  position: 'absolute', inset: 0, background: 'linear-gradient(90deg, transparent, rgba(59,130,246,0.6), transparent)',
                  animation: 'shimmer-move 2s infinite linear'
                }} />}
              </div>
            );
          })}
        </div>

        {/* Message and Tips */}
        <div style={{ marginTop: '30px', textAlign: 'center', width: '100%', maxWidth: '320px' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 16px',
            backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.1)',
            marginBottom: '16px'
          }}>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#3b82f6', animation: 'scale-pulse 2s infinite' }} />
            <span style={{ color: '#fff', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px' }}>
              {message}
            </span>
          </div>

          <div style={{ height: '40px', overflow: 'hidden' }}>
            <p key={tipIndex} style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', fontStyle: 'italic', lineHeight: 1.5, margin: 0, animation: 'tip-fade 5s infinite' }}>
              " {LOADING_TIPS[tipIndex]} "
            </p>
          </div>
        </div>

      </div>

      <style>{`
        @keyframes blob-move {
          0% { transform: translate(0, 0) scale(1); }
          100% { transform: translate(50px, -30px) scale(1.1); }
        }
        @keyframes slideFadeUp {
          from { opacity: 0; transform: translateY(15px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes shimmer-move {
          from { transform: translateX(-100%); }
          to { transform: translateX(100%); }
        }
        @keyframes scale-pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.5); opacity: 0.5; }
        }
        @keyframes float-icon {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        .float-icon { animation: float-icon 3s ease-in-out infinite; }
        
        .card-pulse { animation: card-border-pulse 4s infinite; }
        @keyframes card-border-pulse {
          0%, 100% { border-color: rgba(255,255,255,0.2); }
          50% { border-color: rgba(16, 185, 129, 0.4); }
        }

        @keyframes tip-fade {
          0% { opacity: 0; transform: translateY(5px); }
          10%, 90% { opacity: 1; transform: translateY(0); }
          100% { opacity: 0; transform: translateY(-5px); }
        }
      `}</style>
    </div>
  );
};
