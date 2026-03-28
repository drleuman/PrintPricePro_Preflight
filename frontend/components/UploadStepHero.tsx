import React from "react";
import { WorkflowPicker } from "./WorkflowPicker";

type Mode = "magic" | "manual";

type Props = {
  fileName?: string;
  fileSizeLabel?: string;
  mode: Mode;
  onModeChange: (m: Mode) => void;

  // Dropzone hooks (conecta tu dropzone actual)
  onPickFile?: () => void;
  onRemoveFile?: () => void;

  // CTA
  canContinue: boolean;
  onContinue: () => void;

  // Custom dropzone content (optional)
  dropzoneContent?: React.ReactNode;
};

export const UploadStepHero: React.FC<Props> = ({
  fileName,
  fileSizeLabel,
  mode,
  onModeChange,
  onPickFile,
  onRemoveFile,
  canContinue,
  onContinue,
  dropzoneContent,
}) => {
  const hasFile = !!fileName;

  return (
    <div className="w-full max-w-6xl mx-auto px-4">
      {/* Compact header */}
      <div className="mt-4 mb-4 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-gray-900">
            Upload your PDF
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Prepare a print-ready file in minutes. Choose AI Magic Fix or a manual workflow.
          </p>

          {/* Trust chips */}
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-1 rounded-full">
              ISO Coated v2 (recommended)
            </span>
            <span className="text-[11px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-1 rounded-full">
              3mm bleed support
            </span>
            <span className="text-[11px] font-semibold text-gray-700 bg-gray-50 border border-gray-100 px-2 py-1 rounded-full">
              150 DPI min · 300 best
            </span>
          </div>
        </div>

        {/* Small helper */}
        <div className="hidden md:block text-right">
          <div className="text-xs text-gray-500">Step 1 of 4</div>
          <div className="text-xs text-gray-400 mt-1">Upload → Analysis → Fix → Review</div>
        </div>
      </div>

      {/* Two-column fold */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 items-stretch">
        {/* Left: Dropzone compact */}
        <div className="lg:col-span-3">
          <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <div className="text-sm font-semibold text-gray-900">PDF Dropzone</div>
              {hasFile ? (
                <button
                  type="button"
                  onClick={onRemoveFile}
                  className="text-xs font-semibold text-gray-500 hover:text-gray-800"
                >
                  Remove
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onPickFile}
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
                >
                  Select file
                </button>
              )}
            </div>

            {/* Replace this area with your real drag&drop zone */}
            <div
              className={[
                "px-5 py-5",
                "bg-gradient-to-b from-gray-50 to-white",
              ].join(" ")}
            >
              {dropzoneContent ? (
                dropzoneContent
              ) : (
                <div
                  className={[
                    "rounded-xl border-2 border-dashed",
                    hasFile ? "border-emerald-200 bg-emerald-50/40" : "border-gray-200 bg-white",
                    "px-5 py-5 cursor-pointer",
                  ].join(" ")}
                  onClick={onPickFile}
                >
                  <div className="flex items-start gap-4">
                    {/* Icon */}
                    <div className="h-11 w-11 rounded-xl bg-gray-900/5 flex items-center justify-center shrink-0">
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className="text-gray-700">
                        <path
                          d="M7 18a4 4 0 0 1 0-8 5.5 5.5 0 0 1 10.7-1.6A4.5 4.5 0 1 1 18.5 18H7Z"
                          stroke="currentColor"
                          strokeWidth="1.7"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </div>

                    <div className="min-w-0 flex-1">
                      {!hasFile ? (
                        <>
                          <div className="text-sm font-semibold text-gray-900">
                            Drag & drop your PDF
                          </div>
                          <div className="text-sm text-gray-600 mt-1">
                            Or{" "}
                            <button
                              type="button"
                              onClick={onPickFile}
                              className="font-semibold text-indigo-600 hover:text-indigo-700"
                            >
                              browse your computer
                            </button>
                            .
                          </div>
                          <div className="text-xs text-gray-400 mt-3">
                            Recommended: PDF/X-4 · fonts embedded · 3mm bleed.
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-gray-900 truncate">
                                {fileName}
                              </div>
                              <div className="text-xs text-gray-500 mt-1">
                                {fileSizeLabel || "Ready for analysis"}
                              </div>
                            </div>
                            <span className="text-xs font-semibold text-emerald-700 bg-emerald-100 px-2 py-1 rounded-full">
                              selected
                            </span>
                          </div>

                          <div className="mt-3 text-xs text-gray-500">
                            Next: choose your workflow → we'll analyze issues and generate a print-ready PDF.
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Bottom actions (compact) */}
            <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-between gap-3">
              <div className="text-xs text-gray-500">
                Supported: PDF files · typical processing 10–60s
              </div>
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
        </div>

        {/* Right: Workflow cards */}
        <div className="lg:col-span-2">
          <WorkflowPicker
            mode={mode}
            onModeChange={onModeChange}
            hasFile={!!fileName}
          />
        </div>
      </div>

      {/* Small spacing to avoid scroll while keeping breathing room */}
      <div className="h-4" />
    </div>
  );
};