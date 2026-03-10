import React, { useState, useEffect } from "react";
import * as adminApi from "../../lib/adminApi";
import {
    BanknotesIcon,
    DocumentTextIcon,
    ArrowTrendingUpIcon,
    BoltIcon,
    ClockIcon,
    IdentificationIcon,
    CurrencyEuroIcon,
    CheckCircleIcon,
    ExclamationCircleIcon,
    ListBulletIcon
} from "@heroicons/react/24/outline";

export const FinancialOpsTab: React.FC = () => {
    const [transactions, setTransactions] = useState<any[]>([]);
    const [selectedTx, setSelectedTx] = useState<any | null>(null);
    const [metrics, setMetrics] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 10000);
        return () => clearInterval(interval);
    }, []);

    const fetchData = async () => {
        try {
            const [tData, mData] = await Promise.all([
                adminApi.getFinanceTransactions(),
                adminApi.getFinanceMetrics()
            ]);
            setTransactions(Array.isArray(tData) ? tData : []);
            setMetrics(mData);
            setLoading(false);
        } catch (err) {
            console.error('Failed to fetch finance data:', err);
        }
    };

    const fetchDetail = async (id: string) => {
        try {
            const data = await adminApi.getFinanceTransactionDetail(id);
            setSelectedTx(data);
        } catch (err) {
            console.error('Failed to fetch transaction detail:', err);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                        <BanknotesIcon className="w-6 h-6 text-emerald-600" />
                        Financial Operations
                    </h2>
                    <p className="text-sm text-slate-500 font-medium tracking-tight">Immutable settlement ledger & global remittance tracking.</p>
                </div>
                <div className="flex gap-2">
                    <div className="flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-lg border border-emerald-100 text-[10px] font-black uppercase tracking-widest">
                        <BoltIcon className="w-3 h-3" /> Ledger Active
                    </div>
                </div>
            </div>

            {/* Financial Metrics */}
            {metrics && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Gross Volume</div>
                        <div className="text-2xl font-black text-slate-900">{metrics.total_gross?.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' }) || '0 €'}</div>
                    </div>
                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                        <div className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-1">Platform Revenue</div>
                        <div className="text-2xl font-black text-slate-900">{metrics.total_fees?.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' }) || '0 €'}</div>
                    </div>
                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                        <div className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-1">Settled Trans.</div>
                        <div className="text-2xl font-black text-slate-900">{metrics.settled_count}</div>
                    </div>
                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                        <div className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-1">Settlement Rate</div>
                        <div className="text-2xl font-black text-slate-900">{((metrics.settled_count / metrics.total_count) * 100 || 0).toFixed(1)}%</div>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Transactions Table */}
                <div className="lg:col-span-2">
                    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50/50 border-b border-slate-100">
                                <tr>
                                    <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Reference</th>
                                    <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Job</th>
                                    <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Gross</th>
                                    <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Fee</th>
                                    <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {transactions.map((tx, i) => (
                                    <tr
                                        key={i}
                                        onClick={() => fetchDetail(tx.id)}
                                        className={`hover:bg-slate-50 cursor-pointer transition-colors ${selectedTx?.id === tx.id ? 'bg-indigo-50/30' : ''}`}
                                    >
                                        <td className="px-4 py-4">
                                            <div className="text-[11px] font-black text-slate-900">{tx.transaction_reference}</div>
                                            <div className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter">{tx.id.slice(0, 8)}...</div>
                                        </td>
                                        <td className="px-4 py-4">
                                            <div className="text-[11px] font-bold text-slate-700 truncate max-w-[150px]">{tx.job_name || 'N/A'}</div>
                                        </td>
                                        <td className="px-4 py-4 text-right font-black text-slate-900 text-xs">
                                            {parseFloat(tx.gross_amount).toFixed(2)} {tx.currency}
                                        </td>
                                        <td className="px-4 py-4 text-right font-black text-emerald-600 text-xs">
                                            {parseFloat(tx.platform_fee).toFixed(2)} {tx.currency}
                                        </td>
                                        <td className="px-4 py-4">
                                            <span className={`text-[8px] font-black px-1.5 py-0.5 rounded border uppercase tracking-widest ${tx.transaction_status === 'SETTLED' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                                tx.transaction_status === 'FAILED' ? 'bg-red-50 text-red-600 border-red-100' :
                                                    tx.transaction_status === 'CREATED' ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-amber-50 text-amber-600 border-amber-100'
                                                }`}>
                                                {tx.transaction_status}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Ledger Inspector */}
                <div className="lg:col-span-1">
                    {selectedTx ? (
                        <div className="space-y-4">
                            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                                <h3 className="text-sm font-black text-slate-900 tracking-tight flex items-center gap-2 mb-4">
                                    <IdentificationIcon className="w-4 h-4 text-indigo-500" />
                                    Ledger Inspector
                                </h3>
                                <div className="space-y-3">
                                    {selectedTx.ledger.map((entry: any, i: number) => (
                                        <div key={i} className={`p-3 rounded-xl border flex justify-between items-center ${entry.entry_type === 'DEBIT' ? 'bg-red-50/30 border-red-100' : 'bg-emerald-50/30 border-emerald-100'
                                            }`}>
                                            <div>
                                                <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{entry.account_type}</div>
                                                <div className="text-[10px] font-black text-slate-900">{entry.entry_type}</div>
                                            </div>
                                            <div className={`text-xs font-black ${entry.entry_type === 'DEBIT' ? 'text-red-500' : 'text-emerald-500'}`}>
                                                {parseFloat(entry.amount).toFixed(2)} {entry.currency}
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div className="mt-6 pt-6 border-t border-slate-100">
                                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Documents & Audit</h4>
                                    <div className="space-y-2">
                                        {selectedTx.invoices.map((inv: any, i: number) => (
                                            <div key={i} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                                                <div className="flex items-center gap-2">
                                                    <DocumentTextIcon className="w-3 h-3 text-slate-400" />
                                                    <span className="text-[10px] font-bold text-slate-600">{inv.invoice_number}</span>
                                                </div>
                                                <span className="text-[8px] font-black text-indigo-500 uppercase">{inv.invoice_type}</span>
                                            </div>
                                        ))}
                                        {selectedTx.payouts.map((p: any, i: number) => (
                                            <div key={i} className="flex items-center justify-between p-2 bg-emerald-50/50 rounded-lg border border-emerald-100/50">
                                                <div className="flex items-center gap-2">
                                                    <CheckCircleIcon className="w-3 h-3 text-emerald-500" />
                                                    <span className="text-[10px] font-bold text-emerald-600">{p.payout_status}</span>
                                                </div>
                                                <span className="text-[8px] font-black text-emerald-500 uppercase">{p.external_reference || 'TBD'}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="h-full min-h-[400px] bg-slate-50/50 rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 space-y-3">
                            <CurrencyEuroIcon className="w-12 h-12 opacity-20" />
                            <p className="font-black uppercase text-[10px] tracking-widest opacity-40">Select transaction to inspect ledger</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
