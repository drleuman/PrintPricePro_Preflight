import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  uploadProgress?: number;
  uploadedBytes?: number;
  totalBytes?: number;
  fixProgress?: number;
};

function formatBytes(n: number): string {
  if (n >= 1_048_576) return `${(n / 1_048_576).toFixed(1)} MB`;
  if (n >= 1_024) return `${Math.round(n / 1_024)} KB`;
  return `${n} B`;
}

const DEFAULT_STEPS: LoaderStep[] = [
  { key: 'upload', title: 'PDF_INGRESS', description: 'Carrier validation and metadata stream.' },
  { key: 'preflight', title: 'FORENSIC_SCAN', description: 'CMYK enforcement and bleed analysis.' },
  { key: 'analyze', title: 'ISSUE_TRIAGE', description: 'Diagnostic classification by severity.' },
  { key: 'fix', title: 'ENGINE_CERTIFICATION', description: 'Applying PPOS deterministic corrections.' },
  { key: 'verify', title: 'INTEGRITY_CHECK', description: 'Final compliance audit.' }
];

const LOADING_TIPS = [
  'Deterministic Core V2: Processing high-compliance print profiles.',
  'Technical Note: CMYK Enforced for professional litho-ready outputs.',
  'Trace Integrity: Each correction is traceable in the final PPOS log.',
  'AutoFix Active: Rendering corrections directly to the PDF carrier.',
];

