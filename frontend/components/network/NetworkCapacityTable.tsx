import React from "react";
import { MapPinIcon } from "@heroicons/react/24/outline";

interface RegionalStats {
    country: string;
    region: string;
    printers: number;
    capacity_total_today: number;
    capacity_available_today: number;
    capacity_utilization_pct: number;
}

interface Props {
    data: RegionalStats[];
}

export const NetworkCapacityTable: React.FC<Props> = ({ data }) => {
    return (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <h3 className="font-black text-slate-900 uppercase tracking-wider text-xs flex items-center gap-2">
                    <MapPinIcon className="w-4 h-4 text-slate-400" />
                    Capacity by Region
                </h3>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                    <thead>
                        <tr className="bg-slate-50/50 border-b border-slate-200">
                            <th className="px-6 py-3 font-bold text-slate-500 text-[10px] uppercase tracking-widest">Region</th>
                            <th className="px-6 py-3 font-bold text-slate-500 text-[10px] uppercase tracking-widest text-center">Nodes</th>
                            <th className="px-6 py-3 font-bold text-slate-500 text-[10px] uppercase tracking-widest">Utilization</th>
                            <th className="px-6 py-3 font-bold text-slate-500 text-[10px] uppercase tracking-widest text-right">Available</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {data.map((reg, idx) => (
                            <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                <td className="px-6 py-4">
                                    <div className="font-bold text-slate-900">{reg.region}, {reg.country}</div>
                                </td>
                                <td className="px-6 py-4 text-center">
                                    <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md font-bold text-xs border border-slate-200">
                                        {reg.printers}
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-2">
                                        <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden min-w-[80px]">
                                            <div
                                                className={`h-full rounded-full transition-all duration-500 ${reg.capacity_utilization_pct > 80 ? 'bg-rose-500' :
                                                        reg.capacity_utilization_pct > 50 ? 'bg-amber-500' :
                                                            'bg-emerald-500'
                                                    }`}
                                                style={{ width: `${reg.capacity_utilization_pct}%` }}
                                            />
                                        </div>
                                        <span className="font-black text-slate-700 min-w-[2.5rem] text-right text-xs">
                                            {reg.capacity_utilization_pct}%
                                        </span>
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <span className="font-bold text-slate-900">{reg.capacity_available_today}</span>
                                    <span className="text-slate-400 text-[10px] ml-1 uppercase">Units</span>
                                </td>
                            </tr>
                        ))}
                        {data.length === 0 && (
                            <tr>
                                <td colSpan={4} className="px-6 py-12 text-center text-slate-400 font-medium italic">
                                    No regional footprint detected.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
