import React, { useState } from 'react';

interface PdfComparisonViewerProps {
    originalUrl: string | null;
    fixedUrl: string | null;
}

export const PdfComparisonViewer: React.FC<PdfComparisonViewerProps> = ({ originalUrl, fixedUrl }) => {
    const [view, setView] = useState<'side-by-side' | 'toggle'>('toggle');
    const [showFixed, setShowFixed] = useState(true);

    if (!originalUrl || !fixedUrl) return null;

    return (
        <div className="v2-report-glass" style={{ marginTop: '1.5rem', overflow: 'hidden' }}>
            <div className="flex justify-between items-center mb-4">
                <h3 className="v2-section-title" style={{ margin: 0 }}>Visual Comparison</h3>
                <div className="v2-view-switch">
                    <button className={view === 'toggle' ? 'active' : ''} onClick={() => setView('toggle')}>Toggle</button>
                    <button className={view === 'side-by-side' ? 'active' : ''} onClick={() => setView('side-by-side')}>Side-by-Side</button>
                </div>
            </div>

            {view === 'toggle' ? (
                <div className="relative aspect-[1.414/1] bg-slate-900 rounded-lg overflow-hidden border border-slate-800">
                    <iframe
                        src={showFixed ? fixedUrl : originalUrl}
                        className="w-full h-full border-none"
                        title="PDF Viewer"
                    />
                    <div className="absolute top-4 left-4 flex gap-2">
                        <button
                            onClick={() => setShowFixed(false)}
                            className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all ${!showFixed ? 'bg-red-600 text-white' : 'bg-slate-800/80 text-slate-300'}`}
                        >
                            Original
                        </button>
                        <button
                            onClick={() => setShowFixed(true)}
                            className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all ${showFixed ? 'bg-emerald-600 text-white' : 'bg-slate-800/80 text-slate-300'}`}
                        >
                            AI Fixed
                        </button>
                    </div>
                    <div className="absolute bottom-4 right-4 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-md text-[10px] font-medium text-slate-300 border border-white/10">
                        {showFixed ? '🎯 AI corrected rendering' : '⚠️ Original document pitfalls'}
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-2 gap-4 h-[500px]">
                    <div className="flex flex-col gap-2">
                        <span className="text-[10px] font-black text-slate-500 uppercase">Original</span>
                        <iframe src={originalUrl} className="w-full h-full rounded-lg border border-slate-800 bg-slate-900" title="Original PDF" />
                    </div>
                    <div className="flex flex-col gap-2">
                        <span className="text-[10px] font-black text-emerald-500 uppercase">Fixed</span>
                        <iframe src={fixedUrl} className="w-full h-full rounded-lg border border-emerald-500/30 bg-slate-900" title="Fixed PDF" />
                    </div>
                </div>
            )}
        </div>
    );
};
