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

    if (error) {
        return (
            <div className="v2-report-container">
                <div className="v2-report-glass">
                    <h1 className="v2-error">Error: {error}</h1>
                    <button onClick={onClose} className="v2-stat-label">Close</button>
                </div>
            </div>
        );
    }

    if (loading && !job) {
        return (
            <div className="v2-report-container">
                <div className="v2-report-glass v2-loading">
                    <h2>Initializing V2 Analysis Engine...</h2>
                    <p>Connecting to BullMQ Cluster</p>
                </div>
            </div>
        );
    }

    const report = job?.report;
    const delta = job?.delta;

    return (
        <div className="v2-report-container">
            <div className="v2-header">
                <h1 className="v2-title">PrintPrice Preflight V2-Engine</h1>
                {onClose && <button onClick={onClose} style={{ color: 'white', background: 'none', border: '1px solid #333', padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer' }}>Back to Workflow</button>}
            </div>

            <div className="v2-grid">
                <div className="v2-report-glass v2-summary-card">
                    <span className="v2-stat-label">Job Status</span>
                    <span className={`v2-badge v2-badge-${job.status === 'COMPLETED' ? 'success' : job.status === 'FAILED' ? 'error' : 'info'}`}>
                        {job.status}
                    </span>
                    <div style={{ marginTop: '1rem' }}>
                        <span className="v2-stat-label">Progress</span>
                        <div style={{ width: '100%', height: '4px', background: '#333', borderRadius: '2px', marginTop: '4px' }}>
                            <div style={{ width: `${job.progress}%`, height: '100%', background: '#64ffda', transition: 'width 0.3s ease' }} />
                        </div>
                    </div>
                </div>

                {report && (
                    <div className="v2-report-glass v2-summary-card">
                        <span className="v2-stat-label">Document Summary</span>
                        <span className="v2-stat-value">{report.document.pageCount} Pages</span>
                        <span className="v2-stat-label">{report.document.fileName} • {report.document.pdfVersion}</span>
                    </div>
                )}
            </div>

            {report && (
                <div className="v2-report-glass">
                    <h2 className="v2-section-title">Findings Registry ({report.findings.length})</h2>
                    <div className="v2-findings-list">
                        {report.findings.length === 0 ? (
                            <p className="v2-stat-label" style={{ textAlign: 'center', padding: '2rem' }}>No issues detected. Print ready.</p>
                        ) : (
                            report.findings.map((f: any, i: number) => (
                                <div key={i} className="v2-finding-item">
                                    <div className="v2-finding-header">
                                        <span className="v2-finding-title">{f.title}</span>
                                        <span className={`v2-badge v2-badge-${f.severity}`}>
                                            {f.severity}
                                        </span>
                                    </div>
                                    <p className="v2-finding-msg">{f.user_message}</p>
                                    {f.developer_message && (
                                        <code style={{ fontSize: '0.7rem', color: '#64ffda', opacity: 0.7 }}>
                                            {f.developer_message}
                                        </code>
                                    )}
                                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                                        {f.tags?.map((t: string) => (
                                            <span key={t} className="v2-delta-tag">#{t}</span>
                                        ))}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}

            {delta && (
                <div className="v2-delta-container v2-report-glass">
                    <div className="v2-value-generated" style={{
                        background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(59, 130, 246, 0.1))',
                        padding: '1.5rem',
                        borderRadius: '12px',
                        border: '1px solid rgba(16, 185, 129, 0.3)',
                        marginBottom: '1.5rem',
                        display: 'flex',
                        justifyContent: 'space-around',
                        textAlign: 'center'
                    }}>
                        <div>
                            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#10B981' }}>
                                +{Math.round((delta.fixed_count * 15) / 60 * 10) / 10} hrs
                            </div>
                            <div className="v2-stat-label">Manual Prepress Saved</div>
                        </div>
                        <div>
                            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#3B82F6' }}>
                                {delta.fixed_count > 0 ? '$' + (delta.fixed_count * 25) : '$0'}
                            </div>
                            <div className="v2-stat-label">Value Generated (Est.)</div>
                        </div>
                    </div>

                    <h2 className="v2-section-title" style={{ color: '#64ffda' }}>AutoFix Delta Summary</h2>
                    <div className="v2-delta-grid">
                        <div className="v2-delta-column">
                            <span className="v2-stat-label">Impact</span>
                            <span className="v2-stat-value" style={{ color: '#00e676' }}>+{delta.fixed_count} Resolved</span>
                            <span className="v2-stat-label">Issues cleared by AI Magic Fix</span>
                        </div>
                        <div className="v2-delta-column">
                            <span className="v2-stat-label">Remaining Risks</span>
                            <span className="v2-stat-value" style={{ color: '#ffcc00' }}>{delta.remaining_count} Warning</span>
                            <span className="v2-stat-label">Requires manual check</span>
                        </div>
                    </div>
                    {delta.resolved_ids.length > 0 && (
                        <div style={{ marginTop: '1.5rem' }}>
                            <span className="v2-stat-label">Resolved Issues:</span>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
                                {delta.resolved_ids.map((id: string) => (
                                    <span key={id} className="v2-delta-tag" style={{ border: '1px solid #00e676' }}>{id}</span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
