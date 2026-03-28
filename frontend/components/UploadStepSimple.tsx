import { t } from "../i18n";
import React, { forwardRef, useRef, useState, DragEvent, ChangeEvent, useImperativeHandle } from "react";
import { PreflightDropzoneRef } from "./PreflightDropzone";

type Mode = "magic" | "manual";

type Props = {
  mode: Mode;
  setMode: (m: Mode) => void;
  fileName?: string;
  fileSizeLabel?: string;
  hasFile: boolean;
  onPickFile: () => void;
  onRemoveFile: () => void;
  onFileDrop?: (file: File | null) => void;
  onContinue: () => void;
  canContinue: boolean;
  selectedPolicy?: string;
  onPolicyChange?: (p: string) => void;
  policies?: { slug: string; name: string }[];
};

const I = {
  Sparkles: (p: { style?: React.CSSProperties }) => (
    <svg style={p.style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3V5M12 19V21M3 12H5M19 12H21" opacity="0.4" />
      <path d="M12 8L10 11L7 12L10 13L12 16L14 13L17 12L14 11L12 8Z" />
    </svg>
  ),
  Sliders: (p: { style?: React.CSSProperties }) => (
    <svg style={p.style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" />
    </svg>
  ),
  Shield: (p: { style?: React.CSSProperties }) => (
    <svg style={p.style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  ),
  File: (p: { style?: React.CSSProperties }) => (
    <svg style={p.style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM13 2v7h7" />
    </svg>
  ),
  Check: (p: { style?: React.CSSProperties }) => (
    <svg style={p.style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6L9 17l-5-5" />
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
  selectedPolicy,
  onPolicyChange,
  policies = [],
}, ref) => {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useImperativeHandle(ref, () => ({
    openFileDialog: () => { inputRef.current?.click(); }
  }));

  const handleFile = (file: File | null | undefined) => {
    if (!file) { onFileDrop?.(null); return; }
    if (file.type !== 'application/pdf') { alert('Please select a PDF file'); return; }
    onFileDrop?.(file);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault(); e.stopPropagation(); setIsDragging(false);
    handleFile(e.dataTransfer.files?.[0]);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault(); e.stopPropagation(); if (!isDragging) setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault(); e.stopPropagation(); setIsDragging(false);
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    handleFile(e.target.files?.[0]);
  };

  return (
    <div style={{ width: '100%', maxWidth: '1280px', margin: '0 auto', padding: '0 20px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>

      {/* Header removed for single view adjustment */}


      {/* Main Grid Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '32px', alignItems: 'stretch' }}>

        {/* Dropzone Column */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={onPickFile}
          className="dropzone-hover"
          style={{
            background: isDragging ? '#fef2f2' : hasFile ? '#f0fdf4' : '#fff',
            borderRadius: '48px',
            border: `3px dashed ${isDragging ? '#dc0000' : hasFile ? '#10b981' : '#e5e7eb'}`,
            padding: '40px',
            cursor: 'pointer',
            transition: 'all 0.4s ease',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            minHeight: '450px',
            boxShadow: '0 20px 50px rgba(0,0,0,0.04)',
            position: 'relative',
            overflow: 'hidden'
          }}
        >
          {!hasFile ? (
            <>
              <div style={{
                width: '110px', height: '110px', borderRadius: '35px',
                background: 'linear-gradient(135deg, #dc0000, #b90000)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', marginBottom: '32px', boxShadow: '0 20px 40px -10px rgba(220,0,0,0.4)',
                animation: 'float 3s ease-in-out infinite'
              }}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
                </svg>
              </div>
              <h3 style={{ fontSize: '28px', fontWeight: 900, color: '#111827', margin: '0 0 8px' }}>{t('dragAndDropModern')}</h3>
              <p style={{ fontSize: '15px', color: '#9ca3af', fontWeight: 500, fontStyle: 'italic', marginBottom: '40px' }}>{t('magicWait')}</p>

              <div style={{
                padding: '16px 40px', background: '#111827', color: '#fff',
                borderRadius: '50px', fontWeight: 800, fontSize: '17px',
                boxShadow: '0 10px 20px rgba(0,0,0,0.1)', transition: 'all 0.3s'
              }}>
                {t('browseFiles')}
              </div>
              <span style={{ marginTop: '20px', fontSize: '11px', fontWeight: 900, color: '#d1d5db', textTransform: 'uppercase', letterSpacing: '2px' }}>
                {t('pdfLimit')}
              </span>
            </>
          ) : (
            <div style={{ animation: 'zoomIn 0.5s ease' }}>
              <div style={{
                width: '140px', height: '140px', borderRadius: '50px',
                background: 'linear-gradient(135deg, #10b981, #059669)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', marginBottom: '32px', boxShadow: '0 25px 50px -12px rgba(16,185,129,0.5)',
                border: '6px solid #fff', position: 'relative'
              }}>
                <I.File style={{ width: '60px', height: '60px' }} />
                <div style={{
                  position: 'absolute', bottom: '-10px', right: '-10px',
                  width: '45px', height: '45px', borderRadius: '50%',
                  background: '#fff', color: '#10b981', display: 'flex',
                  alignItems: 'center', justifyContent: 'center', boxShadow: '0 10px 20px rgba(0,0,0,0.1)'
                }}>
                  <I.Check style={{ width: '24px', height: '24px' }} />
                </div>
              </div>
              <h3 style={{ fontSize: '24px', fontWeight: 900, color: '#111827', margin: '0 0 12px', maxWidth: '300px', wordBreak: 'break-all' }}>{fileName}</h3>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: '8px',
                padding: '8px 20px', background: '#dcfce7', borderRadius: '50px',
                color: '#15803d', fontWeight: 800, fontSize: '13px', marginBottom: '40px'
              }}>
                {fileSizeLabel || t('readyForAnalysis')}
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); onPickFile(); }}
                style={{ display: 'block', margin: '0 auto', fontSize: '13px', fontWeight: 800, color: '#9ca3af', border: 'none', background: 'none' }}
              >
                {t('changeFile')}
              </button>
            </div>
          )}
        </div>

        {/* Workflow Choices Column */}
        <div style={{
          background: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(20px)',
          borderRadius: '48px', border: '1px solid #f3f4f6', padding: '40px',
          boxShadow: '0 30px 60px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column'
        }}>
          <h2 style={{ fontSize: '22px', fontWeight: 900, color: '#111827', margin: '0 0 8px' }}>{t('chooseWorkflow')}</h2>
          <p style={{ fontSize: '15px', color: '#6b7280', fontWeight: 500, marginBottom: '32px' }}>
            {hasFile ? t('recommendMagicHint') : t('uploadToContinue')}
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', flex: 1 }}>

            {/* Magic Option */}
            <div
              onClick={() => setMode('magic')}
              style={{
                padding: '28px', borderRadius: '32px', border: `2px solid ${mode === 'magic' ? '#10b981' : '#f3f4f6'}`,
                background: mode === 'magic' ? '#f0fdf4' : '#fff', cursor: 'pointer',
                transition: 'all 0.3s ease', position: 'relative', overflow: 'hidden'
              }}
            >
              <div style={{ display: 'flex', gap: '20px' }}>
                <div style={{
                  width: '64px', height: '64px', borderRadius: '20px',
                  background: mode === 'magic' ? '#10b981' : '#f3f4f6',
                  color: mode === 'magic' ? '#fff' : '#10b981',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <I.Sparkles style={{ width: '32px', height: '32px' }} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                    <h4 style={{ fontSize: '18px', fontWeight: 900, color: '#111827', margin: 0 }}>{t('aiMagicFix')}</h4>
                    <span style={{ padding: '4px 10px', borderRadius: '50px', background: '#dcfce7', color: '#166534', fontSize: '10px', fontWeight: 900, textTransform: 'uppercase' }}>
                      {t('recommended')}
                    </span>
                  </div>
                  <p style={{ fontSize: '13px', color: '#6b7280', fontWeight: 500, margin: '0 0 16px' }}>{t('aiMagicFixDesc')}</p>
                  {mode === 'magic' && (
                    <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                      {[t('magicPoint1'), t('magicPoint2')].map((txt, i) => (
                        <li key={i} style={{ fontSize: '11px', fontWeight: 800, color: '#166534', display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }} />
                          {txt}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
              {mode === 'magic' && <div style={{ position: 'absolute', top: '15px', right: '15px' }}><I.Check style={{ width: '18px', height: '18px', color: '#10b981' }} /></div>}
            </div>

            {/* Manual Option */}
            <div
              onClick={() => setMode('manual')}
              style={{
                padding: '28px', borderRadius: '32px', border: `2px solid ${mode === 'manual' ? '#dc0000' : '#f3f4f6'}`,
                background: mode === 'manual' ? '#fef2f2' : '#fff', cursor: 'pointer',
                transition: 'all 0.3s ease', position: 'relative'
              }}
            >
              <div style={{ display: 'flex', gap: '20px' }}>
                <div style={{
                  width: '64px', height: '64px', borderRadius: '20px',
                  background: mode === 'manual' ? '#dc0000' : '#f3f4f6',
                  color: mode === 'manual' ? '#fff' : '#dc0000',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <I.Sliders style={{ width: '32px', height: '32px' }} />
                </div>
                <div>
                  <h4 style={{ fontSize: '18px', fontWeight: 900, color: '#111827', margin: '0 0 4px' }}>{t('manualMode')}</h4>
                  <p style={{ fontSize: '13px', color: '#6b7280', fontWeight: 500, margin: 0 }}>{t('manualModeDesc')}</p>
                </div>
              </div>
              {mode === 'manual' && <div style={{ position: 'absolute', top: '15px', right: '15px' }}><I.Check style={{ width: '18px', height: '18px', color: '#dc0000' }} /></div>}
            </div>

            {/* Policy Selector (only if magic/ai mode) */}
            {mode === 'magic' && policies.length > 0 && (
              <div style={{ marginTop: '10px' }}>
                <label style={{ fontSize: '12px', fontWeight: 900, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '1px', display: 'block', marginBottom: '10px' }}>
                  Target Production Profile
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px' }}>
                  {policies.map(p => (
                    <div
                      key={p.slug}
                      onClick={() => onPolicyChange?.(p.slug)}
                      style={{
                        padding: '12px 20px',
                        borderRadius: '16px',
                        border: `1px solid ${selectedPolicy === p.slug ? '#10b981' : '#e5e7eb'}`,
                        background: selectedPolicy === p.slug ? '#f0fdf4' : '#fff',
                        fontSize: '13px',
                        fontWeight: 700,
                        color: selectedPolicy === p.slug ? '#166534' : '#374151',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        transition: 'all 0.2s'
                      }}
                    >
                      {p.name}
                      {selectedPolicy === p.slug && <I.Check style={{ width: '14px', height: '14px' }} />}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Action Bar */}
          <div style={{ marginTop: '40px', paddingTop: '30px', borderTop: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: '#fef2f2', color: '#dc0000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
              <div>
                <p style={{ margin: 0, fontSize: '10px', fontWeight: 900, color: '#9ca3af', textTransform: 'uppercase' }}>{t('processingTimeVal')}</p>
                <p style={{ margin: 0, fontSize: '11px', fontWeight: 700, color: '#6b7280' }}>{t('tempProcessNote')}</p>
              </div>
            </div>

            <button
              onClick={onContinue}
              disabled={!canContinue}
              style={{
                padding: '18px 45px', borderRadius: '50px', fontSize: '18px', fontWeight: 900,
                background: canContinue ? 'linear-gradient(135deg, #ef4444, #e11d48)' : '#f3f4f6',
                color: canContinue ? '#fff' : '#d1d5db', border: 'none', cursor: canContinue ? 'pointer' : 'not-allowed',
                display: 'flex', alignItems: 'center', gap: '12px', boxShadow: canContinue ? '0 15px 30px rgba(225,29,72,0.3)' : 'none',
                transition: 'all 0.3s ease'
              }}
            >
              {t('continue')}
              {canContinue && <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>}
            </button>
          </div>
        </div>
      </div>

      <input ref={inputRef} type="file" accept="application/pdf" style={{ display: 'none' }} onChange={handleChange} />

      <style>{`
        @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
        @keyframes zoomIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        .dropzone-hover:hover { transform: translateY(-5px) scale(1.01); box-shadow: 0 30px 60px rgba(0,0,0,0.08); border-color: #3b82f6 !important; }
      `}</style>
    </div>
  );
});