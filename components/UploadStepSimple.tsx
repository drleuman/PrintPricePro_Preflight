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
    <div className={p.className}>
      ✨
    </div>
  ),
  Sliders: (p: { className?: string }) => (
    <div className={p.className}>
      ⚙️
    </div>
  ),
  Shield: (p: { className?: string }) => (
    <div className={p.className}>
      🛡️
    </div>
  ),
  File: (p: { className?: string }) => (
    <div className={p.className}>
      📄
    </div>
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
            Upload your PDF
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Choose <span className="font-semibold text-gray-900">AI Magic Fix</span> (recommended) or{" "}
            <span className="font-semibold text-gray-900">Manual</span>.
          </p>
        </div>

        <div className="hidden md:flex items-center gap-2 text-xs text-gray-500">
          <I.Shield className="h-4 w-4" />
          Safe & temporary processing
        </div>
      </div>

      {/* 2-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
        {/* LEFT: Dropzone */}
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          {/* Header */}
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="text-sm font-semibold text-gray-900">Your file</div>

            <button
              type="button"
              onClick={onPickFile}
              className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
            >
              Select file
            </button>
          </div>

          {/* Dropzone */}
          <div className="px-5 py-5 bg-gradient-to-b from-gray-50 to-white">
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={onPickFile}
              role="button"
              tabIndex={0}
              className={[
                "rounded-2xl border-2 border-dashed px-6 py-8 cursor-pointer select-none transition-all duration-200",
                "flex flex-col items-center text-center",
                isDragging
                  ? "border-emerald-300 bg-emerald-50 ring-2 ring-emerald-600/10"
                  : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50/40",
              ].join(" ")}
            >
              {!hasFile ? (
                <>
                  {/* Icon chip */}
                  <div className="h-12 w-12 rounded-2xl bg-gray-900/5 border border-gray-200 flex items-center justify-center">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className="text-gray-700">
                      <path d="M12 16V7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                      <path d="M8.5 10.5 12 7l3.5 3.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M7 17a4 4 0 0 1 0-8 5.5 5.5 0 0 1 10.7-1.6A4.5 4.5 0 1 1 18.5 17H7Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
                    </svg>
                  </div>

                  <div className="mt-3 text-sm font-semibold text-gray-900">
                    Drag & drop your PDF here
                  </div>

                  <div className="mt-1 text-sm text-gray-600">
                    or{" "}
                    <span className="inline-flex items-center">
                      <button
                        type="button"
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onPickFile(); }}
                        className="ml-1 inline-flex items-center justify-center px-3 py-1.5 rounded-xl bg-gray-900 text-white text-xs font-semibold hover:bg-gray-800 transition-colors"
                      >
                        Browse files
                      </button>
                    </span>
                  </div>

                  <div className="mt-3 text-xs text-gray-500">
                    PDF · up to ~50 MB
                  </div>
                </>
              ) : (
                <div className="flex items-start gap-4 w-full">
                  <div className="h-12 w-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                    <I.File className="h-6 w-6" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-gray-900 truncate">
                      {fileName}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {fileSizeLabel || "Ready"}
                    </div>
                    <div className="mt-3 text-xs text-gray-500">
                      Next: we'll analyze your PDF and prepare a print-ready output.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); onPickFile(); }}
                    className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-xl bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
                  >
                    Change
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Footer bar */}
          <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-between gap-3">
            <div className="text-xs text-gray-500">Typical processing: 10–60s</div>

            <button
              type="button"
              disabled={!canContinue}
              onClick={onContinue}
              className={[
                "px-4 py-2 rounded-xl text-sm font-semibold transition",
                canContinue
                  ? "bg-gray-900 text-white hover:bg-gray-800"
                  : "bg-gray-200 text-gray-400 cursor-not-allowed",
              ].join(" ")}
            >
              Continue
            </button>
          </div>
        </div>

        {/* RIGHT: Workflow (two simple cards) */}
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-4">
          <div className="text-sm font-semibold text-gray-900">Choose workflow</div>
          <div className="text-xs text-gray-500 mt-1">
            {hasFile ? "We recommend Magic Fix for most users." : "Upload a PDF to continue."}
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3">
            {/* Magic Fix (black box) */}
            <button
              type="button"
              onClick={() => setMode("magic")}
              className={`relative text-left rounded-2xl border p-4 transition-all duration-300 ease-out group overflow-hidden ${
                mode === "magic"
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
                  <div className={`h-11 w-11 rounded-2xl flex items-center justify-center shadow-sm transition-all duration-300 ${
                    mode === "magic"
                      ? "bg-emerald-600 text-white shadow-emerald-200/50 scale-110"
                      : "bg-emerald-600 text-white group-hover:scale-105 group-hover:shadow-md"
                  }`}>
                    <I.Sparkles className={`h-6 w-6 transition-transform duration-300 ${
                      mode === "magic" ? "scale-110" : "group-hover:scale-105"
                    }`} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <div className={`text-sm font-semibold transition-colors duration-300 ${
                        mode === "magic" ? "text-emerald-900" : "text-gray-900 group-hover:text-emerald-800"
                      }`}>AI Magic Fix</div>
                      <span className={`text-[11px] font-semibold px-2 py-1 rounded-full transition-all duration-300 ${
                        mode === "magic"
                          ? "text-emerald-800 bg-emerald-200 shadow-sm"
                          : "text-emerald-700 bg-emerald-100 group-hover:bg-emerald-150"
                      }`}>
                        Recommended
                      </span>
                    </div>
                    <p className={`text-xs mt-1 transition-colors duration-300 ${
                      mode === "magic" ? "text-emerald-700" : "text-gray-600 group-hover:text-emerald-600"
                    }`}>
                      One click. We handle everything automatically.
                    </p>

                    {/* Simple human bullets */}
                    <ul className="mt-3 space-y-2 text-xs text-gray-600">
                      <li className="flex items-start gap-2">
                        <span className={`mt-1 h-1.5 w-1.5 rounded-full transition-colors duration-300 ${
                          mode === "magic" ? "bg-emerald-500" : "bg-emerald-600 group-hover:bg-emerald-500"
                        }`} />
                        Fixes the most common print problems
                      </li>
                      <li className="flex items-start gap-2">
                        <span className={`mt-1 h-1.5 w-1.5 rounded-full transition-colors duration-300 ${
                          mode === "magic" ? "bg-emerald-500" : "bg-emerald-600 group-hover:bg-emerald-500"
                        }`} />
                        Produces a print-ready PDF you can download
                      </li>
                      <li className="flex items-start gap-2">
                        <span className={`mt-1 h-1.5 w-1.5 rounded-full transition-colors duration-300 ${
                          mode === "magic" ? "bg-emerald-500" : "bg-emerald-600 group-hover:bg-emerald-500"
                        }`} />
                        No technical knowledge required
                      </li>
                    </ul>
                  </div>
                </div>

                <div className="mt-0.5">
                  {mode === "magic" ? (
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-600 text-white shadow-lg shadow-emerald-200/50 animate-pulse">
                      ✓
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
              className={`relative text-left rounded-2xl border p-4 transition-all duration-300 ease-out group overflow-hidden ${
                mode === "manual"
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
                  <div className={`h-11 w-11 rounded-2xl flex items-center justify-center shadow-sm transition-all duration-300 ${
                    mode === "manual"
                      ? "bg-indigo-600 text-white shadow-indigo-200/50 scale-110"
                      : "bg-indigo-600 text-white group-hover:scale-105 group-hover:shadow-md"
                  }`}>
                    <I.Sliders className={`h-6 w-6 transition-transform duration-300 ${
                      mode === "manual" ? "scale-110" : "group-hover:scale-105"
                    }`} />
                  </div>
                  <div>
                    <div className={`text-sm font-semibold transition-colors duration-300 ${
                      mode === "manual" ? "text-indigo-900" : "text-gray-900 group-hover:text-indigo-800"
                    }`}>Manual</div>
                    <p className={`text-xs mt-1 transition-colors duration-300 ${
                      mode === "manual" ? "text-indigo-700" : "text-gray-600 group-hover:text-indigo-600"
                    }`}>
                      For advanced users who want to review issues and choose fixes.
                    </p>
                  </div>
                </div>

                <div className="mt-0.5">
                  {mode === "manual" ? (
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-white shadow-lg shadow-indigo-200/50 animate-pulse">
                      ✓
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
            We process your file temporarily and clean it up automatically.
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