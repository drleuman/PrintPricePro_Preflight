import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Issue, Bbox, FileMeta, HeatmapData } from '../types';
import { ChevronLeftIcon, ChevronRightIcon, FireIcon, EyeIcon } from '@heroicons/react/24/outline'; // FireIcon for Heatmap
import { t } from '../i18n';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

interface PageViewerProps {
  file: File | null;
  pdfUrl?: string | null; // Optional URL to load PDF from (takes precedence over file)
  numPages: number;
  currentPage: number;
  onPageChange: (page: number) => void;
  onNumPagesChange: (count: number) => void;
  selectedIssue: Issue | null;
  heatmapData: HeatmapData | null;
  onRunHeatmap: (file: File, meta: FileMeta, page: number) => void;
  isHeatmapLoading: boolean;
  onRunVisualCheck?: () => void;
  previewPages?: string[] | null;
  previewLoading?: boolean;
  ldmMode?: boolean;
  ldmJobId?: string | null;
}

export const PageViewer: React.FC<PageViewerProps> = ({
  file,
  pdfUrl,
  numPages,
  currentPage,
  onPageChange,
  onNumPagesChange,
  selectedIssue,
  heatmapData,
  onRunHeatmap,
  isHeatmapLoading,
  onRunVisualCheck,
  previewPages,
  previewLoading,
  ldmMode,
  ldmJobId,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pdfRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);
  const [scale, setScale] = useState(1.5);

  const heatmapLayerRef = useRef<HTMLCanvasElement>(null);

  const drawBbox = useCallback((ctx: CanvasRenderingContext2D, bbox: Bbox, canvasWidth: number, canvasHeight: number) => {
    const x = bbox.x * canvasWidth;
    const y = bbox.y * canvasHeight;
    const width = bbox.width * canvasWidth;
    const height = bbox.height * canvasHeight;

    ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)';
    ctx.lineWidth = 3;
    ctx.fillStyle = 'rgba(255, 0, 0, 0.2)';
    ctx.strokeRect(x, y, width, height);
    ctx.fillRect(x, y, width, height);
  }, []);

  // Effect to load PDF when file or pdfUrl changes
  useEffect(() => {
    const loadPdf = async () => {
      if (ldmMode) return; 
      
      const source = pdfUrl || file;
      if (!source) {
        if (pdfRef.current) {
          pdfRef.current.destroy();
          pdfRef.current = null;
        }
        onNumPagesChange(0);
        return;
      }

      try {
        let loadingTask;
        if (typeof source === 'string') {
          loadingTask = pdfjsLib.getDocument({
            url: source,
            isEvalSupported: false,
          });
        } else {
          const arrayBuffer = await source.arrayBuffer();
          loadingTask = pdfjsLib.getDocument({
            data: new Uint8Array(arrayBuffer),
            isEvalSupported: false,
          });
        }
        
        const pdf = await loadingTask.promise;
        pdfRef.current = pdf;
        onNumPagesChange(pdf.numPages);
        // Do not reset page if it's already set and valid
      } catch (error: any) {
        console.error("[PDF-LOAD-ERROR]", error);
        onNumPagesChange(0);
      }
    };

    loadPdf();

    return () => {
      if (pdfRef.current) {
        pdfRef.current.destroy();
        pdfRef.current = null;
      }
    };
  }, [file, pdfUrl, onNumPagesChange, ldmMode]);

  // Render Page
  useEffect(() => {
    const renderPage = async () => {
      if (ldmMode) return;
      const canvas = canvasRef.current;
      if (!canvas || !pdfRef.current || currentPage < 1 || currentPage > numPages || numPages === 0) {
        if (canvas) {
          const context = canvas.getContext('2d');
          if (context) {
            context.clearRect(0, 0, canvas.width, canvas.height);
          }
        }
        return;
      }

      try {
        const page = await pdfRef.current.getPage(currentPage);
        const viewport = page.getViewport({ scale: scale });
        const context = canvas.getContext('2d');

        if (!context) return;

        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const renderContext = {
          canvasContext: context,
          viewport: viewport,
        };

        await page.render(renderContext).promise;

        if (selectedIssue && selectedIssue.page === currentPage && selectedIssue.bbox) {
          drawBbox(context, selectedIssue.bbox, viewport.width, viewport.height);
        }

      } catch (error) {
        console.error(`Error rendering page ${currentPage}: `, error);
      }
    };

    renderPage();
  }, [currentPage, numPages, scale, selectedIssue, drawBbox]);

  // Logic for heatmap visibility and effects derived from props
  const heatmapVisible = !!heatmapData || isHeatmapLoading;


  // Heatmap Drawing
  useEffect(() => {

    const cvs = heatmapLayerRef.current;
    if (!cvs || !heatmapData) {

      return;
    }

    const ctx = cvs.getContext('2d');
    if (!ctx) return;

    // Resize to match parent (the PDF canvas)
    // canvasRef is the main PDF canvas.
    const mainCanvas = canvasRef.current;
    if (mainCanvas) {
      cvs.width = mainCanvas.width;
      cvs.height = mainCanvas.height;
    }

    // Draw the grid
    if (heatmapData) {
      const { values, width, height, maxTac } = heatmapData;

      ctx.clearRect(0, 0, cvs.width, cvs.height);
      const cellW = cvs.width / width;
      const cellH = cvs.height / height;
      let cellsDrawn = 0;

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const val = values[y * width + x]; // 0-255 mapped from 0-400%
          const tacPercent = (val * 400) / 255;

          if (tacPercent < 280) continue; // Transparency for safe areas? 

          let color = '';
          if (tacPercent >= 300) {
            color = 'rgba(255, 0, 0, 0.6)'; // Red
          } else if (tacPercent >= 280) {
            color = 'rgba(255, 200, 0, 0.5)'; // Yellow
          }

          if (color) {
            ctx.fillStyle = color;
            ctx.fillRect(x * cellW, y * cellH, cellW + 0.5, cellH + 0.5);
            cellsDrawn++;
          }
        }
      }
    }
  }, [heatmapData]);

  // Handle worker messages for heatmap manually?
  // No, I need to update usePreflightWorker to allow me to subscribe.
  // OR I can use the `onAnalysisResult` callback prop? No, that's different type.
  // I will go and update usePreflightWorker to accept `onHeatmapResult` prop.
  // THIS IS CRITICAL.




  const handlePrevPage = useCallback(() => {
    if (currentPage > 1) {
      onPageChange(currentPage - 1);
    }
  }, [currentPage, onPageChange]);

  const handleNextPage = useCallback(() => {
    if (currentPage < numPages) {
      onPageChange(currentPage + 1);
    }
  }, [currentPage, numPages, onPageChange]);

  const handlePageInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const pageNum = parseInt(e.target.value, 10);
    if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= numPages) {
      onPageChange(pageNum);
    }
  }, [numPages, onPageChange]);

  if (!file) {
    return (
      <div className="flex flex-grow items-center justify-center text-[var(--text-muted)]">
        <p>{t('noPdfLoaded')}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center flex-grow overflow-hidden w-full">

      <div className="pdf-viewer-container relative w-full h-[70vh] min-h-[500px] bg-[var(--bg-primary)]/50 rounded-2xl border border-[var(--border-color)] shadow-inner overflow-hidden flex flex-col items-center justify-center p-8">
        {previewLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-[var(--bg-primary)]/90 z-20 backdrop-blur-md rounded-2xl">
            <div className="flex flex-col items-center gap-4">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-[var(--accent-color)] border-t-transparent"></div>
              <p className="text-sm font-black text-[var(--accent-color)] uppercase tracking-widest">Optimizing Preview...</p>
            </div>
          </div>
        )}

        {/* Page Navigation Floating Bar (RESTORED) */}
        {!previewLoading && numPages > 0 && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 bg-[var(--bg-primary)]/95 backdrop-blur-2xl border border-[var(--border-color)] px-6 py-2 rounded-2xl shadow-[0_15px_60px_rgba(0,0,0,0.4)] flex items-center gap-6 animate-in fade-in slide-in-from-top-4 duration-500 hover:border-[var(--accent-color)]/30 transition-all group">
            <button 
                onClick={handlePrevPage} 
                disabled={currentPage <= 1}
                className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--accent-color)] disabled:opacity-20 transition-all hover:bg-[var(--accent-color)]/5 rounded-xl border border-transparent hover:border-[var(--accent-color)]/10"
            >
                <ChevronLeftIcon className="h-4 w-4" />
            </button>
            
            <div className="flex flex-col items-center min-w-[70px]">
                <span className="text-[8px] font-black uppercase tracking-[0.4em] text-[var(--text-muted)] mb-0.5 leading-none flex items-center gap-1">
                  {t('pageNavigation')}
                </span>
                <span className="text-xs font-mono font-black text-[var(--text-primary)] group-hover:scale-110 transition-transform">
                    {currentPage} <span className="text-[var(--text-muted)] mx-1">/</span> {numPages}
                </span>
            </div>

            <button 
                onClick={handleNextPage} 
                disabled={currentPage >= numPages}
                className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--accent-color)] disabled:opacity-20 transition-all hover:bg-[var(--accent-color)]/5 rounded-xl border border-transparent hover:border-[var(--accent-color)]/10"
            >
                <ChevronRightIcon className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* The PDF Stage (constrained box) */}

        <div className="relative w-full h-full flex overflow-auto custom-scrollbar p-4">
          <div
            id="pdf-stage"
            className="relative shadow-2xl border border-[var(--border-color)] bg-white inline-block m-auto text-black"
            style={{ minWidth: '100px', minHeight: '100px' }}
          >
            {/* The PDF.js Canvas */}
            {!ldmMode && (
              <canvas
                ref={canvasRef}
                className="block max-w-[90vw] max-h-[80vh] h-auto w-auto"
                style={{
                  zIndex: 1,
                  display: previewPages?.[currentPage - 1] ? 'none' : 'block'
                }}
              />
            )}

            {/* The Server-side PNG */}
            {previewPages?.[currentPage - 1] && !ldmMode && (
              <img
                src={previewPages[currentPage - 1]}
                alt={`Page ${currentPage}`}
                className="block max-w-full h-auto"
                style={{ position: 'relative', zIndex: 1 }}
              />
            )}

            {/* LDM On-demand Page Preview */}
            {ldmMode && ldmJobId && (
              <img
                src={`/api/v2/jobs/${ldmJobId}/artifacts/page_${currentPage}.png`}
                key={`ldm-${ldmJobId}-${currentPage}`}
                alt={`LDM Page ${currentPage}`}
                className="block max-w-[90vw] max-h-[80vh] h-auto w-auto"
                style={{ position: 'relative', zIndex: 1, minHeight: '400px', backgroundColor: 'var(--bg-secondary)' }}
              />
            )}

            {heatmapVisible && (
              <>
                {isHeatmapLoading && (
                  <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-[var(--bg-tertiary)]/80 text-[var(--text-primary)] px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest z-30 shadow-2xl">
                    {t('analyzingInk')}
                  </div>
                )}
                <canvas
                  ref={heatmapLayerRef}
                  className="absolute top-0 left-0 pointer-events-none w-full h-full"
                  style={{ zIndex: 10, opacity: 0.6, mixBlendMode: 'multiply' }}
                />

                {/* Integrated Legend inside the PDF stage */}
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 p-3 bg-[var(--bg-primary)]/90 backdrop-blur-md rounded-2xl border border-[var(--border-color)] shadow-xl flex gap-4 items-center z-30 animate-in slide-in-from-bottom-2 duration-300 scale-90">
                  <span className="text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)]">TAC Legend</span>
                  <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-green-500"></span> <span className="text-[10px] font-bold text-[var(--text-secondary)]">{'<'}280%</span></div>
                  <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-yellow-400"></span> <span className="text-[10px] font-bold text-[var(--text-secondary)]">280-300%</span></div>
                  <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-500"></span> <span className="text-[10px] font-bold text-[var(--text-secondary)]">{'>'}300%</span></div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

    </div>
  );
};
