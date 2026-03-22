import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { LockClosedIcon, ShieldCheckIcon } from '@heroicons/react/24/outline';

export const AuthOverlay: React.FC = () => {
    const { isAuthenticated, loginDev } = useAuth();
    const [loading, setLoading] = useState(false);
    const [tenantId, setTenantId] = useState('ppos-customer-1');

    if (isAuthenticated) return null;

    const handleConnect = async () => {
        setLoading(true);
        await loginDev('admin-user', tenantId);
        setLoading(false);
    };

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/80 backdrop-blur-md">
            <div className="w-full max-w-md p-8 bg-white rounded-2xl shadow-2xl border border-slate-200">
                <div className="flex flex-col items-center text-center space-y-6">
                    <div className="p-4 bg-indigo-50 rounded-full">
                        <ShieldCheckIcon className="w-12 h-12 text-indigo-600" />
                    </div>
                    
                    <div className="space-y-2">
                        <h2 className="text-2xl font-bold text-slate-900">PrintPrice OS Identity</h2>
                        <p className="text-slate-500 text-sm">
                            This app is now decoupled. Please connect to a PPOS Tenant to proceed with industrial preflight operations.
                        </p>
                    </div>

                    <div className="w-full space-y-4">
                        <div className="text-left">
                            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                                Tenant ID
                            </label>
                            <input 
                                type="text"
                                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                value={tenantId}
                                onChange={(e) => setTenantId(e.target.value)}
                                placeholder="e.g. ppos-customer-1"
                            />
                        </div>

                        <button 
                            onClick={handleConnect}
                            disabled={loading}
                            className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 flex items-center justify-center space-x-2 transition-all disabled:opacity-50"
                        >
                            {loading ? (
                                <span className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></span>
                            ) : (
                                <>
                                    <LockClosedIcon className="w-5 h-5" />
                                    <span>Connect to PrintPriceOS</span>
                                </>
                            )}
                        </button>
                    </div>

                    <p className="text-[10px] text-slate-400">
                        Classification: PRODUCT_IDENTITY_BRIDGE (Phase 19.C.9)
                    </p>
                </div>
            </div>
        </div>
    );
};
