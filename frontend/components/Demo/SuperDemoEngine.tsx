import React, { useState, useEffect, useRef, useCallback } from 'react';
import './SuperDemo.css';
import {
    CloudArrowUpIcon,
    SparklesIcon,
    ShieldCheckIcon,
    ChartBarIcon,
    DocumentMagnifyingGlassIcon,
    ArrowPathIcon,
    ExclamationTriangleIcon,
    CheckCircleIcon,
    CpuChipIcon,
    PresentationChartLineIcon,
    PlayIcon,
    BoltIcon,
    DocumentDuplicateIcon,
    BeakerIcon
} from '@heroicons/react/24/outline';

type Step = 'UPLOAD' | 'INSPECT' | 'FIX' | 'VERIFY' | 'DELTA';

const PIPELINE_STEPS: { id: Step; label: string }[] = [
    { id: 'UPLOAD', label: 'Upload' },
    { id: 'INSPECT', label: 'Inspect' },
    { id: 'FIX', label: 'AutoFix' },
    { id: 'VERIFY', label: 'Verify' },
    { id: 'DELTA', label: 'Delta' },
];

interface SuperDemoEngineProps {
    onBack: () => void;
}

export function SuperDemoEngine({ onBack }: SuperDemoEngineProps) {
    const [currentStep, setCurrentStep] = useState<Step>('UPLOAD');
    const [isInvestorMode, setIsInvestorMode] = useState(false);
    const [isAutoDemo, setIsAutoDemo] = useState(false);
    const [file, setFile] = useState<{ name: string; type: string } | null>(null);
    const [logs, setLogs] = useState<{ msg: string; type: 'info' | 'success' | 'warning' }[]>([]);
    const [processingTime, setProcessingTime] = useState(0);

    // Logic to calculate progress width
    const stepIndex = PIPELINE_STEPS.findIndex(s => s.id === currentStep);
    const progressWidth = (stepIndex / (PIPELINE_STEPS.length - 1)) * 100;

    const addLog = useCallback((msg: string, type: 'info' | 'success' | 'warning' = 'info') => {
        setLogs(prev => [...prev, { msg, type }]);
    }, []);

    const handleRunAutoDemo = () => {
        setIsAutoDemo(true);
        setFile({ name: 'high_res_brochure_RGB.pdf', type: 'demo' });
        setCurrentStep('INSPECT');
    };

    const handleFileUpload = (name: string) => {
        setFile({ name, type: 'demo' });
        setCurrentStep('INSPECT');
    };

    // Auto-advance logic for Auto Demo
    useEffect(() => {
        if (!isAutoDemo) return;

        if (currentStep === 'INSPECT' && logs.length === 6) {
            const timer = setTimeout(() => setCurrentStep('FIX'), 1500);
            return () => clearTimeout(timer);
        }
        if (currentStep === 'FIX') {
            const timer = setTimeout(() => setCurrentStep('VERIFY'), 3000);
            return () => clearTimeout(timer);
        }
        if (currentStep === 'VERIFY') {
            const timer = setTimeout(() => setCurrentStep('DELTA'), 3500);
            return () => clearTimeout(timer);
        }
    }, [currentStep, isAutoDemo, logs.length]);

    useEffect(() => {
        if (currentStep === 'INSPECT') {
            setLogs([]);
            const messages: { msg: string; type: 'info' | 'success' | 'warning' }[] = [
                { msg: 'Initializing PrintPrice V2 Engine...', type: 'info' },
                { msg: 'Loading deterministic probes (GS 10.03)...', type: 'info' },
                { msg: 'Analyzing PDF structure and color spaces...', type: 'info' },
                { msg: 'Extracting font metadata and embedding status...', type: 'info' },
                { msg: 'Heuristic scan complete: 4 print risks detected.', type: 'warning' },
                { msg: 'Inspection finished. Ready for AutoFix.', type: 'success' },
            ];

            let i = 0;
            const interval = setInterval(() => {
                if (i < messages.length) {
                    addLog(messages[i].msg, messages[i].type);
                    i++;
                } else {
                    clearInterval(interval);
                    setProcessingTime(1.2);
                }
            }, 500);
            return () => clearInterval(interval);
        }
    }, [currentStep, addLog]);

    return (
        <div className="sd-container">
            {/* Header & Controls */}
            <div className="sd-header">
                <div>
                    <h1 className="sd-title">
                        PrintPrice <span className="sd-accent-text">Preflight V2</span>
                    </h1>
                    <p className="sd-subtitle text-gradient">
                        Automatically turn problematic PDFs into production-ready print files — and verify the improvement.
                    </p>
                </div>
                <div className="sd-controls">
                    <button
                        onClick={() => setIsInvestorMode(!isInvestorMode)}
                        className={`sd-toggle-btn ${isInvestorMode ? 'active' : ''}`}
                    >
                        <PresentationChartLineIcon className="w-4 h-4" />
                        Investor Mode
                    </button>
                    {!isAutoDemo && currentStep === 'UPLOAD' && (
                        <button onClick={handleRunAutoDemo} className="sd-btn-special">
                            <PlayIcon className="w-4 h-4" />
                            Run Auto Demo
                        </button>
                    )}
                    <button onClick={onBack} className="sd-btn-outline">
                        Exit
                    </button>
                </div>
            </div>

            {/* Pipeline Visual */}
            <div className="sd-pipeline-container">
                <div className="sd-pipeline-line">
                    <div className="sd-pipeline-progress" style={{ width: `${progressWidth}%` }}></div>
                </div>
                {PIPELINE_STEPS.map((step, idx) => {
                    const isActive = step.id === currentStep;
                    const isCompleted = stepIndex > idx;
                    return (
                        <div key={step.id} className={`sd-pipeline-step ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}>
                            <div className="sd-step-node">
                                {isCompleted ? <CheckCircleIcon className="w-5 h-5" /> : idx + 1}
                            </div>
                            <span className="sd-step-label">{step.label}</span>
                        </div>
                    );
                })}
            </div>

            {/* Main Stage */}
            <div className="sd-main-card glass-panel">
                {currentStep === 'UPLOAD' && (
                    <div className="animate-fade-in">
                        <div className="sd-upload-zone" onClick={() => handleFileUpload('custom_file.pdf')}>
                            <div className="sd-upload-icon-wrapper">
                                <CloudArrowUpIcon className="w-12 h-12" />
                            </div>
                            <div className="sd-upload-text">
                                <h3>Drop your PDF to start</h3>
                                <p>Deterministic inspection + AI heuristic signals</p>
                            </div>
                        </div>

                        <div className="sd-demo-scenarios">
                            <p className="sd-scenarios-label">Try a demo scenario</p>
                            <div className="sd-samples-grid">
                                <button className="sd-scenario-card" onClick={() => handleFileUpload('brochure_rgb.pdf')}>
                                    <DocumentDuplicateIcon className="w-5 h-5 text-blue-500" />
                                    <span>RGB Brochure</span>
                                </button>
                                <button className="sd-scenario-card" onClick={() => handleFileUpload('book_missing_fonts.pdf')}>
                                    <BeakerIcon className="w-5 h-5 text-purple-500" />
                                    <span>Book Interior</span>
                                </button>
                                <button className="sd-scenario-card" onClick={() => handleFileUpload('packaging_no_bleed.pdf')}>
                                    <SparklesIcon className="w-5 h-5 text-emerald-500" />
                                    <span>Packaging Design</span>
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {currentStep === 'INSPECT' && (
                    <div className="animate-fade-in">
                        <div className="sd-step-header">
                            <div className="sd-status-indicator">
                                <div className="sd-pulse-ring"></div>
                                <CpuChipIcon className="w-8 h-8 text-blue-500" />
                            </div>
                            <div>
                                <h3>Deep Pipeline Analysis</h3>
                                <p className="sd-file-name">{file?.name} • {logs.length}/6 probes complete</p>
                            </div>
                            {logs.length === 6 && !isAutoDemo && (
                                <button onClick={() => setCurrentStep('FIX')} className="sd-btn-primary animate-bounce-in">
                                    View Logic Errors
                                </button>
                            )}
                        </div>
                        <div className="sd-terminal glass">
                            {logs.map((log, i) => (
                                <div key={i} className={`sd-terminal-line ${log.type}`}>
                                    <span className="sd-term-tag">[{new Date().toLocaleTimeString()}]</span>
                                    <span className="sd-term-msg">{log.msg}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {currentStep === 'FIX' && (
                    <div className="animate-fade-in">
                        <div className="sd-risk-header">
                            <div>
                                <h3 className="sd-risk-title text-danger">
                                    <ExclamationTriangleIcon className="w-6 h-6" /> High Print Risk Detected
                                </h3>
                                <p>The engine identified 4 critical policy violations.</p>
                            </div>
                            <div className="sd-risk-gauge">
                                <span className="sd-gauge-label">RISK LEVEL</span>
                                <div className="sd-gauge-bar">
                                    <div className="sd-gauge-fill high" style={{ width: '85%' }}></div>
                                </div>
                            </div>
                        </div>

                        <div className="sd-risk-list">
                            {[
                                { title: 'Invalid Color Space', desc: 'DeviceRGB targets found. ISO Coated v2 (FOGRA39) required.', icon: SparklesIcon },
                                { title: 'Bleed Violation', desc: 'TrimBox misaligned. Bleed pixels missing in bleedzone.', icon: DocumentMagnifyingGlassIcon },
                                { title: 'Missing Subsets', desc: '2 Type-1 fonts are not embedded. Rendering risk detected.', icon: ExclamationTriangleIcon },
                            ].map((risk, i) => (
                                <div key={i} className="sd-risk-item">
                                    <div className="sd-risk-icon"><risk.icon className="w-5 h-5" /></div>
                                    <div className="sd-risk-content">
                                        <h4>{risk.title}</h4>
                                        <p>{risk.desc}</p>
                                    </div>
                                    <div className="sd-risk-tag high">FAIL</div>
                                </div>
                            ))}
                        </div>

                        {!isAutoDemo && (
                            <div className="sd-action-footer">
                                <button onClick={() => setCurrentStep('VERIFY')} className="sd-btn-glow">
                                    <BoltIcon className="w-5 h-5" />
                                    Launch AutoFix Pipeline
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {currentStep === 'VERIFY' && (
                    <div className="animate-fade-in text-center py-10">
                        <div className="sd-verify-scanner">
                            <div className="sd-scan-line"></div>
                            <ShieldCheckIcon className="w-20 h-20 text-emerald-500 mx-auto" />
                        </div>
                        <h3 className="mt-6 text-2xl font-bold">Deterministic Verification</h3>
                        <p className="text-gray-500">Applying Policy-based AutoFix & GS-Recheck</p>

                        <div className="sd-mini-tasks mt-8">
                            {['Remapping RGB to CMYK', 'Injecting Bleed Markers', 'Embedding Fonts', 'Final Re-Inspection'].map((t, i) => (
                                <div key={i} className="sd-mini-task completed">
                                    <CheckCircleIcon className="w-4 h-4 text-emerald-500" />
                                    <span>{t}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {currentStep === 'DELTA' && (
                    <div className="animate-fade-in">
                        <div className="sd-delta-hero glass-dark">
                            <div className="sd-delta-stats">
                                <div className="sd-stat">
                                    <span className="sd-stat-val text-emerald-400">80%</span>
                                    <span className="sd-stat-lbl">Risk Reduced</span>
                                </div>
                                <div className="sd-stat-divider"></div>
                                <div className="sd-stat">
                                    <span className="sd-stat-val">18m</span>
                                    <span className="sd-stat-lbl">Prepress Saved</span>
                                </div>
                                <div className="sd-stat-divider"></div>
                                <div className="sd-stat">
                                    <span className="sd-stat-val text-blue-400">1.2s</span>
                                    <span className="sd-stat-lbl">Execution</span>
                                </div>
                            </div>
                            <div className="sd-delta-summary">
                                <h3>File Certified: Pass</h3>
                                <p>PDF/X-4 compliant and ready for production printers.</p>
                            </div>
                        </div>

                        <div className="sd-comparison mt-8">
                            <div className="sd-comp-side">
                                <h5>ORIGINAL</h5>
                                <div className="sd-comp-box original">
                                    <div className="sd-error-overlay"></div>
                                </div>
                            </div>
                            <div className="sd-comp-side">
                                <h5>OPTIMIZED</h5>
                                <div className="sd-comp-box fixed">
                                    <CheckCircleIcon className="w-12 h-12 text-white opacity-20" />
                                </div>
                            </div>
                        </div>

                        <div className="sd-final-actions">
                            <button onClick={() => setCurrentStep('UPLOAD')} className="sd-btn-primary">
                                <ArrowPathIcon className="w-5 h-5" /> Analyze New Asset
                            </button>
                            <button className="sd-btn-outline">Download Report</button>
                        </div>
                    </div>
                )}
            </div>

            {/* Investor Meta Panel */}
            {isInvestorMode && (
                <div className="sd-meta-panel glass animate-slide-up">
                    <div className="sd-meta-grid">
                        <div className="sd-meta-item">
                            <label>LATENCY</label>
                            <span>142ms</span>
                        </div>
                        <div className="sd-meta-item">
                            <label>ENGINE</label>
                            <span>V2-ASYNC</span>
                        </div>
                        <div className="sd-meta-item">
                            <label>CORE</label>
                            <span>GS 10.03</span>
                        </div>
                        <div className="sd-meta-item">
                            <label>RELIABILITY</label>
                            <span>99.98%</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Global Trust Footer */}
            <div className="sd-footer">
                <p>
                    <ShieldCheckIcon className="w-4 h-4 text-emerald-500" />
                    Deterministic verification powered by <strong>Ghostscript + Poppler</strong>
                </p>
                {processingTime > 0 && <span className="sd-time-badge">⚡ Processing: {processingTime}s</span>}
            </div>
        </div>
    );
}
