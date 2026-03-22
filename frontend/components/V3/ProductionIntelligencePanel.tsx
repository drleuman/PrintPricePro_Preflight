import React from 'react';
import './ProductionIntelligencePanel.css';

interface ProductionIntelligencePanelProps {
    report: any;
}

export const ProductionIntelligencePanel: React.FC<ProductionIntelligencePanelProps> = ({ report }) => {
    const matchmaking = report?.production?.matchmaking;
    const intent = report?.production?.intent;
    const binding = report?.production?.binding;

    if (!matchmaking && !intent) {
        return (
            <div className="v2-report-glass v2-loading" style={{ textAlign: 'center', padding: '2rem' }}>
                Production Intelligence is being calculated...
            </div>
        );
    }

    const bestPrinter = matchmaking?.candidates?.find((c: any) => c.printerId === matchmaking.best_printer_id);

    return (
        <div className="v3-intel-panel">
            <div className="v3-intel-header">
                <span className="v3-intel-tag">V3 Intelligence</span>
                <h2 className="v2-section-title" style={{ margin: 0 }}>Routing Strategy & Matchmaking</h2>
            </div>

            {/* Decision Summary Hub */}
            <div className="v3-decision-hub">
                {/* Intent Detail */}
                <div className="v2-report-glass v3-hub-card intent">
                    <span className="v2-stat-label">Production Intent</span>
                    <div className="v2-stat-value" style={{ color: '#64ffda' }}>
                        {intent?.primary?.type?.replace('_', ' ').toUpperCase() || 'UNKNOWN'}
                    </div>
                    <div className="v3-card-detail">
                        Confidence: <span className="v3-highlight">{(intent?.primary?.confidence * 100).toFixed(0)}%</span>
                        <br />
                        Signal Count: <span className="v3-highlight">{intent?.signals?.length || 0} positive</span>
                    </div>
                </div>

                {/* Binding Detail */}
                <div className="v2-report-glass v3-hub-card physical">
                    <span className="v2-stat-label">Binding Intelligence</span>
                    <div className="v2-stat-value" style={{ color: '#3B82F6' }}>
                        {binding?.specs?.bindingType?.toUpperCase() || 'N/A'}
                    </div>
                    <div className="v3-card-detail">
                        Spine: <span className="v3-highlight">{binding?.results?.spineMm?.toFixed(2) || '0.00'} mm</span>
                        <br />
                        Constraint: <span className="v3-highlight">{binding?.results?.status || 'Valid'}</span>
                    </div>
                </div>

                {/* Best Match */}
                <div className="v2-report-glass v3-hub-card best-match">
                    <span className="v2-stat-label">Optimal Route</span>
                    <div className="v2-stat-value" style={{ color: '#10B981' }}>
                        {bestPrinter?.printerId || 'NO CANDIDATE'}
                    </div>
                    <div className="v3-card-detail">
                        Decision: <span className="v3-highlight" style={{ fontSize: '0.8rem' }}>{matchmaking?.decision_explanation || 'No compatible route.'}</span>
                    </div>
                </div>
            </div>

            {/* Candidate Comparison */}
            <h3 className="v2-stat-label" style={{ marginBottom: '1rem', display: 'block', fontWeight: 'bold' }}>
                MATCHMAKING REGISTRY (TOP {matchmaking?.candidates?.length || 0} CANDIDATES)
            </h3>

            <div className="v3-candidates-grid">
                {matchmaking?.candidates?.map((c: any, i: number) => (
                    <div key={i} className={`v2-report-glass v3-candidate-card ${c.printerId === matchmaking.best_printer_id ? 'selected' : ''} ${c.status === 'incompatible' ? 'incompatible' : ''}`}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <span className="v3-highlight" style={{ fontSize: '0.85rem' }}>{c.printerId}</span>
                            <span className={`v2-badge v2-badge-${c.status === 'ready' ? 'success' : (c.status === 'incompatible' ? 'error' : 'warning')}`} style={{ fontSize: '0.6rem', padding: '2px 6px' }}>
                                {c.status}
                            </span>
                        </div>

                        <div className="v3-score-ring-container">
                            <div className="v3-score-mini">
                                <span className="v3-score-val">{Math.round(c.scores.overall * 100)}%</span>
                                <span className="v3-score-label">Overall</span>
                            </div>
                            <div className="v3-score-mini">
                                <span className="v3-score-val">{Math.round(c.scores.physical * 100)}%</span>
                                <span className="v3-score-label">Phys</span>
                            </div>
                            <div className="v3-score-mini">
                                <span className="v3-score-val">{Math.round(c.scores.commercial * 100)}%</span>
                                <span className="v3-score-label">Comm</span>
                            </div>
                        </div>

                        {c.status === 'incompatible' && c.blockingReasons?.length > 0 && (
                            <div style={{ fontSize: '0.7rem', color: '#ff4d4d', marginTop: '0.5rem' }}>
                                ✖ {c.blockingReasons[0].id}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Technical Audit Trail */}
            <div className="v3-audit-trail">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <span className="v2-stat-label" style={{ fontWeight: 'bold' }}>STRATEGY AUDIT TRAIL</span>
                    <span style={{ fontSize: '0.7rem', color: '#64ffda' }}>Engine v{matchmaking?.metadata?.matchmaker_version || '3.1'}</span>
                </div>

                <div className="v3-audit-row">
                    <span className="v3-audit-key">Matchmaker Weights</span>
                    <span className="v3-audit-val">P: {matchmaking?.metadata?.weights_applied?.physical} | O: {matchmaking?.metadata?.weights_applied?.operative} | C: {matchmaking?.metadata?.weights_applied?.commercial}</span>
                </div>
                <div className="v3-audit-row">
                    <span className="v3-audit-key">Tie-Breaker Logic</span>
                    <span className="v3-audit-val">cost_lowest (via price_index)</span>
                </div>
                <div className="v3-audit-row">
                    <span className="v3-audit-key">Candidates Scanned</span>
                    <span className="v3-audit-val">{matchmaking?.metadata?.total_scanned} nodes</span>
                </div>
                {bestPrinter && (
                    <div className="v3-audit-row">
                        <span className="v3-audit-key">Evidence ID Matrix</span>
                        <div className="v3-evidence-cloud">
                            {bestPrinter.evidence?.map((e: any, idx: number) => (
                                <span key={idx} className={`v3-evidence-chip ${e.passed ? 'passed' : 'failed'}`}>
                                    {e.id}
                                </span>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
