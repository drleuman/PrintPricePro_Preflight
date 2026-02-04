import { t } from "../i18n";
import React, { forwardRef, useRef, useState, DragEvent, ChangeEvent, useImperativeHandle } from "react";
import { PreflightDropzoneRef } from "./PreflightDropzone";

type Mode = "magic" | "manual";

type Props = {
  mode: Mode;
  setMode: (m: Mode) => void;

  // Dropzone state
  fileName?: string;
  fileSizeLabel?: string;
  hasFile: boolean;

  // Dropzone actions
  onPickFile: () => void;
  onRemoveFile: () => void;
  onFileDrop?: (file: File | null) => void;

  // Continue
  onContinue: () => void;
  canContinue: boolean;
};

const I = {
  Sparkles: (p: { className?: string }) => (
    <svg className={p.className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 3V5M12 19V21M3 12H5M19 12H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.4" />
      <path d="M12 8L10 11L7 12L10 13L12 16L14 13L17 12L14 11L12 8Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  Sliders: (p: { className?: string }) => (
    <svg className={p.className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 21v-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 10V3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 21v-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 8V3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M20 21v-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M20 12V3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M1 14h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 8h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M17 16h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  Shield: (p: { className?: string }) => (
    <svg className={p.className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  File: (p: { className?: string }) => (
    <svg className={p.className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13 2v7h7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  Check: (p: { className?: string }) => (
    <svg className={p.className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  Magic: (p: { className?: string }) => (
    <svg className={p.className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 2a2 2 0 0 0-2 2v5H4a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h5v5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2v-5h5a2 2 0 0 0 2-2v-2a2 2 0 0 0-2-2h-5V4a2 2 0 0 0-2-2h-2z" opacity="0.1" />
      <path d="m13 10 6-6M13 14l6 6M10 11 4 5M10 13l-6 6" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
};

export const UploadStepSimple = forwardRef<PreflightDropzoneRef, Props>(({
  mode,
  setMode,
  fileName,
  fileSizeLabel,
  hasFile,
  onPickFile,
  onRemoveFile,
  onFileDrop,
  onContinue,
  canContinue,
}, ref) => {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useImperativeHandle(ref, () => ({
    openFileDialog: () => {
      inputRef.current?.click();
    }
  }));

  const handleFile = (file: File | null | undefined) => {
    if (!file) {
      onFileDrop?.(null);
      return;
    }

    if (file.type !== 'application/pdf') {
      alert('Please select a PDF file');
      return;
    }

    onFileDrop?.(file);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    handleFile(file);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragging) setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    handleFile(file);
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-6 py-8" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>

      {/* Premium Header Container */}
      <div className="relative mb-12 text-center">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-blue-400/10 blur-[100px] rounded-full -z-10" />

        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/50 backdrop-blur-md border border-gray-200 shadow-sm mb-6">
          <span className="text-xs font-bold text-blue-600 uppercase tracking-widest">{t('safeProcessing')}</span>
          <I.Shield className="h-3.5 w-3.5 text-blue-500" />
        </div>

        <h1 className="text-4xl md:text-5xl font-black text-gray-900 tracking-tight mb-4">
          {t('headerUploadTitle')}
        </h1>
        <p className="text-lg text-gray-500 font-medium max-w-2xl mx-auto">
          {t('headerUploadSubset')}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

        {/* LEFT/TOP: THE DROPZONE (The Gatekeeper) */}
        <div className="lg:col-span-12 xl:col-span-5 h-full">
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={onPickFile}
            className={`
                    relative group cursor-pointer h-full min-h-[400px]
                    rounded-[3rem] p-4 transition-all duration-500
                    ${isDragging ? 'scale-[0.98]' : 'scale-100'}
                `}
          >
            {/* Background Layer with Glass and Glow */}
            <div className={`
                    absolute inset-0 rounded-[2.8rem] border-2 border-dashed transition-all duration-500 shadow-2xl
                    ${isDragging
                ? 'bg-blue-50/80 border-blue-400 shadow-blue-200/50'
                : hasFile
                  ? 'bg-emerald-50/50 border-emerald-300 shadow-emerald-100/50'
                  : 'bg-white/80 border-gray-200 shadow-gray-200/30'
              }
                `} />

            <div className="relative h-full flex flex-col items-center justify-center text-center p-8">
              {!hasFile ? (
                <>
                  <div className="mb-8 relative">
                    <div className="absolute inset-0 bg-blue-500/20 blur-2xl rounded-full scale-0 group-hover:scale-150 transition-transform duration-700" />
                    <div className="relative w-24 h-24 rounded-[2.5rem] bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-[0_20px_40px_-10px_rgba(37,99,235,0.4)] group-hover:-translate-y-2 transition-transform duration-500">
                      <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
                      </svg>
                    </div>
                  </div>

                  <div className="mb-10">
                    <h3 className="text-3xl font-black text-gray-900 mb-2">{t('dragAndDropModern')}</h3>
                    <p className="text-gray-400 font-medium italic">{t('magicWait')}</p>
                  </div>

                  <div className="flex flex-col items-center gap-6">
                    <div className="px-10 py-4 bg-gray-900 hover:bg-black text-white rounded-full font-bold text-lg shadow-xl hover:shadow-2xl hover:scale-105 transition-all duration-300">
                      {t('browseFiles')}
                    </div>
                    <span className="text-[11px] font-black text-gray-300 uppercase tracking-widest">{t('pdfLimit')}</span>
                  </div>
                </>
              ) : (
                <div className="animate-in fade-in zoom-in duration-500">
                  <div className="mb-8 relative flex justify-center">
                    <div className="absolute inset-0 bg-emerald-500/20 blur-3xl rounded-full" />
                    <div className="relative w-32 h-32 rounded-[3.5rem] bg-gradient-to-br from-emerald-400 to-teal-500 text-white flex items-center justify-center shadow-[0_25px_50px_-12px_rgba(16,185,129,0.5)] border-4 border-white mb-4">
                      <I.File className="h-14 w-14" />
                      <div className="absolute -bottom-2 -right-2 w-10 h-10 rounded-full bg-white flex items-center justify-center text-emerald-500 shadow-xl">
                        <I.Check className="h-6 w-6" />
                      </div>
                    </div>
                  </div>

                  <h2 className="text-3xl font-black text-gray-900 mb-2 truncate max-w-[320px]">{fileName}</h2>
                  <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-emerald-50 rounded-full border border-emerald-100 text-emerald-700 font-bold text-sm mb-10">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    {fileSizeLabel || t('readyForAnalysis')}
                  </div>

                  <button
                    onClick={(e) => { e.stopPropagation(); onPickFile(); }}
                    className="block mx-auto text-sm font-bold text-gray-400 hover:text-red-500 transition-colors"
                  >
                    {t('changeFile')}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT: WORKFLOW CHOICES (The Intelligence) */}
        <div className="lg:col-span-12 xl:col-span-7 space-y-6">
          <div className="bg-white/80 backdrop-blur-xl rounded-[3rem] p-10 border border-gray-100 shadow-2xl shadow-gray-200/50">
            <div className="mb-8">
              <h2 className="text-2xl font-black text-gray-900 mb-1">{t('chooseWorkflow')}</h2>
              <p className="text-gray-500 font-medium">
                {hasFile ? t('recommendMagicHint') : t('uploadToContinue')}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Magic Card */}
              <div
                onClick={() => setMode('magic')}
                className={`
                            relative cursor-pointer p-8 rounded-[2.5rem] border-2 transition-all duration-500 group overflow-hidden h-full
                            ${mode === 'magic'
                    ? 'border-emerald-500 bg-emerald-50/30 shadow-2xl shadow-emerald-200/50'
                    : 'border-gray-100 bg-gray-50/50 hover:border-emerald-200 hover:bg-white'
                  }
                        `}
              >
                {/* Selection Visuals */}
                <div className={`
                            absolute top-6 right-6 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-500
                            ${mode === 'magic' ? 'bg-emerald-500 text-white scale-100' : 'bg-gray-200 text-transparent scale-50'}
                         `}>
                  <I.Check className="h-5 w-5" />
                </div>

                <div className={`
                            w-16 h-16 rounded-[1.5rem] mb-6 flex items-center justify-center transition-all duration-500
                            ${mode === 'magic'
                    ? 'bg-emerald-600 text-white shadow-xl shadow-emerald-500/40 rotate-6'
                    : 'bg-white text-emerald-600 shadow-inner group-hover:scale-110'
                  }
                         `}>
                  <I.Sparkles className="h-10 w-10" />
                </div>

                <div className="relative">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-xl font-black text-gray-900">{t('aiMagicFix')}</h3>
                    <span className="px-2.5 py-1 rounded-full bg-emerald-200 text-emerald-800 text-[10px] font-black uppercase tracking-wider animate-pulse">
                      {t('recommended')}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 mb-6 font-medium leading-relaxed">
                    {t('aiMagicFixDesc')}
                  </p>

                  <ul className="space-y-3">
                    {[t('magicPoint1'), t('magicPoint2'), t('magicPoint3')].map((p, i) => (
                      <li key={i} className="flex items-center gap-3 text-xs font-semibold text-gray-600">
                        <div className={`w-1.5 h-1.5 rounded-full ${mode === 'magic' ? 'bg-emerald-400' : 'bg-gray-300'}`} />
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Manual Card */}
              <div
                onClick={() => setMode('manual')}
                className={`
                            relative cursor-pointer p-8 rounded-[2.5rem] border-2 transition-all duration-500 group overflow-hidden h-full
                            ${mode === 'manual'
                    ? 'border-indigo-500 bg-indigo-50/30 shadow-2xl shadow-indigo-200/50'
                    : 'border-gray-100 bg-gray-50/50 hover:border-indigo-200 hover:bg-white'
                  }
                        `}
              >
                <div className={`
                            absolute top-6 right-6 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-500
                            ${mode === 'manual' ? 'bg-indigo-500 text-white scale-100' : 'bg-gray-200 text-transparent scale-50'}
                         `}>
                  <I.Check className="h-5 w-5" />
                </div>

                <div className={`
                            w-16 h-16 rounded-[1.5rem] mb-6 flex items-center justify-center transition-all duration-500
                            ${mode === 'manual'
                    ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-500/40 rotate-6'
                    : 'bg-white text-indigo-600 shadow-inner group-hover:scale-110'
                  }
                         `}>
                  <I.Sliders className="h-10 w-10" />
                </div>

                <div className="relative">
                  <h3 className="text-xl font-black text-gray-900 mb-2">{t('manualMode')}</h3>
                  <p className="text-sm text-gray-500 mb-6 font-medium leading-relaxed">
                    {t('manualModeDesc')}
                  </p>

                  <div className="pt-4 border-t border-gray-200/50">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-loose">
                      {t('manualControlTip') || 'FULL CONTROL OVER INDIVIDUAL FIXES AND COLOR PROFILES.'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer Insight */}
            <div className="mt-10 flex items-center justify-between border-t border-gray-100 pt-8">
              <div className="flex items-center gap-4 text-xs font-bold text-gray-400 uppercase tracking-widest">
                <div className="flex items-center gap-1.5 p-2 px-3 rounded-xl bg-blue-50 text-blue-600">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {t('processingTimeVal')}
                </div>
                <span className="opacity-50">•</span>
                <span className="text-[10px]">{t('tempProcessNote')}</span>
              </div>

              <button
                onClick={onContinue}
                disabled={!canContinue}
                className={`
                            group px-12 py-5 rounded-full font-black text-lg transition-all duration-500 flex items-center gap-3
                            ${canContinue
                    ? 'bg-gradient-to-r from-red-600 to-rose-500 text-white shadow-2xl shadow-red-500/30 hover:scale-105 active:scale-95'
                    : 'bg-gray-100 text-gray-300 cursor-not-allowed shadow-none'
                  }
                        `}
              >
                {t('continue')}
                {canContinue && <svg className="w-6 h-6 transform group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        style={{ display: 'none' }}
        onChange={handleChange}
      />

      <style>{`
        @keyframes blob-move {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(20px, -20px) scale(1.1); }
        }
      `}</style>
    </div>
  );
});