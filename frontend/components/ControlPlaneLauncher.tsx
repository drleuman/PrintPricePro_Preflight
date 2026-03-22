import React, { useEffect, useState } from 'react';
import { RocketLaunchIcon, ExclamationCircleIcon, ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';

export const ControlPlaneLauncher: React.FC = () => {
    const [status, setStatus] = useState<'checking' | 'available' | 'unavailable' | 'disabled'>('checking');
    const controlPlaneUrl = process.env.VITE_CONTROL_PLANE_URL || 'http://localhost:3001';

    useEffect(() => {
        const checkHealth = async () => {
            try {
                // Check if feature is even enabled (could be from session/metadata)
                const isEnabled = !window.location.search.includes('disable_cp=1');
                if (!isEnabled) {
                    setStatus('disabled');
                    return;
                }

                // Check Control Plane Health (API side usually easier to check)
                const controllerApi = controlPlaneUrl.replace('3001', '8081'); // Heuristic for dev
                const res = await fetch(`${controllerApi}/health`, { mode: 'cors' });
                if (res.ok) {
                    setStatus('available');
                    // Optional: Auto-redirect after short delay
                    // setTimeout(() => window.location.href = controlPlaneUrl, 2000);
                } else {
                    setStatus('unavailable');
                }
            } catch (err) {
                console.error('Control Plane health check failed', err);
                setStatus('unavailable');
            }
        };

        checkHealth();
    }, [controlPlaneUrl]);

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
            <div className="max-w-md w-full glass rounded-3xl p-8 shadow-2xl border border-white flex flex-col items-center text-center">
                <div className="w-20 h-20 bg-primary/10 rounded-2xl flex items-center justify-center mb-6">
                    <RocketLaunchIcon className="w-10 h-10 text-primary animate-pulse" />
                </div>
                
                <h1 className="text-2xl font-black text-slate-900 mb-2 tracking-tight">
                    PrintPrice Control Plane
                </h1>
                <p className="text-slate-500 text-sm mb-8 leading-relaxed">
                    You are being transitioned to the dedicated platform governance surface. 
                    Administration has been decoupled from the product surface for enhanced security and operational high-availability.
                </p>

                {status === 'checking' && (
                    <div className="flex flex-col items-center gap-3">
                        <div className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Verifying Connection...</span>
                    </div>
                )}

                {status === 'available' && (
                    <div className="space-y-4 w-full">
                        <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100 flex items-center justify-center gap-2 mb-4">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="text-xs font-bold text-emerald-700">Service Reachable</span>
                        </div>
                        <a 
                            href={controlPlaneUrl}
                            className="flex items-center justify-center gap-2 w-full py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all shadow-lg hover:translate-y-[-2px] active:translate-y-0"
                        >
                            Open Control Plane
                            <ArrowTopRightOnSquareIcon className="w-4 h-4" />
                        </a>
                    </div>
                )}

                {status === 'unavailable' && (
                    <div className="w-full">
                        <div className="p-4 bg-red-50 rounded-2xl border border-red-100 flex items-center gap-4 mb-6">
                            <ExclamationCircleIcon className="w-6 h-6 text-red-500 shrink-0" />
                            <div className="text-left">
                                <div className="text-xs font-bold text-red-700">Connection Failed</div>
                                <div className="text-[10px] text-red-500">The Control Plane service is currently unreachable or offline.</div>
                            </div>
                        </div>
                        <button 
                            onClick={() => window.location.reload()}
                            className="text-sm font-bold text-slate-400 hover:text-slate-600 uppercase tracking-widest"
                        >
                            Retry Connection
                        </button>
                    </div>
                )}

                {status === 'disabled' && (
                    <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 text-amber-700 font-bold text-sm">
                        Admin access is currently restricted via feature flag.
                    </div>
                )}

                <div className="mt-8 pt-6 border-t border-slate-100 w-full">
                    <div className="text-[9px] font-bold text-slate-300 uppercase tracking-[0.2em]">
                        Phase 19.A Environment • Preflight V2
                    </div>
                </div>
            </div>
        </div>
    );
};
