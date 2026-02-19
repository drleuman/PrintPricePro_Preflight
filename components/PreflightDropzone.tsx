import React, {
  useRef,
  useState,
  DragEvent,
  ChangeEvent,
  forwardRef,
  useImperativeHandle,
} from 'react';
import { t, useLocale } from '../i18n';
import type { FileMeta } from '../types';

type Props = {
  onDrop: (file: File | null) => void;
};

export interface PreflightDropzoneRef {
  openFileDialog: () => void;
}

export function formatBytes(bytes?: number, locale: string = 'en'): string {
  if (!bytes || bytes <= 0) return '';

  const formatter = new Intl.NumberFormat(locale, {
    maximumFractionDigits: 1,
  });

  if (bytes < 1024) return formatter.format(bytes) + 'B';
  if (bytes < 1024 * 1024) return formatter.format(bytes / 1024) + 'KB';
  if (bytes < 1024 * 1024 * 1024) return formatter.format(bytes / (1024 * 1024)) + 'MB';
  return formatter.format(bytes / (1024 * 1024 * 1024)) + 'GB';
}

const Icon = {
  File: (p: { className?: string }) => (
    <svg className={p.className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M7 3h7l3 3v15a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M14 3v4h4" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    </svg>
  ),
  Upload: (p: { className?: string }) => (
    <svg className={p.className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 4v12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7 9l5-5 5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  Check: (p: { className?: string }) => (
    <svg className={p.className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M8.5 12.2l2.3 2.3L15.8 9.5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  Alert: (p: { className?: string }) => (
    <svg className={p.className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 9v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M12 17h.01" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <path d="M10.3 4.6a2 2 0 0 1 3.4 0l8 13.9A2 2 0 0 1 20 21H4a2 2 0 0 1-1.7-2.5l8-13.9Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  ),
};

export const PreflightDropzone = forwardRef<PreflightDropzoneRef, Props>(
  ({ onDrop }, ref) => {
    const { currentLocale } = useLocale();
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
        const msg = currentLocale === 'es'
          ? 'Por favor sube un archivo PDF válido.'
          : 'Please upload a valid PDF file.';
        setError(msg);
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

    // Minimalist container style
    const containerClass = hasFile
      ? 'border-emerald-200 bg-emerald-50/40 ring-1 ring-emerald-600/10'
      : isDragging
        ? 'border-red-400 bg-red-50 ring-4 ring-red-100'
        : 'border-gray-300 bg-white hover:border-gray-400 hover:bg-gray-50/50';

    const selectedLabel = currentLocale === 'es' ? 'PDF seleccionado' : 'PDF selected';
    const changeLabel = currentLocale === 'es' ? 'Cambiar' : 'Change';

    return (
      <div className="w-full">
        <div
          className={[
            'relative w-full',
            'border-2 border-dashed rounded-3xl',
            containerClass,
            'transition-all duration-200 ease-in-out',
            hasFile ? 'px-5 py-5' : 'px-8 py-12', // Spacious padding for empty state
            'cursor-pointer select-none',
            'focus:outline-none focus:ring-2 focus:ring-emerald-500/30',
          ].join(' ')}
          role="button"
          tabIndex={0}
          aria-label="Upload PDF"
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
            <div className="flex flex-col items-center text-center justify-center">
              {/* Minimal Icon */}
              <div className="mb-4 text-gray-400">
                <Icon.Upload className="h-10 w-10 mx-auto" />
                <div className="w-8 h-px bg-gray-300 mx-auto mt-2"></div>
              </div>

              {/* Main Text */}
              <p className="text-base text-gray-500 font-medium">
                <span className="text-red-600 font-semibold border-b border-transparent hover:border-red-600 transition-colors">
                  {currentLocale === 'es' ? 'Haz clic para subir' : 'Click to upload'}
                </span>
                {' '}
                {currentLocale === 'es' ? 'o arrastra y suelta' : 'or drag and drop'}
              </p>

              {/* Subtext */}
              <p className="mt-3 text-[10px] font-bold tracking-widest text-gray-400 uppercase">
                {currentLocale === 'es' ? 'SOLO SOPORTA PDF' : 'ONLY PDF SUPPORTED'}
              </p>
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
                      {formatBytes(fileMeta.size, currentLocale)} · PDF
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
                  <span className="inline-flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-full border border-gray-200 bg-white text-gray-700">
                    <Icon.Check className="h-3 w-3 text-emerald-600" />
                    {currentLocale === 'es' ? 'Listo para análisis' : 'Ready for analysis'}
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-full border border-gray-200 bg-white text-gray-700">
                    <Icon.Check className="h-3 w-3 text-emerald-600" />
                    {currentLocale === 'es' ? 'Mejor con AI Magic Fix' : 'Best with AI Magic Fix'}
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

        {/* Inline error */}
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