function computeStatuses(steps: LoaderStep[], stageKey?: string): Record<string, StepStatus> {
  const idx = stageKey ? steps.findIndex((s) => s.key === stageKey) : 0;
  const out: Record<string, StepStatus> = {};
  steps.forEach((s, i) => {
    if (i < idx) out[s.key] = 'done';
    else if (i === idx) out[s.key] = 'active';
    else out[s.key] = 'pending';
  });
  return out;
}

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export const LoaderOverlay: React.FC<Props> = ({
  isOpen,
  message = 'SYSTEM_READY',
  stageKey,
  steps,
  lockUI = true,
  uploadProgress,
  uploadedBytes,
  totalBytes,
  fixProgress,
}) => {
  const [tipIndex, setTipIndex] = useState(0);
  const [visualProgress, setVisualProgress] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [syntheticProgress, setSyntheticProgress] = useState(0);
  const fixStartRef = useRef<number | null>(null);
  const [bffLatency, setBffLatency] = useState<number | null>(null);
  const [crcStatus, setCrcStatus] = useState<'OK' | 'ERR'>('OK');

  const pipeline = useMemo(() => steps ?? DEFAULT_STEPS, [steps]);
  const statuses = useMemo(
    () => computeStatuses(pipeline, isOpen ? stageKey : undefined),
    [pipeline, stageKey, isOpen]
  );

  // Elapsed timer + synthetic fallback for fix stage
  useEffect(() => {
    if (!isOpen || (stageKey !== 'fix' && stageKey !== 'preflight')) {
      fixStartRef.current = null;
      setElapsedSeconds(0);
      setSyntheticProgress(0);
      return;
    }
    fixStartRef.current = Date.now();
    setElapsedSeconds(0);
    setSyntheticProgress(0);

    // Empirical estimate: ~60s for a 1 MB file; cap synthetic advance at 85%
    const estimatedDurationMs = totalBytes ? Math.max(15000, (totalBytes / 1_048_576) * 60_000) : 90_000;

    const tick = setInterval(() => {
      const elapsed = Math.floor((Date.now() - (fixStartRef.current ?? Date.now())) / 1000);
      setElapsedSeconds(elapsed);
      const synthetic = Math.min(85, (elapsed * 1000 / estimatedDurationMs) * 85);
      setSyntheticProgress(Math.round(synthetic));
    }, 1000);

    return () => clearInterval(tick);
  }, [isOpen, stageKey, totalBytes]);

  useEffect(() => {
    if (!isOpen) { setVisualProgress(0); return; }

    // During the upload stage, drive the ring with real byte progress when available
    if (stageKey === 'upload' && uploadProgress !== undefined) {
      setVisualProgress(uploadProgress);
      return;
    }

    const total = pipeline.length;
    const activeIdx = Math.max(0, pipeline.findIndex((s) => statuses[s.key] === 'active'));
    const stageFloor = (activeIdx / total) * 100;
    const target = ((activeIdx + 1) / total) * 100;

    setVisualProgress((prev) => Math.max(prev, stageFloor));

    const interval = setInterval(() => {
      setVisualProgress((prev) => {
        if (prev >= target) return prev;
        if (prev >= target - 0.5) return Math.min(target, prev + 0.05);
        return prev + (target - prev) * 0.1;
      });
    }, 100);
    return () => clearInterval(interval);
  }, [isOpen, stageKey, pipeline, uploadProgress]);

  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => setTipIndex((prev) => (prev + 1) % LOADING_TIPS.length), 4000);
    return () => clearInterval(interval);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !lockUI) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [isOpen, lockUI]);

  useEffect(() => {
    if (!isOpen) return;
    const t0 = performance.now();
    fetch('/healthz')
      .then(r => {
        const lat = Math.round(performance.now() - t0);
        setBffLatency(lat);
        return r.json();
      })
      .then((data: { status?: string }) => {
        setCrcStatus(data?.status === 'READY' ? 'OK' : 'ERR');
      })
      .catch(() => {
        setBffLatency(null);
        setCrcStatus('ERR');
      });
  }, [isOpen]);

  const currentStep = pipeline[Math.max(0, pipeline.findIndex((s) => statuses[s.key] === 'active'))];

  const overlay = (
    <div
      className={`fixed inset-0 z-[99999] flex items-center justify-center bg-[var(--bg-primary)]/95 backdrop-blur-3xl overflow-hidden font-mono text-[var(--text-primary)] transition-opacity duration-150 ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
      aria-hidden={!isOpen}
    >
      
      {/* Monolith Grid Background */}
      <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(var(--accent-color) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

      <div className="relative w-full max-w-2xl px-6 flex flex-col items-center">
        
        {/* Technical Header */}
        <div className="w-full flex items-center justify-between mb-12 border-b border-[var(--border-color)] pb-4">
            <div className="flex items-center gap-3">
                <div className="h-2 w-2 bg-[#dc0000] animate-pulse shadow-[0_0_8px_rgba(220,0,0,0.8)]" />
                <span className="text-[0.7rem] font-black uppercase tracking-[0.3em] text-[#dc0000]">OS_ENGINE_PROCESSING</span>
            </div>
            <span className="text-[0.75rem] font-bold text-[var(--accent-color)]">{Math.floor(visualProgress)}%</span>
        </div>

        {/* Binary Stream Visual (Left) */}
        <div className="absolute left-10 top-1/2 -translate-y-1/2 hidden xl:block opacity-20 text-[0.6rem] space-y-1 select-none pointer-events-none">
            {Array.from({ length: 20 }).map((_, i) => (
                <div key={i} className="animate-pulse" style={{ animationDelay: `${i * 100}ms` }}>
                    {Math.random().toString(2).substring(2, 20)}
                </div>
            ))}
        </div>

        <div className="w-full flex flex-col lg:flex-row gap-12 items-center lg:items-start text-center lg:text-left">
            
            {/* Visual Node */}
            <div className="shrink-0 relative">
                <div className="h-32 w-32 border border-[#dc0000]/30 flex items-center justify-center relative">
                    <div className="absolute inset-0 border border-[#dc0000] scale-x-[1.1] opacity-20" />
                    <div className="absolute inset-0 border border-[#dc0000] scale-y-[1.1] opacity-20" />
                    
                    {/* Spinning Tech Ring */}
                    <svg className="absolute inset-0 w-full h-full rotate-[-90deg]" viewBox="0 0 100 100">
                        <circle cx="50" cy="50" r="48" stroke="rgba(220,0,0,0.1)" strokeWidth="1" fill="none" />
                        <circle 
                            cx="50" cy="50" r="48" 
                            stroke="#dc0000" strokeWidth="2" fill="none" 
                            strokeDasharray="301.59"
                            strokeDashoffset={301.59 - (visualProgress / 100 * 301.59)}
                            className="transition-all duration-700"
                        />
                    </svg>
                    
                    <span className="text-2xl font-black tracking-tighter text-[var(--text-primary)]">V2.4</span>
                </div>
            </div>

            {/* Information Node */}
            <div className="flex-1 space-y-6">
                <div>
                   <h2 className="text-2xl font-black tracking-tighter text-[var(--text-primary)] mb-2 uppercase italic">{currentStep.title}</h2>
                   <p className="text-[0.65rem] text-[var(--text-secondary)] uppercase tracking-[0.2em] font-normal">{currentStep.description}</p>
                </div>

                {/* Upload byte progress — shown only during upload stage with real data */}
                {stageKey === 'upload' && uploadProgress !== undefined && (
                  <div className="space-y-1.5">
                    <div className="w-full h-px bg-[var(--bg-tertiary)] relative overflow-hidden">
                      <div
                        className="absolute inset-y-0 left-0 bg-[#dc0000] shadow-[0_0_6px_rgba(220,0,0,0.5)] transition-all duration-300"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[0.6rem] font-bold uppercase tracking-widest opacity-60">
                      <span>UPLOAD_STREAM</span>
                      <span>
                        {uploadedBytes !== undefined && totalBytes !== undefined
                          ? `${formatBytes(uploadedBytes)} / ${formatBytes(totalBytes)}`
                          : `${uploadProgress}%`}
                      </span>
                    </div>
                  </div>
                )}

                {/* ENGINE_CERTIFICATION / FORENSIC_SCAN progress — floor of real job.progress vs synthetic time estimate.
                    Real takes over when it's ahead; synthetic keeps advancing when PPOS sends sparse updates. */}
                {(stageKey === 'fix' || stageKey === 'preflight') && (
                  (() => {
                    const realLeading = fixProgress > syntheticProgress;
                    const displayPct = realLeading ? fixProgress : syntheticProgress;
                    const label = stageKey === 'fix' ? 'ENGINE_CERTIFICATION' : 'FORENSIC_SCAN';
                    return (
                      <div className="space-y-1.5">
                        <div className="w-full h-px bg-[var(--bg-tertiary)] relative overflow-hidden">
                          <div
                            className={`absolute inset-y-0 left-0 shadow-[0_0_6px_rgba(220,0,0,0.5)] transition-all duration-700 ${realLeading ? 'bg-[#dc0000]' : 'bg-[#dc0000]/60'}`}
                            style={{ width: `${displayPct}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-[0.6rem] font-bold uppercase tracking-widest opacity-60">
                          <span>{label}</span>
                          <span>
                            {realLeading ? `${displayPct}%` : `${formatElapsed(elapsedSeconds)} elapsed`}
                          </span>
                        </div>
                      </div>
                    );
                  })()
                )}

                {/* Technical Log Terminal */}
                <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] p-4 space-y-3 relative">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="h-1 w-1 bg-[#dc0000]" />
                        <span className="text-[0.6rem] font-bold uppercase tracking-widest opacity-60">Log_Stream_Active</span>
                    </div>
                    <div className="space-y-1">
                        <p className="text-[0.7rem] text-[#dc0000] font-black uppercase tracking-widest">{message}</p>
                        <p className="text-[0.65rem] text-[var(--text-muted)] italic">" {LOADING_TIPS[tipIndex]} "</p>
                    </div>
                </div>
                
                {/* Pipeline Progression */}
                <div className="flex gap-2">
                    {pipeline.map((s) => (
                        <div key={s.key} className={`h-1.5 flex-1 transition-all duration-700 ${statuses[s.key] === 'active' ? 'bg-[#dc0000] shadow-[0_0_10px_rgba(220,0,0,0.5)]' : statuses[s.key] === 'done' ? 'bg-[#dc0000]/60' : 'bg-[var(--bg-tertiary)]'}`} />
                    ))}
                </div>
            </div>
        </div>

        {/* Footer Hardware Metadata */}
        <div className="w-full mt-24 border-t border-[var(--border-color)] pt-4 flex justify-between items-center opacity-30 text-[0.6rem] font-bold uppercase tracking-widest">
            <span>Server: PPOS_PROD_BFF</span>
            <span>Lat: {bffLatency !== null ? `${bffLatency}ms` : '—'}</span>
            <span>CRC: {crcStatus}</span>
        </div>
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
};
