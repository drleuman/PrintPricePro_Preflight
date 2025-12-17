import React, { useCallback, useEffect, useRef, useState } from 'react';
import Header from './components/Header';
import { PreflightDropzone } from './components/PreflightDropzone';
import { PreflightSummary } from './components/PreflightSummary';
import { IssuesPanel } from './components/IssuesPanel';
import { PageViewer } from './components/PageViewer';
import { FixDrawer } from './components/FixDrawer';
import { AIAuditModal } from './components/AIAuditModal';
import { EfficiencyAuditModal } from './components/EfficiencyAuditModal';
import { LoaderOverlay } from './components/LoaderOverlay';

import { t } from './i18n';
import {
  FileMeta,
  Issue,
  PreflightResult,
  HeatmapData,
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

  // Visual QA State
  const [visualPageImage, setVisualPageImage] = useState<string | null>(null);
  const [isVisualAudit, setIsVisualAudit] = useState(false);

  // Heatmap State (lifted from PageViewer)
  const [heatmapData, setHeatmapData] = useState<HeatmapData | null>(null);
  const [heatmapLoading, setHeatmapLoading] = useState(false);

  // UI / Loader
  const [processMessage, setProcessMessage] = useState<string | null>(null);

  // UI flags
  // Combined running state is derived later, but we keep track for UI
  const [lastPdfUrl, setLastPdfUrl] = useState<string | null>(null);
  const [lastPdfName, setLastPdfName] = useState<string | null>(null);
  const lastPdfUrlRef = useRef<string | null>(null);
  // State for profile selection
  const [selectedProfile, setSelectedProfile] = useState<string>('cmyk');

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
    setVisualPageImage(null);
  }, []);

  // ---------- Hooks ----------

  // Worker callbacks
  const onAnalysisResult = useCallback((res: PreflightResult) => {
    setResult(res || null);
    setProcessMessage(null);
  }, []);

  const onRenderPageResult = useCallback((base64: string) => {
    // window.alert('Debug: Render result received! Opening modal...');
    setVisualPageImage(base64);
    setAiAuditOpen(true);
    setProcessMessage(null);
  }, []);

  const onTransformResult = useCallback((blob: Blob, meta: FileMeta, operation: string) => {
    setProcessMessage(null);

    // Determine info based on operation
    let opLabel = 'Processed';
    if (operation === 'grayscale') opLabel = 'B&W / Grayscale';
    else if (operation === 'upscaleImages') opLabel = 'Rebuild ≥150 dpi';
    else if (operation === 'fixBleed') opLabel = 'Bleed Fixed';

    updateFileState(new File([blob], meta.name, { type: 'application/pdf' }), meta);
    downloadAndRemember(blob, meta.name);

    window.alert(`Your ${opLabel} PDF is ready (processed client-side) and has been downloaded.`);
  }, [updateFileState, downloadAndRemember]);

  const onWorkerError = useCallback((msg: string) => {
    console.error('Worker error:', msg);
    setHeatmapLoading(false); // Ensure loading stops if it was heatmap
    setProcessMessage(null);
    window.alert('Operation failed: ' + msg);
  }, []);

  const onHeatmapResult = useCallback((data: { values: Uint8Array; width: number; height: number; maxTac: number }) => {
    setHeatmapData(data);
    setHeatmapLoading(false);
    setProcessMessage(null);
  }, []);

  const {
    isWorkerRunning,
    runAnalysis,
    runClientGrayscale,
    runClientUpscale,
    runFixBleed,
    runTacHeatmap,
    runRenderPageAsImage,
  } = usePreflightWorker({
    onAnalysisResult,
    onTransformResult,
    onError: onWorkerError,
    onHeatmapResult,
    onRenderPageResult,
  });

  const {
    isServerRunning,
    convertToGrayscaleServer,
    convertColorServer,
    rebuildPdfServer,
    createBookletClient,
  } = usePdfTools();

  const isRunning = isWorkerRunning || isServerRunning;

  // Clear heatmap when file changes (handled in updateFileState mostly, but specific state here)
  useEffect(() => {
    if (!file) setHeatmapData(null);
  }, [file]);

  // Wrapper for runTacHeatmap to manage loading state in App
  const handleRunHeatmap = useCallback((f: File, meta: FileMeta, page: number) => {
    setHeatmapLoading(true);
    setHeatmapData(null); // Clear previous
    setProcessMessage('Generating Ink Coverage Heatmap...');
    runTacHeatmap(f, meta, page);
  }, [runTacHeatmap]);


  // ---------- Handlers ----------

  const onDropFile = useCallback((f: File | null) => {
    setFile(f);
    setResult(null);
    setSelectedIssue(null);
    setNumPages(0);
    setCurrentPage(1);
    setVisualPageImage(null);

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
    setHeatmapData(null);

    setProcessMessage('Analyzing PDF Structure & Content...');
    runAnalysis(file, fileMeta);
  }, [file, fileMeta, runAnalysis]);

  // Handle Visual Audit
  const handleRunVisualAudit = useCallback(() => {
    if (!file || !fileMeta) {
      window.alert('Debug: No file loaded');
      return;
    }

    // window.alert(`Debug: Starting visual audit for page ${currentPage}`);

    // Clear previous specific issue audit
    setIssueForAudit(null);
    setVisualPageImage(null);
    setIsVisualAudit(true);

    setProcessMessage('Analyzing page visuals (AI Vision)...');
    runRenderPageAsImage(file, fileMeta, currentPage);
  }, [file, fileMeta, currentPage, runRenderPageAsImage]);

  // B&W / Grayscale
  const convertToGrayscale = useCallback(async () => {
    if (!file || !fileMeta) return;
    setResult(null);
    setSelectedIssue(null);

    setProcessMessage('Converting to Grayscale (Server)...');
    try {
      // Try Server
      const blob = await convertToGrayscaleServer(file);
      const newName = file.name.replace(/\.pdf$/i, '') + '_bw.pdf';
      const newFile = new File([blob], newName, { type: 'application/pdf' });

      downloadAndRemember(blob, newName);
      updateFileState(newFile, { name: newName, size: blob.size, type: 'application/pdf' });
      setProcessMessage(null);
    } catch (e) {
      console.warn('Server grayscale failed:', e);
      setProcessMessage(null);

      // Fallback
      if (window.confirm(
        'Server method unavailable. Do you want to use the local fallback?\n\n' +
        'WARNING: This will rasterize text (convert to image), making it unselectable and potentially lower quality.'
      )) {
        setProcessMessage('Converting to Grayscale (Local Fallback)...');
        runClientGrayscale(file, fileMeta);
      }
    }
  }, [file, fileMeta, convertToGrayscaleServer, downloadAndRemember, updateFileState, runClientGrayscale]);

  // Rebuild ≥150 dpi
  const upscaleLowResImages = useCallback(async () => {
    if (!file || !fileMeta) return;
    setResult(null);
    setSelectedIssue(null);

    setProcessMessage('Rebuilding PDF (300 DPI High-Res)...');
    try {
      // Try Server
      const blob = await rebuildPdfServer(file, 300);
      const newName = file.name.replace(/\.pdf$/i, '') + '_rebuild_300dpi.pdf';
      const newFile = new File([blob], newName, { type: 'application/pdf' });

      downloadAndRemember(blob, newName);
      updateFileState(newFile, { name: newName, size: blob.size, type: 'application/pdf' });
      setProcessMessage(null);
    } catch (e) {
      console.warn('Server rebuild failed:', e);
      setProcessMessage(null);

      // Fallback
      if (window.confirm(
        'Server method unavailable. Do you want to use the local fallback?\n\n' +
        '⚠️ WARNING: This will rasterize the entire PDF (convert to images).\n' +
        '• Text will NOT be selectable\n' +
        '• Fonts may appear as boxes/symbols\n' +
        '• File size will increase significantly\n\n' +
        'For best results, use the server method (ensure backend is running).\n\n' +
        'Continue with client-side processing?'
      )) {
        setProcessMessage('Rebuilding PDF (Local Fallback)...');
        runClientUpscale(file, fileMeta);
      }
    }
  }, [file, fileMeta, rebuildPdfServer, downloadAndRemember, updateFileState, runClientUpscale]);

  // Convert Colors (Generic CMYK or Profile)
  const convertColors = useCallback(async () => {
    if (!file) return;
    setResult(null);
    setSelectedIssue(null);

    setProcessMessage(`Converting colors to ${selectedProfile.toUpperCase()}...`);
    try {
      const blob = await convertColorServer(file, selectedProfile);
      const newName = file.name.replace(/\.pdf$/i, '') + `_${selectedProfile}.pdf`;
      const newFile = new File([blob], newName, { type: 'application/pdf' });

      downloadAndRemember(blob, newName);
      updateFileState(newFile, { name: newName, size: blob.size, type: 'application/pdf' });

    } catch (e) {
      console.error('convertColors failed', e);
      window.alert('Color conversion requires server connection. Please try again later.');
    } finally {
      setProcessMessage(null);
    }
  }, [file, selectedProfile, convertColorServer, downloadAndRemember, updateFileState]);

  // Make Booklet
  const makeBooklet = useCallback(async () => {
    if (!file) return;
    setProcessMessage('Creating 2-up Booklet...');
    try {
      // Simulating loading state if we had one for client tools
      const blob = await createBookletClient(file);
      const newName = file.name.replace(/\.pdf$/i, '') + '_booklet.pdf';
      const newFile = new File([blob], newName, { type: 'application/pdf' });

      downloadAndRemember(blob, newName);
      updateFileState(newFile, { name: newName, size: blob.size, type: 'application/pdf' });
      window.alert('Booklet created successfully (2-up saddle stitch implementation).');
    } catch (e) {
      console.error('Booklet creation failed', e);
      window.alert('Booklet creation failed: ' + (e as Error).message);
    } finally {
      setProcessMessage(null);
    }
  }, [file, createBookletClient, downloadAndRemember, updateFileState]);

  const handleFixBleed = useCallback(async () => {
    if (!file || !fileMeta) return;
    setProcessMessage('Applying Bleed Fix...');
    try {
      await runFixBleed(file, fileMeta);
      // Note: cleared in onTransformResult
    } catch (e) {
      console.error('Fix bleed failed', e);
      window.alert('Fix bleed failed: ' + (e as Error).message);
      setProcessMessage(null);
    }
  }, [file, fileMeta, runFixBleed]);


  const onPageChange = useCallback((p: number) => setCurrentPage(p), []);

  const openIssue = useCallback((issue: Issue) => {
    setSelectedIssue(issue);
    if (typeof issue.page === 'number' && issue.page > 0) {
      setCurrentPage(issue.page);
    }
  }, []);

  const handleOpenAIAudit = useCallback((issue: Issue) => {
    setIssueForAudit(issue);
    setVisualPageImage(null);
    setIsVisualAudit(false);
    setAiAuditOpen(true);
  }, []);

  const handleOpenEfficiencyTips = useCallback((issue: Issue) => {
    setIssueForAudit(issue);
    setEfficiencyOpen(true);
  }, []);

  // ---------- Render ----------
  return (
    <div className="min-h-screen bg-gray-100">
      <LoaderOverlay isOpen={!!processMessage} message={processMessage || ''} />

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
                  className="ppp-action ppp-action--ai-visual"
                  onClick={handleRunVisualAudit}
                  disabled={!file || isRunning}
                  title="Analyze current page aesthetics with AI Vision"
                  style={{ background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)', color: 'white' }}
                >
                  <span className="ppp-action__icon" aria-hidden>👁️</span>
                  <span className="ppp-action__label">
                    AI Visual Check
                    <span className="ppp-action__subtitle" style={{ color: 'rgba(255,255,255,0.9)' }}>Analyze Page {currentPage}</span>
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

                <div className="ppp-action-group">
                  <div className="flex flex-col gap-2">
                    <select
                      className="w-full p-3 rounded-lg border border-gray-200 text-sm bg-gray-50 font-medium"
                      defaultValue="cmyk"
                      onChange={(e) => {
                        setSelectedProfile(e.target.value);
                      }}
                    >
                      <option value="cmyk">Generic CMYK</option>
                      <option value="fogra39">Coated FOGRA39 (ISO 12647)</option>
                      <option value="gracol">GRACoL 2006 (Coated)</option>
                      <option value="swop">SWOP Web Coated</option>
                    </select>
                    <button
                      className="ppp-action ppp-action--cmyk"
                      onClick={convertColors}
                      disabled={!file || isRunning}
                      title="Convert colors using selected profile"
                    >
                      <span className="ppp-action__icon" aria-hidden>🎨</span>
                      <span className="ppp-action__label">
                        Convert Colors
                        <span className="ppp-action__subtitle">To {selectedProfile === 'cmyk' ? 'CMYK' : selectedProfile.toUpperCase()}</span>
                      </span>
                    </button>
                  </div>
                </div>

                <button
                  className="ppp-action ppp-action--rebuild"
                  onClick={upscaleLowResImages}
                  disabled={!file || isRunning}
                  title="Rebuild PDF to ensure better quality (300 DPI)"
                >
                  <span className="ppp-action__icon" aria-hidden>🛠️</span>
                  <span className="ppp-action__label">
                    Rebuild High-Res
                    <span className="ppp-action__subtitle">Optimize & Fix Quality (300 dpi)</span>
                  </span>
                </button>

                <button
                  className="ppp-action ppp-action--booklet"
                  onClick={makeBooklet}
                  disabled={!file || isRunning}
                  title="Create a 2-up saddle stitch booklet"
                >
                  <span className="ppp-action__icon" aria-hidden>📖</span>
                  <span className="ppp-action__label">
                    Make Booklet
                    <span className="ppp-action__subtitle">2-up Saddle Stitch</span>
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
                heatmapData={heatmapData}
                onRunHeatmap={handleRunHeatmap}
                isHeatmapLoading={heatmapLoading}
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
        onFixBleed={handleFixBleed}
        isFixing={isRunning}
      />
      <AIAuditModal
        isOpen={aiAuditOpen}
        onClose={() => {
          setAiAuditOpen(false);
          setVisualPageImage(null);
          setIsVisualAudit(false);
        }}
        issue={issueForAudit}
        fileMeta={fileMeta}
        result={result}
        visualImage={visualPageImage}
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
