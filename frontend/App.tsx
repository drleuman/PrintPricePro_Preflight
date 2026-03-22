import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Stepper } from './components/Stepper';
import { Step1Upload } from './components/steps/Step1Upload';
import { Step2Analysis } from './components/steps/Step2Analysis';
import { Step3Fix } from './components/steps/Step3Fix';
import { Step4Review } from './components/steps/Step4Review';
import { LoaderOverlay } from './components/LoaderOverlay';
import { AIAuditModal } from './components/AIAuditModal';
import { InvestorDemo } from './components/Demo/InvestorDemo';
import { RocketLaunchIcon } from '@heroicons/react/24/outline';

import { t } from './i18n';
import {
  FileMeta,
  Issue,
  PreflightResult,
  HeatmapData,
  AppMode,
} from './types';
import { usePreflightWorker } from './hooks/usePreflightWorker';
import { usePdfTools } from './hooks/usePdfTools';

import { AuthOverlay } from './components/AuthOverlay';
import { useAuth } from './hooks/useAuth';

export default function App() {
  // ---------- Workflow State ----------
  const [currentStep, setCurrentStep] = useState(1);
  const [appMode, setAppMode] = useState<AppMode>(null);

  // ---------- Main state ----------
  const [file, setFile] = useState<File | null>(null);
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [fileMeta, setFileMeta] = useState<FileMeta | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [result, setResult] = useState<PreflightResult | null>(null);
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);

  // ---------- AutoFix Pro Session ----------
  const [autoFixBefore, setAutoFixBefore] = useState<PreflightResult | null>(null);
  const [autoFixAfter, setAutoFixAfter] = useState<PreflightResult | null>(null);
  const [autoFixReport, setAutoFixReport] = useState<any | null>(null);
  const [autoFixRunId, setAutoFixRunId] = useState<number | null>(null);
  const [compareEnabled, setCompareEnabled] = useState(false);

  // Visual QA State
  const [visualPageImage, setVisualPageImage] = useState<string | null>(null);
  const [visualReports, setVisualReports] = useState<Record<number, string>>({});
  const [showVisualModal, setShowVisualModal] = useState(false);

  // Heatmap State
  const [heatmapData, setHeatmapData] = useState<HeatmapData | null>(null);
  const [heatmapLoading, setHeatmapLoading] = useState(false);

  // ---------- Large Document Mode (LDM) State ----------
  const [ldmActive, setLdmActive] = useState(false);
  const [ldmProgress, setLdmProgress] = useState(0);
  const [ldmStatus, setLdmStatus] = useState<string | null>(null);

  // Preview State (Server-side GS PNGs)
  const [previewPages, setPreviewPages] = useState<string[] | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // UI / Loader
  const lastPdfUrlRef = useRef<string | null>(null);
  const [lastPdfUrl, setLastPdfUrl] = useState<string | null>(null);
  const [lastPdfName, setLastPdfName] = useState<string | null>(null);
  const [selectedProfile, setSelectedProfile] = useState<string>('OFFSET_CMYK_STRICT');
  const [selectedPolicy, setSelectedPolicy] = useState<string>('OFFSET_CMYK_STRICT');

  const { isAuthenticated } = useAuth();

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

  const { isWorkerRunning, error: workerError, runAnalysis } = usePreflightWorker({
    onAnalysisResult: (res: PreflightResult) => {
      setResult(res);
      setCurrentStep(3);
    },
    onError: (err: string) => { console.error('[WORKER-ERROR]', err); }
  });

  const { 
    startV2Preflight, 
    handleV2JobComplete 
  } = usePdfTools({
    onStatus: (st: string, pr: number) => { setLdmStatus(st); setLdmProgress(pr); },
    onComplete: (res: PreflightResult) => {
      setResult(res);
      setCurrentStep(3);
      setLdmActive(false);
    }
  });

  const handleV2Start = useCallback(async () => {
    if (!file) return;
    setLdmActive(true);
    setLdmStatus('Starting V2 Engine...');
    try {
      await startV2Preflight(file, selectedPolicy);
    } catch (err: any) {
      alert('V2 Engine Start Failed: ' + err.message);
      setLdmActive(false);
    }
  }, [file, selectedPolicy, startV2Preflight]);

  const onFileSelect = (newFile: File | null) => {
    setFile(newFile);
    if (!newFile) {
        setFileMeta(null);
        setResult(null);
        setCurrentStep(1);
        return;
    }
    setOriginalFile(newFile);
    setFileMeta({
        name: newFile.name,
        size: newFile.size,
        type: newFile.type
    });
  };

  const handlePageChange = (page: number) => setCurrentPage(page);
  const handleSelectIssue = (issue: Issue | null) => setSelectedIssue(issue);
  
  const handleStartOver = () => {
    setFile(null);
    setFileMeta(null);
    setResult(null);
    setCurrentStep(1);
    setAppMode(null);
  };

  const handleRunHeatmap = (file: File, meta: FileMeta, page: number) => {
    setHeatmapLoading(true);
    setTimeout(() => {
      setHeatmapData({
        values: new Uint8Array(100),
        width: 10,
        height: 10,
        maxTac: 300
      });
      setHeatmapLoading(false);
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans selection:bg-blue-100 selection:text-blue-900">
      <nav className="sticky top-0 z-40 w-full bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-600 rounded-xl shadow-lg shadow-blue-200">
                <RocketLaunchIcon className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-700">
                PrintPrice <span className="text-blue-600">Pro</span>
              </span>
            </div>
            
            <div className="flex items-center gap-4">
              {appMode === 'demo' && (
                  <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-bold ring-1 ring-amber-200">
                      INVESTOR DEMO MODE
                  </span>
              )}
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {!isAuthenticated ? (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8 animate-in fade-in zoom-in duration-1000">
            <RocketLaunchIcon className="w-16 h-16 text-blue-600 mb-6 animate-bounce" />
            <h2 className="text-3xl font-bold text-gray-900 mb-4 tracking-tight">Ready for PrintPrice OS V2?</h2>
            <p className="text-lg text-gray-600 max-w-md mx-auto">
              Please connect to your PrintPrice OS instance to start performing lightning-fast preflight audits.
            </p>
          </div>
        ) : (
          <>
            <div className="mb-12">
                <Stepper 
                  currentStep={currentStep} 
                  steps={[
                    { number: 1, title: t('uploadPdf'), icon: 'document' },
                    { number: 2, title: t('analysis'), icon: 'search' },
                    { number: 3, title: t('fixIssuesTitle'), icon: 'wrench' },
                    { number: 4, title: t('review'), icon: 'check' }
                  ]} 
                />
            </div>

            <div className="relative">
              {currentStep === 1 && (
                <Step1Upload
                  file={file}
                  fileMeta={fileMeta}
                  onFileSelect={onFileSelect}
                  onNext={(mode) => {
                    setAppMode(mode);
                    if (mode === 'ai') {
                        handleV2Start();
                    } else {
                        setCurrentStep(2);
                    }
                  }}
                  selectedPolicy={selectedPolicy}
                  onPolicyChange={setSelectedPolicy}
                  isAuthenticated={isAuthenticated}
                />
              )}

              {currentStep === 2 && (
                <Step2Analysis
                  file={file}
                  fileMeta={fileMeta}
                  result={result}
                  autoFixBefore={autoFixBefore}
                  autoFixAfter={autoFixAfter}
                  autoFixReport={autoFixReport}
                  autoFixRunId={autoFixRunId}
                  isRunning={isWorkerRunning}
                  onRunAnalysis={() => file && fileMeta && runAnalysis(file, fileMeta)}
                  onRunV2Analysis={() => file && startV2Preflight(file, selectedPolicy)}
                  onNext={() => setCurrentStep(3)}
                  onSkipToReview={() => setCurrentStep(4)}
                  onBack={() => setCurrentStep(1)}
                />
              )}

              {currentStep === 3 && (
                <Step3Fix
                  file={file}
                  fileMeta={fileMeta}
                  result={result}
                  autoFixBefore={autoFixBefore}
                  autoFixAfter={autoFixAfter}
                  autoFixReport={autoFixReport}
                  autoFixRunId={autoFixRunId}
                  compareEnabled={compareEnabled}
                  numPages={numPages}
                  currentPage={currentPage}
                  selectedIssue={selectedIssue}
                  heatmapData={heatmapData}
                  isHeatmapLoading={heatmapLoading}
                  isRunning={isWorkerRunning}
                  selectedProfile={selectedProfile}
                  onPageChange={handlePageChange}
                  onNumPagesChange={setNumPages}
                  onSelectIssue={handleSelectIssue}
                  onRunAnalysis={() => file && fileMeta && runAnalysis(file, fileMeta)}
                  onRunHeatmap={() => file && fileMeta && handleRunHeatmap(file, fileMeta, currentPage)}
                  onRunVisualCheck={() => setShowVisualModal(true)}
                  onFixBleed={() => {}}
                  onConvertGrayscale={() => {}}
                  onConvertCMYK={() => {}}
                  onRebuildPdf={() => {}}
                  onAutoFix={() => {}}
                  onToggleCompare={setCompareEnabled}
                  onProfileChange={setSelectedProfile}
                  onOpenAIAudit={(issue) => { handleSelectIssue(issue); setShowVisualModal(true); }}
                  onOpenEfficiency={() => alert('Efficiency optimized by PPOS.')}
                  onNext={() => setCurrentStep(4)}
                  onBack={() => setCurrentStep(2)}
                  serverAvailable={true}
                  previewPages={previewPages}
                  previewLoading={previewLoading}
                  ldmActive={ldmActive}
                  ldmProgress={ldmProgress}
                  ldmStatus={ldmStatus}
                  ldmMode={false}
                  ldmJobId={null}
                />
              )}

              {currentStep === 4 && (
                <Step4Review
                  file={file}
                  fileMeta={fileMeta}
                  result={result}
                  numPages={numPages}
                  currentPage={currentPage}
                  lastPdfUrl={lastPdfUrl}
                  lastPdfName={lastPdfName}
                  isRunning={isWorkerRunning}
                  onPageChange={handlePageChange}
                  onNumPagesChange={setNumPages}
                  onConvertGrayscale={() => {}}
                  onConvertColors={() => {}}
                  onRebuildPdf={() => {}}
                  onMakeBooklet={() => {}}
                  onStartOver={handleStartOver}
                  onBack={() => setCurrentStep(3)}
                  appMode={appMode}
                  heatmapData={heatmapData}
                  isHeatmapLoading={heatmapLoading}
                  onRunHeatmap={() => file && fileMeta && handleRunHeatmap(file, fileMeta, currentPage)}
                  originalFile={originalFile}
                  autoFixReport={autoFixReport}
                  previewPages={previewPages}
                  previewLoading={previewLoading}
                />
              )}

              {appMode === 'demo' && (
                <InvestorDemo 
                  onBack={() => setAppMode(null)} 
                  onJobComplete={handleV2JobComplete}
                  isAuthenticated={isAuthenticated}
                />
              )}
            </div>
          </>
        )}
      </main>

      <AIAuditModal
        isOpen={showVisualModal}
        onClose={() => setShowVisualModal(false)}
        issue={selectedIssue}
        fileMeta={fileMeta}
        result={result}
        visualImage={visualPageImage}
        isVisualMode={showVisualModal}
        cachedResponse={visualReports[currentPage] || null}
        onSaveResponse={(response) => {
          setVisualReports(prev => ({ ...prev, [currentPage]: response }));
        }}
      />
      
      <AuthOverlay />
      
      <LoaderOverlay 
        isOpen={ldmActive} 
        message={ldmStatus || 'Processing...'} 
        stageKey={ldmStatus?.toLowerCase().includes('engine') ? 'upload' : 'preflight'}
      />
    </div>
  );
}
