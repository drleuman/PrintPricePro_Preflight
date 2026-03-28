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

    // Gauge calculations
    const radius = 36;
    const circumference = 2 * Math.PI * radius;
    // We only show 75% of the circle as a gauge
    const arcLength = circumference * 0.75;
    const offset = arcLength - (score / 100) * arcLength;

    return (
        <div className="flex flex-col items-center gap-4 p-4 bg-[var(--bg-secondary)] backdrop-blur-xl rounded-3xl border border-[var(--border-color)] shadow-xl">
            <div className="relative w-32 h-32">
                <svg className="w-full h-full -rotate-[225deg]" viewBox="0 0 100 100">
                    <circle
                        cx="50"
                        cy="50"
                        r={radius}
                        fill="none"
                        stroke="currentColor"
                        className="text-[var(--border-color)]"
                        strokeWidth="8"
                        strokeDasharray={`${arcLength} ${circumference}`}
                        strokeLinecap="round"
                    />
                    {/* Progress Arc */}
                    <circle
                        cx="50"
                        cy="50"
                        r={radius}
                        fill="none"
                        stroke={getColor()}
                        strokeWidth="8"
                        strokeDasharray={`${arcLength} ${circumference}`}
                        strokeDashoffset={offset}
                        strokeLinecap="round"
                        className="transition-all duration-1000 ease-out"
                        style={{
                            filter: `drop-shadow(0 0 8px ${getColor()}44)`
                        }}
                    />
                </svg>
                {/* Center Content */}
                <div className="absolute inset-0 flex flex-col items-center justify-center translate-y-2">
                    <span className="text-2xl font-black text-[var(--text-primary)] leading-none">{score}</span>
                    <span className="text-[10px] font-black tracking-widest text-[var(--text-muted)] uppercase mt-1">Score</span>
                </div>
            </div>

            <div className="text-center">
                <div className="text-xs font-black tracking-[0.2em] mb-1" style={{ color: getColor() }}>
                    {getLabel()}
                </div>
                <p className="text-[10px] text-[var(--text-muted)] font-medium max-w-[140px] leading-relaxed mx-auto">
                    {score < 20
                        ? 'Document adheres to strict production standards.'
                        : score < 60
                            ? 'Minor issues detected. AI-Fix recommended for stability.'
                            : 'Significant rendering risks detected. Review required.'}
                </p>
            </div>
        </div>
    );
};
