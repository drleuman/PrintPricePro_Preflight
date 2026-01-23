import React, {
  useRef,
  useState,
  DragEvent,
  ChangeEvent,
  forwardRef,
  useImperativeHandle,
} from 'react';
import { t } from '../i18n';
import type { FileMeta } from '../types';

type Props = {
  onDrop: (file: File | null) => void;
};

export interface PreflightDropzoneRef {
  openFileDialog: () => void;
}

function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  let b = bytes;
  let i = 0;
  while (b >= 1024 && i < units.length - 1) {
    b /= 1024;
    i++;
  }
  const v = i === 0 ? Math.round(b) : Math.round(b * 10) / 10;
  return `${v} ${units[i]}`;
}

const Icon = {
  File: (p: { className?: string }) => (
    <svg className={p.className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M7 3h7l3 3v15a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/>
      <path d="M14 3v4h4" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/>
    </svg>
  ),
  Upload: (p: { className?: string }) => (
    <svg className={p.className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 16V7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M8.5 10.5 12 7l3.5 3.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M7 17a4 4 0 0 1 0-8 5.5 5.5 0 0 1 10.7-1.6A4.5 4.5 0 1 1 18.5 17H7Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/>
    </svg>
  ),
  Check: (p: { className?: string }) => (
    <svg className={p.className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M8.5 12.2l2.3 2.3L15.8 9.5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  Alert: (p: { className?: string }) => (
    <svg className={p.className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 9v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
      <path d="M12 17h.01" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
      <path d="M10.3 4.6a2 2 0 0 1 3.4 0l8 13.9A2 2 0 0 1 20 21H4a2 2 0 0 1-1.7-2.5l8-13.9Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/>
    </svg>
  ),
};

export const PreflightDropzone = forwardRef<PreflightDropzoneRef, Props>(
  ({ onDrop }, ref) => {
    const [isDragging, setIsDragging] = useState(false);
    const [fileMeta, setFileMeta] = useState<FileMeta | null>(null);
    const [error, setError] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement | null>(null);

    useImperativeHandle(ref, () => ({
      openFileDialog: () => inputRef.current?.click(),
    }));

    const handleFile = (file: File | null | undefined) => {
      setError(null);

      if (!file) {
        setFileMeta(null);
        onDrop(null);
        return;
      }

      if (file.type !== 'application/pdf') {
        setError(t('invalidFileType') || 'Please upload a PDF file.');
        return;
      }

      setFileMeta({ name: file.name, size: file.size, type: file.type });
      onDrop(file);
    };

    const handleDrop = (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      handleFile(e.dataTransfer.files?.[0]);
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
      handleFile(e.target.files?.[0]);
      if (inputRef.current) inputRef.current.value = '';
    };

    const openFileDialog = () => inputRef.current?.click();

    const hasFile = !!fileMeta;

    // ✅ green confirm for dragging/selected
    const containerClass = hasFile
      ? 'border-emerald-200 bg-emerald-50/40 ring-2 ring-emerald-600/10'
      : isDragging
      ? 'border-emerald-300 bg-emerald-50/50 ring-2 ring-emerald-600/10'
      : 'border-gray-200 bg-gray-50';

    const dragLabel = t('dragDropPrompt') || 'Drag & drop your PDF here';
    const orText = t('or') || 'or';
    const browseText = t('browseYourComputer') || 'browse your computer';
    const pdfHint = t('pdfMaxHint') || 'PDF · max ~50 MB';
    const selectedLabel = t('pdfSelected') || 'PDF selected';
    const changeLabel = t('change') || 'Change';
    const tipText = t('uploadTipLargePdf') || 'Tip: large PDFs may take a bit longer.';

    return (
      <div className="w-full">
        <div
          className={[
            'relative w-full',
            'border-2 border-dashed rounded-2xl',
            containerClass,
            'transition-colors',
            'px-5 py-5',
            'cursor-pointer select-none',
            'focus:outline-none focus:ring-2 focus:ring-emerald-500/30',
          ].join(' ')}
          role="button"
          tabIndex={0}
          aria-label={dragLabel}
          aria-describedby="ppp-dropzone-hint ppp-dropzone-error"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={openFileDialog}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') openFileDialog();
          }}
        >
          {hasFile && (
            <div className="absolute top-3 right-3">
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-full border border-emerald-200 bg-white text-emerald-700 shadow-sm">
                <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-emerald-600 text-white">
                  <Icon.Check className="h-3.5 w-3.5" />
                </span>
                {selectedLabel}
              </span>
            </div>
          )}

          {!hasFile ? (
            <div className="flex flex-col items-center text-center">
              <div className="h-12 w-12 rounded-2xl bg-white border border-gray-200 shadow-sm flex items-center justify-center">
                <Icon.Upload className="h-6 w-6 text-gray-700" />
              </div>

              <p className="mt-3 text-sm font-semibold text-gray-900">
                {dragLabel}
              </p>

              <p className="mt-1 text-sm text-gray-600">
                {orText}{' '}
                <span className="font-semibold text-emerald-700">
                  {browseText}
                </span>
              </p>

              <p id="ppp-dropzone-hint" className="mt-3 text-xs text-gray-500">
                {pdfHint}
              </p>

              <div className="mt-3 text-[11px] text-gray-400">
                {tipText}
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-sm shrink-0">
                <Icon.File className="h-6 w-6" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {fileMeta.name}
                    </p>
                    <p className="text-xs text-gray-600 mt-1">
                      {formatBytes(fileMeta.size)} · PDF
                    </p>
                  </div>

                  <button
                    type="button"
                    className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-xl bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      openFileDialog();
                    }}
                  >
                    {changeLabel}
                  </button>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-2 text-[11px] px-2 py-1 rounded-full border border-gray-200 bg-white text-gray-700">
                    ✓ {t('readyForAnalysis') || 'Ready for analysis'}
                  </span>
                  <span className="inline-flex items-center gap-2 text-[11px] px-2 py-1 rounded-full border border-gray-200 bg-white text-gray-700">
                    ✓ {t('bestWithMagicFix') || 'Best with AI Magic Fix'}
                  </span>
                </div>
              </div>
            </div>
          )}

          <input
            ref={inputRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={handleChange}
          />
        </div>

        {/* Inline error (no alerts) */}
        {error && (
          <div
            id="ppp-dropzone-error"
            className="mt-2 flex items-start gap-2 text-sm text-red-700"
          >
            <Icon.Alert className="h-5 w-5 mt-0.5" />
            <span className="text-sm">{error}</span>
          </div>
        )}
      </div>
    );
  }
);
