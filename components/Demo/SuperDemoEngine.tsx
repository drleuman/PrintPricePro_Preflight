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
    PresentationChartLineIcon
} from '@heroicons/react/24/outline';

type Step = 'UPLOAD' | 'INSPECT' | 'FIX' | 'VERIFY' | 'DELTA';

const PIPELINE_STEPS: { id: Step; label: string }[] = [
    { id: 'UPLOAD', label: 'Upload' },
    { id: 'INSPECT', label: 'AI Preflight' },
    { id: 'FIX', label: 'AutoFix' },
    { id: 'VERIFY', label: 'Verification' },
    { id: 'DELTA', label: 'Delta Report' },
];

interface SuperDemoEngineProps {
    onBack: () => void;
}

export function SuperDemoEngine({ onBack }: SuperDemoEngineProps) {
    const [currentStep, setCurrentStep] = useState<Step>('UPLOAD');
    const [isInvestorMode, setIsInvestorMode] = useState(false);
    const [isAutoDemo, setIsAutoDemo] = useState(false);
    const [file, setFile] = useState<File | null>(null);
    const [logs, setLogs] = useState<{ msg: string; type: 'info' | 'success' | 'warning' }[]>([]);

    // Logic to calculate progress width
    const stepIndex = PIPELINE_STEPS.findIndex(s => s.id === currentStep);
    const progressWidth = (stepIndex / (PIPELINE_STEPS.length - 1)) * 100;

    const addLog = useCallback((msg: string, type: 'info' | 'success' | 'warning' = 'info') => {
        setLogs(prev => [...prev, { msg, type }]);
    }, []);

    const handleStartDemo = () => {
        setIsAutoDemo(true);
        setCurrentStep('INSPECT');
    };

    const handleFileUpload = (f: File) => {
        setFile(f);
        setCurrentStep('INSPECT');
    };

    useEffect(() => {
        if (currentStep === 'INSPECT') {
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
                }
            }, 800);
            return () => clearInterval(interval);
        }
    }, [currentStep, addLog]);

    return (
        <div className="sd-container">
            {/* Header & Controls */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
                <div>
                    <h1 style={{ margin: 0, fontSize: '32px', fontWeight: 800, letterSpacing: '-1px' }}>
                        PrintPrice <span style={{ color: 'var(--sd-accent)' }}>Preflight V2</span>
                    </h1>
                    <p style={{ margin: '4px 0 0 0', color: '#6B7280', fontSize: '15px' }}>
                        Hybrid Intelligence Engine for Production Print Risk
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <button
                        onClick={() => setIsInvestorMode(!isInvestorMode)}
                        className="sd-btn-outline"
                        style={{ padding: '8px 16px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}
                    >
                        <PresentationChartLineIcon className="w-4 h-4" />
                        {isInvestorMode ? 'Hide Tech Data' : 'Investor Mode'}
                    </button>
                    {!isAutoDemo && (
                        <button
                            onClick={handleStartDemo}
                            className="sd-btn-primary"
                            style={{ padding: '8px 16px', fontSize: '13px' }}
                        >
                            Run Interactive Demo
                        </button>
                    )}
                    <button onClick={onBack} className="sd-btn-outline" style={{ padding: '8px 16px', fontSize: '13px' }}>
                        Exit
                    </button>
                </div>
            </div>

            {/* Pipeline Tracker */}
            <div className="sd-pipeline">
                <div className="sd-pipeline-line">
                    <div className="sd-pipeline-progress" style={{ width: `${progressWidth}%` }}></div>
                </div>
                {PIPELINE_STEPS.map((step, idx) => {
                    const isActive = step.id === currentStep;
                    const isCompleted = stepIndex > idx;
                    return (
                        <div key={step.id} className={`sd-pipeline-step ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}>
                            <div className="sd-step-circle">
                                {isCompleted ? <CheckCircleIcon className="w-5 h-5" /> : idx + 1}
                            </div>
                            <span className="sd-step-label">{step.label}</span>
                        </div>
                    );
                })}
            </div>

            {/* Main Experience Area */}
            <div className="sd-card">
                {currentStep === 'UPLOAD' && (
                    <div className="animate-fade-in">
                        <div className="sd-dropzone" onClick={() => handleFileUpload(new File([], 'demo.pdf'))}>
                            <div style={{ padding: '12px', background: '#EFF6FF', borderRadius: '50%' }}>
                                <CloudArrowUpIcon className="w-10 h-10 text-blue-600" />
                            </div>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '18px' }}>Drop your PDF to analyze</h3>
                                <p style={{ margin: '4px 0 0 0', color: '#6B7280' }}>Deterministic inspection + AI heuristic signals</p>
                            </div>
                        </div>

                        <div className="sd-samples-grid">
                            <button className="sd-sample-btn" onClick={() => handleFileUpload(new File([], 'brochure.pdf'))}>
                                <div className="sd-sample-icon"><DocumentMagnifyingGlassIcon className="w-5 h-5" /></div>
                                <div className="sd-sample-info">
                                    <span className="sd-sample-title">RGB Brochure</span>
                                    <span className="sd-sample-desc">4 Isses • CMYK mismatch</span>
                                </div>
                            </button>
                            <button className="sd-sample-btn" onClick={() => handleFileUpload(new File([], 'packaging.pdf'))}>
                                <div className="sd-sample-icon"><ExclamationTriangleIcon className="w-5 h-5" /></div>
                                <div className="sd-sample-info">
                                    <span className="sd-sample-title">Packaging File</span>
                                    <span className="sd-sample-desc">Bleed missing • Spot colors</span>
                                </div>
                            </button>
                            <button className="sd-sample-btn" onClick={() => handleFileUpload(new File([], 'book.pdf'))}>
                                <div className="sd-sample-icon"><ArrowPathIcon className="w-5 h-5" /></div>
                                <div className="sd-sample-info">
                                    <span className="sd-sample-title">Book Interior</span>
                                    <span className="sd-sample-desc">Font issues • Transparency</span>
                                </div>
                            </button>
                            <button className="sd-sample-btn" onClick={() => handleFileUpload(new File([], 'poster.pdf'))}>
                                <div className="sd-sample-icon"><SparklesIcon className="w-5 h-5" /></div>
                                <div className="sd-sample-info">
                                    <span className="sd-sample-title">Low DPI Poster</span>
                                    <span className="sd-sample-desc">Image optimization required</span>
                                </div>
                            </button>
                        </div>
                    </div>
                )}

                {currentStep === 'INSPECT' && (
                    <div className="animate-fade-in">
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div className="animate-spin" style={{ color: 'var(--sd-accent)' }}><CpuChipIcon className="w-8 h-8" /></div>
                                <div>
                                    <h3 style={{ margin: 0, fontSize: '20px' }}>Deep Analysis in Progress</h3>
                                    <p style={{ margin: 0, color: '#6B7280', fontSize: '14px' }}>{file?.name || 'Interactive Demo'} • {logs.length}/6 probes complete</p>
                                </div>
                            </div>
                            {logs.length === 6 && (
                                <button className="sd-btn-primary" onClick={() => setCurrentStep('FIX')}>
                                    View Print Risks
                                </button>
                            )}
                        </div>

                        <div className="sd-logs-container">
                            {logs.map((log, idx) => (
                                <div key={idx} className="sd-log-line">
                                    <span className="sd-log-timestamp">[{new Date().toLocaleTimeString()}]</span>
                                    <span className="sd-log-tag">SYS</span>
                                    <span className={`sd-log-${log.type}`}>{log.msg}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Other steps will be implemented sequentially */}
                {currentStep === 'FIX' && (
                    <div className="animate-fade-in">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '20px', color: 'var(--sd-danger)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <ExclamationTriangleIcon className="w-6 h-6" /> High Risk Detected
                                </h3>
                                <p style={{ margin: '4px 0 0 0', color: '#6B7280' }}>The engine found 4 critical violations of the active print policy.</p>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: '12px', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase' }}>Issue Severity</div>
                                <div className="sd-risk-meter" style={{ width: '120px' }}>
                                    <div className="sd-risk-fill sd-risk-high" style={{ width: '85%' }}></div>
                                </div>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gap: '12px', marginBottom: '32px' }}>
                            {[
                                { title: 'RGB Images Detected', desc: '12 raster objects use prohibited DeviceRGB color space', severity: 'High' },
                                { title: 'Missing Bleed Information', desc: 'TrimBox detected without sufficient bleed offset (0mm found, 3mm required)', severity: 'High' },
                                { title: 'Low Resolution Assets', desc: '3 images found below 150 DPI limit', severity: 'Medium' },
                                { title: 'Transparency Conflicts', desc: 'Overprinting elements may cause unexpected results on this device', severity: 'Medium' }
                            ].map((risk, i) => (
                                <div key={i} style={{ padding: '16px', background: 'white', border: '1px solid #E5E7EB', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <div style={{ fontWeight: 600, fontSize: '15px' }}>{risk.title}</div>
                                        <div style={{ fontSize: '13px', color: '#6B7280' }}>{risk.desc}</div>
                                    </div>
                                    <span style={{
                                        padding: '4px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 700,
                                        background: risk.severity === 'High' ? '#FEF2F2' : '#FFFBEB',
                                        color: risk.severity === 'High' ? '#DC2626' : '#D97706'
                                    }}>{risk.severity}</span>
                                </div>
                            ))}
                        </div>

                        <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
                            <button className="sd-btn-primary" style={{ padding: '16px 40px', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '12px' }} onClick={() => setCurrentStep('VERIFY')}>
                                <SparklesIcon className="w-6 h-6" /> Make Print-Ready (AutoFix)
                            </button>
                        </div>
                    </div>
                )}

                {currentStep === 'VERIFY' && (
                    <div className="animate-fade-in" style={{ textAlign: 'center', padding: '40px 0' }}>
                        <div className="sd-scanning-pulse" style={{ width: '80px', height: '80px', background: '#EFF6FF', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px auto', color: 'var(--sd-accent)' }}>
                            <ArrowPathIcon className="w-10 h-10 animate-spin" />
                        </div>
                        <h3 style={{ margin: 0, fontSize: '22px' }}>Executing Deterministic Verification</h3>
                        <p style={{ color: '#6B7280', maxWidth: '400px', margin: '8px auto 32px auto' }}>The engine is applying fixes and re-inspecting the output against the FOGRA51 policy.</p>

                        <div style={{ maxWidth: '300px', margin: '0 auto', display: 'grid', gap: '8px', textAlign: 'left' }}>
                            {[
                                'Converting RGB to Gracol/Fogra CMYK...',
                                'Generating secondary bleed zones...',
                                'Embedding missing font subsets...',
                                'Flattening transparency layers...',
                                'Running final G-Check recheck...'
                            ].map((task, i) => (
                                <div key={i} style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px', color: i < 4 ? 'var(--sd-success)' : '#6B7280' }}>
                                    {i < 4 ? <CheckCircleIcon className="w-4 h-4" /> : <div className="animate-spin h-3 w-3 border-2 border-blue-600 border-t-transparent rounded-full" />}
                                    {task}
                                </div>
                            ))}
                        </div>

                        <button
                            className="sd-btn-primary"
                            style={{ marginTop: '40px' }}
                            onClick={() => setCurrentStep('DELTA')}
                        >
                            Finalizing Report...
                        </button>
                    </div>
                )}

                {currentStep === 'DELTA' && (
                    <div className="animate-fade-in">
                        <div className="sd-delta-card" style={{ marginBottom: '32px' }}>
                            <div style={{ display: 'flex', justifyContent: 'center', gap: '60px', marginBottom: '32px' }}>
                                <div className="sd-delta-stat">
                                    <div className="sd-delta-value" style={{ color: 'var(--sd-success)' }}>80%</div>
                                    <div className="sd-delta-label">Risk Reduction</div>
                                </div>
                                <div style={{ width: '1px', background: 'rgba(255,255,255,0.1)' }}></div>
                                <div className="sd-delta-stat">
                                    <div className="sd-delta-value">18m</div>
                                    <div className="sd-delta-label">Time Saved</div>
                                </div>
                                <div style={{ width: '1px', background: 'rgba(255,255,255,0.1)' }}></div>
                                <div className="sd-delta-stat">
                                    <div className="sd-delta-value">$24.50</div>
                                    <div className="sd-delta-label">Value (Est)</div>
                                </div>
                            </div>

                            <h2 style={{ fontSize: '24px', margin: '0 0 8px 0' }}>Asset is Production-Ready</h2>
                            <p style={{ color: '#9CA3AF', margin: 0 }}>4 High-risk issues resolved. 1 informational note remaining.</p>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '32px' }}>
                            <div style={{ background: '#F9FAFB', borderRadius: '16px', padding: '20px', border: '1px solid #E5E7EB' }}>
                                <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '12px' }}>Before Optimization</div>
                                <div style={{ height: '180px', background: '#D1D5DB', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6B7280', fontSize: '12px' }}>
                                    [PDF Visualization with RGB markers]
                                </div>
                            </div>
                            <div style={{ background: '#F9FAFB', borderRadius: '16px', padding: '20px', border: '1px solid #E5E7EB' }}>
                                <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '12px' }}>After AutoFix</div>
                                <div style={{ height: '180px', background: '#E5E7EB', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--sd-success)', fontSize: '12px' }}>
                                    [Clean CMYK PDF Output]
                                </div>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
                            <button className="sd-btn-primary" onClick={() => { setFile(null); setCurrentStep('UPLOAD'); setLogs([]); setIsAutoDemo(false); }}>
                                Analyze Another Asset
                            </button>
                            <button className="sd-btn-outline" onClick={() => window.open('https://docs.printprice.pro', '_blank')}>
                                Read Documentation
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Investor Mode Meta-Overlay */}
            {isInvestorMode && (
                <div className="animate-slide-in" style={{
                    marginTop: '24px',
                    background: 'rgba(17, 24, 39, 0.05)',
                    borderRadius: '16px',
                    padding: '24px',
                    border: '1px solid rgba(17, 24, 39, 0.1)'
                }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px' }}>
                        <div>
                            <div style={{ color: '#6B7280', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase' }}>Latency</div>
                            <div style={{ fontSize: '18px', fontWeight: 700 }}>142ms</div>
                        </div>
                        <div>
                            <div style={{ color: '#6B7280', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase' }}>Queue Load</div>
                            <div style={{ fontSize: '18px', fontWeight: 700 }}>2%</div>
                        </div>
                        <div>
                            <div style={{ color: '#6B7280', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase' }}>Threads Active</div>
                            <div style={{ fontSize: '18px', fontWeight: 700 }}>8</div>
                        </div>
                        <div>
                            <div style={{ color: '#6B7280', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase' }}>Reliability</div>
                            <div style={{ fontSize: '18px', fontWeight: 700 }}>99.99%</div>
                        </div>
                    </div>
                    <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid rgba(0,0,0,0.05)', fontSize: '12px', color: '#6B7280' }}>
                        <b>Architecture:</b> BullMQ Distributed Workers • PostgreSQL Job Persistence • Memory-safe PDF Isolation
                    </div>
                </div>
            )}

            {/* Footer Trust Bar */}
            <div style={{ marginTop: '48px', paddingBottom: '40px', textAlign: 'center' }}>
                <p style={{ color: '#9CA3AF', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                    <ShieldCheckIcon className="w-4 h-4" />
                    Deterministic verification powered by Ghostscript 10.03 + Poppler 24.08
                </p>
            </div>
        </div>
    );
}
