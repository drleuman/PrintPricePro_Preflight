import React from "react";
import { ExclamationTriangleIcon, BoltIcon } from "@heroicons/react/24/outline";

interface Warning {
    type: string;
    printer_id: string;
    printer_name: string;
    severity: 'CRITICAL' | 'WARNING';
    message: string;
    evaluated_at: string;
}

interface Props {
    warnings: Warning[];
    onWarningClick: (printerId: string) => void;
}

export const NetworkHealthPanel: React.FC<Props> = ({ warnings, onWarningClick }) => {
    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between px-1">
                <h3 className="font-black text-slate-900 uppercase tracking-wider text-[10px] flex items-center gap-2">
                    <ExclamationTriangleIcon className="w-4 h-4 text-rose-500" />
                    Operational Risks & Alerts
                </h3>
                <span className="px-2 py-0.5 bg-rose-100 text-rose-700 rounded-full text-[9px] font-black">
                    {warnings.length} Active alerts
                </span>
            </div>
            <div className="space-y-3 max-h-[400px] overflow-y-auto scrollbar-hide pr-1">
                {warnings.map((alert, idx) => (
                    <div
                        key={idx}
                        onClick={() => onWarningClick(alert.printer_id)}
                        className={`p-4 rounded-xl border-l-4 cursor-pointer hover:scale-[1.02] transition-all active:scale-95 group ${alert.severity === 'CRITICAL'
                                ? 'bg-rose-50/50 border-rose-500 hover:bg-rose-50'
                                : 'bg-amber-50/50 border-amber-500 hover:bg-amber-50'
                            }`}
                    >
                        <div className="flex items-start gap-3">
                            <div className={`mt-0.5 p-1 rounded-lg ${alert.severity === 'CRITICAL' ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-600'}`}>
                                <BoltIcon className="w-4 h-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                    <span className="text-xs font-black text-slate-900 truncate uppercase tracking-tight">
                                        {alert.printer_name}
                                    </span>
                                    <span className="text-[8px] font-heavy text-slate-400 whitespace-nowrap">
                                        {new Date(alert.evaluated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                                <div className="text-[10px] font-bold text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                                    {alert.message}
                                </div>
                                <div className={`text-[8px] font-black mt-2 uppercase tracking-widest ${alert.severity === 'CRITICAL' ? 'text-rose-500' : 'text-amber-600'}`}>
                                    {alert.type.replace(/_/g, ' ')}
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
                {warnings.length === 0 && (
                    <div className="p-8 text-center bg-slate-50 border border-slate-200 border-dashed rounded-xl text-slate-400 text-xs font-black uppercase tracking-widest flex flex-col items-center gap-2">
                        <div className="w-8 h-8 bg-emerald-100 text-emerald-600 rounded-lg flex items-center justify-center">
                            <ShieldCheckIcon className="w-5 h-5" />
                        </div>
                        No Risks Detected
                    </div>
                )}
            </div>
        </div>
    );
};

// Supporting icon import (was missing in previous thought)
import { ShieldCheckIcon } from "@heroicons/react/24/outline";
