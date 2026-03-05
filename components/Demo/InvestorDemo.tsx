import React, { useState, useEffect, useRef } from 'react';
import { FileMeta } from '../../types';
import { SparklesIcon, DocumentTextIcon, Cog6ToothIcon, RocketLaunchIcon, XCircleIcon, CheckCircleIcon, CpuChipIcon } from '@heroicons/react/24/outline';

interface InvestorDemoProps {
    onBack: () => void;
    onJobComplete: (jobId: string) => void;
}

export function InvestorDemo({ onBack, onJobComplete }: InvestorDemoProps) {
    const [file, setFile] = useState<File | null>(null);
    const [dragActive, setDragActive] = useState(false);
    const [policies, setPolicies] = useState<any[]>([]);
    const [selectedPolicy, setSelectedPolicy] = useState<string>('OFFSET_CMYK_STRICT');

    const [uploading, setUploading] = useState(false);
    const [jobId, setJobId] = useState<string | null>(null);
    const [status, setStatus] = useState<string | null>(null);
    const [progress, setProgress] = useState(0);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Load available policies from backend
    useEffect(() => {
        fetch('/api/v2/preflight/policies')
            .then(r => r.json())
            .then(res => {
                if (res.ok && res.policies) {
                    setPolicies(res.policies);
                }
            })
            .catch(console.error);
    }, []);

    // Poll Job Status
    useEffect(() => {
        if (!jobId) return;
        const interval = setInterval(() => {
            fetch(`/api/v2/preflight/jobs/${jobId}`)
                .then(r => r.json())
                .then(res => {
                    if (res.job) {
                        setStatus(res.job.status);
                        setProgress(res.job.progress || 0);
                        if (res.job.status === 'COMPLETED') {
                            clearInterval(interval);
                            onJobComplete(jobId);
                        } else if (res.job.status === 'FAILED') {
                            clearInterval(interval);
                            setStatus('FAILED');
                        }
                    }
                })
                .catch(console.error);
        }, 1000);
        return () => clearInterval(interval);
    }, [jobId, onJobComplete]);

    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
        else if (e.type === 'dragleave') setDragActive(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            setFile(e.dataTransfer.files[0]);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };

    const startDemo = async () => {
        if (!file) return;
        setUploading(true);
        const fd = new FormData();
        fd.append('pdf', file);
        const selectedProfile = selectedPolicy; // Assuming selectedProfile should be derived from selectedPolicy
        fd.append('policy', selectedProfile);

        try {
            const res = await fetch('/api/v2/preflight/analyze', { method: 'POST', body: fd });
            const data = await res.json();
            if (data.jobId || data.job_id) {
                setJobId(data.jobId || data.job_id);
                setStatus('PENDING');
            } else {
                alert('Upload failed: ' + (data.error || 'Unknown error'));
                setUploading(false);
            }
        } catch (err) {
            console.error(err);
            alert('Network error');
            setUploading(false);
        }
    };

    return (
        <div style={{
            background: 'rgba(255,255,255,0.7)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.5)',
            borderRadius: '24px',
            padding: '40px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.1)',
            maxWidth: '1000px',
            margin: '0 auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '32px'
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h2 style={{ margin: 0, fontSize: '28px', color: '#111827', letterSpacing: '-0.5px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <SparklesIcon className="w-8 h-8 text-blue-600" /> Investor Demo Mode
                    </h2>
                    <p style={{ margin: '8px 0 0 0', color: '#4B5563', fontSize: '15px' }}>
                        Experience the power of the PrintPricePro V2 AutoFix Engine with Policy Enforcement.
                    </p>
                </div>
                {!window.location.hostname.startsWith('demo') && (
                    <button onClick={onBack} style={{
                        background: 'none', border: '1px solid #E5E7EB', borderRadius: '8px', padding: '8px 16px',
                        color: '#374151', cursor: 'pointer', fontWeight: 600
                    }}>
                        Close Demo
                    </button>
                )}
            </div>

            {!jobId && !uploading && (
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 300px', gap: '24px' }}>
                    <div
                        onDragEnter={handleDrag}
                        onDragLeave={handleDrag}
                        onDragOver={handleDrag}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                        style={{
                            border: `2px dashed ${dragActive ? '#3B82F6' : '#D1D5DB'}`,
                            borderRadius: '16px',
                            padding: '60px 40px',
                            textAlign: 'center',
                            cursor: 'pointer',
                            background: dragActive ? 'rgba(59, 130, 246, 0.05)' : '#F9FAFB',
                            transition: 'all 0.2s ease',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}
                    >
                        <input type="file" onChange={handleChange} style={{ display: 'none' }} ref={fileInputRef} accept="application/pdf" />
                        <div style={{ marginBottom: '16px' }}><DocumentTextIcon className="w-12 h-12 text-gray-400 mx-auto" /></div>
                        {file ? (
                            <div>
                                <b style={{ color: '#111827' }}>{file.name}</b>
                                <div style={{ color: '#6B7280', fontSize: '14px', marginTop: '4px' }}>{(file.size / 1024 / 1024).toFixed(2)} MB</div>
                            </div>
                        ) : (
                            <div>
                                <strong style={{ color: '#3B82F6', fontSize: '16px' }}>Click to upload</strong>
                                <span style={{ color: '#6B7280', display: 'block', marginTop: '4px' }}>or drag and drop a PDF file here</span>
                            </div>
                        )}
                    </div>

                    <div style={{
                        background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '16px', padding: '24px',
                        display: 'flex', flexDirection: 'column', gap: '16px'
                    }}>
                        <h3 style={{ margin: 0, fontSize: '16px', color: '#111827', display: 'flex', alignItems: 'center', gap: '6px' }}><Cog6ToothIcon className="w-5 h-5 text-gray-500" /> Print Policy</h3>
                        <p style={{ margin: 0, fontSize: '13px', color: '#6B7280' }}>
                            Select the target machine rules. The AI will conform the PDF to these exact limits.
                        </p>
                        <select
                            value={selectedPolicy}
                            onChange={e => setSelectedPolicy(e.target.value)}
                            style={{
                                width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #D1D5DB',
                                background: '#fff', fontSize: '14px', color: '#111827', outline: 'none', cursor: 'pointer'
                            }}
                        >
                            {policies.map(p => (
                                <option key={p.slug} value={p.slug}>{p.name}</option>
                            ))}
                            {policies.length === 0 && <option value="OFFSET_CMYK_STRICT">Loading policies...</option>}
                        </select>

                        <div style={{ marginTop: 'auto' }}>
                            <button
                                disabled={!file}
                                onClick={startDemo}
                                style={{
                                    width: '100%', padding: '14px', borderRadius: '8px', background: !file ? '#D1D5DB' : '#111827',
                                    color: '#fff', border: 'none', fontWeight: 600, fontSize: '15px', cursor: !file ? 'not-allowed' : 'pointer',
                                    transition: 'background 0.2s', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                                }}
                            >
                                <RocketLaunchIcon className="w-5 h-5" /> Run AI AutoFix
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {(uploading || jobId) && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    <div style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '16px', padding: '32px', textAlign: 'center' }}>
                        <h3 style={{ margin: '0 0 16px 0', fontSize: '20px', color: '#111827', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                            {status === 'FAILED' ? <><XCircleIcon className="w-6 h-6 text-red-500" /> Processing Failed</> :
                                status === 'COMPLETED' ? <><CheckCircleIcon className="w-6 h-6 text-emerald-500" /> Optimization Complete</> :
                                    <><CpuChipIcon className="w-6 h-6 text-blue-500 animate-pulse" /> Engine Processing...</>}
                        </h3>

                        <div style={{ width: '100%', height: '12px', background: '#E5E7EB', borderRadius: '6px', overflow: 'hidden', marginBottom: '16px' }}>
                            <div style={{
                                height: '100%',
                                background: status === 'FAILED' ? '#EF4444' : status === 'COMPLETED' ? '#10B981' : '#3B82F6',
                                width: `${Math.max(5, progress)}%`,
                                transition: 'width 0.5s ease',
                            }} />

                        </div>

                        <div style={{ fontSize: '14px', color: '#6B7280', fontWeight: 500, fontFamily: 'monospace' }}>
                            {status === 'COMPLETED' ? 'Finalizing report and value metrics...' :
                                status === 'FAILED' ? 'An error occurred during processing.' :
                                    progress < 20 ? 'Enqueuing V2 Async Job...' :
                                        progress < 50 ? 'Deterministic Core Analysis (Poppler/Ghostscript)...' :
                                            progress < 80 ? 'Heuristic Core Analysis & Layout Inference...' :
                                                'AutoFix Execution (Rendering corrections to PDF)...'}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
