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

  const borderClass = isDragging ? 'border-red-400 bg-red-50/50' : hasFile ? 'border-emerald-200 bg-emerald-50/50' : 'border-gray-200 bg-white';

  return (
    <div className="w-full max-w-6xl mx-auto px-4">
      {/* Header (compact, no pills) */}
      <div className="mt-6 mb-4 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-gray-900">
            {t('headerUploadTitle')}
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            {t('headerUploadSubset')}
          </p>
        </div>

        <div className="hidden md:flex items-center gap-2 text-xs text-gray-500">
          <I.Shield className="h-4 w-4" />
          {t('safeProcessing')}
        </div>
      </div>

      {/* 2-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
        {/* LEFT: Dropzone (Modernized) */}
        <div className="rounded-3xl bg-white/80 backdrop-blur-xl shadow-xl shadow-gray-200/50 overflow-hidden flex flex-col h-full transition-all duration-300 hover:shadow-2xl hover:shadow-gray-200/60">

          {/* Dropzone Area */}
          <div className="flex-1 p-5 flex flex-col">
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={onPickFile}
              role="button"
              tabIndex={0}
              className={[
                "relative flex-1 rounded-2xl border-2 border-dashed transition-all duration-300 ease-in-out group",
                "flex flex-col items-center justify-center text-center p-8",
                isDragging
                  ? "border-blue-500 bg-blue-50/50 shadow-inner ring-4 ring-blue-500/20 scale-[0.99]"
                  : "border-gray-200 bg-gray-50/30 hover:border-blue-400 hover:bg-blue-50/10 hover:shadow-lg hover:shadow-blue-500/5 hover:-translate-y-0.5",
              ].join(" ")}
            >
              {!hasFile ? (
                <>
                  {/* Modern Animated Icon */}
                  <div className="relative mb-6 group-hover:scale-110 transition-transform duration-300 ease-out">
                    <div className="absolute inset-0 bg-blue-500/20 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    <div className="relative h-20 w-20 rounded-3xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/30 flex items-center justify-center">
                      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" className="drop-shadow-sm">
                        <path d="M12 16.5V7.5M12 7.5L8.5 11M12 7.5L15.5 11" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M6 19.5H18" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                        {/* Cloud shape subtle */}
                        <path d="M5.5 15.5A4.5 4.5 0 0 1 5.4 6.5A5.5 5.5 0 0 1 16.1 4.5A4.5 4.5 0 0 1 18.5 15.5" stroke="currentColor" strokeWidth="2" strokeOpacity="0.3" strokeLinecap="round" fill="none" />
                      </svg>
                    </div>
                    {/* Floating pill */}
                    <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-white px-3 py-1 rounded-full shadow-md border border-gray-100 text-[10px] font-bold uppercase tracking-wider text-blue-600 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0">
                      {t('uploadPdf')}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-xl font-bold text-gray-900 tracking-tight group-hover:text-blue-600 transition-colors">
                      {t('dragAndDropModern')}
                    </h3>
                    <p className="text-sm text-gray-400 font-medium">
                      {t('magicWait')}
                    </p>
                  </div>

                  <div className="mt-8 flex flex-col items-center gap-4">
                    <span className="relative">
                      <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 opacity-20 blur transition duration-200 group-hover:opacity-40" />
                      <button
                        type="button"
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onPickFile(); }}
                        className="relative flex items-center gap-2 px-8 py-3 rounded-full bg-gray-900 text-white text-sm font-bold shadow-xl shadow-gray-200 hover:bg-black hover:scale-105 transition-all duration-200 active:scale-95"
                      >
                        <span>{t('browseFiles')}</span>
                        <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                      </button>
                    </span>
                    <p className="text-[10px] uppercase tracking-widest font-bold text-gray-300">
                      {t('pdfLimit')}
                    </p>
                  </div>
                </>
              ) : (
                <div className="w-full flex flex-col items-center justify-center animate-in fade-in zoom-in duration-300">
                  <div className="relative mb-6">
                    <div className="absolute inset-0 bg-emerald-500/20 blur-2xl rounded-full" />
                    <div className="relative h-24 w-24 rounded-[2rem] bg-gradient-to-br from-emerald-400 to-teal-500 text-white shadow-2xl shadow-emerald-500/40 flex items-center justify-center ring-4 ring-white">
                      <I.File className="h-10 w-10" />
                      <div className="absolute -bottom-2 -right-2 h-8 w-8 rounded-full bg-white flex items-center justify-center shadow-lg text-emerald-600">
                        <I.Check className="h-5 w-5" />
                      </div>
                    </div>
                  </div>

                  <h3 className="text-2xl font-bold text-gray-900 tracking-tight text-center px-4 leading-tight">
                    {fileName}
                  </h3>

                  <div className="mt-2 inline-flex items-center gap-2 px-3 py-1 bg-emerald-50 rounded-full border border-emerald-100">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-xs font-semibold text-emerald-700">{fileSizeLabel || t('readyForAnalysis')}</span>
                  </div>

                  <div className="mt-8">
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); onPickFile(); }}
                      className="text-xs font-bold text-gray-400 hover:text-gray-600 hover:underline transition-colors"
                    >
                      {t('changeFile')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer bar */}
          <div className="px-6 py-5 bg-gray-50/50 border-t border-gray-100 flex items-center justify-between gap-4 backdrop-blur-sm">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] uppercase tracking-wider font-bold text-gray-400">{t('processingTime')}</span>
                <span className="text-xs font-bold text-gray-700">{t('processingTimeVal')}</span>
              </div>
            </div>

            <button
              type="button"
              disabled={!canContinue}
              onClick={onContinue}
              className={[
                "px-8 py-3 rounded-xl text-sm font-bold shadow-lg transition-all duration-200 flex items-center gap-2",
                canContinue
                  ? "bg-gradient-to-r from-red-600 to-red-500 text-white hover:from-red-700 hover:to-red-600 hover:scale-105 hover:shadow-red-500/30"
                  : "bg-gray-100 text-gray-400 cursor-not-allowed shadow-none",
              ].join(" ")}
            >
              <span>{t('continue')}</span>
              {canContinue && (
                <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* RIGHT: Workflow (two simple cards) */}
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-4">
          <div className="text-sm font-semibold text-gray-900">{t('chooseWorkflow')}</div>
          <div className="text-xs text-gray-500 mt-1">
            {hasFile ? t('recommendMagicHint') : t('uploadToContinue')}
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3">
            {/* Magic Fix (black box) */}
            <button
              type="button"
              onClick={() => setMode("magic")}
              className={`relative text-left rounded-2xl border p-4 transition-all duration-300 ease-out group overflow-hidden ${mode === "magic"
                ? "border-emerald-300 bg-gradient-to-b from-emerald-50/80 to-emerald-25/40 shadow-lg shadow-emerald-100/50 ring-2 ring-emerald-200/30 scale-[1.02]"
                : "border-gray-200 hover:border-emerald-200 hover:shadow-md hover:shadow-emerald-50/50 bg-white hover:scale-[1.01] hover:bg-gradient-to-b hover:from-emerald-25/20 hover:to-white"
                }`}
            >
              {/* Subtle background glow for selected state */}
              {mode === "magic" && (
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-400/5 to-transparent rounded-2xl" />
              )}

              <div className="relative flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className={`h-11 w-11 rounded-2xl flex items-center justify-center shadow-sm transition-all duration-300 ${mode === "magic"
                    ? "bg-emerald-600 text-white shadow-emerald-200/50 scale-110"
                    : "bg-emerald-600 text-white group-hover:scale-105 group-hover:shadow-md"
                    }`}>
                    <I.Sparkles className={`h-6 w-6 transition-transform duration-300 ${mode === "magic" ? "scale-110" : "group-hover:scale-105"
                      }`} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <div className={`text-sm font-semibold transition-colors duration-300 ${mode === "magic" ? "text-emerald-900" : "text-gray-900 group-hover:text-emerald-800"
                        }`}>{t('aiMagicFix')}</div>
                      <span className={`text-[11px] font-semibold px-2 py-1 rounded-full transition-all duration-300 ${mode === "magic"
                        ? "text-emerald-800 bg-emerald-200 shadow-sm"
                        : "text-emerald-700 bg-emerald-100 group-hover:bg-emerald-150"
                        }`}>
                        {t('recommended')}
                      </span>
                    </div>
                    <p className={`text-xs mt-1 transition-colors duration-300 ${mode === "magic" ? "text-emerald-700" : "text-gray-600 group-hover:text-emerald-600"
                      }`}>
                      {t('aiMagicFixDesc')}
                    </p>

                    {/* Simple human bullets */}
                    <ul className="mt-3 space-y-2 text-xs text-gray-600">
                      <li className="flex items-start gap-2">
                        <span className={`mt-1 h-1.5 w-1.5 rounded-full transition-colors duration-300 ${mode === "magic" ? "bg-emerald-500" : "bg-emerald-600 group-hover:bg-emerald-500"
                          }`} />
                        {t('magicPoint1')}
                      </li>
                      <li className="flex items-start gap-2">
                        <span className={`mt-1 h-1.5 w-1.5 rounded-full transition-colors duration-300 ${mode === "magic" ? "bg-emerald-500" : "bg-emerald-600 group-hover:bg-emerald-500"
                          }`} />
                        {t('magicPoint2')}
                      </li>
                      <li className="flex items-start gap-2">
                        <span className={`mt-1 h-1.5 w-1.5 rounded-full transition-colors duration-300 ${mode === "magic" ? "bg-emerald-500" : "bg-emerald-600 group-hover:bg-emerald-500"
                          }`} />
                        {t('magicPoint3')}
                      </li>
                    </ul>
                  </div>
                </div>

                <div className="mt-0.5">
                  {mode === "magic" ? (
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-600 text-white shadow-lg shadow-emerald-200/50 animate-pulse">
                      <I.Check className="h-5 w-5" />
                    </span>
                  ) : (
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-400 group-hover:bg-emerald-100 group-hover:text-emerald-500 transition-all duration-300 group-hover:scale-110">
                      •
                    </span>
                  )}
                </div>
              </div>
            </button>

            {/* Manual */}
            <button
              type="button"
              onClick={() => setMode("manual")}
              className={`relative text-left rounded-2xl border p-4 transition-all duration-300 ease-out group overflow-hidden ${mode === "manual"
                ? "border-indigo-300 bg-gradient-to-b from-indigo-50/80 to-indigo-25/40 shadow-lg shadow-indigo-100/50 ring-2 ring-indigo-200/30 scale-[1.02]"
                : "border-gray-200 hover:border-indigo-200 hover:shadow-md hover:shadow-indigo-50/50 bg-white hover:scale-[1.01] hover:bg-gradient-to-b hover:from-indigo-25/20 hover:to-white"
                }`}
            >
              {/* Subtle background glow for selected state */}
              {mode === "manual" && (
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-400/5 to-transparent rounded-2xl" />
              )}

              <div className="relative flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className={`h-11 w-11 rounded-2xl flex items-center justify-center shadow-sm transition-all duration-300 ${mode === "manual"
                    ? "bg-indigo-600 text-white shadow-indigo-200/50 scale-110"
                    : "bg-indigo-600 text-white group-hover:scale-105 group-hover:shadow-md"
                    }`}>
                    <I.Sliders className={`h-6 w-6 transition-transform duration-300 ${mode === "manual" ? "scale-110" : "group-hover:scale-105"
                      }`} />
                  </div>
                  <div>
                    <div className={`text-sm font-semibold transition-colors duration-300 ${mode === "manual" ? "text-indigo-900" : "text-gray-900 group-hover:text-indigo-800"
                      }`}>{t('manualMode')}</div>
                    <p className={`text-xs mt-1 transition-colors duration-300 ${mode === "manual" ? "text-indigo-700" : "text-gray-600 group-hover:text-indigo-600"
                      }`}>
                      {t('manualModeDesc')}
                    </p>
                  </div>
                </div>

                <div className="mt-0.5">
                  {mode === "manual" ? (
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-white shadow-lg shadow-indigo-200/50 animate-pulse">
                      <I.Check className="h-5 w-5" />
                    </span>
                  ) : (
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-400 group-hover:bg-indigo-100 group-hover:text-indigo-500 transition-all duration-300 group-hover:scale-110">
                      •
                    </span>
                  )}
                </div>
              </div>
            </button>
          </div>

          <div className="mt-4 text-[11px] text-gray-400 leading-relaxed">
            {t('tempProcessNote')}
          </div>
        </div>
      </div>

      <div className="h-4" />

      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        style={{ display: 'none' }}
        onChange={handleChange}
      />
    </div>
  );
});