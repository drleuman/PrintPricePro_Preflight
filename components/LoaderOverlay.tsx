import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

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
  'Tip: We use 300 DPI by default for high-quality professional printing.',
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

  const overlay = (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(40px)',
        WebkitBackdropFilter: 'blur(40px)',
        overflow: 'hidden',
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}
      aria-modal="true"
      role="dialog"
    >
      {/* Background Animated Blobs */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        <div style={{
          position: 'absolute', top: '15%', left: '15%', width: '35%', height: '35%',
          background: 'rgba(16, 185, 129, 0.2)', borderRadius: '50%', filter: 'blur(100px)',
          animation: 'blob-move 15s infinite alternate ease-in-out'
        }} />
        <div style={{
          position: 'absolute', bottom: '15%', right: '15%', width: '40%', height: '40%',
          background: 'rgba(59, 130, 246, 0.2)', borderRadius: '50%', filter: 'blur(100px)',
          animation: 'blob-move 18s infinite alternate-reverse ease-in-out'
        }} />
      </div>

      <div style={{ position: 'relative', width: '100%', maxWidth: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>

        {/* Container for Loader and Card */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '30px',
          width: '100%',
          maxWidth: '500px'
        }}>
          {/* Main Circular Loader */}
          <div style={{ position: 'relative', width: '320px', height: '320px' }}>
            <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', transform: 'rotate(-90deg)' }} viewBox="0 0 200 200">
              <circle cx="100" cy="100" r={radius} stroke="rgba(255,255,255,0.05)" strokeWidth="12" fill="transparent" />
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
                strokeWidth="12"
                strokeLinecap="round"
                fill="transparent"
                strokeDasharray={circumference}
                style={{
                  strokeDashoffset,
                  transition: 'stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1)'
                }}
              />
            </svg>

            {/* Inner Central Glass Card */}
            <div style={{
              position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
              width: '230px', height: '230px', borderRadius: '40px',
              backgroundColor: 'transparent',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              padding: '25px', textAlign: 'center', overflow: 'hidden'
            }}>

              <div style={{ height: '70px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <div key={currentStep.key} style={{ animation: 'slideFadeUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards' }}>
                  <h3 style={{ color: '#fff', fontSize: '20px', fontWeight: 900, marginBottom: '6px', margin: 0, letterSpacing: '-0.3px' }}>
                    {currentStep.title}
                  </h3>
                  <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', fontWeight: 500, margin: 0 }}>
                    {currentStep.description}
                  </p>
                </div>
              </div>

              <div style={{ marginTop: '20px', display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                <span style={{ color: '#fff', fontSize: '48px', fontWeight: 900, letterSpacing: '-2px', fontVariantNumeric: 'tabular-nums' }}>
                  {Math.floor(visualProgress)}
                </span>
                <span style={{ color: '#10b981', fontSize: '14px', fontWeight: 800 }}>%</span>
              </div>
            </div>
          </div>

          {/* Timeline Dots */}
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            {pipeline.map((s) => {
              const status = statuses[s.key];
              const isActive = status === 'active';
              const isDone = status === 'done';
              return (
                <div key={s.key} style={{
                  height: '6px', width: isActive ? '45px' : '10px',
                  borderRadius: '3px', background: isActive ? '#fff' : isDone ? '#10b981' : 'rgba(255,255,255,0.2)',
                  transition: 'all 0.6s ease', position: 'relative', overflow: 'hidden'
                }}>
                  {isActive && <div style={{
                    position: 'absolute', inset: 0, background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)',
                    animation: 'shimmer-move 2s infinite'
                  }} />}
                </div>
              );
            })}
          </div>

          {/* Status Info */}
          <div style={{ textAlign: 'center' }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 20px',
              backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '30px', border: '1px solid rgba(255,255,255,0.1)',
              marginBottom: '15px'
            }}>
              <span style={{ color: '#fff', fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px' }}>
                {message}
              </span>
            </div>
            <div style={{ height: '24px' }}>
              <p key={tipIndex} style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', fontStyle: 'italic', margin: 0, animation: 'tip-fade 5s infinite' }}>
                " {LOADING_TIPS[tipIndex]} "
              </p>
            </div>
          </div>
        </div>

      </div>

      <style>{`
        @keyframes blob-move {
          0% { transform: translate(0, 0) scale(1); }
          100% { transform: translate(60px, -40px) scale(1.15); }
        }
        @keyframes slideFadeUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes shimmer-move {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        @keyframes tip-fade {
          0% { opacity: 0; filter: blur(5px); }
          10%, 90% { opacity: 1; filter: blur(0); }
          100% { opacity: 0; filter: blur(5px); }
        }
      `}</style>
    </div>
  );

  return createPortal(overlay, document.body);
};
