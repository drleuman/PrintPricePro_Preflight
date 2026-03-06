import React from 'react';

interface RiskMeterProps {
    score: number; // 0 to 100, where 0 is perfect and 100 is critical risk
}

export const RiskMeter: React.FC<RiskMeterProps> = ({ score }) => {
    const getColor = () => {
        if (score < 20) return '#10B981'; // Emerald (Low)
        if (score < 60) return '#F59E0B'; // Amber (Medium)
        return '#EF4444'; // Red (High)
    };

    const getLabel = () => {
        if (score < 20) return 'LOW RISK';
        if (score < 60) return 'MODERATE RISK';
        return 'CRITICAL RISK';
    };

    return (
        <div className="flex flex-col gap-2">
            <div className="flex justify-between items-end">
                <span className="text-[10px] font-black tracking-widest text-slate-400 uppercase">Printability Risk</span>
                <span className="text-xs font-black" style={{ color: getColor() }}>{getLabel()}</span>
            </div>
            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden flex">
                <div
                    className="h-full transition-all duration-1000 ease-out"
                    style={{
                        width: `${Math.max(5, score)}%`,
                        backgroundColor: getColor(),
                        boxShadow: `0 0 10px ${getColor()}44`
                    }}
                />
            </div>
            <p className="text-[9px] text-slate-400 font-medium">
                {score < 20
                    ? 'Document adheres to strict production standards.'
                    : score < 60
                        ? 'Minor issues detected. AI-Fix recommended for stability.'
                        : 'Significant rendering risks detected. Review required.'}
            </p>
        </div>
    );
};
