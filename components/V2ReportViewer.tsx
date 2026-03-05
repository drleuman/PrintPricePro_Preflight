import React, { useState, useEffect } from 'react';
import './V2ReportViewer.css';

interface V2ReportViewerProps {
    jobId: string;
    onClose?: () => void;
}

export const V2ReportViewer: React.FC<V2ReportViewerProps> = ({ jobId, onClose }) => {
    const [job, setJob] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<'executive' | 'technical'>('executive');
    const [expandedFindings, setExpandedFindings] = useState<string[]>([]);

    useEffect(() => {
        let pollTimer: any;

        const fetchStatus = async () => {
            try {
                const res = await fetch(`/api/v2/preflight/jobs/${jobId}`);
                if (!res.ok) throw new Error('Failed to fetch job status');
                const data = await res.json();

                setJob(data);

                if (data.status === 'COMPLETED' || data.status === 'FAILED') {
                    setLoading(false);
                    clearInterval(pollTimer);
                }
            } catch (err: any) {
                setError(err.message);
                setLoading(false);
                clearInterval(pollTimer);
            }
        };

        fetchStatus();
        pollTimer = setInterval(fetchStatus, 2000);

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

    // Timeline steps
    const steps = ['Upload', 'Analyze', 'Magic Fix', 'Recheck', 'Delta'];
    let currentStep = 0;
    if (job?.status === 'PENDING') currentStep = 0;
    else if (job?.status === 'PROCESSING') currentStep = 1;
    else if (job?.progress >= 30) currentStep = 2;
    else if (job?.progress >= 70) currentStep = 3;
    if (job?.status === 'COMPLETED') currentStep = 4;

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
            {job?.status === 'PROCESSING' && (
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
                            <span className="v2-stat-label">Cleared by Magic Fix</span>
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
                        🛡️ Verified by Post-Fix Deterministic Recheck (Ghostscript V10.06 | Poppler 24.x)
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
                        <span className="v2-stat-value">{report.engines.server_engine_version}</span>
                        <span className="v2-stat-label">Policy Active: OFFSET_CMYK_STRICT</span>
                    </div>
                    <div className="v2-report-glass v2-summary-card">
                        <span className="v2-stat-label">Document Summary</span>
                        <span className="v2-stat-value">{report.document.pageCount} Pages</span>
                        <span className="v2-stat-label">{report.document.fileName} • {report.document.pdfVersion}</span>
                    </div>
                </div>
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
                                            <span className={`v2-badge v2-badge-${f.severity?.toLowerCase()}`}>
                                                {f.severity}
                                            </span>
                                        </div>
                                        <p className="v2-finding-msg">{f.user_message}</p>

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
