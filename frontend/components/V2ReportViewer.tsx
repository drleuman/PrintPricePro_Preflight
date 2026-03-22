import React, { useState, useEffect } from 'react';
import './V2ReportViewer.css';
import { RiskMeter } from './RiskMeter';
import { PdfComparisonViewer } from './PdfComparisonViewer';
import { ProductionIntelligencePanel } from './V3/ProductionIntelligencePanel';

interface V2ReportViewerProps {
    jobId: string;
    originalUrl?: string | null;
    onClose?: () => void;
}

export const V2ReportViewer: React.FC<V2ReportViewerProps> = ({ jobId, originalUrl, onClose }) => {
    const [job, setJob] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<'executive' | 'technical'>('executive');
    const [expandedFindings, setExpandedFindings] = useState<string[]>([]);

    useEffect(() => {
        let pollTimer: any;
        let pollCount = 0;

        const fetchStatus = async () => {
            try {
                const res = await fetch(`/api/v2/preflight/jobs/${jobId}`);
                if (!res.ok) throw new Error('Failed to fetch job status');
                const data = await res.json();

                setJob(data);
                pollCount++;

                if (data.status === 'SUCCEEDED' || data.status === 'FAILED') {
                    setLoading(false);
                    clearInterval(pollTimer);
                } else {
                    // Adjust interval dynamically: 1s for first 10 loops, then 3s
                    const nextInterval = pollCount < 10 ? 1000 : 3000;
                    clearInterval(pollTimer);
                    pollTimer = setInterval(fetchStatus, nextInterval);
                }
            } catch (err: any) {
                setError(err.message);
                setLoading(false);
                clearInterval(pollTimer);
            }
        };

        fetchStatus();
        pollTimer = setInterval(fetchStatus, 1000);

        return () => clearInterval(pollTimer);
    }, [jobId]);

    const toggleEvidence = (id: string) => {
        setExpandedFindings(prev =>
            prev.includes(id) ? prev.filter(fid => fid !== id) : [...prev, id]
        );
    };

    if (error) {
        return (
            <div className="v2-report-container">
                <div className="v2-report-glass">
                    <h1 className="v2-error">Error: {error}</h1>
                    <button onClick={onClose} className="v2-stat-label" style={{ cursor: 'pointer' }}>Close</button>
                </div>
            </div>
        );
    }

    if (loading && !job) {
        return (
            <div className="v2-report-container">
                <div className="v2-report-glass v2-loading">
                    <h2 style={{ color: '#64ffda', marginBottom: '1rem' }}>Initializing V2 Analysis Engine...</h2>
                    <p>Connecting to BullMQ Cluster & Deterministic Probes</p>
                </div>
            </div>
        );
    }

    const report = job?.report;
    const delta = job?.delta;

    // Calculate Risk Score
    const calculateRiskScore = () => {
        if (!report?.findings) return 0;
        let score = 0;
        report.findings.forEach((f: any) => {
            if (f.severity === 'ERROR' || f.severity === 'CRITICAL') score += 30;
            else if (f.severity === 'WARNING') score += 10;
            else if (f.severity === 'INFO') score += 2;
        });
        return Math.min(100, score);
    };
    const riskScore = calculateRiskScore();

    // Timeline steps
    const steps = ['Upload', 'Analyze', 'Magic Fix', 'Recheck', 'Delta'];
    let currentStep = 0;
    if (job?.status === 'QUEUED') currentStep = 0;
    else if (job?.status === 'RUNNING' && job?.progress < 30) currentStep = 1;
    else if (job?.progress >= 30 && job?.progress < 70) currentStep = 2;
    else if (job?.progress >= 70 && job?.progress < 100) currentStep = 3;
    if (job?.status === 'SUCCEEDED') currentStep = 4;

    const hasResolved = (id: string) => delta?.resolved_ids?.includes(id);

    return (
        <div className="v2-report-container">
            {/* Header */}
            <div className="v2-header">
                <div>
                    <h1 className="v2-title">PrintRisk Intelligence Result</h1>
                    <p style={{ color: '#94a3b8', marginTop: '0.25rem' }}>Asset ID: {job?.job_id?.split('-')[0]}</p>
                </div>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    {/* View Switch */}
                    <div className="v2-view-switch">
                        <button
                            className={viewMode === 'executive' ? 'active' : ''}
                            onClick={() => setViewMode('executive')}
                        >
                            Executive
                        </button>
                        <button
                            className={viewMode === 'technical' ? 'active' : ''}
                            onClick={() => setViewMode('technical')}
                        >
                            Technical
                        </button>
                    </div>
                    {onClose && <button onClick={onClose} className="v2-btn-outline">Exit Demo</button>}
                </div>
            </div>

            {/* Timeline */}
            <div className="v2-timeline v2-report-glass">
                {steps.map((step, idx) => (
                    <div key={step} className={`v2-timeline-step ${idx <= currentStep ? 'active' : ''}`}>
                        <div className="v2-timeline-circle">{idx <= currentStep ? '✓' : idx + 1}</div>
                        <span className="v2-timeline-label">{step}</span>
                        {idx < steps.length - 1 && <div className={`v2-timeline-line ${idx < currentStep ? 'active' : ''}`} />}
                    </div>
                ))}
            </div>

            {/* Loading State Mid-Timeline */}
            {job?.status === 'RUNNING' && (
                <div className="v2-report-glass v2-loading" style={{ textAlign: 'center', margin: '2rem 0' }}>
                    <h2 style={{ color: '#64ffda', margin: 0 }}>AI V2-Engine is processing your file...</h2>
                    <p style={{ marginTop: '0.5rem', color: '#94a3b8' }}>{job?.progress}% completed</p>
                </div>
            )}

            {/* Delta Hero Card */}
            {delta && (
                <div className="v2-delta-hero v2-report-glass">
                    <div className="v2-hero-main">
                        <div>
                            <h2 style={{ fontSize: '2rem', margin: 0, color: '#10B981' }}>
                                +{Math.round((delta.fixed_count * 15) / 60 * 10) / 10} hrs
                            </h2>
                            <span className="v2-stat-label">Manual Prepress Saved</span>
                        </div>
                        <div style={{ width: '1px', background: 'rgba(255,255,255,0.1)' }}></div>
                        <div>
                            <h2 style={{ fontSize: '2rem', margin: 0, color: '#3B82F6' }}>
                                {delta.fixed_count > 0 ? '$' + (delta.fixed_count * 25) : '$0'}
                            </h2>
                            <span className="v2-stat-label">Value Generated (Est.)</span>
                        </div>
                        <div style={{ width: '1px', background: 'rgba(255,255,255,0.1)' }}></div>
                        <div>
                            <h2 style={{ fontSize: '2rem', margin: 0, color: '#00e676' }}>
                                {delta.fixed_count} Issues
                            </h2>
                            <span className="v2-stat-label">Resolved by AI Magic Fix</span>
                        </div>
                    </div>

                    <div className="v2-hero-metrics">
                        <div className="v2-metric-row">
                            <span className="v2-metric-label">RGB Objects</span>
                            <span className="v2-metric-val">
                                {hasResolved('rgb-only-content') ? <><span className="v2-strike">Detected</span> → <span className="v2-green">0</span></> : '0'}
                            </span>
                        </div>
                        <div className="v2-metric-row">
                            <span className="v2-metric-label">Spots</span>
                            <span className="v2-metric-val">
                                {hasResolved('spot-color-detected') ? <><span className="v2-strike">Found</span> → <span className="v2-green">Converted</span></> : '0 / Allowed'}
                            </span>
                        </div>
                        <div className="v2-metric-row">
                            <span className="v2-metric-label">Max TAC</span>
                            <span className="v2-metric-val">
                                {hasResolved('tac_limit') ? <><span className="v2-strike">Exceeded</span> → <span className="v2-green">Safe</span></> : 'Safe limit'}
                            </span>
                        </div>
                        <div className="v2-metric-row">
                            <span className="v2-metric-label">Fonts Embedded</span>
                            <span className="v2-metric-val">
                                {hasResolved('fonts-not-embedded') ? <><span className="v2-strike">False</span> → <span className="v2-green">True</span></> : <span className="v2-green">True → True</span>}
                            </span>
                        </div>
                        <div className="v2-metric-row">
                            <span className="v2-metric-label">Bleed Zone</span>
                            <span className="v2-metric-val">
                                {hasResolved('missing-bleed-info') || hasResolved('bleed_mm_required') ? <><span className="v2-strike">Missing</span> → <span className="v2-green">Added via AI</span></> : <span className="v2-green">Intact</span>}
                            </span>
                        </div>
                    </div>

                    <div style={{ textAlign: 'center', marginTop: '1rem', fontSize: '0.8rem', color: '#94a3b8' }}>
                        🛡️ Certified by AI Magic Fix Post-Analysis (Ghostscript 10.06 | Poppler 24.x)
                    </div>

                    <div className="v2-action-buttons">
                        <button
                            className="v2-btn-primary"
                            onClick={() => {
                                if (job?.download_url) {
                                    window.open(job.download_url, '_blank');
                                }
                            }}
                            disabled={!job?.download_url}
                            style={{ opacity: job?.download_url ? 1 : 0.5 }}
                        >
                            Download Fixed PDF (Secure)
                        </button>
                        <button className="v2-btn-outline">Download Report JSON</button>
                    </div>
                </div>
            )}

            {/* Document Info */}
            {report && viewMode === 'technical' && (
                <div className="v2-grid">
                    <div className="v2-report-glass v2-summary-card">
                        <span className="v2-stat-label">Engine Configuration</span>
                        <span className="v2-stat-value" style={{ fontSize: '1.2rem' }}>{report.engines?.server_engine_version || 'v2.2.0-PRO'}</span>
                        <span className="v2-stat-label">Policy: {report.policy?.name || 'OFFSET_CMYK_STRICT'}</span>
                    </div>
                    <div className="v2-report-glass v2-summary-card">
                        <span className="v2-stat-label">Classification: {report.classification?.type || 'DOCUMENT'}</span>
                        <span className="v2-stat-value" style={{ fontSize: '1.2rem' }}>{report.classification?.format || 'Custom'}</span>
                        <span className="v2-stat-label">{report.document?.pageCount} Pages • {report.classification?.spineMm?.toFixed(2) || '0.00'}mm Spine</span>
                    </div>
                    <div className="v2-report-glass v2-summary-card">
                        <span className="v2-stat-label">Editorial Geometry</span>
                        <span className="v2-stat-value" style={{
                            fontSize: '1.2rem',
                            color: report.bleedAudit?.status === 'PASS' ? '#10B981' : '#F59E0B'
                        }}>
                            {report.bleedAudit?.status === 'PASS' ? 'Bleed OK' : 'Bleed Warning'}
                        </span>
                        <span className="v2-stat-label">
                            {report.bleedAudit?.bleed ?
                                `${report.bleedAudit.bleed.top.toFixed(1)}mm / ${report.bleedAudit.bleed.left.toFixed(1)}mm`
                                : 'Missing Box Metadata'}
                        </span>
                    </div>
                </div>
            )}

            {/* Risk and Comparison */}
            {report && (
                <div className="v2-grid" style={{ marginTop: '1.5rem' }}>
                    <div className="v2-report-glass">
                        <RiskMeter score={riskScore} />
                    </div>
                    {originalUrl && job?.download_url && (
                        <div style={{}}>
                            {/* Empty gap for grid alignment if needed or more stats */}
                        </div>
                    )}
                </div>
            )}

            {originalUrl && job?.download_url && (
                <PdfComparisonViewer originalUrl={originalUrl} fixedUrl={job.download_url} />
            )}

            {/* V3 Production Intelligence */}
            {report && (
                <ProductionIntelligencePanel report={report} />
            )}

            {/* Findings List */}
            {report && (
                <div className="v2-report-glass" style={{ marginTop: '2rem' }}>
                    <h2 className="v2-section-title">
                        {viewMode === 'executive' ? 'Remaining Action Items' : `Findings Registry (${report.findings.length})`}
                    </h2>

                    <div className="v2-findings-list">
                        {report.findings.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
                                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎉</div>
                                <h3 style={{ margin: 0, color: '#f8f9fa' }}>Zero Issues Detected</h3>
                                <p className="v2-stat-label" style={{ marginTop: '0.5rem' }}>This document is flawlessly prepared for production.</p>
                            </div>
                        ) : (
                            report.findings.map((f: any, i: number) => {
                                const isExpanded = expandedFindings.includes(f.id);
                                return (
                                    <div key={i} className="v2-finding-item">
                                        <div className="v2-finding-header">
                                            <span className="v2-finding-title">{f.title || f.id}</span>
                                            <span className={`v2-badge v2-badge-${f.severity?.toLowerCase()} shadow-sm shadow-red-500/10`}>
                                                {f.severity}
                                            </span>
                                        </div>
                                        <p className="v2-finding-msg text-slate-300 italic">“{f.user_message}”</p>

                                        {viewMode === 'technical' && (
                                            <div style={{ marginTop: '1rem' }}>
                                                <button
                                                    className="v2-evidence-toggle"
                                                    onClick={() => toggleEvidence(f.id)}
                                                >
                                                    {isExpanded ? 'Hide Evidence' : 'Show Proof / Evidence (GS/Poppler)'}
                                                </button>

                                                {isExpanded && (
                                                    <div className="v2-evidence-box">
                                                        <div className="v2-stat-label" style={{ marginBottom: '0.5rem', color: '#64ffda' }}>Data Source: {f.evidence?.source || 'deterministic_probe'}</div>
                                                        <code>{f.developer_message || JSON.stringify(f.evidence, null, 2)}</code>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {viewMode === 'technical' && f.tags?.length > 0 && (
                                            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                                                {f.tags.map((t: string) => (
                                                    <span key={t} className="v2-delta-tag">#{t}</span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )
                            })
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
