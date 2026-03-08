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

  // Heatmap State (local calculation trigger)
  const [showHeatmap, setShowHeatmap] = useState(false);
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

  // Effect to load PDF when file changes
  useEffect(() => {
    const loadPdf = async () => {
      if (ldmMode) return; // In LDM Mode we don't load the full PDF in PDF.js
      if (!file) {
        if (pdfRef.current) {
          pdfRef.current.destroy();
          pdfRef.current = null;
        }
        onNumPagesChange(0);
        setShowHeatmap(false);
        return;
      }

      const fileReader = new FileReader();
      fileReader.onload = async () => {
        const typedArray = new Uint8Array(fileReader.result as ArrayBuffer);
        try {
          const loadingTask = pdfjsLib.getDocument({
            data: typedArray,
            // Ensure we use the worker even if it's served as a module
            isEvalSupported: false,
          });
          const pdf = await loadingTask.promise;
          pdfRef.current = pdf;
          onNumPagesChange(pdf.numPages);
          onPageChange(1);
        } catch (error: any) {
          console.error("[PDF-LOAD-ERROR]", error);
          // Detect worker failure (often MIME mismatch in production)
          if (error.message?.includes('worker') || error.message?.includes('MIME')) {
            console.error("Critical: PDF.js worker failed to initialize. Check PROD_CONFIG.md for MIME type settings.");
          }
          onNumPagesChange(0);
        }
      };
      fileReader.readAsArrayBuffer(file);

      return () => {
        if (pdfRef.current) {
          pdfRef.current.destroy();
          pdfRef.current = null;
        }
        onNumPagesChange(0);
      };
    };

    loadPdf();
  }, [file, onNumPagesChange]);

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

  // Separate effect for heatmap trigger to avoid infinite loop
  useEffect(() => {
    if (showHeatmap && file) {
      const meta: FileMeta = { name: file.name, size: file.size, type: file.type };
      onRunHeatmap(file, meta, currentPage);
    }
  }, [showHeatmap, currentPage]); // Only trigger when showHeatmap or currentPage changes

  // Heatmap Trigger (Toggle)
  // We don't need a separate effect for toggle, just logic.
  // Actually, we do need an effect to watch showHeatmap changes IF we want strict separation, 
  // but we included it in the renderPage effect dependency above, so it will re-render and trigger calculation.

  // Wait, if I just toggle showHeatmap, renderPage runs again (expensive canvas render).
  // Ideally we separate page render from heatmap trigger.
  // But for now, simple is fine.


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


  const toggleHeatmap = useCallback(() => {
    setShowHeatmap(prev => !prev);
  }, []);

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
      <div className="flex flex-grow items-center justify-center text-gray-500">
        <p>{t('noPdfLoaded')}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center flex-grow overflow-hidden">
      <div className="flex items-center mb-4 sticky top-0 bg-white p-2 rounded-lg shadow-sm z-10 gap-4">
        <button
          onClick={handlePrevPage}
          disabled={currentPage <= 1 || numPages === 0}
          className="p-2 rounded-full bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          aria-label={t('prevPage')}
        >
          <ChevronLeftIcon className="h-5 w-5" />
        </button>
        <div className="flex items-center">
          <label htmlFor="page-input" className="sr-only">{t('goToPage')}</label>
          <input
            id="page-input"
            type="number"
            value={currentPage}
            onChange={handlePageInputChange}
            className="w-16 text-center border border-gray-300 rounded-md py-1 mx-2 focus:ring-blue-500 focus:border-blue-500"
            min="1"
            max={numPages > 0 ? numPages : 1}
            disabled={numPages === 0}
          />
          <span className="text-gray-700">{t('of')} {numPages}</span>
        </div>
        <button
          onClick={handleNextPage}
          disabled={currentPage >= numPages || numPages === 0}
          className="p-2 rounded-full bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          aria-label={t('nextPage')}
        >
          <ChevronRightIcon className="h-5 w-5" />
        </button>

        <div className="h-6 w-px bg-gray-300 mx-2" />

        <button
          onClick={toggleHeatmap}
          className={`p-2 rounded-lg flex items-center gap-2 transition-colors ${showHeatmap ? 'bg-orange-100 text-orange-700 border border-orange-200' : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-transparent'}`}
          title={t('toggleTacHeatmap')}
        >
          <FireIcon className="h-5 w-5" />
          <span className="text-sm font-medium">{t('heatmap')}</span>
        </button>

        {onRunVisualCheck && (
          <button
            onClick={onRunVisualCheck}
            className="p-2 rounded-lg flex items-center gap-2 bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 transition-colors"
            title={t('aiVisualQualityCheck')}
          >
            <EyeIcon className="w-5 h-5" />
            <span className="text-sm font-medium">{t('aiVisualCheck')}</span>
          </button>
        )}
      </div>

      <div className="pdf-viewer-container relative w-full h-[70vh] min-h-[500px] bg-gray-50/50 rounded-2xl border border-gray-100 shadow-inner overflow-hidden flex flex-col items-center justify-center p-8">
        {previewLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/90 z-20 backdrop-blur-md rounded-2xl">
            <div className="flex flex-col items-center gap-4">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-red-600 border-t-transparent"></div>
              <p className="text-sm font-black text-red-600 uppercase tracking-widest">Optimizing Preview...</p>
            </div>
          </div>
        )}

        {/* The PDF Stage (constrained box) */}
        <div className="relative w-full h-full flex overflow-auto custom-scrollbar p-4">
          <div
            id="pdf-stage"
            className="relative shadow-2xl border border-gray-200 bg-white inline-block m-auto"
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
                src={`/api/convert/preview/${ldmJobId}/${currentPage}`}
                key={`ldm-${ldmJobId}-${currentPage}`}
                alt={`LDM Page ${currentPage}`}
                className="block max-w-[90vw] max-h-[80vh] h-auto w-auto"
                style={{ position: 'relative', zIndex: 1, minHeight: '400px', backgroundColor: '#f3f4f6' }}
              />
            )}

            {showHeatmap && (
              <>
                {isHeatmapLoading && (
                  <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-black/80 text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest z-30 shadow-2xl">
                    {t('analyzingInk')}
                  </div>
                )}
                <canvas
                  ref={heatmapLayerRef}
                  className="absolute top-0 left-0 pointer-events-none w-full h-full"
                  style={{ zIndex: 10, opacity: 0.6, mixBlendMode: 'multiply' }}
                />

                {/* Integrated Legend inside the PDF stage */}
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 p-3 bg-white/90 backdrop-blur-md rounded-2xl border border-gray-100 shadow-xl flex gap-4 items-center z-30 animate-in slide-in-from-bottom-2 duration-300 scale-90">
                  <span className="text-[9px] font-black uppercase tracking-widest text-gray-400">TAC Legend</span>
                  <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-green-500"></span> <span className="text-[10px] font-bold text-gray-600">{'<'}280%</span></div>
                  <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-yellow-400"></span> <span className="text-[10px] font-bold text-gray-600">280-300%</span></div>
                  <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-500"></span> <span className="text-[10px] font-bold text-gray-600">{'>'}300%</span></div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

    </div>
  );
};
