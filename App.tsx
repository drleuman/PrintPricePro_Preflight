import React, { useCallback, useEffect, useRef, useState } from 'react';
import Header from './components/Header';
import { PreflightDropzone } from './components/PreflightDropzone';
import { PreflightSummary } from './components/PreflightSummary';
import { IssuesPanel } from './components/IssuesPanel';
import { PageViewer } from './components/PageViewer';
import { FixDrawer } from './components/FixDrawer';
import { AIAuditModal } from './components/AIAuditModal';
import { EfficiencyAuditModal } from './components/EfficiencyAuditModal';

import { t } from './i18n';
import {
  FileMeta,
  Issue,
  PreflightResult,
} from './types';
import { usePreflightWorker } from './hooks/usePreflightWorker';
import { usePdfTools } from './hooks/usePdfTools';

export default function App() {
  // ---------- Main state ----------
  const [file, setFile] = useState<File | null>(null);
  const [fileMeta, setFileMeta] = useState<FileMeta | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [result, setResult] = useState<PreflightResult | null>(null);
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);

  // AI (drawer)
  const [aiAuditOpen, setAiAuditOpen] = useState(false);
  const [efficiencyOpen, setEfficiencyOpen] = useState(false);
  const [issueForAudit, setIssueForAudit] = useState<Issue | null>(null);

  // UI flags
  // Combined running state is derived later, but we keep track for UI
  const [lastPdfUrl, setLastPdfUrl] = useState<string | null>(null);
  const [lastPdfName, setLastPdfName] = useState<string | null>(null);
  const lastPdfUrlRef = useRef<string | null>(null);

  // ---------- Helpers ----------

  const cleanupUrl = useCallback(() => {
    if (lastPdfUrlRef.current) {
      try {
        URL.revokeObjectURL(lastPdfUrlRef.current);
      } catch (e) { }
      lastPdfUrlRef.current = null;
    }
  }, []);

  useEffect(() => {
    return cleanupUrl;
  }, [cleanupUrl]);

  const downloadAndRemember = useCallback((blob: Blob, filename: string) => {
    cleanupUrl();

    const url = URL.createObjectURL(blob);
    lastPdfUrlRef.current = url;
    setLastPdfUrl(url);
    setLastPdfName(filename);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename || 'output.pdf';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }, [cleanupUrl]);

  const updateFileState = useCallback((newFile: File, newMeta: FileMeta) => {
    setFile(newFile);
    setFileMeta(newMeta);
    setResult(null);
    setSelectedIssue(null);
    setNumPages(0);
    setCurrentPage(1);
  }, []);

  // ---------- Hooks ----------

  // Worker callbacks
  const onAnalysisResult = useCallback((res: PreflightResult) => {
    setResult(res || null);
  }, []);

  const onTransformResult = useCallback((blob: Blob, meta: FileMeta, operation: string) => {
    // Determine info based on operation
    const opLabel = operation === 'grayscale' ? 'B&W / Grayscale' : 'Rebuild ≥150 dpi';

    updateFileState(new File([blob], meta.name, { type: 'application/pdf' }), meta);
    downloadAndRemember(blob, meta.name);

    window.alert(`Your ${opLabel} PDF is ready (processed client-side) and has been downloaded.`);
  }, [updateFileState, downloadAndRemember]);

  const onWorkerError = useCallback((msg: string) => {
    console.error('Worker error:', msg);
    window.alert('Operation failed: ' + msg);
  }, []);

  const {
    isWorkerRunning,
    runAnalysis,
    runClientGrayscale,
    runClientUpscale
  } = usePreflightWorker({
    onAnalysisResult,
    onTransformResult,
    onError: onWorkerError
  });

  const {
    isServerRunning,
    convertToGrayscaleServer,
    convertRgbToCmykServer,
    rebuildPdfServer
  } = usePdfTools();

  const isRunning = isWorkerRunning || isServerRunning;

  // ---------- Handlers ----------

  const onDropFile = useCallback((f: File | null) => {
    setFile(f);
    setResult(null);
    setSelectedIssue(null);
    setNumPages(0);
    setCurrentPage(1);

    if (f) {
      setFileMeta({ name: f.name, size: f.size, type: f.type });
    } else {
      setFileMeta(null);
    }
  }, []);

  // Run Preflight
  const runPreflight = useCallback(() => {
    if (!file || !fileMeta) return;
    setResult(null);
    setSelectedIssue(null);
    runAnalysis(file, fileMeta);
  }, [file, fileMeta, runAnalysis]);

  // B&W / Grayscale
  const convertToGrayscale = useCallback(async () => {
    if (!file || !fileMeta) return;
    setResult(null);
    setSelectedIssue(null);

    try {
      // Try Server
      const blob = await convertToGrayscaleServer(file);
      const newName = file.name.replace(/\.pdf$/i, '') + '_bw.pdf';
      const newFile = new File([blob], newName, { type: 'application/pdf' });

      downloadAndRemember(blob, newName);
      updateFileState(newFile, { name: newName, size: blob.size, type: 'application/pdf' });

    } catch (e) {
      console.warn('Server grayscale failed:', e);
      // Fallback
      if (window.confirm(
        'Server method unavailable. Do you want to use the local fallback?\n\n' +
        'WARNING: This will rasterize text (convert to image), making it unselectable and potentially lower quality.'
      )) {
        runClientGrayscale(file, fileMeta);
      }
    }
  }, [file, fileMeta, convertToGrayscaleServer, downloadAndRemember, updateFileState, runClientGrayscale]);

  // Rebuild ≥150 dpi
  const upscaleLowResImages = useCallback(async () => {
    if (!file || !fileMeta) return;
    setResult(null);
    setSelectedIssue(null);

    try {
      // Try Server
      const blob = await rebuildPdfServer(file, 150);
      const newName = file.name.replace(/\.pdf$/i, '') + '_rebuild_150dpi.pdf';
      const newFile = new File([blob], newName, { type: 'application/pdf' });

      downloadAndRemember(blob, newName);
      updateFileState(newFile, { name: newName, size: blob.size, type: 'application/pdf' });

    } catch (e) {
      console.warn('Server rebuild failed:', e);
      // Fallback
      if (window.confirm(
        'Server method unavailable. Do you want to use the local fallback?\n\n' +
        'WARNING: This will rasterize text (convert to image) and rebuild the PDF from images.'
      )) {
        runClientUpscale(file, fileMeta);
      }
    }
  }, [file, fileMeta, rebuildPdfServer, downloadAndRemember, updateFileState, runClientUpscale]);

  // RGB → CMYK (Server Only)
  const convertRgbToCmyk = useCallback(async () => {
    if (!file) return;
    setResult(null);
    setSelectedIssue(null);

    try {
      const blob = await convertRgbToCmykServer(file);
      const newName = file.name.replace(/\.pdf$/i, '') + '_cmyk.pdf';
      const newFile = new File([blob], newName, { type: 'application/pdf' });

      downloadAndRemember(blob, newName);
      updateFileState(newFile, { name: newName, size: blob.size, type: 'application/pdf' });

    } catch (e) {
      console.error('convertRgbToCmyk failed', e);
      window.alert('RGB → CMYK conversion requires server connection. Please try again later.');
    }
  }, [file, convertRgbToCmykServer, downloadAndRemember, updateFileState]);


  const onPageChange = useCallback((p: number) => setCurrentPage(p), []);

  const openIssue = useCallback((issue: Issue) => {
    setSelectedIssue(issue);
    if (typeof issue.page === 'number' && issue.page > 0) {
      setCurrentPage(issue.page);
    }
  }, []);

  const handleOpenAIAudit = useCallback((issue: Issue) => {
    setIssueForAudit(issue);
    setAiAuditOpen(true);
  }, []);

  const handleOpenEfficiencyTips = useCallback((issue: Issue) => {
    setIssueForAudit(issue);
    setEfficiencyOpen(true);
  }, []);

  // ---------- Render ----------
  return (
    <div className="min-h-screen bg-gray-100">
      <main className="container mx-auto px-4 py-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200/70 px-4 sm:px-6 py-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* LEFT COLUMN */}
            <div className="space-y-6 lg:col-span-4">
              <PreflightDropzone onDrop={onDropFile} />

              {/* ACTIONS */}
              <div className="ppp-actions">
                <button
                  className="ppp-action ppp-action--run"
                  onClick={runPreflight}
                  disabled={!file || isRunning}
                  title="Analyze the PDF and list issues"
                >
                  <span className="ppp-action__icon" aria-hidden>🔎</span>
                  <span className="ppp-action__label">
                    Run Preflight
                    <span className="ppp-action__subtitle">Analyze & detect issues</span>
                  </span>
                </button>

                <button
                  className="ppp-action ppp-action--bw"
                  onClick={convertToGrayscale}
                  disabled={!file || isRunning}
                  title="Convert the document to grayscale"
                >
                  <span className="ppp-action__icon" aria-hidden>⚫️</span>
                  <span className="ppp-action__label">
                    B&amp;W / Grayscale
                    <span className="ppp-action__subtitle">Convert pages to grayscale</span>
                  </span>
                </button>

                <button
                  className="ppp-action ppp-action--cmyk"
                  onClick={convertRgbToCmyk}
                  disabled={!file || isRunning}
                  title="Convert RGB content to CMYK"
                >
                  <span className="ppp-action__icon" aria-hidden>🎨</span>
                  <span className="ppp-action__label">
                    RGB → CMYK
                    <span className="ppp-action__subtitle">Convert colors for print</span>
                  </span>
                </button>

                <button
                  className="ppp-action ppp-action--rebuild"
                  onClick={upscaleLowResImages}
                  disabled={!file || isRunning}
                  title="Rebuild PDF to ensure images are at least 150 DPI"
                >
                  <span className="ppp-action__icon" aria-hidden>🛠️</span>
                  <span className="ppp-action__label">
                    Rebuild ≥150 dpi
                    <span className="ppp-action__subtitle">Rebuild/export with safer DPI</span>
                  </span>
                </button>
              </div>


              {lastPdfUrl && (
                <div className="ppp-download-last">
                  <a
                    href={lastPdfUrl}
                    download={lastPdfName || 'output.pdf'}
                    className="ppp-download-last__link"
                  >
                    Download last PDF
                  </a>
                  {lastPdfName ? (
                    <span className="ppp-download-last__name">{lastPdfName}</span>
                  ) : null}
                </div>
              )}

              <IssuesPanel
                result={result}
                onSelectIssue={openIssue}
                emptyHint={t('noIssuesToDisplay')}
                onRunPreflight={runPreflight}
                isRunning={isRunning}
              />

              <PreflightSummary
                fileMeta={fileMeta}
                result={result}
                onRunPreflight={runPreflight}
                isRunning={isRunning}
              />
            </div>

            {/* RIGHT COLUMN */}
            <div className="lg:col-span-8 sticky top-6 self-start">
              <PageViewer
                file={file}
                numPages={numPages}
                currentPage={currentPage}
                onPageChange={onPageChange}
                onNumPagesChange={setNumPages}
                selectedIssue={selectedIssue}
              />
            </div>
          </div>
        </div>
      </main>

      <FixDrawer
        issue={selectedIssue}
        onClose={() => setSelectedIssue(null)}
        onOpenAIAudit={handleOpenAIAudit}
        onOpenEfficiencyTips={handleOpenEfficiencyTips}
      />
      <AIAuditModal
        isOpen={aiAuditOpen}
        onClose={() => setAiAuditOpen(false)}
        issue={issueForAudit}
        fileMeta={fileMeta}
        result={result}
      />
      <EfficiencyAuditModal
        isOpen={efficiencyOpen}
        onClose={() => setEfficiencyOpen(false)}
        issue={issueForAudit}
        fileMeta={fileMeta}
        result={result}
      />
    </div>
  );
}
